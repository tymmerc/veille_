from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor

import config
from sources.base import Article

log = logging.getLogger(__name__)


def _conn():
    return psycopg2.connect(config.DATABASE_URL)


def filter_new(articles: list[Article]) -> list[Article]:
    """Return only articles not already in the database."""
    if not articles:
        return []
    with _conn() as conn:
        with conn.cursor() as cur:
            new = []
            for a in articles:
                cur.execute(
                    "SELECT 1 FROM articles WHERE platform = %s AND external_id = %s",
                    (a.platform, a.external_id),
                )
                if not cur.fetchone():
                    new.append(a)
            return new


def save_articles(articles: list[Article]) -> int:
    """Save articles to database. Returns count of newly inserted."""
    count = 0
    with _conn() as conn:
        with conn.cursor() as cur:
            for a in articles:
                try:
                    cur.execute(
                        """INSERT INTO articles
                           (id, platform, external_id, title, url, text, summary, score, category, source, created_at, title_original, is_official)
                           VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (platform, external_id) DO NOTHING""",
                        (a.platform, a.external_id, a.title, a.url, a.text,
                         a.summary, a.score, a.category, a.source,
                         a.created_at.isoformat() if a.created_at else None,
                         getattr(a, 'title_original', '') or '',
                         getattr(a, 'is_official', False)),
                    )
                    count += cur.rowcount
                except Exception:
                    log.exception("Error saving article %s", a.external_id)
        conn.commit()
    log.info("Saved %d articles", count)
    return count


def purge_old(days: int = 30) -> int:
    """Delete articles older than `days`."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM articles WHERE found_at < %s", (cutoff,))
            deleted = cur.rowcount
        conn.commit()
    if deleted:
        log.info("Purged %d old articles", deleted)
    return deleted


def get_all_enabled_sources() -> dict:
    """Build unified source config from all users' prompt_config JSON.

    Each user's prompt_config has: subreddits, rss_feeds, arxiv_categories, hn_keywords.
    We union all users' configs into a single fetch config.
    """
    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT prompt_config FROM users WHERE prompt_config IS NOT NULL"
            )
            rows = cur.fetchall()

    all_subreddits: set[str] = set()
    all_rss_feeds: set[str] = set()
    all_arxiv_cats: set[str] = set()
    all_hn_keywords: set[str] = set()
    all_nitter_feeds: set[str] = set()
    all_blog_accounts: dict[str, str] = {}  # label -> url, dedup by url
    all_github_repos: dict[str, dict] = {}  # repo -> {repo, label, category}
    all_twitter_accounts: set[str] = set()

    NITTER_INSTANCES = [
        "https://nitter.net",
        "https://nitter.privacydev.net",
    ]

    for row in rows:
        pc = row["prompt_config"]
        if isinstance(pc, str):
            try:
                pc = json.loads(pc)
            except (json.JSONDecodeError, TypeError):
                continue
        if not isinstance(pc, dict):
            continue

        for sub in pc.get("subreddits", []):
            all_subreddits.add(sub)
        for feed in pc.get("rss_feeds", []):
            all_rss_feeds.add(feed)
        for cat in pc.get("arxiv_categories", []):
            all_arxiv_cats.add(cat)
        for kw in pc.get("hn_keywords", []):
            all_hn_keywords.add(kw)

        # Extract followed_accounts from prompt_config
        for account in pc.get("followed_accounts", []):
            platform = account.get("platform", "")
            handle = account.get("handle", "").strip().lstrip("@")
            label = account.get("label", handle)
            if not handle:
                continue

            if platform == "twitter":
                for instance in NITTER_INSTANCES:
                    all_nitter_feeds.add(f"{instance}/{handle}/rss")
            elif platform == "blog":
                url = handle if handle.startswith("http") else f"https://{handle}"
                all_blog_accounts[label or url] = url

        # GitHub repos to track releases
        for repo_cfg in pc.get("github_repos", []):
            repo = repo_cfg.get("repo", "")
            if repo and "/" in repo:
                all_github_repos[repo] = repo_cfg

        # Twitter accounts to follow via Nitter
        for acc in pc.get("twitter_accounts", []):
            acc = acc.strip().lstrip("@")
            if acc:
                all_twitter_accounts.add(acc)

    # Add twitter_accounts as Nitter RSS feeds
    for acc in all_twitter_accounts:
        for instance in NITTER_INSTANCES:
            all_nitter_feeds.add(f"{instance}/{acc}/rss")

    # Build a structure compatible with the existing source classes.
    # For subreddits, we don't have per-category info anymore, so use "tech" as default.
    subreddits: dict[str, list[str]] = {}
    if all_subreddits:
        subreddits["tech"] = list(all_subreddits)

    rss_feeds: dict[str, list[str]] = {}
    if all_rss_feeds:
        rss_feeds["tech"] = list(all_rss_feeds)

    # Convert blog accounts to list of {name, url} dicts
    blog_accounts = [
        {"name": name, "url": url}
        for name, url in all_blog_accounts.items()
    ]

    return {
        "subreddits": subreddits,
        "rss_feeds": rss_feeds,
        "arxiv_categories": list(all_arxiv_cats),
        "hn_enabled": len(all_hn_keywords) > 0,
        "hn_keywords": list(all_hn_keywords),
        "nitter_feeds": list(all_nitter_feeds),
        "blog_accounts": blog_accounts,
        "github_repos": list(all_github_repos.values()),
    }


def get_users_with_webhooks() -> list[dict]:
    """Get all users who have a webhook URL configured and notifications enabled."""
    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """SELECT id, discord_id, username, webhook_url, slack_webhook_url,
                          prompt_config, scoring_notes, min_score, notify_enabled,
                          sync_hours, sync_days, last_notified_at
                   FROM users
                   WHERE (webhook_url IS NOT NULL AND webhook_url != ''
                          OR slack_webhook_url IS NOT NULL AND slack_webhook_url != '')
                     AND notify_enabled = true"""
            )
            return cur.fetchall()


def is_user_scheduled_now(user: dict) -> bool:
    """Check if the current time matches the user's sync schedule.

    If no schedule is set (null), always allow notifications (every run).
    """
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_day = now.weekday()  # Monday=0 ... Sunday=6
    # Convert Python weekday (Mon=0) to JS weekday (Sun=0)
    js_day = (current_day + 1) % 7

    sync_hours = user.get("sync_hours")
    if isinstance(sync_hours, str):
        try:
            sync_hours = json.loads(sync_hours)
        except (json.JSONDecodeError, TypeError):
            sync_hours = None

    sync_days = user.get("sync_days")
    if isinstance(sync_days, str):
        try:
            sync_days = json.loads(sync_days)
        except (json.JSONDecodeError, TypeError):
            sync_days = None

    # No schedule configured = notify on every run that has articles
    if not sync_hours and not sync_days:
        return True

    # Partial config: use defaults for the missing part
    if not sync_hours:
        sync_hours = list(range(24))  # all hours
    if not sync_days:
        sync_days = [0, 1, 2, 3, 4, 5, 6]  # all days

    return current_hour in sync_hours and js_day in sync_days


def get_user_scoring_notes(user: dict) -> str:
    """Get a user's scoring notes (from Ollama prompt interpretation)."""
    return user.get("scoring_notes") or ""


def get_unsent_articles_for_user(user: dict, hours: int = 24) -> list[Article]:
    """Get articles created AFTER the user's last notification.
    Falls back to last N hours if no previous notification."""
    user_id = user["id"]
    fallback_since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Use last_notified_at to avoid re-sending the same articles
    last_notified = user.get("last_notified_at")
    if last_notified and isinstance(last_notified, datetime):
        since = last_notified
    elif last_notified and isinstance(last_notified, str):
        try:
            since = datetime.fromisoformat(last_notified)
        except (ValueError, TypeError):
            since = fallback_since
    else:
        since = fallback_since

    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """SELECT id, platform, external_id, title, url, text, summary,
                          score, category, source, created_at, title_original, is_official
                   FROM articles
                   WHERE created_at > %s
                     AND score >= %s
                   ORDER BY score DESC, created_at DESC""",
                (since, user.get("min_score") or 4),
            )
            rows = cur.fetchall()

    # Convert to Article objects for filter_for_user and notifier
    articles = []
    for r in rows:
        a = Article(
            platform=r["platform"],
            external_id=r["external_id"],
            title=r["title"],
            url=r["url"],
            text=r.get("text") or "",
            source=r["source"],
            category=r.get("category") or "tech",
            created_at=r["created_at"],
        )
        a.summary = r.get("summary") or ""
        a.score = r.get("score") or 0
        a.title_original = r.get("title_original") or ""
        a.is_official = r.get("is_official", False)
        articles.append(a)

    return articles


def mark_user_notified(user_id: str) -> None:
    """Update the last_notified_at timestamp for a user."""
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE users SET last_notified_at = %s WHERE id = %s""",
                (datetime.now(timezone.utc), user_id),
            )
        conn.commit()


def get_all_user_preferences() -> str:
    """Get combined scoring notes from all users (for global scoring)."""
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT scoring_notes FROM users WHERE scoring_notes IS NOT NULL AND scoring_notes != ''"
            )
            rows = cur.fetchall()
    if not rows:
        return ""
    return "\n---\n".join(row[0] for row in rows)


def filter_for_user(articles: list[Article], user: dict) -> list[Article]:
    """Filter articles to match a user's prompt_config keywords."""
    pc = user.get("prompt_config")
    if isinstance(pc, str):
        try:
            pc = json.loads(pc)
        except (json.JSONDecodeError, TypeError):
            return articles  # No config = gets everything

    if not isinstance(pc, dict):
        return articles

    # Build keyword set for matching
    keywords = set()
    for kw in pc.get("keywords", []):
        keywords.add(kw.lower())
    for kw in pc.get("hn_keywords", []):
        keywords.add(kw.lower())

    # Also match by subreddit/source
    subreddits = {f"r/{s}".lower() for s in pc.get("subreddits", [])}

    min_score = user.get("min_score", 6) or 6

    # Also match by RSS feed domain
    rss_domains = set()
    for feed_url in pc.get("rss_feeds", []):
        try:
            from urllib.parse import urlparse
            rss_domains.add(urlparse(feed_url).netloc.lower())
        except Exception:
            pass

    result = []
    for a in articles:
        if a.score < min_score:
            continue

        # Match by subreddit source
        if a.source.lower() in subreddits:
            result.append(a)
            continue

        # Match by keyword in title + summary (word-boundary for single words)
        text_lower = f"{a.title} {a.summary or ''}".lower()
        matched = False
        for kw in keywords:
            if ' ' in kw:
                # Multi-word: substring match is fine
                if kw in text_lower:
                    matched = True
                    break
            else:
                # Single word: use word boundary to avoid "code" matching "barcode"
                if re.search(rf'\b{re.escape(kw)}\b', text_lower):
                    matched = True
                    break
        if matched:
            result.append(a)
            continue

        # Match RSS by domain
        if a.platform == "rss" and rss_domains:
            try:
                from urllib.parse import urlparse
                article_domain = urlparse(a.url).netloc.lower()
                if any(d in article_domain for d in rss_domains):
                    result.append(a)
                    continue
            except Exception:
                pass

    return result
