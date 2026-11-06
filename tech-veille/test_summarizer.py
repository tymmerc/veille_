"""Tests for summaries: no invented facts, no filler, real changelog lines, real page text."""

import json
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, "/opt/tech-veille")
import content  # noqa: E402
import summarizer  # noqa: E402
from sources.base import Article  # noqa: E402


def art(platform="hackernews", text="", title="Show HN: K8sman – A Native Kubernetes IDE",
        url="https://k8sman.example/") -> Article:
    return Article(title=title, url=url, text=text, source="HackerNews", category="tech",
                   platform=platform, external_id="x1")


LONG_TEXT = "K8sman is a native Kubernetes IDE built with Flutter and Go. " * 10


class TestParseSummary:
    def test_strips_filler_openers(self):
        raw = json.dumps({"accroche": "Dans cet article publié sur HackerNews, k8sman est un IDE.",
                          "points": ["Voici : licence Apache 2.0."]})
        hook, points = summarizer.parse_summary_json(raw)
        assert hook == "K8sman est un IDE."
        assert points == ["Licence Apache 2.0."]

    def test_caps_points_and_drops_empty_ones(self):
        raw = json.dumps({"accroche": "Un fait.", "points": ["a1", "", "a2", "a3", "a4"]})
        _, points = summarizer.parse_summary_json(raw)
        assert points == ["A1", "A2", "A3"]

    def test_invalid_json_gives_none(self):
        assert summarizer.parse_summary_json("not json") is None
        assert summarizer.parse_summary_json(json.dumps({"points": []})) is None


class TestFormat:
    def test_points_are_bullets_after_separator(self):
        assert summarizer.format_summary("Hook.", ["Un.", "Deux."]) == "Hook.|||• Un.\n• Deux."

    def test_no_points_leaves_detail_empty(self):
        assert summarizer.format_summary("Hook.", []) == "Hook.|||"


class TestSummarize:
    def test_long_text_uses_json_summary(self):
        reply = json.dumps({"accroche": "K8sman est un IDE Kubernetes natif.", "points": ["Écrit en Go."]})
        with patch("summarizer._ask_ollama", return_value=reply) as ask:
            out = summarizer.summarize_article(art(text=LONG_TEXT))
        assert out == "K8sman est un IDE Kubernetes natif.|||• Écrit en Go."
        assert ask.call_args.kwargs.get("json_mode") is True

    def test_title_only_never_asks_for_details(self):
        with patch("summarizer._ask_ollama", return_value="K8sman, un IDE Kubernetes natif.") as ask:
            out = summarizer.summarize_article(art(text=""))
        assert out == "K8sman, un IDE Kubernetes natif.|||"
        assert "TEXTE" not in ask.call_args.args[0]

    def test_title_is_kept_as_published(self):
        a = art(text="")
        with patch("summarizer._ask_ollama", return_value="Phrase."):
            summarizer.summarize_article(a)
        assert a.title == "Show HN: K8sman – A Native Kubernetes IDE"
        assert a.title_original == a.title

    def test_github_points_are_the_real_changelog_lines(self):
        text = "Nouvelles fonctionnalites de Claude Code v2.1:\nAdded `effort` param\nFixed MCP auth\nNew /usage"
        a = art(platform="github", text=text, title="Claude Code v2.1")
        with patch("summarizer._ask_ollama", return_value="Arrivée du paramètre effort.") as ask:
            out = summarizer.summarize_article(a)
        assert out == "Arrivée du paramètre effort.|||• Added `effort` param\n• Fixed MCP auth\n• New /usage"
        assert ask.call_count == 1

    def test_release_notes_points_are_the_real_changes(self):
        text = ("Changements de API Claude du 5 novembre 2026 :\n"
                "IP allowlist in the Claude Console, in beta\nRequests from other IPs are rejected")
        a = art(platform="release_notes", text=text, title="Notes de version API Claude : 5 novembre 2026")
        a.source = "Notes de version API Claude"
        with patch("summarizer._ask_ollama", return_value="Une liste d'IP autorisées arrive.") as ask:
            out = summarizer.summarize_article(a)
        assert out == ("Une liste d'IP autorisées arrive.|||• IP allowlist in the Claude Console, in beta\n"
                       "• Requests from other IPs are rejected")
        prompt = ask.call_args[0][0]
        assert "API Claude" in prompt and "Notes de version" not in prompt

    def test_release_notes_keep_their_preset_score(self):
        a = art(platform="release_notes", text="header\nchange")
        a.score = 8
        with patch("summarizer._ask_ollama") as ask:
            assert summarizer.score_article(a) == 8
        ask.assert_not_called()

    def test_ollama_down_falls_back_to_title(self):
        with patch("summarizer._ask_ollama", return_value=None):
            out = summarizer.summarize_article(art(text=LONG_TEXT))
        assert out == "Show HN: K8sman – A Native Kubernetes IDE|||"


class TestContent:
    def test_short_text_is_replaced_by_page_text(self):
        page = MagicMock(content=b"<html>page</html>")
        with patch("content.net.get", return_value=page), \
             patch("content.trafilatura.extract", return_value=LONG_TEXT):
            enriched = content.enrich(art(text=""))
        assert enriched.text.startswith("K8sman is a native")

    def test_long_text_is_left_alone(self):
        a = art(text=LONG_TEXT)
        with patch("content.net.get") as get:
            assert content.enrich(a) is a
        get.assert_not_called()

    def test_fetch_failure_keeps_article(self):
        a = art(text="")
        with patch("content.net.get", side_effect=Exception("boom")):
            assert content.enrich(a) is a

    def test_skips_github_and_hn_discussion_pages(self):
        for a in (art(platform="github"), art(url="https://news.ycombinator.com/item?id=1")):
            with patch("content.net.get") as get:
                content.enrich(a)
            get.assert_not_called()


class TestGrounding:
    SOURCE = "MCP is an open protocol. JSON-RPC over stdin/stdout or one HTTP endpoint. Costs $0.07 per second."

    def test_invented_name_is_dropped(self):
        assert not summarizer.is_grounded("Développé par Google, MCP est ouvert.", self.SOURCE)

    def test_known_names_and_numbers_pass(self):
        assert summarizer.is_grounded("Il utilise JSON-RPC sur stdin/stdout ou HTTP.", self.SOURCE)
        assert summarizer.is_grounded("Le prix tombe à 0,07 $ par seconde.", self.SOURCE)

    def test_invented_number_is_dropped(self):
        assert not summarizer.is_grounded("Le prix tombe à 0,05 $ par seconde.", self.SOURCE)

    def test_first_word_and_french_ai_acronym_are_fine(self):
        assert summarizer.is_grounded("Nouvelle norme d'IA pour MCP.", self.SOURCE)

    def test_summary_drops_ungrounded_points(self):
        text = self.SOURCE * 10
        reply = json.dumps({"accroche": "MCP est un protocole ouvert.",
                            "points": ["Développé par Google.", "Transport JSON-RPC sur HTTP."]})
        with patch("summarizer._ask_ollama", return_value=reply):
            out = summarizer.summarize_article(art(text=text, title="MCP Explained"))
        assert out == "MCP est un protocole ouvert.|||• Transport JSON-RPC sur HTTP."


class TestScoreFloor:
    def test_floor_raises_score_and_keeps_article(self):
        a = art(text=LONG_TEXT, title="Critical nginx vulnerability")
        reply = json.dumps({"accroche": "Une faille dans nginx.", "points": []})
        with patch("summarizer.score_article", return_value=2), \
             patch("summarizer._ask_ollama", return_value=reply):
            kept = summarizer.process_articles([a], floor=lambda x: 8)
        assert kept == [a] and a.score == 8


class TestSummaryMinScore:
    """Low-scored articles are kept for the global feed, without an Ollama summary."""

    def test_low_score_article_is_kept_without_calling_ollama(self):
        a = art(text=LONG_TEXT)
        with patch("summarizer.score_article", return_value=summarizer.SUMMARY_MIN_SCORE - 1), \
             patch("summarizer._ask_ollama") as ask:
            kept = summarizer.process_articles([a])
        ask.assert_not_called()
        assert kept == [a]
        assert a.summary == summarizer.format_summary(a.title, [])
        assert a.title_original == a.title

    def test_article_at_threshold_is_summarized(self):
        a = art(text=LONG_TEXT)
        reply = json.dumps({"accroche": "K8sman est un IDE Kubernetes natif.", "points": []})
        with patch("summarizer.score_article", return_value=summarizer.SUMMARY_MIN_SCORE), \
             patch("summarizer._ask_ollama", return_value=reply) as ask:
            summarizer.process_articles([a])
        assert ask.call_count == 1
        assert a.summary.startswith("K8sman est un IDE Kubernetes natif.")

    def test_threshold_is_five(self):
        assert summarizer.SUMMARY_MIN_SCORE == 5
