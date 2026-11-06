"""Tests for the per-run cap: official sources first, arXiv last."""

import sys

sys.path.insert(0, "/opt/tech-veille")
from main import prioritize  # noqa: E402
from sources.base import Article  # noqa: E402


def art(platform: str, n: int = 0) -> Article:
    return Article(title=f"{platform}{n}", url=f"https://x/{platform}{n}", text="",
                   source=platform, category="tech", platform=platform, external_id=f"{platform}{n}")


def test_official_sources_first_and_arxiv_last():
    items = [art("arxiv"), art("reddit"), art("hackernews"), art("rss"), art("blog"), art("github")]
    order = [a.platform for a in prioritize(items, limit=10)]
    assert order == ["github", "blog", "rss", "hackernews", "reddit", "arxiv"]


def test_limit_keeps_order_within_a_platform():
    items = [art("reddit", i) for i in range(5)] + [art("rss", 0)]
    kept = prioritize(items, limit=3)
    assert [a.title for a in kept] == ["rss0", "reddit0", "reddit1"]


def test_input_is_not_mutated():
    items = [art("arxiv"), art("github")]
    prioritize(items, limit=1)
    assert [a.platform for a in items] == ["arxiv", "github"]


# ─── notify_users: instant alerts and summaries ───────────────────

from unittest.mock import patch  # noqa: E402

import main  # noqa: E402


def scored(n: int, score: int) -> Article:
    a = art("rss", n)
    a.score = score
    a.summary = f"Hook {n}.|||"
    return a


def run_notify(user: dict, fresh: list[Article]):
    with patch("main.get_users_with_webhooks", return_value=[user]), \
         patch("main.get_unsent_articles_for_user", return_value=fresh) as unsent, \
         patch("main.filter_for_user", side_effect=lambda arts, u: arts), \
         patch("main.send_instant", return_value=True) as instant, \
         patch("main.send_discord", return_value=True) as digest, \
         patch("main.mark_user_notified") as marked:
        main.notify_users(fresh, [])
    return instant, digest, marked, unsent


BASE = {"id": "u1", "username": "someone", "webhook_url": "https://discord.test/h", "slack_webhook_url": None,
        "sync_hours": None, "sync_days": None, "notify_digest": None, "notify_instant_min": None,
        "last_notified_at": None}


def test_instant_alert_only_for_important_articles():
    instant, _, _, _ = run_notify({**BASE, "notify_instant_min": 9}, [scored(1, 9), scored(2, 6)])
    sent = instant.call_args.args[0]
    assert [a.title for a in sent] == ["rss1"]


def test_summary_skipped_outside_its_schedule_but_instant_still_works():
    user = {**BASE, "notify_instant_min": 8, "sync_hours": [3], "sync_days": [0]}
    instant, digest, marked, _ = run_notify(user, [scored(1, 10)])
    assert instant.called
    assert not digest.called and not marked.called


def test_summary_without_schedule_goes_out_and_marks_the_user():
    _, digest, marked, _ = run_notify(BASE, [scored(1, 7)])
    assert digest.called and marked.called


# ─── Official release notes: always fetched, never cut by the cap ──

from unittest.mock import MagicMock  # noqa: E402


def test_release_notes_rank_with_github_releases():
    items = [art("arxiv"), art("blog"), art("rss"), art("release_notes")]
    assert [a.platform for a in prioritize(items, limit=1)] == ["release_notes"]
    assert main.PLATFORM_PRIORITY["release_notes"] == main.PLATFORM_PRIORITY["github"] == 0


def test_collect_always_reads_official_release_notes():
    notes = MagicMock()
    notes.return_value.fetch.return_value = []
    with patch("main.stack_watch.stack_keywords", return_value=[]), \
         patch("main.BlogScraperSource") as blogs, \
         patch("main.ReleaseNotesSource", notes):
        blogs.return_value.fetch.return_value = []
        main.collect({})
    notes.assert_called_once_with()
    notes.return_value.fetch.assert_called_once()
