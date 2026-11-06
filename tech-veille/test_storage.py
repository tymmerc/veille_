"""Unit tests for storage.py filter and schedule functions."""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import patch

# Import the functions under test
import sys
sys.path.insert(0, "/opt/tech-veille")
from sources.base import Article
from storage import filter_for_user, is_user_scheduled_now


# ─── Helpers ──────────────────────────────────────────────────────

def make_article(title="Test", summary="", source="HN", platform="hackernews",
                 url="https://example.com", category="tech", score=7, text="") -> Article:
    a = Article(
        platform=platform, external_id="test-1", title=title,
        url=url, text=text, source=source, category=category,
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

    def test_followed_subreddit_alone_is_not_enough(self):
        # 06/11/2026 : un subreddit suivi laissait passer n'importe quel sujet
        articles = [
            make_article(title="Claude Code hooks explained", source="r/ClaudeAI", platform="reddit", score=8),
            make_article(title="Random meme", source="r/ClaudeAI", platform="reddit", score=8),
        ]
        user = make_user(keywords=["claude code"], subreddits=["ClaudeAI"])
        result = filter_for_user(articles, user)
        assert [a.title for a in result] == ["Claude Code hooks explained"]

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

    def test_no_schedule_notifies_at_any_hour(self):
        # No schedule configured = notify on every run (see is_user_scheduled_now)
        user = {"sync_hours": None, "sync_days": None}
        with patch("storage.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 3, 18, 3, 0, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = is_user_scheduled_now(user)
        assert result is True

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


# ─── Stack security news always reaches the admin ─────────────────

class TestStackFilter:
    def test_stack_security_article_passes_even_without_keyword(self):
        a = make_article(title="Critical nginx vulnerability under attack", score=8, category="cyber")
        user = {**make_user(keywords=["claude code"], min_score=6), "stack_keywords": ["nginx"]}
        assert filter_for_user([a], user) == [a]

    def test_without_stack_keywords_nothing_changes(self):
        a = make_article(title="Critical nginx vulnerability under attack", score=8, category="cyber")
        user = make_user(keywords=["claude code"], min_score=6)
        assert filter_for_user([a], user) == []


# ─── Followed sources need a keyword, except blogs and GitHub repos ──

def make_followed_user(**extra):
    config = {
        "keywords": ["claude code"],
        "subreddits": ["ClaudeAI"],
        "rss_feeds": ["https://techcrunch.com/category/artificial-intelligence/feed/"],
        "followed_accounts": [
            {"label": "Anthropic", "handle": "https://www.anthropic.com/news", "platform": "blog"},
        ],
        "github_repos": [{"repo": "anthropics/claude-code", "label": "Claude Code", "category": "ia"}],
        **extra,
    }
    return {"prompt_config": config, "min_score": 1}


TECHCRUNCH = "https://techcrunch.com/2026/11/06/some-story/"


class TestFollowedSources:
    def test_rss_domain_alone_is_not_enough(self):
        # Le résumé du 06/11 à 9 h 18 : 20 articles TechCrunch sans rapport avec la phrase
        a = make_article(title="Meta acquires AI coding startup Conductor", platform="rss",
                         source="TechCrunch", url=TECHCRUNCH, score=5)
        assert filter_for_user([a], make_followed_user()) == []

    def test_rss_article_with_keyword_passes(self):
        a = make_article(title="Anthropic ships Claude Code 3", platform="rss",
                         source="TechCrunch", url=TECHCRUNCH, score=5)
        assert filter_for_user([a], make_followed_user()) == [a]

    def test_keyword_found_at_start_of_text(self):
        a = make_article(title="New agent tooling", platform="reddit", source="r/ClaudeAI",
                         text="I tried Claude Code for a week and here is what I learned.", score=5)
        assert filter_for_user([a], make_followed_user()) == [a]

    def test_keyword_beyond_text_start_is_ignored(self):
        a = make_article(title="Long post", platform="reddit", source="r/ClaudeAI",
                         text="x " * 800 + "claude code", score=5)
        assert filter_for_user([a], make_followed_user()) == []

    def test_text_keyword_keeps_word_boundary(self):
        a = make_article(title="Release notes", text="new barcode scanner", score=5)
        user = make_user(keywords=["code"], min_score=1)
        assert filter_for_user([a], user) == []

    def test_followed_blog_passes_without_keyword(self):
        a = make_article(title="Introducing a new model", platform="blog", source="Anthropic", score=5)
        assert filter_for_user([a], make_followed_user()) == [a]

    def test_blog_of_unfollowed_account_needs_keyword(self):
        a = make_article(title="Introducing a new model", platform="blog", source="OpenAI", score=5)
        assert filter_for_user([a], make_followed_user()) == []

    def test_blog_without_label_matches_its_url(self):
        user = make_followed_user(followed_accounts=[
            {"label": "", "handle": "www.anthropic.com/news", "platform": "blog"},
        ])
        a = make_article(title="News", platform="blog", source="https://www.anthropic.com/news", score=5)
        assert filter_for_user([a], user) == [a]

    def test_twitter_account_does_not_open_a_blog(self):
        user = make_followed_user(followed_accounts=[
            {"label": "Anthropic", "handle": "AnthropicAI", "platform": "twitter"},
        ])
        a = make_article(title="News", platform="blog", source="Anthropic", score=5)
        assert filter_for_user([a], user) == []

    def test_followed_github_repo_passes_without_keyword(self):
        a = make_article(title="Claude Code v3.1.0", platform="github", source="GitHub/Claude Code", score=9)
        user = make_followed_user(keywords=["hooks"])
        assert filter_for_user([a], user) == [a]

    def test_github_label_defaults_to_repo_name(self):
        user = make_followed_user(keywords=["hooks"], github_repos=[{"repo": "anthropics/claude-code"}])
        a = make_article(title="claude-code v3.1.0", platform="github", source="GitHub/claude-code", score=9)
        assert filter_for_user([a], user) == [a]

    def test_github_release_of_other_repo_needs_keyword(self):
        a = make_article(title="Next.js 16.1", platform="github", source="GitHub/Next.js", score=9)
        assert filter_for_user([a], make_followed_user()) == []

    def test_followed_sources_still_respect_min_score(self):
        a = make_article(title="Introducing a new model", platform="blog", source="Anthropic", score=2)
        user = {**make_followed_user(), "min_score": 6}
        assert filter_for_user([a], user) == []


# ─── Official Claude sources always reach the admin (Tym, 06/11/2026) ──

class TestAlwaysSources:
    OFFICIAL = {("blog", "Claude"), ("release_notes", "Notes de version API Claude")}

    def test_official_claude_article_passes_without_keyword(self):
        a = make_article(title="Introducing Personal Finance in Claude", source="Claude", platform="blog", score=5)
        user = {**make_user(keywords=["claude code"], min_score=1), "always_sources": self.OFFICIAL}
        assert filter_for_user([a], user) == [a]

    def test_api_release_notes_pass_without_keyword(self):
        a = make_article(title="Notes de version API Claude : 5 novembre 2026",
                         source="Notes de version API Claude", platform="release_notes", score=8)
        user = {**make_user(keywords=["claude code"], min_score=1), "always_sources": self.OFFICIAL}
        assert filter_for_user([a], user) == [a]

    def test_other_users_keep_the_keyword_rule(self):
        a = make_article(title="Introducing Personal Finance in Claude", source="Claude", platform="blog", score=5)
        assert filter_for_user([a], make_user(keywords=["claude code"], min_score=1)) == []


# ─── Purge never deletes what a user kept ─────────────────────────

class TestPurgeKeepsFavorites:
    def test_purge_spares_bookmarked_liked_and_shared_articles(self):
        from unittest.mock import MagicMock
        import storage
        cur = MagicMock(rowcount=0)
        conn = MagicMock()
        conn.__enter__.return_value = conn
        conn.cursor.return_value.__enter__.return_value = cur
        with patch("storage._conn", return_value=conn):
            storage.purge_old(days=30)
        sql = cur.execute.call_args.args[0]
        for table in ("bookmarks", "likes", "shared_articles"):
            assert f"FROM {table}" in sql, table
