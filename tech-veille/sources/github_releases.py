"""Scrape GitHub Releases for tracked repositories (changelogs, new features)."""
from __future__ import annotations

import hashlib
import logging
import os
import re
from datetime import datetime, timezone, timedelta

import requests

from . import net
from .base import Article, BaseSource

log = logging.getLogger(__name__)

# Default repos to track (can be overridden via config)
DEFAULT_REPOS = [
    {
        "repo": "anthropics/claude-code",
        "label": "Claude Code",
        "category": "ia",
    },
]

# Canary / nightly / beta builds: Next.js alone ships several a day
UNSTABLE = re.compile(r"(canary|nightly|alpha|beta|[-.]rc[.\d]|-rc$|preview|insiders)", re.IGNORECASE)
PER_PAGE = 30  # enough to reach stable backports (14.x, 15.x) behind the canaries


def is_stable(release: dict, prefix: str = "") -> bool:
    tag = release.get("tag_name", "") or ""
    if release.get("prerelease") or release.get("draft"):
        return False
    if prefix and not tag.startswith(prefix):
        return False
    return not UNSTABLE.search(tag)


HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "TechVeille/1.0",
}


class GitHubReleasesSource(BaseSource):
    """Fetch recent releases from GitHub repos and convert to articles."""

    def __init__(self, repos: list[dict] | None = None, max_age_hours: int = 48) -> None:
        self.repos = repos or DEFAULT_REPOS
        self.max_age_hours = max_age_hours

    def fetch(self) -> list[Article]:
        articles: list[Article] = []
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.max_age_hours)

        for repo_config in self.repos:
            repo = repo_config["repo"]
            label = repo_config.get("label", repo.split("/")[-1])
            category = repo_config.get("category", "tech")

            try:
                fetched = self._fetch_repo(repo, label, category, cutoff,
                                           prefix=repo_config.get("tag_prefix", ""),
                                           score=int(repo_config.get("score", 0)))
                articles.extend(fetched)
                log.info("GitHub %s: %d releases", repo, len(fetched))
                self._note(f"GitHub {repo}", True)
            except Exception as exc:
                log.warning("Failed to fetch GitHub releases for %s", repo, exc_info=True)
                self._note(f"GitHub {repo}", False, net.describe_error(exc))

        return articles

    def _fetch_repo(
        self, repo: str, label: str, category: str, cutoff: datetime,
        prefix: str = "", score: int = 0,
    ) -> list[Article]:
        url = f"https://api.github.com/repos/{repo}/releases"
        headers = dict(HEADERS)
        if os.getenv("GITHUB_TOKEN"):  # optional: 5000 calls/hour instead of 60
            headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
        resp = requests.get(url, headers=headers, params={"per_page": PER_PAGE}, timeout=15)
        resp.raise_for_status()

        articles: list[Article] = []
        for release in resp.json():
            if not is_stable(release, prefix):
                continue
            published = release.get("published_at")
            if not published:
                continue

            pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if pub_dt < cutoff:
                continue

            tag = release.get("tag_name", "")
            name = release.get("name", tag)
            body = release.get("body", "") or ""

            # Parse changelog into readable text
            title = f"{label} {name}"
            # Extract feature lines from "## What's changed" body
            features = self._extract_features(body)

            if not features:
                continue  # Skip empty releases

            text = "\n".join(features)
            summary_text = f"Nouvelles fonctionnalites de {label} {name}:\n" + text

            ext_id = hashlib.md5(f"gh-release-{repo}-{tag}".encode()).hexdigest()

            articles.append(Article(
                title=title,
                url=release.get("html_url", f"https://github.com/{repo}/releases/tag/{tag}"),
                text=summary_text,
                source=f"GitHub/{label}",
                category=category,
                platform="github",
                external_id=ext_id,
                created_at=pub_dt,
                is_official=True,
                score=score,  # 0 = let the summarizer decide (9 for repos a user follows)
            ))

        return articles

    @staticmethod
    def _extract_features(body: str) -> list[str]:
        """Extract feature bullet points from a GitHub release body."""
        features: list[str] = []
        for line in body.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Skip headers
            if line.startswith("#"):
                continue
            # Keep bullet points (- or *)
            if line.startswith("- ") or line.startswith("* "):
                # Clean markdown links
                clean = line.lstrip("-* ").strip()
                if clean:
                    features.append(clean)
        return features
