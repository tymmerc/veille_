"""Weekly interpretation of the veille by Claude Code (headless, Tym's subscription).

Monday morning: the week's best articles (already summarized), the stack flaws, the
Shimmer market changes and a short context file go to `claude -p` with a JSON schema.
Every fact must cite a dossier id; facts citing nothing known are dropped. The result is
saved in data/analyses/<week>.json (read by veille-app's admin page) and sent to the
admin's Discord. Private: it can mention the stack's unpatched packages.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import config
from sources.base import Article

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ANALYSES_DIR = DATA / "analyses"
STATE_PATH = DATA / "analysis-state.json"
CONTEXT_PATH = ROOT / "projects" / "context-tym.md"
CLAUDE_BIN = os.getenv("CLAUDE_BIN", "/root/.local/bin/claude")
MAX_ITEMS = 60
MIN_SCORE = 5
TIMEOUT = 900
MIN_FREE_MB = 1500  # one claude process takes about 0.9 GB
BRIEF_HOUR = 8  # Monday, Paris time
PRIO = {"haute": "🔴", "moyenne": "🟠", "basse": "⚪"}

_FACT = {"type": "object", "required": ["texte", "sources"], "additionalProperties": False,
         "properties": {"texte": {"type": "string", "maxLength": 260},
                        "sources": {"type": "array", "minItems": 1, "maxItems": 4, "items": {"type": "string"}}}}
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["en_une", "themes", "signaux_faibles", "a_surveiller"],
    "properties": {
        "en_une": {"type": "string", "maxLength": 260},
        "themes": {"type": "array", "maxItems": 5, "items": {
            "type": "object", "additionalProperties": False,
            "required": ["titre", "faits", "pour_toi", "a_faire", "priorite"],
            "properties": {
                "titre": {"type": "string", "maxLength": 80},
                "faits": {"type": "array", "minItems": 1, "maxItems": 4, "items": _FACT},
                "pour_toi": {"type": "string", "maxLength": 300},
                "a_faire": {"type": "string", "maxLength": 220},
                "priorite": {"enum": ["haute", "moyenne", "basse"]},
            }}},
        "signaux_faibles": {"type": "array", "maxItems": 3, "items": _FACT},
        "a_surveiller": {"type": "array", "maxItems": 3, "items": {"type": "string", "maxLength": 180}},
    },
}

SYSTEM_PROMPT = """Tu es l'analyste de veille de Tym. Tu reçois une fiche de contexte sur lui, puis le dossier \
de la semaine : des articles numérotés (A1, A2...) déjà triés et résumés, et des éléments internes (S1, S2...) : \
failles connues de sa stack, changements chez les concurrents de Shimmer, sources en panne.

Ta mission : dire ce qu'il faut retenir de la semaine POUR LUI.

Règles :
- 2 à 5 thèmes, du plus important au moins important pour lui. Un thème regroupe des articles qui parlent \
de la même chose, ou un seul article vraiment important.
- Chaque fait cite au moins un id du dossier. N'écris aucun fait absent du dossier. N'invente ni chiffre, \
ni date, ni nom, ni fonctionnalité.
- pour_toi : une ou deux phrases sur ce que ça change concrètement pour un de ses projets, sa stack ou sa \
façon de travailler avec Claude Code. Si ça ne change rien pour lui, ne fais pas de thème.
- a_faire : une action courte et concrète (tester, mettre à jour, lire), ou « Rien, juste à savoir. »
- signaux_faibles : 0 à 3 sujets qui reviennent dans plusieurs sources et pourraient compter plus tard.
- a_surveiller : 0 à 3 choses à revérifier la semaine prochaine.
- Français simple, phrases courtes, ton direct, tutoiement. Jamais de tiret cadratin. Pas de généralités \
sur l'IA. Les noms propres et termes techniques restent tels quels.
- Semaine calme : dis-le dans en_une et fais peu de thèmes."""


# ─── Dossier (pure) ───────────────────────────────────────────────

def week_id(now: datetime) -> str:
    year, week, _ = now.astimezone(config.LOCAL_TZ).isocalendar()
    return f"{year}-W{week:02d}"


def _hook_points(summary: str | None) -> tuple[str, list[str]]:
    hook, _, detail = (summary or "").partition("|||")
    points = [line.removeprefix("•").strip() for line in detail.splitlines() if line.strip()]
    return hook.strip(), points


def _keep(a: Article) -> bool:
    return a.score >= MIN_SCORE or a.is_official or a.platform in ("github", "release_notes")


def build_dossier(articles: list[Article], extras: dict[str, list[str]], now: datetime) -> dict:
    ranked = sorted((a for a in articles if _keep(a)), key=lambda a: a.score, reverse=True)[:MAX_ITEMS]
    items = []
    for i, a in enumerate(ranked, start=1):
        hook, points = _hook_points(a.summary)
        items.append({
            "id": f"A{i}", "titre": a.title, "source": a.source, "url": a.url, "note": a.score,
            "date": a.created_at.date().isoformat() if a.created_at else "",
            "officiel": bool(a.is_official), "accroche": hook if hook != a.title else "", "points": points,
        })
    extra_items, n = [], 0
    for kind, lines in extras.items():
        for line in lines:
            n += 1
            extra_items.append({"id": f"S{n}", "type": kind, "texte": line})
    return {"semaine": week_id(now), "articles": items, "internes": extra_items,
            "extras_ids": [e["id"] for e in extra_items]}


def ground(result: dict, dossier: dict) -> dict:
    """Copy of the result keeping only facts that cite a known id; empty themes removed."""
    known = {a["id"] for a in dossier.get("articles", [])} | set(dossier.get("extras_ids", []))
    out = json.loads(json.dumps(result))

    def ok(fact: dict) -> bool:
        return any(s in known for s in fact.get("sources", []))

    themes = []
    for theme in out.get("themes", []):
        facts = [f for f in theme.get("faits", []) if ok(f)]
        if facts:
            themes.append({**theme, "faits": facts})
    out["themes"] = themes
    out["signaux_faibles"] = [s for s in out.get("signaux_faibles", []) if ok(s)]
    return out


# ─── Discord (pure) ───────────────────────────────────────────────

def _links(sources: list[str], refs: dict) -> str:
    parts = [f"[{s[1:] if s.startswith('A') else s}]({refs[s]['url']})" for s in sources if refs.get(s, {}).get("url")]
    return " ".join(parts)


def discord_payload(saved: dict) -> dict:
    refs = saved.get("refs", {})
    week = saved.get("semaine", "").split("-W")[-1]
    content = f"**🧠 Ce qu'il faut retenir · semaine {week}**\n{saved.get('en_une', '')}"
    embeds = []
    for theme in saved.get("themes", [])[:8]:
        facts = "\n".join(f"• {f['texte']} {_links(f['sources'], refs)}".rstrip() for f in theme["faits"])
        desc = f"{facts}\n\n→ **Pour toi** : {theme['pour_toi']}\n✅ **À faire** : {theme['a_faire']}"
        embeds.append({"title": f"{PRIO.get(theme.get('priorite'), '⚪')} {theme['titre']}"[:250],
                       "description": desc[:4000], "color": 0x6C5CE7})
    extra = [f"• {s['texte']} {_links(s['sources'], refs)}".rstrip() for s in saved.get("signaux_faibles", [])]
    watch = [f"• {w}" for w in saved.get("a_surveiller", [])]
    if extra or watch:
        desc = "\n".join((["**Signaux faibles**", *extra] if extra else []) + (["**À surveiller**", *watch] if watch else []))
        embeds.append({"description": desc[:4000], "color": 0x2F3136})
    if not embeds:
        embeds.append({"description": "Rien de marquant cette semaine.", "color": 0x2F3136})
    embeds[-1]["footer"] = {"text": f"Analyse complète et historique : {config.DASHBOARD_URL}/analyse"}
    return {"content": content[:1900], "embeds": embeds[:10]}


# ─── Schedule and state ───────────────────────────────────────────

def due(now: datetime, last_week: str | None) -> bool:
    local = now.astimezone(config.LOCAL_TZ)
    return local.weekday() == 0 and local.hour >= BRIEF_HOUR and last_week != week_id(now)


def _load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text())
    except (OSError, ValueError):
        return {}


def _save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def _free_mb() -> int:
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) // 1024
    except OSError:
        pass
    return 0


# ─── Collection and Claude ────────────────────────────────────────

def collect_extras(now: datetime) -> dict[str, list[str]]:
    extras: dict[str, list[str]] = {}
    report = DATA / "stack-report.md"
    if report.exists():
        lines = [ln for ln in report.read_text().splitlines() if ln.startswith(("🔴", "🟠"))]
        extras["failles de la stack"] = [ln.replace("**", "")[:300] for ln in lines[:8]]
    since = (now - timedelta(days=7)).date().isoformat()
    for changes in sorted((DATA / "market").glob("*/changes.json")):
        try:
            items = json.loads(changes.read_text())
        except (OSError, ValueError):
            continue
        project = changes.parent.name
        extras[f"marché {project}"] = [
            f"{c.get('competitor')} ({c.get('kind')}) : " + " / ".join((c.get("added") or [])[:2])[:280]
            for c in items if c.get("day", "") > since][:8]
    try:
        health = json.loads((DATA / "health.json").read_text())
        down = [f"{k} ({v.get('detail', '')})" for k, v in health.items() if v.get("fails", 0) >= 3]
        if down:
            extras["sources en panne"] = down
    except (OSError, ValueError):
        pass
    return {k: v for k, v in extras.items() if v}


def week_articles(now: datetime) -> list[Article]:
    import storage  # needs the database: imported here so the pure parts stay testable

    probe = {"id": "", "last_notified_at": now - timedelta(days=7), "min_score": 1}
    return storage.get_unsent_articles_for_user(probe, hours=24 * 7)


def run_claude(dossier: dict) -> dict | None:
    context = CONTEXT_PATH.read_text() if CONTEXT_PATH.exists() else ""
    prompt = f"# Contexte\n{context}\n\n# Dossier de la semaine\n```json\n{json.dumps(dossier, ensure_ascii=False)}\n```"
    ANALYSES_DIR.mkdir(parents=True, exist_ok=True)
    empty_mcp = ANALYSES_DIR / ".empty-mcp.json"
    empty_mcp.write_text('{"mcpServers": {}}')
    cmd = [CLAUDE_BIN, "-p", "--output-format", "json", "--json-schema", json.dumps(SCHEMA),
           "--tools", "", "--strict-mcp-config", "--mcp-config", str(empty_mcp),
           "--no-session-persistence", "--system-prompt", SYSTEM_PROMPT]
    if os.getenv("CLAUDE_MODEL"):
        cmd += ["--model", os.environ["CLAUDE_MODEL"]]
    env = {**os.environ, "CLAUDE_CODE_OAUTH_TOKEN": config.CLAUDE_TOKEN}
    try:
        proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=TIMEOUT,
                              cwd=ANALYSES_DIR, env=env)
    except (OSError, subprocess.TimeoutExpired):
        log.exception("claude -p failed to run")
        return None
    try:
        out = json.loads(proc.stdout)
    except ValueError:
        log.error("claude -p: unreadable output (code %s): %s", proc.returncode, (proc.stderr or proc.stdout)[:300])
        return None
    if out.get("is_error"):
        log.error("claude -p error: %s", str(out.get("result"))[:300])
        return None
    log.info("claude -p: %.1f s, coût indicatif %s $", (out.get("duration_ms") or 0) / 1000, out.get("total_cost_usd"))
    result = out.get("structured_output")
    if result is None:
        try:
            result = json.loads(out.get("result") or "")
        except ValueError:
            log.error("claude -p: no structured output")
            return None
    return result if isinstance(result, dict) else None


def analyse(now: datetime) -> dict | None:
    """Build the dossier, ask Claude, keep only grounded facts, save. Returns the saved analysis."""
    dossier = build_dossier(week_articles(now), collect_extras(now), now)
    if not dossier["articles"]:
        log.info("Analyse: aucun article cette semaine")
        return None
    result = run_claude(dossier)
    if result is None:
        return None
    grounded = ground(result, dossier)
    dropped = sum(len(t.get("faits", [])) for t in result.get("themes", [])) - \
        sum(len(t["faits"]) for t in grounded["themes"])
    if dropped:
        log.info("Analyse: %d fait(s) sans source connue retiré(s)", dropped)
    refs = {a["id"]: {"titre": a["titre"], "url": a["url"], "source": a["source"]} for a in dossier["articles"]}
    refs |= {e["id"]: {"titre": e["texte"][:120], "url": "", "source": e["type"]} for e in dossier["internes"]}
    saved = {**grounded, "semaine": dossier["semaine"], "refs": refs,
             "cree_le": now.isoformat(), "nb_articles": len(dossier["articles"])}
    _save_json(ANALYSES_DIR / f"{dossier['semaine']}.json", saved)
    return saved


def maybe_run(now: datetime, webhook_getter, force: bool = False) -> bool:
    """Called every hour by main.py. Runs on Monday morning, once a week."""
    state = _load_state()
    if not force and not due(now, state.get("last_week")):
        return False
    if not config.CLAUDE_TOKEN:
        log.warning("Analyse hebdo: CLAUDE_CODE_OAUTH_TOKEN absent de .env (claude setup-token), pas d'analyse")
        return False
    if _free_mb() < MIN_FREE_MB:
        log.warning("Analyse hebdo: %d Mo libres seulement, nouvel essai au prochain passage", _free_mb())
        return False
    saved = analyse(now)
    if saved is None:
        return False
    from notifier import _post

    webhook = webhook_getter()
    if webhook and _post(webhook, discord_payload(saved), {200, 204}, "Discord analyse"):
        log.info("Analyse hebdo envoyée (%d thèmes)", len(saved["themes"]))
    _save_json(STATE_PATH, {**state, "last_week": saved["semaine"]})
    return True


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s — %(message)s")
    current = datetime.now(timezone.utc)
    if "--dossier" in sys.argv:  # show what Claude would receive, without calling it
        d = build_dossier(week_articles(current), collect_extras(current), current)
        print(json.dumps({"articles": len(d["articles"]), "internes": d["internes"]}, indent=1, ensure_ascii=False))
    else:
        import storage

        ok = maybe_run(current, lambda: storage.get_admin_webhook(config.ADMIN_USERNAME), force="--now" in sys.argv)
        print("analyse envoyée" if ok else "pas d'analyse (voir les logs)")
