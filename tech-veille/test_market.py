"""Tests for the project market watch: changes, not articles."""

import sys
from datetime import datetime, timezone

sys.path.insert(0, "/opt/tech-veille")
import market  # noqa: E402

LISTING_HTML = """<html><head><script type="application/ld+json">
{"@type": "SoftwareApplication", "name": "Doofinder", "aggregateRating": {"ratingValue": 4.7, "ratingCount": 760}}
</script></head><body>
<div class="app-details-pricing-plan-card">Plan Basic $61 / month Features AI Guided Search</div>
<div class="app-details-pricing-plan-card">Plan Pro $186 / month Features Quiz Maker</div>
</body></html>"""


def test_listing_parser_reads_rating_count_and_plans():
    snap = market.parse_listing(LISTING_HTML.encode())
    assert snap["rating"] == 4.7
    assert snap["reviews"] == 760
    assert snap["plans"] == ["Plan Basic $61 / month Features AI Guided Search",
                             "Plan Pro $186 / month Features Quiz Maker"]


def test_listing_changes_report_price_and_rating_moves():
    old = {"rating": 4.7, "reviews": 760, "plans": ["Plan Pro $186 / month"]}
    new = {"rating": 4.5, "reviews": 790, "plans": ["Plan Pro $199 / month"]}
    changes = market.listing_changes(old, new)
    kinds = {c["kind"] for c in changes}
    assert kinds == {"note", "prix"}
    prix = next(c for c in changes if c["kind"] == "prix")
    assert prix["added"] == ["Plan Pro $199 / month"]
    assert prix["removed"] == ["Plan Pro $186 / month"]


def test_review_count_alone_is_not_a_change():
    old = {"rating": 4.7, "reviews": 760, "plans": []}
    assert market.listing_changes(old, {**old, "reviews": 765}) == []


def test_page_changes_keep_only_meaningful_sentences():
    old = "Our Basic plan costs $49 per month. We love our customers. Copyright 2025."
    new = "Our Basic plan costs $59 per month. We love our customers. Copyright 2026. New AI shopping assistant included."
    added, removed = market.page_changes(old, new, watch_words=["AI", "assistant"])
    assert "Our Basic plan costs $59 per month." in added
    assert "New AI shopping assistant included." in added
    assert all("Copyright" not in s for s in added)
    assert removed == ["Our Basic plan costs $49 per month."]


def test_hint_is_one_concrete_sentence_for_clear_cases():
    assert "prix" in market.hint({"kind": "prix", "added": ["$59"], "removed": ["$49"]}, "Doofinder")
    assert market.hint({"kind": "page", "added": ["We love cats."], "removed": []}, "X") == ""


def test_review_delta_over_a_week():
    history = {"2026-10-30": 700, "2026-11-02": 720, "2026-11-06": 760}
    assert market.review_delta(history, today="2026-11-06", days=7) == 60
    assert market.review_delta({"2026-11-06": 760}, today="2026-11-06", days=7) is None


def test_brief_is_due_once_on_brief_day():
    monday_8h = datetime(2026, 11, 9, 7, 30, tzinfo=timezone.utc)  # 8:30 Paris
    assert market.brief_due(monday_8h, last_brief=None, brief_weekday=0)
    assert not market.brief_due(monday_8h, last_brief="2026-11-09", brief_weekday=0)
    friday = datetime(2026, 11, 6, 9, 0, tzinfo=timezone.utc)
    assert not market.brief_due(friday, last_brief=None, brief_weekday=0)


def test_brief_lines_name_the_competitor_and_link_the_proof():
    changes = [{"competitor": "Doofinder", "kind": "prix", "url": "https://apps.shopify.com/doofinder",
                "added": ["Plan Pro $199 / month"], "removed": ["Plan Pro $186 / month"], "day": "2026-11-05"}]
    text = "\n".join(market.competitor_lines(changes, quiet=["Klevu"], deltas={"Doofinder": 30}))
    assert "**Doofinder**" in text
    assert "https://apps.shopify.com/doofinder" in text
    assert "$199" in text and "$186" in text
    assert "Rien de neuf : Klevu" in text


# ─── Weekly brief, offline ────────────────────────────────────────

import json  # noqa: E402
from unittest.mock import patch  # noqa: E402

import market_brief  # noqa: E402

PROJECT = {
    "name": "Shimmer", "slug": "test-proj",
    "competitors": [{"name": "Doofinder", "appstore": "doofinder"}, {"name": "Klevu", "appstore": "klevu"}],
    "signals": {"pages": [{"name": "Prix de Mistral", "url": "https://mistral.ai/pricing", "hint": "Refaire le calcul."}],
                "feeds": [], "github": [], "news": []},
    "manual_checks": ["Regarder TMview."],
}


def test_brief_has_changes_status_rules_and_manual_checks(tmp_path):
    now = datetime(2026, 11, 9, 8, 0, tzinfo=timezone.utc)
    folder = tmp_path / "test-proj"
    folder.mkdir()
    (folder / "changes.json").write_text(json.dumps([
        {"competitor": "Doofinder", "kind": "prix", "url": "https://apps.shopify.com/doofinder",
         "added": ["Plan Pro $199 / month"], "removed": ["Plan Pro $186 / month"], "day": "2026-11-05"},
        {"competitor": "Prix de Mistral", "kind": "signal", "url": "https://mistral.ai/pricing",
         "added": ["Small: 0.2 $/M"], "removed": [], "day": "2026-11-06"},
        {"competitor": "Klevu", "kind": "note", "before": 4.9, "after": 4.5, "day": "2026-10-01",
         "url": "https://apps.shopify.com/klevu"},  # older than a week: ignored
    ]))
    (folder / "snapshots.json").write_text(json.dumps({
        "https://apps.shopify.com/doofinder": {"rating": 4.7, "reviews": 790, "plans": ["Plan Pro $199 / month"]},
    }))
    (folder / "reviews.json").write_text(json.dumps({"Doofinder": {"2026-11-02": 760, "2026-11-09": 790}}))
    with patch("market.DATA_DIR", tmp_path), patch("market_brief._feed", return_value=[]):
        embeds = market_brief.build(PROJECT, now)
    text = json.dumps(embeds, ensure_ascii=False)
    assert "**Doofinder** · formules" in text and "$199" in text
    assert "Rien de neuf : Klevu" in text
    assert "790 avis (+30)" in text and "dès $199/mois" in text
    assert "Prix de Mistral" in text and "Refaire le calcul." in text
    assert "Regarder TMview." in text
    assert embeds[0]["author"]["name"] == "Veille marché Shimmer · semaine du 9/11"
