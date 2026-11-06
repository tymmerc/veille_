"""Daily check of the stack against OSV.dev: which installed versions have known flaws.

Results go ONLY to the admin's Discord and a local file: the veille-app database
is shared with every registered user, and a list of our unpatched packages must
never end up there.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from packaging.version import InvalidVersion, Version

import stack
from stack import Dep

log = logging.getLogger(__name__)

DATA = Path(__file__).resolve().parent / "data"
SEEN_PATH = DATA / "stack-vulns.json"
CACHE_PATH = DATA / "osv-cache.json"
STACK_PATH = DATA / "stack.json"
LAST_RUN_PATH = DATA / "stack-last-run.txt"
OSV_BATCH = "https://api.osv.dev/v1/querybatch"
OSV_VULN = "https://api.osv.dev/v1/vulns/{}"
BATCH_SIZE = 500
RUN_EVERY = timedelta(hours=20)
SEVERITY_RANK = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "MEDIUM": 2, "LOW": 3, "NEGLIGIBLE": 4}
ICON = {"CRITICAL": "🔴", "HIGH": "🟠", "MODERATE": "🟡", "MEDIUM": "🟡", "LOW": "⚪"}
LABEL = {"CRITICAL": "critique", "HIGH": "haute", "MODERATE": "moyenne", "MEDIUM": "moyenne", "LOW": "basse"}
MAX_LINES = 15


@dataclass(frozen=True)
class Finding:
    dep: Dep
    ids: tuple[str, ...]
    worst: str
    worst_id: str
    worst_summary: str
    fix: str
    count: int
    critical: int


# ─── Pure helpers ─────────────────────────────────────────────────

def _severity(vuln: dict) -> str:
    sev = (vuln.get("database_specific") or {}).get("severity")
    if not sev:
        for item in vuln.get("severity") or []:
            if item.get("type") == "Ubuntu":
                sev = item.get("score")
    sev = str(sev or "").upper()
    return sev if sev in SEVERITY_RANK else "UNKNOWN"


def _vkey(version: str):
    try:
        return (0, Version(version.lstrip("v")))
    except InvalidVersion:
        return (1, version)


def _fix_for(dep: Dep, vuln: dict) -> str | None:
    """Smallest fixed version above the installed one, for this package."""
    current = _vkey(dep.version)
    fixes = []
    for aff in vuln.get("affected") or []:
        if (aff.get("package") or {}).get("name") != dep.name:
            continue
        for rng in aff.get("ranges") or []:
            for event in rng.get("events") or []:
                fixed = event.get("fixed")
                if fixed and (_vkey(fixed) > current or _vkey(fixed)[0]):
                    fixes.append(fixed)
    return min(fixes, key=_vkey) if fixes else None


def package_finding(dep: Dep, vulns: list[dict]) -> Finding:
    ranked = sorted(vulns, key=lambda v: SEVERITY_RANK.get(_severity(v), 9))
    worst = ranked[0]
    fixes = [f for f in (_fix_for(dep, v) for v in vulns) if f]
    return Finding(
        dep=dep,
        ids=tuple(v["id"] for v in vulns),
        worst=_severity(worst),
        worst_id=worst["id"],
        worst_summary=(worst.get("summary") or (worst.get("details") or "").split("\n")[0])[:160],
        fix=max(fixes, key=_vkey) if fixes else "",
        count=len(vulns),
        critical=sum(1 for v in vulns if _severity(v) == "CRITICAL"),
    )


def _key(dep: Dep, vid: str) -> str:
    return f"{dep.ecosystem}|{dep.name}|{dep.version}|{vid}"


def new_findings(findings: list[Finding], seen: dict, today: str) -> tuple[list[Finding], dict]:
    """Packages that have at least one flaw not reported before, and the updated memory."""
    state = dict(seen)
    new = []
    for f in findings:
        fresh = [vid for vid in f.ids if _key(f.dep, vid) not in seen]
        if fresh:
            new.append(f)
            state.update({_key(f.dep, vid): today for vid in fresh})
    return new, state


def format_finding(f: Finding) -> str:
    icon = ICON.get(f.worst, "⚪")
    where = ", ".join(f.dep.projects)
    count = f"{f.count} faille" + ("s" if f.count > 1 else "")
    if f.critical:
        count += f" dont {f.critical} critique" + ("s" if f.critical > 1 else "")
    fix = f" · passer en {f.fix}" if f.fix else " · pas encore de correctif"
    link = f"https://osv.dev/vulnerability/{f.worst_id}"
    return (f"{icon} **{f.dep.name} {f.dep.version}** ({where}) : {count}{fix}\n"
            f"   pire : {f.worst_summary} · [{f.worst_id}]({link})")


def blocks(lines: list[str], size: int = 4000) -> list[str]:
    """Group lines into Discord embed descriptions (max 4096 chars each)."""
    out: list[str] = []
    current = ""
    for line in lines:
        line = line[:size]
        if current and len(current) + 2 + len(line) > size:
            out.append(current)
            current = line
        else:
            current = f"{current}\n\n{line}" if current else line
    if current:
        out.append(current)
    return out


def report_lines(new: list[Finding], total_open: int) -> list[str]:
    ordered = sorted(new, key=lambda f: (SEVERITY_RANK.get(f.worst, 9), -f.count))
    lines = [format_finding(f) for f in ordered[:MAX_LINES]]
    if len(ordered) > MAX_LINES:
        lines.append(f"… et {len(ordered) - MAX_LINES} autres paquets (détail dans data/stack-report.md)")
    lines.append(f"Paquets avec au moins une faille connue : {total_open}.")
    return lines


# ─── OSV ──────────────────────────────────────────────────────────

def _query_ids(deps: list[Dep]) -> dict[Dep, list[tuple[str, str]]]:
    out: dict[Dep, list[tuple[str, str]]] = {}
    for i in range(0, len(deps), BATCH_SIZE):
        chunk = deps[i:i + BATCH_SIZE]
        body = {"queries": [{"package": {"name": d.name, "ecosystem": d.ecosystem}, "version": d.version}
                            for d in chunk]}
        resp = requests.post(OSV_BATCH, json=body, timeout=60)
        resp.raise_for_status()
        for dep, result in zip(chunk, resp.json().get("results", [])):
            vulns = [(v["id"], v.get("modified", "")) for v in result.get("vulns") or []]
            if vulns:
                out[dep] = vulns
    return out


def _details(ids: list[tuple[str, str]], cache: dict) -> list[dict]:
    vulns = []
    for vid, modified in ids:
        cached = cache.get(vid)
        if not cached or cached.get("modified") != modified:
            resp = requests.get(OSV_VULN.format(vid), timeout=30)
            resp.raise_for_status()
            cached = resp.json()
            cache[vid] = {k: cached.get(k) for k in
                          ("id", "summary", "details", "modified", "withdrawn", "severity", "database_specific", "affected")}
            cached = cache[vid]
        if not cached.get("withdrawn"):
            vulns.append(cached)
    return vulns


def _load(path: Path) -> dict:
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save(path: Path, data) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    os.chmod(tmp, 0o600)  # list of unpatched packages: root only
    os.replace(tmp, path)


def _write_report(findings: list[Finding]) -> None:
    ordered = sorted(findings, key=lambda f: (SEVERITY_RANK.get(f.worst, 9), -f.count))
    lines = [f"# Failles connues dans la stack ({datetime.now(timezone.utc):%d/%m/%Y})", ""]
    lines += [format_finding(f).replace("\n   ", "\n  - ") for f in ordered]
    path = DATA / "stack-report.md"
    path.write_text("\n".join(lines) + "\n")
    os.chmod(path, 0o600)


def run() -> tuple[list[str], dict]:
    """Scan + OSV. Returns (alert lines for new flaws, memory to save once delivered)."""
    deps = stack.scan()
    words = stack.keywords(deps) + stack.ALWAYS_KEYWORDS
    _save(STACK_PATH, {"updated": datetime.now(timezone.utc).isoformat(), "keywords": words,
                       "projects": sorted({p for d in deps for p in d.projects})})

    cache = _load(CACHE_PATH)
    ids = _query_ids(deps)
    findings = [package_finding(dep, _details(vids, cache)) for dep, vids in ids.items()]
    findings = [f for f in findings if f.count]
    _save(CACHE_PATH, cache)
    _write_report(findings)

    seen = _load(SEEN_PATH)
    new, state = new_findings(findings, seen, today=datetime.now(timezone.utc).date().isoformat())
    log.info("Stack: %d dépendances, %d paquets avec failles, %d avec du nouveau",
             len(deps), len(findings), len(new))
    return (report_lines(new, len(findings)) if new else []), state


def save_seen(state: dict) -> None:
    """Call once the alert is delivered, so a failed send is retried next time."""
    _save(SEEN_PATH, state)


def due(now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    try:
        last = datetime.fromisoformat(LAST_RUN_PATH.read_text().strip())
    except (OSError, ValueError):
        return True
    return now - last >= RUN_EVERY


def mark_done(now: datetime | None = None) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    LAST_RUN_PATH.write_text((now or datetime.now(timezone.utc)).isoformat())


def stack_keywords() -> list[str]:
    """Keywords saved by the last scan (empty before the first one)."""
    return list(_load(STACK_PATH).get("keywords") or [])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s — %(message)s")
    alert, _state = run()  # manual run: prints, does not mark anything as reported
    print("\n".join(alert) or "Rien de nouveau.")
