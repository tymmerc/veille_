"""Tests for the source fixes: real User-Agent, arXiv query, Reddit without keys, dead feeds."""

import sys
from unittest.mock import MagicMock, patch

import pytest
import requests

sys.path.insert(0, "/opt/tech-veille")
from sources import net  # noqa: E402
from sources.arxiv import ArxivSource, build_query  # noqa: E402
from sources.reddit import RedditSource  # noqa: E402
from sources.rss import RSSSource, normalize_feed_url  # noqa: E402


def http_error(status: int) -> requests.HTTPError:
    resp = requests.Response()
    resp.status_code = status
    return requests.HTTPError(f"{status} error", response=resp)


def fake_response(body: str) -> MagicMock:
    resp = MagicMock()
    resp.content = body.encode()
    resp.text = body
    return resp


# ─── net ──────────────────────────────────────────────────────────

class TestNet:
    def test_sends_browser_like_user_agent(self):
        with patch("sources.net.requests.get") as get:
            get.return_value = MagicMock(status_code=200)
            net.get("https://example.com/feed")
        ua = get.call_args.kwargs["headers"]["User-Agent"]
        assert "Mozilla/5.0" in ua
        assert "Python-urllib" not in ua

    def test_retries_once_after_429(self):
        limited = MagicMock(status_code=429, headers={"Retry-After": "1"})
        ok = MagicMock(status_code=200, headers={})
        with patch("sources.net.requests.get", side_effect=[limited, ok]) as get, \
             patch("sources.net.time.sleep") as sleep:
            resp = net.get("https://example.com", wait_on_429=30)
        assert resp is ok
        assert get.call_count == 2
        sleep.assert_called_once_with(1)

    @pytest.mark.parametrize("exc, expected", [
        (http_error(403), "HTTP 403"),
        (requests.Timeout(), "délai dépassé"),
        (requests.ConnectionError("Name or service not known"), "adresse introuvable (DNS)"),
        (requests.ConnectionError("refused"), "connexion impossible"),
    ])
    def test_describe_error_is_readable(self, exc, expected):
        assert net.describe_error(exc) == expected


# ─── RSS ──────────────────────────────────────────────────────────

RSS_SAMPLE = """<?xml version="1.0"?><rss version="2.0"><channel><title>TechCrunch</title>
<item><title>New model</title><link>https://techcrunch.com/a</link>
<pubDate>{date}</pubDate><description>hello</description></item>
</channel></rss>"""


class TestRSS:
    def test_dead_feeds_are_redirected(self):
        assert normalize_feed_url("https://blog.openai.com/rss/") == "https://openai.com/news/rss.xml"
        assert normalize_feed_url(
            "https://feeds.technologyreview.com/technologyreview/ai/"
        ) == "https://www.technologyreview.com/topic/artificial-intelligence/feed"
        assert normalize_feed_url("https://example.com/feed") == "https://example.com/feed"

    def test_failed_feed_is_reported_with_its_reason(self):
        src = RSSSource(feeds={"tech": ["https://techcrunch.com/feed/"]})
        with patch("sources.rss.net.get", side_effect=http_error(403)):
            assert src.fetch() == []
        assert len(src.checks) == 1
        check = src.checks[0]
        assert check.ok is False
        assert "techcrunch.com" in check.key
        assert check.detail == "HTTP 403"

    def test_working_feed_gives_articles_and_ok_check(self):
        from email.utils import format_datetime
        from datetime import datetime, timezone
        body = RSS_SAMPLE.format(date=format_datetime(datetime.now(timezone.utc)))
        src = RSSSource(feeds={"tech": ["https://techcrunch.com/feed/"]})
        with patch("sources.rss.net.get", return_value=fake_response(body)):
            articles = src.fetch()
        assert [a.url for a in articles] == ["https://techcrunch.com/a"]
        assert src.checks[0].ok is True


# ─── arXiv ────────────────────────────────────────────────────────

class TestArxiv:
    def test_query_keeps_or_as_an_operator(self):
        q = build_query(["cs.AI", "cs.LG"], [])
        url = requests.Request("GET", "https://export.arxiv.org/api/query",
                               params={"search_query": q}).prepare().url
        assert "%2B" not in url  # the old bug: "+OR+" was sent as a literal "%2BOR%2B"
        assert "cat%3Acs.AI+OR+cat%3Acs.LG" in url

    def test_query_filters_by_keywords(self):
        q = build_query(["cs.AI"], ["Claude Code", "agents"])
        assert q == '(cat:cs.AI) AND (abs:"claude code" OR abs:"agents")'

    def test_api_failure_is_reported(self):
        src = ArxivSource(categories=["cs.AI"])
        with patch("sources.arxiv.net.get", side_effect=requests.Timeout()):
            assert src.fetch() == []
        assert src.checks[0].ok is False
        assert src.checks[0].detail == "délai dépassé"


# ─── Reddit sans identifiants ─────────────────────────────────────

REDDIT_ATOM = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry><category term="ClaudeAI" label="r/ClaudeAI"/><id>t3_abc123</id>
<link href="https://www.reddit.com/r/ClaudeAI/comments/abc123/hooks/"/>
<updated>{date}</updated><published>{date}</published>
<title>Claude Code hooks are great</title>
<content type="html">&lt;p&gt;Body text&lt;/p&gt;</content></entry>
</feed>"""


class TestRedditPublicFeed:
    def test_uses_one_combined_request_without_keys(self):
        from datetime import datetime, timezone
        body = REDDIT_ATOM.format(date=datetime.now(timezone.utc).isoformat())
        src = RedditSource(subreddits={"tech": ["ClaudeAI", "LocalLLaMA"]})
        with patch("sources.reddit.config.REDDIT_CLIENT_ID", ""), \
             patch("sources.reddit.net.get", return_value=fake_response(body)) as get:
            articles = src.fetch()
        assert get.call_count == 1
        assert "/r/ClaudeAI+LocalLLaMA/top/.rss" in get.call_args.args[0]
        assert len(articles) == 1
        a = articles[0]
        assert a.source == "r/ClaudeAI"
        assert a.external_id == "abc123"
        assert a.platform == "reddit"
        assert "Body text" in a.text and "<p>" not in a.text
        assert src.checks[0].ok is True

    def test_rate_limit_is_reported(self):
        src = RedditSource(subreddits={"tech": ["ClaudeAI"]})
        with patch("sources.reddit.config.REDDIT_CLIENT_ID", ""), \
             patch("sources.reddit.net.get", side_effect=http_error(429)):
            assert src.fetch() == []
        assert src.checks[0].ok is False
        assert src.checks[0].detail == "HTTP 429"
