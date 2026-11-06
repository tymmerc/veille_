from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

from . import net
from .base import Article, BaseSource

log = logging.getLogger(__name__)

ARXIV_API = "https://export.arxiv.org/api/query"
NS = {"atom": "http://www.w3.org/2005/Atom"}
MAX_KEYWORDS = 15
MAX_RESULTS = 10


def build_query(categories: list[str], keywords: list[str]) -> str:
    """arXiv search_query with real spaces around OR/AND.

    requests turns spaces into "+", which arXiv reads as a separator. Writing
    "+OR+" ourselves got encoded as "%2BOR%2B" and matched nothing at all.
    Keywords keep the feed relevant: without them we would send ~30 random
    AI papers an hour to the local LLM.
    """
    cats = " OR ".join(f"cat:{c}" for c in categories)
    terms = list(dict.fromkeys(k.strip().lower() for k in keywords if k.strip()))
    terms = [t.replace('"', "") for t in terms][:MAX_KEYWORDS]
    if not terms:
        return cats
    words = " OR ".join(f'abs:"{t}"' for t in terms)
    return f"({cats}) AND ({words})"


class ArxivSource(BaseSource):

    def __init__(self, categories: list[str] | None = None, keywords: list[str] | None = None):
        self.categories = categories or []
        self.keywords = keywords or []

    def fetch(self) -> list[Article]:
        if not self.categories:
            log.info("Arxiv: no categories configured, skipping")
            return []
        params = {
            "search_query": build_query(self.categories, self.keywords),
            "sortBy": "submittedDate",
            "sortOrder": "descending",
            "max_results": MAX_RESULTS,
        }

        try:
            resp = net.get(ARXIV_API, params=params, timeout=30, wait_on_429=5)
        except Exception as exc:
            reason = net.describe_error(exc)
            log.warning("Arxiv API request failed (%s)", reason)
            self._note("arXiv", False, reason)
            return []
        self._note("arXiv", True)

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
