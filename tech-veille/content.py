"""Fetch the real article text when a source only gives a title.

Hacker News links and many RSS items arrive with little or no body. The local
model then invents a story around the title, so we read the page itself first.
"""
from __future__ import annotations

import dataclasses
import logging
from urllib.parse import urlparse

import trafilatura

from sources import net
from sources.base import Article

log = logging.getLogger(__name__)

MIN_TEXT_CHARS = 400
MAX_TEXT_CHARS = 4000
FETCH_TIMEOUT = 12

# Pages we cannot or should not read: discussions, login walls, our own changelog source.
SKIP_PLATFORMS = {"github", "arxiv", "reddit"}
SKIP_HOSTS = {"news.ycombinator.com", "twitter.com", "x.com", "www.reddit.com", "reddit.com"}


def needs_text(article: Article) -> bool:
    if article.platform in SKIP_PLATFORMS:
        return False
    if len(article.text or "") >= MIN_TEXT_CHARS:
        return False
    host = urlparse(article.url).netloc.lower()
    return bool(host) and host not in SKIP_HOSTS


def enrich(article: Article) -> Article:
    """Return a copy with the page's main text, or the same article if not needed/possible."""
    if not needs_text(article):
        return article
    try:
        # bytes, not .text: trafilatura reads the page's own charset (requests guesses Latin-1)
        html = net.get(article.url, timeout=FETCH_TIMEOUT).content
        text = trafilatura.extract(
            html, include_comments=False, include_tables=False, favor_precision=True,
        ) or ""
    except Exception as exc:  # network, parser: keep what we have
        log.debug("No page text for %s (%s)", article.url, net.describe_error(exc))
        return article
    if len(text) <= len(article.text or ""):
        return article
    return dataclasses.replace(article, text=text[:MAX_TEXT_CHARS])
