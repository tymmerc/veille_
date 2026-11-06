"""Tests for source health tracking: alert once when a source stays down, once when it is back."""

import sys
from datetime import datetime, timezone

sys.path.insert(0, "/opt/tech-veille")
from health import Check, load_state, save_state, update_health  # noqa: E402

NOW = datetime(2026, 11, 6, 9, 0, tzinfo=timezone.utc)


def run_failures(n: int, state: dict | None = None, threshold: int = 3):
    state = state or {}
    all_alerts = []
    for _ in range(n):
        state, alerts = update_health(state, [Check("RSS techcrunch.com", False, "HTTP 403")], NOW, threshold)
        all_alerts.extend(alerts)
    return state, all_alerts


def test_no_alert_before_threshold():
    _, alerts = run_failures(2)
    assert alerts == []


def test_alert_once_at_threshold():
    state, alerts = run_failures(5)
    assert len(alerts) == 1
    assert "RSS techcrunch.com" in alerts[0]
    assert "HTTP 403" in alerts[0]
    assert state["RSS techcrunch.com"]["fails"] == 5


def test_recovery_alert_only_after_a_down_alert():
    state, _ = run_failures(3)
    state, alerts = update_health(state, [Check("RSS techcrunch.com", True)], NOW, 3)
    assert len(alerts) == 1
    assert "remarche" in alerts[0]
    assert state["RSS techcrunch.com"]["fails"] == 0

    _, alerts = update_health(state, [Check("RSS techcrunch.com", True)], NOW, 3)
    assert alerts == []


def test_short_glitch_does_not_alert():
    state, _ = run_failures(1)
    _, alerts = update_health(state, [Check("RSS techcrunch.com", True)], NOW, 3)
    assert alerts == []


def test_input_state_is_not_mutated():
    state = {"Arxiv": {"fails": 1, "alerted": False}}
    update_health(state, [Check("Arxiv", False, "HTTP 500")], NOW, 3)
    assert state == {"Arxiv": {"fails": 1, "alerted": False}}


def test_sources_no_longer_checked_are_dropped():
    state = {"Old source": {"fails": 9, "alerted": True}}
    new_state, alerts = update_health(state, [Check("Arxiv", True)], NOW, 3)
    assert "Old source" not in new_state
    assert alerts == []


def test_state_roundtrip(tmp_path):
    path = tmp_path / "health.json"
    assert load_state(path) == {}
    save_state(path, {"Arxiv": {"fails": 2, "alerted": False}})
    assert load_state(path) == {"Arxiv": {"fails": 2, "alerted": False}}


def test_corrupt_state_is_ignored(tmp_path):
    path = tmp_path / "health.json"
    path.write_text("{not json")
    assert load_state(path) == {}


def test_duplicate_keys_count_once_and_ok_wins():
    # "Blog Anthropic" is both a built-in blog and a user-followed one
    checks = [Check("Blog Anthropic", False, "HTTP 500"), Check("Blog Anthropic", True)]
    state, _ = update_health({}, checks, NOW, 3)
    assert state["Blog Anthropic"]["fails"] == 0

    checks = [Check("Blog Anthropic", False, "HTTP 500"), Check("Blog Anthropic", False, "HTTP 500")]
    state, _ = update_health({}, checks, NOW, 3)
    assert state["Blog Anthropic"]["fails"] == 1
