from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone

log = logging.getLogger(__name__)


@dataclass
class Article:
    title: str
    url: str
    text: str  # body / description
    source: str  # e.g. "r/MachineLearning", "HackerNews", "Ars Technica"
    category: str  # "ia", "cyber", "tech"
    platform: str  # "reddit", "hackernews", "rss", "arxiv"
    external_id: str  # unique id from the platform
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # filled later by summarizer
    score: int = 0
    summary: str = ""
    title_original: str = ""  # original title before translation
    is_official: bool = False  # official source (blog, press release)


class BaseSource(ABC):
    """Interface for all news sources."""

    @abstractmethod
    def fetch(self) -> list[Article]:
        """Fetch recent articles. Returns deduplicated list."""
        ...

    def _note(self, key: str, ok: bool, detail: str = "") -> None:
        """Record whether one feed/endpoint answered, for health alerts."""
        from health import Check  # root module, imported lazily to keep sources standalone

        if not hasattr(self, "checks"):
            self.checks = []
        self.checks.append(Check(key=key, ok=ok, detail=detail))
