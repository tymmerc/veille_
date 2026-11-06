"""Tests for the digest layout: grouped by theme, real hooks, nothing written by the LLM."""

import sys
from datetime import datetime, timezone
from unittest.mock import patch

sys.path.insert(0, "/opt/tech-veille")
import notifier  # noqa: E402
from sources.base import Article  # noqa: E402

NOW = datetime(2026, 11, 6, 8, 0, tzinfo=timezone.utc)  # a Friday morning


def art(n: int, category="tech", score=6, summary=None) -> Article:
    a = Article(title=f"Title {n}", url=f"https://x/{n}", text="", source=f"Src{n}",
                category=category, platform="rss", external_id=str(n))
    a.score = score
    a.summary = summary if summary is not None else f"Hook {n}.|||• point"
    return a


def test_header_says_day_period_and_count():
    d = notifier.build_digest([art(1), art(2)], NOW)
    assert d.header == "📡 Veille du vendredi 6/11 · matin · 2 articles"


def test_sections_follow_theme_order_security_first():
    d = notifier.build_digest([art(1, "tech"), art(2, "ia"), art(3, "cyber")], NOW)
    assert [s.key for s in d.sections] == ["cyber", "ia", "tech"]


def test_items_show_link_hook_and_source_never_the_detail():
    d = notifier.build_digest([art(1)], NOW)
    item = d.sections[0].items[0]
    assert "[Title 1](https://x/1)" in item
    assert "Hook 1." in item
    assert "Src1" in item
    assert "|||" not in item and "• point" not in item


def test_only_top_articles_are_listed_and_rest_counted():
    arts = [art(i, score=10 - (i % 5)) for i in range(15)]
    d = notifier.build_digest(arts, NOW, limit=10)
    assert sum(len(s.items) for s in d.sections) == 10
    assert d.more == 5


def test_hook_equal_to_title_is_not_repeated():
    a = art(1, summary="Title 1|||")
    item = notifier.build_digest([a], NOW).sections[0].items[0]
    assert item.count("Title 1") == 1


def test_discord_payload_has_one_embed_per_theme():
    d = notifier.build_digest([art(1, "cyber"), art(2, "ia")], NOW)
    payload = notifier.discord_payload(d)
    assert payload["content"] == f"**{d.header}**"
    assert [e["title"] for e in payload["embeds"]] == ["🔒 Cybersécurité", "🤖 IA & Machine Learning"]


def test_send_discord_never_calls_ollama():
    with patch("notifier.requests.post") as post:
        post.return_value.status_code = 204
        assert notifier.send_discord([art(1)], webhook_url="https://discord.test/hook")
    assert post.call_count == 1
    assert "11434" not in post.call_args.args[0]


def test_instant_alert_has_its_own_header():
    with patch("notifier.requests.post") as post:
        post.return_value.status_code = 204
        assert notifier.send_instant([art(1, score=9)], discord_url="https://discord.test/hook")
    payload = post.call_args.kwargs["json"]
    assert payload["content"] == "**⚡ Alerte veille · 1 article important**"
