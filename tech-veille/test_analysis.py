"""Tests for the weekly interpretation: dossier, grounding, Discord layout, schedule."""

import sys
from datetime import datetime, timezone
from unittest.mock import patch

sys.path.insert(0, "/opt/tech-veille")
import analysis  # noqa: E402
from sources.base import Article  # noqa: E402

MONDAY_9H = datetime(2026, 11, 9, 8, 0, tzinfo=timezone.utc)  # 9:00 Paris


def art(n, score=7, platform="rss", source="TechCrunch", official=False, summary="Hook.|||• Fait un"):
    a = Article(title=f"Titre {n}", url=f"https://x/{n}", text="corps", source=source, category="ia",
                platform=platform, external_id=str(n), created_at=datetime(2026, 11, 5, tzinfo=timezone.utc))
    a.score, a.summary, a.is_official = score, summary, official
    return a


class TestDossier:
    def test_items_have_short_ids_hook_and_points(self):
        d = analysis.build_dossier([art(1), art(2, score=9)], extras={}, now=MONDAY_9H)
        assert [i["id"] for i in d["articles"]] == ["A1", "A2"]
        top = d["articles"][0]
        assert top["titre"] == "Titre 2" and top["accroche"] == "Hook." and top["points"] == ["Fait un"]
        assert d["semaine"] == "2026-W46"

    def test_low_scores_are_left_out_unless_official(self):
        d = analysis.build_dossier([art(1, score=3), art(2, score=3, platform="release_notes", official=True)],
                                   extras={}, now=MONDAY_9H)
        assert [i["titre"] for i in d["articles"]] == ["Titre 2"]

    def test_size_is_capped(self):
        d = analysis.build_dossier([art(i) for i in range(200)], extras={}, now=MONDAY_9H)
        assert len(d["articles"]) == analysis.MAX_ITEMS


class TestGrounding:
    DOSSIER = {"articles": [{"id": "A1"}, {"id": "A2"}], "extras_ids": ["S1"]}

    def test_facts_without_known_source_are_dropped(self):
        result = {"en_une": "x", "themes": [
            {"titre": "T", "faits": [{"texte": "vrai", "sources": ["A1"]}, {"texte": "inventé", "sources": ["A9"]}],
             "pour_toi": "p", "a_faire": "f", "priorite": "haute"},
            {"titre": "Vide", "faits": [{"texte": "rien", "sources": []}], "pour_toi": "p", "a_faire": "f",
             "priorite": "basse"},
        ], "signaux_faibles": [{"texte": "s", "sources": ["S1"]}, {"texte": "z", "sources": ["Q1"]}],
            "a_surveiller": []}
        grounded = analysis.ground(result, self.DOSSIER)
        assert [t["titre"] for t in grounded["themes"]] == ["T"]
        assert [f["texte"] for f in grounded["themes"][0]["faits"]] == ["vrai"]
        assert [s["texte"] for s in grounded["signaux_faibles"]] == ["s"]
        assert result["themes"][0]["faits"][1]["texte"] == "inventé"  # input not mutated


class TestDiscord:
    def test_one_embed_per_theme_with_source_links_and_page_link(self):
        saved = {"semaine": "2026-W46", "en_une": "Semaine calme.", "refs": {"A1": {"titre": "Titre 1", "url": "https://x/1"}},
                 "themes": [{"titre": "Claude Code", "faits": [{"texte": "Les mods arrivent.", "sources": ["A1"]}],
                             "pour_toi": "Tes chats peuvent l'utiliser.", "a_faire": "Tester.", "priorite": "haute"}],
                 "signaux_faibles": [], "a_surveiller": []}
        payload = analysis.discord_payload(saved)
        assert "Semaine calme." in payload["content"]
        embed = payload["embeds"][0]
        assert embed["title"].startswith("🔴 Claude Code")
        assert "[1](https://x/1)" in embed["description"]
        assert "Pour toi" in embed["description"] and "À faire" in embed["description"]
        assert "analyse" in payload["embeds"][-1]["footer"]["text"]


class TestSchedule:
    def test_due_monday_morning_once_a_week(self):
        assert analysis.due(MONDAY_9H, last_week=None)
        assert not analysis.due(MONDAY_9H, last_week="2026-W46")
        assert not analysis.due(datetime(2026, 11, 6, 9, 0, tzinfo=timezone.utc), last_week=None)  # Friday
        assert not analysis.due(datetime(2026, 11, 9, 6, 0, tzinfo=timezone.utc), last_week=None)  # 7:00 Paris

    def test_no_token_means_no_run_and_a_clear_log(self, tmp_path, caplog):
        with patch("analysis.config.CLAUDE_TOKEN", ""), patch("analysis.STATE_PATH", tmp_path / "s.json"):
            assert analysis.maybe_run(MONDAY_9H, lambda: "https://discord.test/h") is False
        assert "CLAUDE_CODE_OAUTH_TOKEN" in caplog.text
