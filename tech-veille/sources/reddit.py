from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import praw

import config
from .base import Article, BaseSource

log = logging.getLogger(__name__)


class RedditSource(BaseSource):

    def __init__(self, subreddits: dict[str, list[str]] | None = None):
        self.subreddits = subreddits or {}

    def fetch(self) -> list[Article]:
        if not self.subreddits:
            log.info("Reddit: no subreddits configured, skipping")
            return []
        if not config.REDDIT_CLIENT_ID or not config.REDDIT_SECRET:
            log.warning("Reddit credentials missing, skipping")
            return []

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
                except Exception:
                    log.exception("Error fetching r/%s", sub_name)

        log.info("Reddit: %d articles collected", len(articles))
        return articles
