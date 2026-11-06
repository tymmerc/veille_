"""Tests for the stack inventory (lockfiles) and the OSV vulnerability report."""

import sys

sys.path.insert(0, "/opt/tech-veille")
import stack  # noqa: E402
import stack_watch  # noqa: E402
from stack import Dep  # noqa: E402


# ─── Lockfile parsers (direct production dependencies only) ──────

def test_package_lock_direct_dependencies_with_installed_versions():
    lock = {"lockfileVersion": 3, "packages": {
        "": {"dependencies": {"next": "14.0.4", "@prisma/client": "^6.19.0"},
             "devDependencies": {"vitest": "^2"}},
        "node_modules/next": {"version": "14.0.4"},
        "node_modules/@prisma/client": {"version": "6.19.2"},
        "node_modules/vitest": {"version": "2.1.9"},
    }}
    assert stack.parse_package_lock(lock) == [("npm", "@prisma/client", "6.19.2"), ("npm", "next", "14.0.4")]


def test_pnpm_lock_strips_peer_suffix_and_workspace_links():
    lock = {"importers": {"apps/api": {"dependencies": {
        "fastify": {"specifier": "^5", "version": "5.2.1(pino@9.0.0)"},
        "@shimmer/core": {"specifier": "workspace:*", "version": "link:../../packages/core"},
    }}}}
    assert stack.parse_pnpm_lock(lock) == [("npm", "fastify", "5.2.1")]


def test_composer_lock_keeps_only_required_packages():
    lock = {"packages": [{"name": "symfony/http-kernel", "version": "v7.4.0"},
                         {"name": "psr/log", "version": "3.0.0"}]}
    require = {"php": ">=8.2", "ext-ctype": "*", "symfony/http-kernel": "7.4.*"}
    assert stack.parse_composer_lock(lock, require) == [("Packagist", "symfony/http-kernel", "v7.4.0")]


def test_requirements_pins_and_venv_fallback():
    text = "fastapi==0.115.0\nuvicorn>=0.30\n# comment\nrequests\n"
    installed = {"uvicorn": "0.32.1"}
    assert stack.parse_requirements(text, installed) == [
        ("PyPI", "fastapi", "0.115.0"), ("PyPI", "uvicorn", "0.32.1")]


def test_find_lockfile_walks_up_to_project_root(tmp_path):
    root = tmp_path / "opt" / "impulse"
    (root / "packages" / "api").mkdir(parents=True)
    (root / "package-lock.json").write_text("{}")
    found = stack.find_lockfile(root / "packages" / "api", stop=tmp_path / "opt")
    assert found == root / "package-lock.json"


def test_keywords_come_from_well_known_names_only():
    deps = [Dep("npm", "next", "14.0.4", ("veille-app",)), Dep("npm", "zod", "3.0.0", ("x",)),
            Dep("Ubuntu:24.04:LTS", "nginx", "1.24.0", ("système",))]
    assert stack.keywords(deps) == ["Next.js", "nginx"]


# ─── OSV report ───────────────────────────────────────────────────

def vuln(vid, severity, fixed, summary="Bad bug", modified="2026-11-01T00:00:00Z"):
    return {"id": vid, "summary": summary, "modified": modified, "aliases": ["CVE-2026-1"],
            "database_specific": {"severity": severity},
            "affected": [{"package": {"name": "next", "ecosystem": "npm"},
                          "ranges": [{"type": "SEMVER", "events": [{"introduced": "10.0.0"}, {"fixed": fixed}]}]}]}


NEXT = Dep("npm", "next", "14.0.4", ("veille-app",))


def test_findings_group_by_package_with_worst_and_fix_version():
    vulns = [vuln("GHSA-a", "HIGH", "14.2.25"), vuln("GHSA-b", "CRITICAL", "15.5.28", "RCE in images")]
    f = stack_watch.package_finding(NEXT, vulns)
    assert f.worst == "CRITICAL"
    assert f.fix == "15.5.28"
    assert f.count == 2 and f.critical == 1
    assert f.worst_summary == "RCE in images"


def test_only_packages_with_new_vulns_are_reported():
    seen = {"npm|next|14.0.4|GHSA-a": "2026-11-01"}
    findings = [stack_watch.package_finding(NEXT, [vuln("GHSA-a", "HIGH", "14.2.25")])]
    new, state = stack_watch.new_findings(findings, seen, today="2026-11-06")
    assert new == []
    findings = [stack_watch.package_finding(NEXT, [vuln("GHSA-a", "HIGH", "14.2.25"),
                                                   vuln("GHSA-c", "LOW", "14.2.30")])]
    new, state = stack_watch.new_findings(findings, seen, today="2026-11-06")
    assert [f.dep.name for f in new] == ["next"]
    assert state["npm|next|14.0.4|GHSA-c"] == "2026-11-06"
    assert seen == {"npm|next|14.0.4|GHSA-a": "2026-11-01"}  # not mutated


def test_message_lines_are_short_and_actionable():
    f = stack_watch.package_finding(NEXT, [vuln("GHSA-b", "CRITICAL", "15.5.28", "RCE in images")])
    line = stack_watch.format_finding(f)
    assert line.startswith("🔴 **next 14.0.4**")
    assert "veille-app" in line
    assert "passer en 15.5.28" in line
    assert "https://osv.dev/vulnerability/GHSA-b" in line


def test_report_is_private_and_never_lists_paths():
    f = stack_watch.package_finding(NEXT, [vuln("GHSA-b", "CRITICAL", "15.5.28")])
    text = "\n".join(stack_watch.report_lines([f], total_open=1))
    assert "/opt/" not in text


# ─── Stack news ───────────────────────────────────────────────────

WORDS = ["Next.js", "nginx", "PostgreSQL", "Redis"]


def test_security_news_about_the_stack_is_detected():
    assert stack.stack_security_hits("Critical Next.js middleware bypass (CVE-2025-29927)", WORDS) == ["Next.js"]
    assert stack.stack_security_hits("nginx fixes a vulnerability in HTTP/3", WORDS) == ["nginx"]


def test_stack_news_without_security_angle_is_ignored():
    assert stack.stack_security_hits("Next.js 16 ships a new router", WORDS) == []


def test_partial_words_do_not_match():
    assert stack.stack_security_hits("Redistribution exploit found", WORDS) == []


def test_alert_is_split_into_discord_sized_blocks():
    lines = ["x" * 1500] * 5
    blocks = stack_watch.blocks(lines, size=4000)
    assert all(len(b) <= 4000 for b in blocks)
    assert sum(b.count("x" * 1500) for b in blocks) == 5
