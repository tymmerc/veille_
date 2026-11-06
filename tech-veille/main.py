#!/usr/bin/env python3
"""Tech Veille — collecte, resume et envoie des digests Discord personnalises."""

from __future__ import annotations

import logging
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import config  # noqa: F401 — loads .env
import health
import stack
import stack_watch
import market_brief
import analysis
import zotero_sync
from sources.base import Article
from sources.reddit import RedditSource
from sources.hackernews import HackerNewsSource
from sources.rss import RSSSource
from sources.arxiv import ArxivSource
from sources.blog_scraper import BlogScraperSource
from sources.github_releases import GitHubReleasesSource
from sources.release_notes import ReleaseNotesSource
from summarizer import process_articles
from content import enrich
import notify_rules
from storage import (
    filter_new, save_articles, purge_old,
    get_all_enabled_sources, get_users_with_webhooks,
    get_all_user_preferences, filter_for_user,
    get_unsent_articles_for_user,
    mark_user_notified, get_admin_webhook,
)
from notifier import send_alert, send_discord, send_instant, send_slack, send_stack_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("veille")


def collect(source_config: dict) -> tuple[list[Article], list[health.Check]]:
    """Fetch articles from all sources in parallel, using dynamic config from DB.

    Returns the articles and one health check per feed/endpoint tried.
    """
    sources = []

    if source_config.get("subreddits"):
        sources.append(RedditSource(subreddits=source_config["subreddits"]))
    stack_words = stack_watch.stack_keywords()
    hn_keywords = list(source_config.get("hn_keywords") or [])
    hn_keywords += [q for q in stack.news_queries(stack_words) if q not in hn_keywords]
    if hn_keywords:
        sources.append(HackerNewsSource(enabled=True, keywords=hn_keywords))
    rss_feeds = {k: list(v) for k, v in (source_config.get("rss_feeds") or {}).items()}
    if stack_words:
        rss_feeds["cyber"] = [f for f in config.SECURITY_FEEDS
                              if f not in {u for v in rss_feeds.values() for u in v}]
    if any(rss_feeds.values()):
        sources.append(RSSSource(feeds=rss_feeds))
    if source_config.get("twitter_accounts"):
        log.info(
            "Twitter skipped for %s: no free RSS bridge works any more (Nitter is closed)",
            ", ".join(source_config["twitter_accounts"]),
        )
    if source_config.get("arxiv_categories"):
        sources.append(ArxivSource(
            categories=source_config["arxiv_categories"],
            keywords=source_config.get("keywords", []),
        ))

    # Always scrape official tech blogs and official release notes
    sources.append(BlogScraperSource())
    sources.append(ReleaseNotesSource())

    # Track GitHub releases for repos configured by users (from their promptConfig)
    github_repos = list(source_config.get("github_repos", []))
    followed = {r.get("repo") for r in github_repos}
    github_repos += [r for r in stack.stack_repos(stack_words) if r["repo"] not in followed]
    if github_repos:
        sources.append(GitHubReleasesSource(repos=github_repos))
        log.info("Tracking %d GitHub repos for releases", len(github_repos))

    # Add user-followed blog accounts as additional blog scrapers
    blog_accounts = source_config.get("blog_accounts", [])
    if blog_accounts:
        extra_blog_configs = [
            {
                "name": account["name"],
                "urls": [account["url"]],
                "article_selector": "a[href]",
                "base_url": account["url"].rstrip("/"),
                "category": "tech",
                "is_official": False,
            }
            for account in blog_accounts
        ]
        sources.append(BlogScraperSource(blog_configs=extra_blog_configs))
        log.info("Added %d user-followed blog accounts", len(blog_accounts))

    if not sources:
        log.warning("No sources enabled by any user")
        return [], []

    articles: list[Article] = []
    source_stats: Counter = Counter()

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(source.fetch): type(source).__name__
            for source in sources
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                result = future.result()
                articles.extend(result)
                source_stats[name] = source_stats.get(name, 0) + len(result)  # 2 blog scrapers
                log.info("%s → %d articles", name, len(result))
            except Exception:
                source_stats[name] = -1  # mark as failed
                log.exception("Source %s failed", name)

    # Per-source summary
    summary_parts = []
    for src, count in sorted(source_stats.items()):
        summary_parts.append(f"{src}={'FAILED' if count < 0 else count}")
    log.info("Collection stats: %s", ", ".join(summary_parts) if summary_parts else "no sources")

    checks = [c for source in sources for c in getattr(source, "checks", [])]
    return articles, checks


# Official sources first, arXiv last, when a run has more new articles than the cap.
PLATFORM_PRIORITY = {"github": 0, "release_notes": 0, "blog": 1, "rss": 2, "hackernews": 3,
                     "reddit": 4, "arxiv": 5}


def prioritize(articles: list[Article], limit: int) -> list[Article]:
    """Return at most `limit` articles, most trusted platforms first (stable order)."""
    ranked = sorted(articles, key=lambda a: PLATFORM_PRIORITY.get(a.platform, 4))
    return ranked[:limit]


def check_stack() -> None:
    """Once a day: known flaws in the stack, sent privately to the admin."""
    if not stack_watch.due():
        return
    try:
        lines, state = stack_watch.run()
    except Exception:
        log.exception("Stack watch failed, will retry next run")
        return
    stack_watch.mark_done()
    if not lines:
        stack_watch.save_seen(state)
        return
    webhook = get_admin_webhook(config.ADMIN_USERNAME)
    if not webhook:
        log.warning("No admin webhook: stack report only in data/stack-report.md")
        stack_watch.save_seen(state)
        return
    if send_stack_report(stack_watch.blocks(lines), webhook):
        log.info("Rapport de failles de la stack envoyé (%d lignes)", len(lines))
        stack_watch.save_seen(state)


def stack_floor(words: list[str]):
    """Score floor: security news about our own stack is never under 8."""
    def floor(article: Article) -> int:
        text = f"{article.title} {article.text[:1500]}"
        if stack.stack_security_hits(text, words):
            article.category = "cyber"
            return 8
        return 0
    return floor


def report_health(checks: list[health.Check]) -> None:
    """Update the health file and warn the admin on Discord when a source stays down."""
    down = [c for c in checks if not c.ok]
    if down:
        log.warning("Sources en échec ce passage : %s", "; ".join(f"{c.key} ({c.detail})" for c in down))
    else:
        log.info("Toutes les sources ont répondu (%d)", len(checks))

    try:
        state = health.load_state()
        new_state, alerts = health.update_health(state, checks, datetime.now(timezone.utc))
        health.save_state(health.STATE_PATH, new_state)
    except Exception:
        log.exception("Health state update failed")
        return

    if not alerts:
        return
    for line in alerts:
        log.warning("Alerte santé : %s", line)
    webhook = get_admin_webhook(config.ADMIN_USERNAME)
    if not webhook:
        log.warning("No Discord webhook for %s, health alert only in logs", config.ADMIN_USERNAME)
        return
    if send_alert(alerts, webhook):
        log.info("Alerte santé envoyée sur Discord (%d lignes)", len(alerts))


def run_fast() -> None:
    """Fast collection mode: collect + save WITHOUT Ollama scoring.
    Used for first-time prompt submission so articles appear immediately."""
    t_start = time.monotonic()
    log.info("=== Veille tech FAST mode ===")

    source_config = get_all_enabled_sources()
    raw, _checks = collect(source_config)  # health is tracked by the hourly run only
    log.info("Total brut : %d articles", len(raw))

    if not raw:
        log.info("Aucun article, fin")
        return

    new = filter_new(raw)
    log.info("Nouveaux : %d (apres dedup)", len(new))

    if not new:
        log.info("Rien de nouveau, fin")
        return

    # Assign default score (5) and skip Ollama entirely
    for a in new:
        a.score = 9 if a.platform == "github" else 5
        a.summary = ""
        a.title_original = a.title

    save_articles(new)
    elapsed = time.monotonic() - t_start
    log.info("=== Fast mode termine en %.1fs (%d articles) ===", elapsed, len(new))


def run() -> None:
    t_start = time.monotonic()
    log.info("=== Veille tech demarree ===")

    # 1. Load dynamic config from PostgreSQL (union of all users' prompt_config)
    source_config = get_all_enabled_sources()
    log.info(
        "Config: %d subreddit groups, %d RSS groups, %d arxiv cats, HN=%s (%d kw), %d twitter accounts, %d blog accounts",
        len(source_config.get("subreddits", {})),
        len(source_config.get("rss_feeds", {})),
        len(source_config.get("arxiv_categories", [])),
        source_config.get("hn_enabled", False),
        len(source_config.get("hn_keywords", [])),
        len(source_config.get("twitter_accounts", [])),
        len(source_config.get("blog_accounts", [])),
    )

    # 2. Collect from all sources, then record which ones answered
    raw, checks = collect(source_config)
    report_health(checks)
    check_stack()
    market_brief.run_all(datetime.now(timezone.utc), lambda: get_admin_webhook(config.ADMIN_USERNAME))
    analysis.maybe_run(datetime.now(timezone.utc), lambda: get_admin_webhook(config.ADMIN_USERNAME))
    log.info("Total brut : %d articles", len(raw))

    stack_words = stack_watch.stack_keywords()
    scored = process_new(raw, stack_words)

    # 6. Notifications: instant alerts for this run, summaries on their schedule
    notify_users(scored, stack_words)

    # Bookmarks of the admin → Zotero (does nothing until ZOTERO_API_KEY is set)
    try:
        zotero_sync.run()
    except Exception:
        log.exception("Zotero sync failed")

    # 7. Purge old entries
    purge_old(days=30)

    elapsed = time.monotonic() - t_start
    log.info("=== Veille tech terminee en %.1fs ===", elapsed)


def process_new(raw: list[Article], stack_words: list[str]) -> list[Article]:
    """Dedup, cap, read pages, score, summarize, save. Returns what was saved."""
    if not raw:
        log.info("Aucun article trouve")
        return []

    # 3. Deduplicate against database
    new = filter_new(raw)
    log.info("Nouveaux articles : %d (apres dedup)", len(new))

    if not new:
        log.info("Rien de nouveau")
        return []
    if len(new) > config.MAX_NEW_PER_RUN:
        log.info("Plafond : %d traités ce passage, %d laissés au suivant", config.MAX_NEW_PER_RUN,
                 len(new) - config.MAX_NEW_PER_RUN)
        new = prioritize(new, config.MAX_NEW_PER_RUN)

    # Read the real page when a source only gave a title (scores and summaries need it)
    with ThreadPoolExecutor(max_workers=4) as pool:
        new = list(pool.map(enrich, new))

    # 4. Score and summarize via Ollama (with user preferences)
    user_prefs = get_all_user_preferences()
    if user_prefs:
        log.info("Preferences utilisateur chargees (%d chars)", len(user_prefs))
    scored = process_articles(new, user_prefs=user_prefs, floor=stack_floor(stack_words))
    log.info("Articles retenus (score >= %d) : %d", config.MIN_SCORE, len(scored))

    if scored:
        save_articles(scored)  # 5. Save to database
    return scored


def notify_users(fresh: list[Article], stack_words: list[str]) -> None:
    users = get_users_with_webhooks()
    log.info("Users avec webhook : %d", len(users))
    now = datetime.now(timezone.utc)

    for user in users:
        if user["username"] == config.ADMIN_USERNAME:
            user = {**user, "stack_keywords": stack_words, "always_sources": config.OFFICIAL_SOURCES}

        # Instant alert: important articles of this run, without waiting for the summary
        urgent = notify_rules.instant_articles(filter_for_user(fresh, user), user)
        if urgent and send_instant(urgent, user.get("webhook_url") or "", user.get("slack_webhook_url") or ""):
            log.info("Alerte immédiate envoyée à %s (%d articles)", user["username"], len(urgent))

        if not notify_rules.digest_due(user, now):
            log.info("Pas l'heure du résumé pour %s", user["username"])
            continue

        # Get all articles since last notification (not just this batch)
        all_recent = get_unsent_articles_for_user(user, hours=notify_rules.fallback_hours(user))
        user_articles = filter_for_user(all_recent, user)
        if not user_articles:
            log.info("Aucun article non-notifie pour %s", user["username"])
            continue

        sent = False
        # Discord
        if user.get("webhook_url"):
            ok = send_discord(user_articles, webhook_url=user["webhook_url"])
            if ok:
                log.info("Discord digest envoye a %s (%d articles)", user["username"], len(user_articles))
                sent = True
            else:
                log.error("Erreur Discord digest pour %s", user["username"])

        # Slack
        if user.get("slack_webhook_url"):
            ok = send_slack(user_articles, webhook_url=user["slack_webhook_url"])
            if ok:
                log.info("Slack digest envoye a %s (%d articles)", user["username"], len(user_articles))
                sent = True
            else:
                log.error("Erreur Slack digest pour %s", user["username"])

        if sent:
            mark_user_notified(user["id"])


if __name__ == "__main__":
    try:
        if "--fast" in sys.argv:
            run_fast()
        else:
            run()
    except Exception:
        log.exception("Erreur fatale")
        sys.exit(1)
