"""One prepared Claude Code prompt per vulnerable package (asked by Tym, 06/11/2026).

The stack report links each flaw to https://tymmerc.eu/veille/fix/<id>; that admin page
reads data/fixes/<id>.json and opens Claude Code with the prompt prefilled
(claude://code/new?q=...). Tym picks the VPS environment and sends it himself.
Private: the briefs name the server's paths and its unpatched packages.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path

import config
from stack import Dep

FIXES_DIR = Path(__file__).resolve().parent / "data" / "fixes"
MAX_PROMPT = 12000  # the desktop deep link truncates around 14 000 characters
MAX_LISTED = 12
SEVERITY_RANK = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "MEDIUM": 2, "LOW": 3}
LABEL = {"CRITICAL": "critique", "HIGH": "haute", "MODERATE": "moyenne", "MEDIUM": "moyenne", "LOW": "basse"}


def fix_id(dep: Dep) -> str:
    raw = f"{dep.ecosystem}-{dep.name}-{dep.version}".lower().replace(":", "-").replace("/", "-")
    slug = re.sub(r"[^a-z0-9._-]+", "-", raw).replace("@", "")
    return re.sub(r"-{2,}", "-", slug).strip("-")[:80]


def link(dep: Dep) -> str:
    return f"{config.DASHBOARD_URL}/fix/{fix_id(dep)}"


def _severity(v: dict) -> str:
    sev = str((v.get("database_specific") or {}).get("severity") or "").upper()
    if not sev:
        for item in v.get("severity") or []:
            if item.get("type") == "Ubuntu":
                sev = str(item.get("score") or "").upper()
    return sev or "UNKNOWN"


def _fixed_in(dep: Dep, v: dict) -> str:
    fixes = [e["fixed"] for a in v.get("affected") or [] if (a.get("package") or {}).get("name") == dep.name
             for r in a.get("ranges") or [] for e in r.get("events") or [] if e.get("fixed")]
    return ", ".join(dict.fromkeys(fixes))


def _major(version: str) -> str:
    return version.lstrip("v").split(".")[0]


def brief(finding, vulns: list[dict], now: datetime) -> dict:
    dep: Dep = finding.dep
    ordered = sorted(vulns, key=lambda v: SEVERITY_RANK.get(_severity(v), 9))
    failles = [{"id": v["id"], "gravite": LABEL.get(_severity(v), "inconnue"),
                "resume": (v.get("summary") or (v.get("details") or "").split("\n")[0])[:220],
                "lien": f"https://osv.dev/vulnerability/{v['id']}", "corrige_en": _fixed_in(dep, v)}
               for v in ordered]
    projets = [f"/opt/{p}" for p in dep.projects if p != "système"]
    system = dep.ecosystem.startswith("Ubuntu") or not projets
    target = finding.fix
    major = bool(target) and not system and _major(target) != _major(dep.version)

    lines = [
        f"Corrige une faille de sécurité signalée par ma veille le {now:%d/%m/%Y}.",
        "Tu travailles sur mon VPS. Si ce chat n'est pas ouvert sur le VPS, dis-le et arrête-toi.",
        "",
        "## Ce qui est touché",
        f"- Paquet : {dep.name} {dep.version} ({dep.ecosystem})",
        f"- Où : {', '.join(projets) if projets else 'paquet système du serveur (Ubuntu)'}",
        f"- {finding.count} faille(s) connue(s), dont {finding.critical} critique(s). La plus grave : {finding.worst_summary}",
        f"- Version qui corrige toutes les failles connues : {target or 'pas encore de correctif publié'}",
    ]
    if major:
        lines.append(f"- Attention : c'est une montée de version majeure ({_major(dep.version)} vers {_major(target)}), "
                     "avec des changements cassants possibles. C'est un chantier, pas une commande.")
    lines += ["", "## Failles (les plus graves d'abord)"]
    for f in failles[:MAX_LISTED]:
        fixed = f" (corrigée en {f['corrige_en']})" if f["corrige_en"] else ""
        lines.append(f"- [{f['gravite']}] {f['id']} : {f['resume']}{fixed} {f['lien']}")
    if len(failles) > MAX_LISTED:
        lines.append(f"- et {len(failles) - MAX_LISTED} autres, moins graves.")

    lines += ["", "## Ce que j'attends, dans l'ordre"]
    steps = [
        "Lis le CLAUDE.md du projet (et sa mémoire) et respecte ses règles : prod, GO, branches, chat chef de projet.",
        "Vérifie si le projet est vraiment exposé : la fonctionnalité vulnérable est-elle utilisée ? Est-elle accessible "
        "depuis internet ? Dis-le moi en une phrase par faille grave, avant de toucher au code.",
    ]
    if system:
        steps.append("Propose la mise à jour du paquet par apt (version Ubuntu corrigée) et dis-moi quels services "
                     "il faudra redémarrer. Ne redémarre rien sans mon GO.")
    else:
        steps += [
            "Propose le plus petit correctif sûr : d'abord la dernière version corrigée de la même branche majeure si "
            "elle existe, sinon la montée de version. Travaille sur une branche git dédiée, jamais sur main.",
            "Lance les tests, puis le build via `heavy` (règle du VPS : une seule tâche lourde à la fois, regarde "
            "`free -g` avant). Corrige ce qui casse.",
            "Si un autre projet de la liste utilise la même version, traite-les un par un, pas en parallèle.",
        ]
    steps += [
        "Ne mets rien en prod et ne redémarre aucun service sans mon GO explicite dans ce chat.",
        "Termine par un compte rendu court : ce qui est corrigé, ce qui reste, comment vérifier.",
    ]
    lines += [f"{i}. {s}" for i, s in enumerate(steps, start=1)]
    prompt = "\n".join(lines)
    if len(prompt) > MAX_PROMPT:
        prompt = prompt[: MAX_PROMPT - 40].rsplit("\n", 1)[0] + "\n(liste coupée, voir la page)"

    return {
        "id": fix_id(dep), "titre": f"{dep.name} {dep.version}", "paquet": dep.name, "version": dep.version,
        "ecosysteme": dep.ecosystem, "projets": projets, "gravite": LABEL.get(finding.worst, "inconnue"),
        "nb_failles": finding.count, "nb_critiques": finding.critical, "cible": target,
        "montee_majeure": major, "failles": failles, "prompt": prompt, "cree_le": now.isoformat(),
    }


def write_all(pairs: list[tuple], now: datetime) -> int:
    """Write one brief per finding, remove briefs of packages no longer vulnerable."""
    FIXES_DIR.mkdir(parents=True, exist_ok=True)
    keep = set()
    for finding, vulns in pairs:
        data = brief(finding, vulns, now)
        keep.add(f"{data['id']}.json")
        path = FIXES_DIR / f"{data['id']}.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    for old in FIXES_DIR.glob("*.json"):
        if old.name not in keep:
            old.unlink()  # package upgraded or no longer used: its brief is obsolete
    return len(keep)
