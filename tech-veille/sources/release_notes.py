"""Official release notes pages: one article per dated entry, changes kept word for word.

The Claude API release notes are a single page of dated sections (h3 "November 5, 2026"
followed by bullets). Each recent section becomes an article whose text is a header
line plus one line per change, like GitHub releases, so the summarizer shows the real
changes as points instead of asking the local model to rephrase them.
"""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone

from bs4 import BeautifulSoup

from . import net
from .base import Article, BaseSource

log = logging.getLogger(__name__)

PAGES = [
    {"name": "API Claude", "url": "https://platform.claude.com/docs/en/release-notes/overview"},
]
MAX_AGE_DAYS = 7  # official notes: catch up on a full week, dedup does the rest
MAX_CHANGES = 6
MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
             "septembre", "octobre", "novembre", "décembre"]


_DATE = re.compile(r"([A-Z][a-z]+ \d{1,2}, \d{4})")


def _date(text: str) -> datetime | None:
    """Date of a heading; the docs add an icon glyph (anchor button) to the text."""
    match = _DATE.search(text)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%B %d, %Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _changes(heading) -> list[str]:
    """Bullets (or paragraphs when there are none) between this heading and the next one."""
    items, paragraphs = [], []
    for el in heading.find_all_next():
        if el.name in ("h2", "h3"):
            break
        if el.name == "li":
            items.append(el.get_text(" ", strip=True))
        elif el.name == "p" and not el.find_parent("li"):
            paragraphs.append(el.get_text(" ", strip=True))
    lines = [" ".join(x.split()) for x in (items or paragraphs) if x.strip()]
    return lines[:MAX_CHANGES]


def parse_release_notes(html: bytes, page: dict, cutoff: datetime) -> list[Article]:
    soup = BeautifulSoup(html, "html.parser")
    articles = []
    for heading in soup.select("h3"):
        when = _date(heading.get_text(" ", strip=True))
        if not when or when < cutoff:
            continue
        changes = _changes(heading)
        if not changes:
            continue
        label = f"{when.day} {MONTHS_FR[when.month - 1]} {when.year}"
        anchor = heading.get("id")
        url = f"{page['url']}#{anchor}" if anchor else page["url"]
        articles.append(Article(
            title=f"Notes de version {page['name']} : {label}",
            url=url,
            text="\n".join([f"Changements de {page['name']} du {label} :", *changes]),
            source=f"Notes de version {page['name']}",
            category="ia",
            platform="release_notes",
            external_id=hashlib.sha256(f"{page['url']}|{when.date()}".encode()).hexdigest()[:16],
            created_at=when,
            is_official=True,
            score=8,  # official changes: preset, the summarizer keeps it (like GitHub releases)
        ))
    return articles


class ReleaseNotesSource(BaseSource):

    def __init__(self, pages: list[dict] | None = None, max_age_days: int = MAX_AGE_DAYS):
        self.pages = pages or PAGES
        self.max_age_days = max_age_days

    def fetch(self) -> list[Article]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.max_age_days)
        articles: list[Article] = []
        for page in self.pages:
            key = f"Notes de version {page['name']}"
            try:
                html = net.get(page["url"], timeout=20).content
            except Exception as exc:
                reason = net.describe_error(exc)
                log.warning("Release notes %s failed (%s)", page["url"], reason)
                self._note(key, False, reason)
                continue
            found = parse_release_notes(html, page, cutoff)
            self._note(key, True)
            log.info("Release notes %s: %d entries", page["name"], len(found))
            articles.extend(found)
        return articles
