from __future__ import annotations

import logging
import hashlib
import re
import time
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

import config
from .base import Article, BaseSource

log = logging.getLogger(__name__)

BLOG_CONFIGS = [
    {
        "name": "Anthropic",
        "urls": [
            "https://www.anthropic.com/news",
            "https://www.anthropic.com/research",
        ],
        "article_selector": "a[href*='/news/'], a[href*='/research/']",
        "base_url": "https://www.anthropic.com",
        "category": "ia",
        "is_official": True,
    },
    {
        "name": "Anthropic Engineering",
        "urls": [
            "https://www.anthropic.com/engineering",
        ],
        "article_selector": "a[href*='/engineering/']",
        "base_url": "https://www.anthropic.com",
        "category": "ia",
        "is_official": True,
    },
    # Official Claude articles (claude.com/blog redirects here). Asked by Tym on 06/11/2026.
    {
        "name": "Claude",
        "urls": ["https://claude.com/fr/resources/articles"],
        "article_selector": "a[href*='/resources/articles/']",
        "base_url": "https://claude.com",
        "category": "ia",
        "is_official": True,
    },
    # OpenAI blocks server-side requests (403). Content comes via RSS + HackerNews instead.
    {
        "name": "Google DeepMind",
        "urls": ["https://deepmind.google/discover/blog/"],
        "article_selector": "a[href*='/blog/']",
        "base_url": "https://deepmind.google",
        "category": "ia",
        "is_official": True,
    },
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds, exponential backoff: 2s, 4s, 8s


class BlogScraperSource(BaseSource):

    def __init__(self, blog_configs: list[dict] | None = None):
        self.configs = blog_configs or BLOG_CONFIGS

    def fetch(self) -> list[Article]:
        articles: list[Article] = []
        seen_urls: set[str] = set()
        succeeded = 0
        failed = 0

        for blog in self.configs:
            key = f"Blog {blog['name']}"
            try:
                pages_ok = self._scrape_blog(blog, articles, seen_urls)
            except Exception as exc:
                failed += 1
                log.exception("Error scraping blog %s", blog["name"])
                self._note(key, False, type(exc).__name__)
                continue
            if pages_ok:
                succeeded += 1
                self._note(key, True)
            else:
                failed += 1
                self._note(key, False, "aucune page ne répond")

        log.info(
            "BlogScraper: %d articles collected (%d blogs succeeded, %d failed)",
            len(articles), succeeded, failed,
        )
        return articles

    def _scrape_blog(
        self,
        blog: dict,
        articles: list[Article],
        seen_urls: set[str],
    ) -> int:
        """Scrape one blog. Returns how many of its pages answered."""
        name = blog["name"]
        pages_ok = 0
        base_url = blog.get("base_url", "")
        selector = blog.get("article_selector", "a")
        category = blog.get("category", "ia")
        is_official = blog.get("is_official", False)

        for page_url in blog["urls"]:
            resp = None
            for attempt in range(MAX_RETRIES):
                try:
                    resp = requests.get(page_url, headers=HEADERS, timeout=15)
                    resp.raise_for_status()
                    break
                except requests.ConnectionError as e:
                    log.warning("Connection error fetching %s (attempt %d/%d): %s", page_url, attempt + 1, MAX_RETRIES, e)
                except requests.Timeout:
                    log.warning("Timeout fetching %s (attempt %d/%d)", page_url, attempt + 1, MAX_RETRIES)
                except requests.HTTPError as e:
                    log.warning("HTTP error fetching %s (attempt %d/%d): %s", page_url, attempt + 1, MAX_RETRIES, e)
                except Exception:
                    log.warning("Failed to fetch %s (attempt %d/%d)", page_url, attempt + 1, MAX_RETRIES)

                resp = None
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    time.sleep(delay)

            if resp is None:
                log.error("All %d attempts failed for %s", MAX_RETRIES, page_url)
                continue
            pages_ok += 1

            soup = BeautifulSoup(resp.text, "html.parser")
            links = soup.select(selector)

            for link in links[:15]:
                href = link.get("href", "")
                if not href:
                    continue

                # Make absolute URL
                if href.startswith("/"):
                    href = base_url + href

                if href in seen_urls or not href.startswith("http"):
                    continue

                # Skip team/category pages (not actual articles)
                if re.search(r'/team/|/category/|/tag/', href):
                    continue
                # Skip links that point to the index page itself
                if href.rstrip('/') == page_url.rstrip('/'):
                    continue

                seen_urls.add(href)

                # Extract title from link text or nested elements
                title = ""
                # Try heading elements first (more specific)
                h = link.select_one("h2, h3, h4")
                if h:
                    title = h.get_text(strip=True)
                if not title or len(title) < 10:
                    title = link.get_text(strip=True)
                if not title or len(title) < 10:
                    continue

                # Clean up titles that have metadata prefixed
                # Remove date patterns like "Mar 5, 2026" or "Feb 27, 2026"
                title = re.sub(r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}', '', title)
                # Remove category prefixes (may be concatenated without space)
                title = re.sub(r'^(?:Announcements?|Product|Policy|Research|Engineering|Economic Research|Alignment Science|Societal Impacts?|Frontier Threats)\s*', '', title)
                title = title.strip()
                if not title or len(title) < 20:
                    continue
                # Skip navigation-like titles (single word, too generic)
                if len(title.split()) < 3:
                    continue

                # Extract description if available
                desc = ""
                parent = link.parent
                if parent:
                    p = parent.select_one("p")
                    if p:
                        desc = p.get_text(strip=True)

                ext_id = hashlib.sha256(href.encode()).hexdigest()[:16]

                article = Article(
                    title=title[:500],
                    url=href,
                    text=desc[:3000] if desc else title,
                    source=name,
                    category=category,
                    platform="blog",
                    external_id=ext_id,
                    created_at=datetime.now(timezone.utc),
                )
                article.is_official = is_official
                articles.append(article)

        log.info("Blog %s: %d articles found", name, len([a for a in articles if a.source == name]))
        return pages_ok
