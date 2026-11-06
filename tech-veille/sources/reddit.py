from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import feedparser
from bs4 import BeautifulSoup

import config
from . import net
from .base import Article, BaseSource

log = logging.getLogger(__name__)

# Without API keys we read Reddit's public Atom feed. Reddit rate-limits
# anonymous clients hard (429 after one or two calls), so every subreddit goes
# into ONE multireddit request: /r/a+b+c/top/.rss
PUBLIC_FEED = "https://www.reddit.com/r/{subs}/top/.rss"
SUBS_PER_REQUEST = 20
WAIT_ON_429 = 30


class RedditSource(BaseSource):

    def __init__(self, subreddits: dict[str, list[str]] | None = None):
        self.subreddits = subreddits or {}

    def fetch(self) -> list[Article]:
        if not self.subreddits:
            log.info("Reddit: no subreddits configured, skipping")
            return []
        if config.REDDIT_CLIENT_ID and config.REDDIT_SECRET:
            articles = self._fetch_api()
        else:
            log.info("Reddit: no API keys, using the public feed")
            articles = self._fetch_public()
        log.info("Reddit: %d articles collected", len(articles))
        return articles

    # ─── Public feed (no keys) ────────────────────────────────────

    def _fetch_public(self) -> list[Article]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=config.MAX_AGE_HOURS)
        articles: list[Article] = []
        seen_ids: set[str] = set()

        for category, subs in self.subreddits.items():
            clean = [s.strip().removeprefix("r/") for s in subs if s.strip()]
            for i in range(0, len(clean), SUBS_PER_REQUEST):
                chunk = clean[i:i + SUBS_PER_REQUEST]
                url = PUBLIC_FEED.format(subs="+".join(chunk))
                try:
                    resp = net.get(url, params={"t": "day", "limit": 50}, wait_on_429=WAIT_ON_429)
                except Exception as exc:
                    reason = net.describe_error(exc)
                    log.warning("Reddit public feed failed for %s (%s)", "+".join(chunk), reason)
                    self._note("Reddit", False, reason)
                    continue
                self._note("Reddit", True)

                for entry in feedparser.parse(resp.content).entries:
                    article = self._entry_to_article(entry, category, cutoff, seen_ids)
                    if article:
                        articles.append(article)
        return articles

    @staticmethod
    def _entry_to_article(entry, category: str, cutoff: datetime, seen_ids: set[str]) -> Article | None:
        raw_id = entry.get("id", "") or entry.get("link", "")
        post_id = raw_id.removeprefix("t3_") if raw_id.startswith("t3_") else hashlib.sha256(
            raw_id.encode()).hexdigest()[:16]
        if not raw_id or post_id in seen_ids:
            return None
        seen_ids.add(post_id)

        title = entry.get("title", "")
        link = entry.get("link", "")
        if not title or not link:
            return None

        created = _entry_date(entry)
        if created and created < cutoff:
            return None

        tags = entry.get("tags") or []
        sub = tags[0].get("term", "") if tags else ""
        html = entry.get("summary", "") or ""
        text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

        return Article(
            title=title[:500],
            url=link,
            text=text[:3000],
            source=f"r/{sub}" if sub else "Reddit",
            category=category,
            platform="reddit",
            external_id=post_id,
            created_at=created or datetime.now(timezone.utc),
        )

    # ─── Official API (keys in .env) ──────────────────────────────

    def _fetch_api(self) -> list[Article]:
        import praw  # only needed when keys exist

        reddit = praw.Reddit(
            client_id=config.REDDIT_CLIENT_ID,
            client_secret=config.REDDIT_SECRET,
            user_agent=config.REDDIT_USER_AGENT,
        )

        cutoff = datetime.now(timezone.utc) - timedelta(hours=config.MAX_AGE_HOURS)
        articles: list[Article] = []
        seen_ids: set[str] = set()

        for category, subreddits in self.subreddits.items():
            for sub_name in subreddits:
                try:
                    subreddit = reddit.subreddit(sub_name)
                    for post in subreddit.hot(limit=50):
                        if post.id in seen_ids:
                            continue
                        seen_ids.add(post.id)

                        created = datetime.fromtimestamp(post.created_utc, tz=timezone.utc)
                        if created < cutoff:
                            continue
                        if post.score < config.MIN_UPVOTES_REDDIT:
                            continue
                        if post.stickied:
                            continue

                        articles.append(Article(
                            title=post.title[:500],
                            url=f"https://reddit.com{post.permalink}",
                            text=(post.selftext or "")[:3000],
                            source=f"r/{sub_name}",
                            category=category,
                            platform="reddit",
                            external_id=post.id,
                            created_at=created,
                        ))
                    self._note(f"Reddit r/{sub_name}", True)
                except Exception as exc:
                    log.exception("Error fetching r/%s", sub_name)
                    self._note(f"Reddit r/{sub_name}", False, net.describe_error(exc))
        return articles


def _entry_date(entry) -> datetime | None:
    for field in ("published_parsed", "updated_parsed"):
        raw = entry.get(field)
        if raw:
            return datetime(*raw[:6], tzinfo=timezone.utc)
    return None
