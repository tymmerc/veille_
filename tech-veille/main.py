#!/usr/bin/env python3
"""Tech Veille — collecte, resume et envoie des digests Discord personnalises."""

from __future__ import annotations

import logging
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

import config  # noqa: F401 — loads .env
from sources.base import Article
from sources.reddit import RedditSource
from sources.hackernews import HackerNewsSource
from sources.rss import RSSSource
from sources.arxiv import ArxivSource
from sources.blog_scraper import BlogScraperSource
from sources.github_releases import GitHubReleasesSource
from summarizer import process_articles
from storage import (
    filter_new, save_articles, purge_old,
    get_all_enabled_sources, get_users_with_webhooks,
    get_all_user_preferences, filter_for_user,
    is_user_scheduled_now, get_unsent_articles_for_user,
    mark_user_notified,
)
from notifier import send_discord, send_slack

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("veille")


def collect(source_config: dict) -> list[Article]:
    """Fetch articles from all sources in parallel, using dynamic config from DB."""
    sources = []

    if source_config.get("subreddits"):
        sources.append(RedditSource(subreddits=source_config["subreddits"]))
    if source_config.get("hn_enabled"):
        sources.append(HackerNewsSource(
            enabled=True,
            keywords=source_config.get("hn_keywords") or None,
        ))
    if source_config.get("rss_feeds") or source_config.get("nitter_feeds"):
        rss_feeds = dict(source_config.get("rss_feeds", {}))
        # Add Nitter RSS feeds for followed Twitter accounts
        nitter_feeds = source_config.get("nitter_feeds", [])
        if nitter_feeds:
            existing = rss_feeds.get("twitter", [])
            rss_feeds["twitter"] = existing + list(nitter_feeds)
            log.info("Added %d Nitter feeds for followed Twitter accounts", len(nitter_feeds))
        sources.append(RSSSource(feeds=rss_feeds))
    if source_config.get("arxiv_categories"):
        sources.append(ArxivSource(categories=source_config["arxiv_categories"]))

    # Always scrape official tech blogs
    sources.append(BlogScraperSource())

    # Track GitHub releases for repos configured by users (from their promptConfig)
    github_repos = source_config.get("github_repos", [])
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
        return []

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
                source_stats[name] = len(result)
                log.info("%s → %d articles", name, len(result))
            except Exception:
                source_stats[name] = -1  # mark as failed
                log.exception("Source %s failed", name)

    # Per-source summary
    summary_parts = []
    for src, count in sorted(source_stats.items()):
        summary_parts.append(f"{src}={'FAILED' if count < 0 else count}")
    log.info("Collection stats: %s", ", ".join(summary_parts) if summary_parts else "no sources")

    return articles


def run_fast() -> None:
    """Fast collection mode: collect + save WITHOUT Ollama scoring.
    Used for first-time prompt submission so articles appear immediately."""
    t_start = time.monotonic()
    log.info("=== Veille tech FAST mode ===")

    source_config = get_all_enabled_sources()
    raw = collect(source_config)
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
        "Config: %d subreddit groups, %d RSS groups, %d arxiv cats, HN=%s (%d kw), %d nitter feeds, %d blog accounts",
        len(source_config.get("subreddits", {})),
        len(source_config.get("rss_feeds", {})),
        len(source_config.get("arxiv_categories", [])),
        source_config.get("hn_enabled", False),
        len(source_config.get("hn_keywords", [])),
        len(source_config.get("nitter_feeds", [])),
        len(source_config.get("blog_accounts", [])),
    )

    # 2. Collect from all sources
    raw = collect(source_config)
    log.info("Total brut : %d articles", len(raw))

    if not raw:
        log.info("Aucun article trouve, fin")
        return

    # 3. Deduplicate against database
    new = filter_new(raw)
    log.info("Nouveaux articles : %d (apres dedup)", len(new))

    if not new:
        log.info("Rien de nouveau, fin")
        return

    # 4. Score and summarize via Ollama (with user preferences)
    user_prefs = get_all_user_preferences()
    if user_prefs:
        log.info("Preferences utilisateur chargees (%d chars)", len(user_prefs))
    scored = process_articles(new, user_prefs=user_prefs)
    log.info("Articles retenus (score >= %d) : %d", config.MIN_SCORE, len(scored))

    if not scored:
        log.info("Aucun article pertinent, fin")
        return

    # 5. Save to database
    save_articles(scored)

    # 6. Send personalized digests (accumulated articles, not just this batch)
    users = get_users_with_webhooks()
    log.info("Users avec webhook : %d", len(users))

    for user in users:
        if not is_user_scheduled_now(user):
            log.info("Hors planning pour %s, skip notification", user["username"])
            continue

        # Get all articles since last notification (not just this batch)
        all_recent = get_unsent_articles_for_user(user, hours=24)
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

    # 7. Purge old entries
    purge_old(days=30)

    elapsed = time.monotonic() - t_start
    log.info("=== Veille tech terminee en %.1fs ===", elapsed)


if __name__ == "__main__":
    try:
        if "--fast" in sys.argv:
            run_fast()
        else:
            run()
    except Exception:
        log.exception("Erreur fatale")
        sys.exit(1)
