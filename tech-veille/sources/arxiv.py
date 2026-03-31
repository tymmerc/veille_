from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

import requests

import config
from .base import Article, BaseSource

log = logging.getLogger(__name__)

ARXIV_API = "https://export.arxiv.org/api/query"
NS = {"atom": "http://www.w3.org/2005/Atom"}


class ArxivSource(BaseSource):

    def __init__(self, categories: list[str] | None = None):
        self.categories = categories or []

    def fetch(self) -> list[Article]:
        if not self.categories:
            log.info("Arxiv: no categories configured, skipping")
            return []
        cats = "+OR+".join(f"cat:{c}" for c in self.categories)
        params = {
            "search_query": cats,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
            "max_results": 30,
        }

        try:
            resp = requests.get(ARXIV_API, params=params, timeout=15)
            resp.raise_for_status()
        except Exception:
            log.exception("Arxiv API request failed")
            return []

        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)  # arxiv updates ~daily
        articles: list[Article] = []

        root = ET.fromstring(resp.text)
        for entry in root.findall("atom:entry", NS):
            try:
                article = self._parse_entry(entry, cutoff)
                if article:
                    articles.append(article)
            except Exception:
                log.exception("Error parsing arxiv entry")

        log.info("Arxiv: %d articles collected", len(articles))
        return articles

    def _parse_entry(self, entry: ET.Element, cutoff: datetime) -> Article | None:
        published_str = entry.findtext("atom:published", "", NS)
        if not published_str:
            return None
        published = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
        if published < cutoff:
            return None

        title = (entry.findtext("atom:title", "", NS) or "").strip().replace("\n", " ")
        if not title:
            return None

        summary = (entry.findtext("atom:summary", "", NS) or "").strip()
        arxiv_id = (entry.findtext("atom:id", "", NS) or "").strip()
        url = arxiv_id  # arxiv IDs are URLs like http://arxiv.org/abs/...

        # Determine subcategory
        categories = [
            c.get("term", "") for c in entry.findall("atom:category", NS)
        ]
        category = self._categorize(categories)

        return Article(
            title=title[:500],
            url=url,
            text=summary[:3000],
            source="arxiv",
            category=category,
            platform="arxiv",
            external_id=arxiv_id.split("/")[-1] if "/" in arxiv_id else arxiv_id,
            created_at=published,
        )

    @staticmethod
    def _categorize(cats: list[str]) -> str:
        for c in cats:
            if c in ("cs.CR",):
                return "cyber"
        return "ia"  # cs.AI, cs.LG, cs.CL → all IA
