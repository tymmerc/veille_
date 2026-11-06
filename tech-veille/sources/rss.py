from __future__ import annotations

import logging
import hashlib
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

from urllib.parse import urlparse

import feedparser

import config
from . import net
from .base import Article, BaseSource

log = logging.getLogger(__name__)

# Feeds that moved or died. Old user configs (and veille-app's suggestions)
# still point at them, so we rewrite them instead of failing every hour.
FEED_REDIRECTS = {
    "https://blog.openai.com/rss/": "https://openai.com/news/rss.xml",
    "https://blog.openai.com/rss": "https://openai.com/news/rss.xml",
    "https://feeds.technologyreview.com/technologyreview/ai/":
        "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    "https://feeds.technologyreview.com/technologyreview/ai":
        "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    "https://thisweekinreact.com/rss.xml": "https://thisweekinreact.com/newsletter/rss.xml",
}


def normalize_feed_url(url: str) -> str:
    return FEED_REDIRECTS.get(url.strip(), url.strip())


def feed_label(url: str) -> str:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return f"RSS {host or url}"


class RSSSource(BaseSource):

    def __init__(self, feeds: dict[str, list[str]] | None = None):
        self.feeds = {
            category: list(dict.fromkeys(normalize_feed_url(u) for u in urls))
            for category, urls in (feeds or {}).items()
        }

    def fetch(self) -> list[Article]:
        if not self.feeds:
            log.info("RSS: no feeds configured, skipping")
            return []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=config.MAX_AGE_HOURS)
        articles: list[Article] = []
        seen_urls: set[str] = set()

        for category, feeds in self.feeds.items():
            for feed_url in feeds:
                try:
                    self._parse_feed(feed_url, category, cutoff, articles, seen_urls)
                except Exception:
                    log.exception("Error parsing RSS feed %s (category=%s)", feed_url, category)

        log.info("RSS: %d articles collected", len(articles))
        return articles

    def _parse_feed(
        self,
        feed_url: str,
        category: str,
        cutoff: datetime,
        articles: list[Article],
        seen_urls: set[str],
    ) -> None:
        try:
            raw_feed = net.get(feed_url).content
        except Exception as exc:
            reason = net.describe_error(exc)
            log.warning("Failed to download RSS feed %s (%s)", feed_url, reason)
            self._note(feed_label(feed_url), False, reason)
            return

        feed = feedparser.parse(raw_feed)

        if feed.bozo and not feed.entries:
            log.warning("RSS feed %s returned invalid data: %s", feed_url, feed.get("bozo_exception", "unknown"))
            self._note(feed_label(feed_url), False, "flux illisible")
            return
        self._note(feed_label(feed_url), True)

        feed_title = feed.feed.get("title", feed_url)

        for entry in feed.entries[:20]:
            link = entry.get("link", "")
            if not link or link in seen_urls:
                continue
            seen_urls.add(link)

            published = self._parse_date(entry)
            if published and published < cutoff:
                continue

            title = entry.get("title", "")
            if not title:
                continue

            summary = entry.get("summary", "") or entry.get("description", "")
            ext_id = hashlib.sha256(link.encode()).hexdigest()[:16]

            articles.append(Article(
                title=title[:500],
                url=link,
                text=summary[:3000],
                source=feed_title,
                category=category,
                platform="rss",
                external_id=ext_id,
                created_at=published or datetime.now(timezone.utc),
            ))

    @staticmethod
    def _parse_date(entry) -> datetime | None:
        for field in ("published", "updated", "created"):
            raw = entry.get(f"{field}_parsed")
            if raw:
                try:
                    from time import mktime
                    return datetime.fromtimestamp(mktime(raw), tz=timezone.utc)
                except Exception:
                    pass
            raw_str = entry.get(field, "")
            if raw_str:
                try:
                    return parsedate_to_datetime(raw_str).astimezone(timezone.utc)
                except Exception:
                    pass
        return None
