from __future__ import annotations

import logging
import time
from datetime import datetime, timezone, timedelta

import requests

import config
from .base import Article, BaseSource

log = logging.getLogger(__name__)

ALGOLIA_URL = "https://hn.algolia.com/api/v1"


class HackerNewsSource(BaseSource):

    def __init__(self, enabled: bool = True, keywords: list[str] | None = None):
        self.enabled = enabled
        self.keywords = keywords or config.HN_KEYWORDS

    def fetch(self) -> list[Article]:
        if not self.enabled:
            log.info("HackerNews: disabled, skipping")
            return []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=config.MAX_AGE_HOURS)
        cutoff_ts = int(cutoff.timestamp())
        articles: list[Article] = []
        seen_ids: set[str] = set()

        self._searches_ok = 0
        # Keyword searches only — no generic front page dump
        for kw in self.keywords:
            self._search(
                params={
                    "query": kw,
                    "tags": "story",
                    "numericFilters": f"created_at_i>{cutoff_ts},points>5",
                    "hitsPerPage": 10,
                },
                articles=articles,
                seen_ids=seen_ids,
            )

        if self._searches_ok:
            self._note("Hacker News", True)
        else:
            self._note("Hacker News", False, "aucune recherche n'a répondu")
        log.info("HackerNews: %d articles collected", len(articles))
        return articles

    def _search(
        self,
        params: dict,
        articles: list[Article],
        seen_ids: set[str],
    ) -> None:
        max_attempts = 2
        data = None
        for attempt in range(max_attempts):
            try:
                resp = requests.get(f"{ALGOLIA_URL}/search", params=params, timeout=15)
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception:
                log.warning("HN Algolia request failed (attempt %d/%d)", attempt + 1, max_attempts, exc_info=True)
                if attempt < max_attempts - 1:
                    time.sleep(2)

        if data is None:
            log.error("HN Algolia request failed after %d attempts", max_attempts)
            return
        self._searches_ok += 1

        for hit in data.get("hits", []):
            obj_id = hit.get("objectID", "")
            if obj_id in seen_ids:
                continue
            seen_ids.add(obj_id)

            title = hit.get("title") or ""
            if not title:
                continue

            url = hit.get("url") or f"https://news.ycombinator.com/item?id={obj_id}"
            text = hit.get("story_text") or ""
            created_ts = hit.get("created_at_i", 0)
            created = datetime.fromtimestamp(created_ts, tz=timezone.utc)

            category = self._categorize(title + " " + text)

            articles.append(Article(
                title=title[:500],
                url=url,
                text=text[:3000],
                source="HackerNews",
                category=category,
                platform="hackernews",
                external_id=obj_id,
                created_at=created,
            ))

    @staticmethod
    def _categorize(text: str) -> str:
        t = text.lower()
        ai_kw = ["ai", "llm", "gpt", "claude", "machine learning", "neural", "model", "transformer", "diffusion"]
        cyber_kw = ["security", "vulnerability", "exploit", "hack", "cve", "malware", "ransomware"]
        if any(k in t for k in ai_kw):
            return "ia"
        if any(k in t for k in cyber_kw):
            return "cyber"
        return "tech"
