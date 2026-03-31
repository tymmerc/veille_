"""Unit tests for storage.py filter and schedule functions."""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import patch
from dataclasses import dataclass, field

# Import the functions under test
import sys
sys.path.insert(0, "/opt/tech-veille")
from sources.base import Article
from storage import filter_for_user, is_user_scheduled_now


# ─── Helpers ──────────────────────────────────────────────────────

def make_article(title="Test", summary="", source="HN", platform="hackernews",
                 url="https://example.com", category="tech", score=7) -> Article:
    a = Article(
        platform=platform, external_id="test-1", title=title,
        url=url, text="", source=source, category=category,
    )
    a.summary = summary
    a.score = score
    return a


def make_user(keywords=None, hn_keywords=None, subreddits=None, min_score=4):
    config = {}
    if keywords is not None:
        config["keywords"] = keywords
    if hn_keywords is not None:
        config["hn_keywords"] = hn_keywords
    if subreddits is not None:
        config["subreddits"] = subreddits
    return {"prompt_config": config, "min_score": min_score}


# ─── filter_for_user ──────────────────────────────────────────────

class TestFilterForUser:
    def test_returns_all_when_no_config(self):
        articles = [make_article(title="Test")]
        user = {"prompt_config": None, "min_score": 4}
        result = filter_for_user(articles, user)
        assert len(result) == len(articles)

    def test_returns_all_when_invalid_config(self):
        user = {"prompt_config": "invalid json{{{", "min_score": 4}
        articles = [make_article()]
        result = filter_for_user(articles, user)
        assert len(result) == len(articles)

    def test_filters_by_keyword_in_title(self):
        articles = [
            make_article(title="Claude Code Update", score=8),
            make_article(title="Bitcoin Price Surge", score=8),
        ]
        user = make_user(keywords=["claude code"])
        result = filter_for_user(articles, user)
        assert len(result) == 1
        assert result[0].title == "Claude Code Update"

    def test_filters_by_keyword_in_summary(self):
        articles = [
            make_article(title="New Release", summary="This claude code feature is amazing", score=8),
        ]
        user = make_user(keywords=["claude code"])
        result = filter_for_user(articles, user)
        assert len(result) == 1

    def test_keyword_case_insensitive(self):
        articles = [make_article(title="CLAUDE CODE is great", score=8)]
        user = make_user(keywords=["claude code"])
        result = filter_for_user(articles, user)
        assert len(result) == 1

    def test_single_word_uses_word_boundary(self):
        articles = [
            make_article(title="Rust 2026 Edition", score=8),
            make_article(title="Rustic Furniture", score=8),
        ]
        user = make_user(keywords=["rust"])
        result = filter_for_user(articles, user)
        # "rust" should match "Rust 2026" but NOT "Rustic"
        assert len(result) == 1
        assert result[0].title == "Rust 2026 Edition"

    def test_filters_by_subreddit_source(self):
        articles = [
            make_article(title="Random", source="r/ClaudeAI", platform="reddit", score=8),
            make_article(title="Random", source="r/Bitcoin", platform="reddit", score=8),
        ]
        user = make_user(subreddits=["ClaudeAI"])
        result = filter_for_user(articles, user)
        assert len(result) == 1
        assert result[0].source == "r/ClaudeAI"

    def test_respects_min_score(self):
        articles = [
            make_article(title="Claude Code", score=3),
            make_article(title="Claude Code Update", score=8),
        ]
        user = make_user(keywords=["claude code"], min_score=5)
        result = filter_for_user(articles, user)
        assert len(result) == 1
        assert result[0].score == 8

    def test_hn_keywords_also_match(self):
        articles = [make_article(title="Anthropic Claude announcement", score=8)]
        user = make_user(hn_keywords=["Anthropic Claude"])
        result = filter_for_user(articles, user)
        assert len(result) == 1

    def test_json_string_config(self):
        """Config stored as JSON string in DB should be parsed."""
        articles = [make_article(title="Claude Code", score=8)]
        user = {
            "prompt_config": json.dumps({"keywords": ["claude code"]}),
            "min_score": 4,
        }
        result = filter_for_user(articles, user)
        assert len(result) == 1

    def test_empty_keywords_returns_nothing(self):
        """Empty keyword list means user configured but has no keywords — nothing matches."""
        articles = [make_article(), make_article(title="Other")]
        user = make_user(keywords=[], hn_keywords=[])
        result = filter_for_user(articles, user)
        assert len(result) == 0


# ─── is_user_scheduled_now ────────────────────────────────────────

class TestIsUserScheduledNow:
    def test_defaults_to_8_and_19(self):
        user = {"sync_hours": None, "sync_days": None}
        # Mock time to 8:00 UTC on a Wednesday (weekday=2, js_day=3)
        with patch("storage.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 3, 18, 8, 0, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = is_user_scheduled_now(user)
        assert result is True

    def test_defaults_reject_non_scheduled_hour(self):
        user = {"sync_hours": None, "sync_days": None}
        with patch("storage.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 3, 18, 3, 0, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = is_user_scheduled_now(user)
        assert result is False

    def test_custom_hours(self):
        user = {"sync_hours": [9, 12, 18], "sync_days": None}
        with patch("storage.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 3, 18, 12, 0, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = is_user_scheduled_now(user)
        assert result is True

    def test_custom_days_excludes_wrong_day(self):
        # Only Monday (JS day 1 = Python weekday 0)
        user = {"sync_hours": [8], "sync_days": [1]}
        with patch("storage.datetime") as mock_dt:
            # Wednesday = Python weekday 2, JS day 3
            mock_dt.now.return_value = datetime(2026, 3, 18, 8, 0, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = is_user_scheduled_now(user)
        assert result is False

    def test_json_string_hours(self):
        """sync_hours stored as JSON string in DB."""
        user = {"sync_hours": "[8, 19]", "sync_days": None}
        with patch("storage.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 3, 18, 8, 0, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = is_user_scheduled_now(user)
        assert result is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
