"""Tests for fix briefs: one prepared Claude Code prompt per vulnerable package."""

import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, "/opt/tech-veille")
import fix_briefs as fb  # noqa: E402
import stack_watch  # noqa: E402
from stack import Dep  # noqa: E402

NOW = datetime(2026, 11, 6, 11, 0, tzinfo=timezone.utc)
NEXT = Dep("npm", "next", "14.0.4", ("quiz-app", "veille-app"))
NGINX = Dep("Ubuntu:24.04:LTS", "nginx", "1.24.0-2ubuntu7", ("système",))


def vuln(vid, severity, fixed, summary="Bad bug"):
    return {"id": vid, "summary": summary, "database_specific": {"severity": severity},
            "affected": [{"package": {"name": "next"}, "ranges": [{"events": [{"introduced": "10.0.0"}, {"fixed": fixed}]}]}]}


VULNS = [vuln("GHSA-low", "LOW", "14.2.30", "Small leak"), vuln("GHSA-rce", "CRITICAL", "15.5.28", "RCE in images")]


def test_ids_are_safe_for_urls_and_files():
    assert fb.fix_id(NEXT) == "npm-next-14.0.4"
    assert fb.fix_id(Dep("npm", "@modelcontextprotocol/sdk", "1.29.0", ("x",))) == "npm-modelcontextprotocol-sdk-1.29.0"
    assert fb.fix_id(NGINX) == "ubuntu-24.04-lts-nginx-1.24.0-2ubuntu7"


def test_brief_lists_projects_worst_first_and_the_target():
    f = stack_watch.package_finding(NEXT, VULNS)
    b = fb.brief(f, VULNS, NOW)
    assert b["id"] == "npm-next-14.0.4"
    assert b["projets"] == ["/opt/quiz-app", "/opt/veille-app"]
    assert [x["id"] for x in b["failles"]] == ["GHSA-rce", "GHSA-low"]
    assert b["cible"] == "15.5.28"
    p = b["prompt"]
    assert "next 14.0.4" in p and "15.5.28" in p and "/opt/veille-app" in p
    assert "https://osv.dev/vulnerability/GHSA-rce" in p
    assert "CLAUDE.md" in p and "heavy" in p and "GO" in p
    assert "montée de version majeure" in p  # 14 → 15
    assert "—" not in p


def test_system_package_brief_talks_about_apt_not_npm():
    f = stack_watch.package_finding(NGINX, [vuln("UBUNTU-CVE-1", "HIGH", "1.24.0-2ubuntu7.19")])
    p = fb.brief(f, f and [vuln("UBUNTU-CVE-1", "HIGH", "1.24.0-2ubuntu7.19")], NOW)["prompt"]
    assert "apt" in p and "npm install" not in p


def test_prompt_fits_the_deep_link_limit():
    many = [vuln(f"GHSA-{i}", "HIGH", "15.5.28", "x" * 300) for i in range(80)]
    f = stack_watch.package_finding(NEXT, many)
    assert len(fb.brief(f, many, NOW)["prompt"]) <= fb.MAX_PROMPT


def test_write_all_replaces_stale_briefs(tmp_path):
    from unittest.mock import patch
    stale = tmp_path / "npm-old-1.0.0.json"
    stale.write_text("{}")
    f = stack_watch.package_finding(NEXT, VULNS)
    with patch("fix_briefs.FIXES_DIR", tmp_path):
        fb.write_all([(f, VULNS)], NOW)
    assert not stale.exists()
    saved = json.loads((tmp_path / "npm-next-14.0.4.json").read_text())
    assert saved["paquet"] == "next"


def test_report_line_has_a_fix_link():
    f = stack_watch.package_finding(NEXT, VULNS)
    line = stack_watch.format_finding(f)
    assert "[Corriger avec Claude](https://tymmerc.eu/veille/fix/npm-next-14.0.4)" in line
