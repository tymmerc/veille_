"""Tests for GitHub releases: stable only, monorepo prefixes, stack repos, market filters."""

import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

sys.path.insert(0, "/opt/tech-veille")
import market_brief  # noqa: E402
import stack  # noqa: E402
from sources.github_releases import GitHubReleasesSource, is_stable  # noqa: E402

NOW = datetime.now(timezone.utc)


def release(tag, pre=False, hours=1, body="- Fixed a security issue in the router"):
    return {"tag_name": tag, "name": tag, "prerelease": pre, "draft": False, "body": body,
            "published_at": (NOW - timedelta(hours=hours)).isoformat().replace("+00:00", "Z"),
            "html_url": f"https://github.com/x/y/releases/tag/{tag}"}


def test_stable_filter():
    assert is_stable(release("v15.5.28"))
    assert not is_stable(release("v16.5.0-canary.42", pre=True))
    assert not is_stable(release("nightly"))
    assert not is_stable(release("v8.0.0-rc.22"))
    assert is_stable(release("socket.io@4.8.4"), prefix="socket.io@")
    assert not is_stable(release("engine.io@6.6.11"), prefix="socket.io@")


def test_source_keeps_stable_releases_with_preset_score():
    data = [release("v16.5.0-canary.42", pre=True), release("v15.5.28")]
    resp = MagicMock()
    resp.json.return_value = data
    src = GitHubReleasesSource(repos=[{"repo": "vercel/next.js", "label": "Next.js", "score": 6}])
    with patch("sources.github_releases.requests.get", return_value=resp):
        articles = src.fetch()
    assert [a.title for a in articles] == ["Next.js v15.5.28"]
    assert articles[0].score == 6


def test_stack_repos_follow_the_stack():
    repos = stack.stack_repos(["Next.js", "nginx", "Python requests"])
    assert [r["repo"] for r in repos] == ["vercel/next.js", "nginx/nginx"]
    assert all(r["score"] == 6 for r in repos)


def test_market_news_needs_the_query_words():
    assert market_brief.relevant("La DGCCRF contrôle les avis en ligne", "DGCCRF avis en ligne")
    assert not market_brief.relevant("Secteur funéraire : la DGCCRF mobilisée", "DGCCRF avis en ligne")
    assert market_brief.relevant("Shopify Sidekick gets a new agent mode", "Shopify Sidekick")
    assert not market_brief.relevant("Shopify délaisse React Native", "Shopify Sidekick")
    assert market_brief.relevant("Ce que l'AI Act change pour les chatbots", '"AI Act" chatbot e-commerce')
