"""Market watch per project: what CHANGED at competitors and on the platforms, once a week.

Not an article feed. Every day we take a snapshot of public pages (Shopify App
Store listings, pricing pages, platform rules) and keep only meaningful
differences: price, rating, AI features. Monday morning, one private brief.
Config lives in projects/<slug>.yaml.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

import trafilatura
import yaml
from bs4 import BeautifulSoup

import config
from sources import net

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent
PROJECTS_DIR = ROOT / "projects"
DATA_DIR = ROOT / "data" / "market"
APPSTORE = "https://apps.shopify.com/{}"
APPSTORE_PAUSE = 3  # seconds between App Store pages: it rate-limits fast
RATING_STEP = 0.1
MAX_SENTENCES = 4
MAX_NEWS = 8
MONEY = re.compile(r"[$€£]\s?\d|\d\s?(?:[$€£]|eur\b|usd\b)|\d+\s?%", re.IGNORECASE)
AI_WORDS = ["AI", "IA", "assistant", "agent", "quiz", "guided", "conversational", "conversationnel", "chatbot"]
PLAN_PRICE = re.compile(r"\$\s?([\d,]+(?:\.\d+)?)\s*/\s*month", re.IGNORECASE)


# ─── Pure helpers ─────────────────────────────────────────────────

def parse_listing(html: bytes) -> dict:
    """Rating, review count and pricing plans of a Shopify App Store listing."""
    soup = BeautifulSoup(html, "html.parser")
    rating = reviews = None
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or "")
        except ValueError:
            continue
        agg = data.get("aggregateRating") if isinstance(data, dict) else None
        if agg:
            rating, reviews = agg.get("ratingValue"), agg.get("ratingCount")
            break
    plans = []
    for el in soup.select('[class*="pricing-plan-card"]'):
        text = " ".join(el.get_text(" ", strip=True).split())
        if text.count("Plan ") <= 1 and text not in plans:
            plans.append(text[:300])
    return {"rating": rating, "reviews": reviews, "plans": plans}


def listing_changes(old: dict, new: dict) -> list[dict]:
    changes = []
    if old.get("rating") is not None and new.get("rating") is not None \
            and abs(new["rating"] - old["rating"]) >= RATING_STEP - 1e-9:
        changes.append({"kind": "note", "before": old["rating"], "after": new["rating"]})
    added = [p for p in new.get("plans", []) if p not in old.get("plans", [])]
    removed = [p for p in old.get("plans", []) if p not in new.get("plans", [])]
    if added or removed:
        changes.append({"kind": "prix", "added": added, "removed": removed})
    return changes


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text or "")
    return [" ".join(p.split()) for p in parts if len(p.strip()) > 3]


def _has_word(sentence: str, words: list[str]) -> bool:
    return any(re.search(rf"(?<!\w){re.escape(w)}(?!\w)", sentence, re.IGNORECASE) for w in words)


def page_changes(old: str, new: str, watch_words: list[str]) -> tuple[list[str], list[str]]:
    """Added/removed sentences that mention a price, a percentage or a watched word."""
    before, after = _sentences(old), _sentences(new)
    keep = lambda s: bool(MONEY.search(s)) or _has_word(s, watch_words)  # noqa: E731
    added = [s for s in after if s not in before and keep(s)]
    removed = [s for s in before if s not in after and keep(s)]
    return added[:MAX_SENTENCES], removed[:MAX_SENTENCES]


def hint(change: dict, competitor: str) -> str:
    """One concrete sentence for clear cases only. Empty when there is nothing sure to say."""
    kind = change.get("kind")
    if kind == "prix":
        return f"{competitor} touche à ses prix : comparer avec notre offre payée au prouvé."
    if kind == "note":
        if change["after"] < change["before"]:
            return f"La note de {competitor} baisse : ses avis négatifs disent ce que les marchands n'aiment pas."
        return f"La note de {competitor} monte : regarder ce que ses avis récents saluent."
    if kind == "page":
        text = " ".join(change.get("added", []))
        if MONEY.search(text):
            return f"{competitor} affiche de nouveaux prix ou pourcentages sur son site."
        if _has_word(text, AI_WORDS):
            return f"{competitor} met en avant de l'IA ou de la vente guidée : voir si ça recoupe le vendeur sous la barre."
    return ""


def review_delta(history: dict, today: str, days: int = 7) -> int | None:
    """New reviews over the last `days`, from the daily history {date: count}."""
    if today not in history:
        return None
    limit = (datetime.fromisoformat(today) - timedelta(days=days)).date().isoformat()
    older = [d for d in history if d <= limit]
    if not older:
        return None
    return history[today] - history[max(older)]


def brief_due(now: datetime, last_brief: str | None, brief_weekday: int) -> bool:
    local = now.astimezone(config.LOCAL_TZ)
    return local.weekday() == brief_weekday and local.hour >= 8 and last_brief != local.date().isoformat()


def _quote(items: list[str], limit: int = 160) -> str:
    return " / ".join(f"« {i[:limit]} »" for i in items)


def competitor_lines(changes: list[dict], quiet: list[str], deltas: dict) -> list[str]:
    lines = []
    for c in changes:
        name = c["competitor"]
        if c["kind"] == "note":
            what = f"note {c['before']} → {c['after']}"
        elif c["kind"] == "prix":
            what = "formules : " + "; ".join(filter(None, [
                f"nouveau {_quote(c['added'])}" if c.get("added") else "",
                f"retiré {_quote(c['removed'])}" if c.get("removed") else "",
            ]))
        else:
            what = "site : " + _quote(c.get("added") or c.get("removed") or [])
        line = f"**{name}** · {what} · [preuve]({c['url']})"
        tip = hint(c, name)
        if tip:
            line += f"\n→ {tip}"
        lines.append(line)
    if quiet:
        lines.append("Rien de neuf : " + ", ".join(quiet) + ".")
    return lines


def status_line(name: str, snap: dict, delta: int | None) -> str:
    parts = [f"**{name}**"]
    if snap.get("rating") is not None:
        parts.append(f"{snap['rating']}★")
    if snap.get("reviews") is not None:
        parts.append(f"{snap['reviews']} avis" + (f" (+{delta})" if delta else ""))
    prices = [float(m.replace(",", "")) for p in snap.get("plans", []) for m in PLAN_PRICE.findall(p)]
    if prices:
        parts.append(f"dès ${min(prices):g}/mois")
    return " · ".join(parts)


# ─── Storage ──────────────────────────────────────────────────────

def _load(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def _save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def load_project(slug: str) -> dict:
    return yaml.safe_load((PROJECTS_DIR / f"{slug}.yaml").read_text())


def project_slugs() -> list[str]:
    return sorted(p.stem for p in PROJECTS_DIR.glob("*.yaml"))


# ─── Daily snapshot ───────────────────────────────────────────────

def _page_text(url: str) -> str:
    html = net.get(url, timeout=25, wait_on_429=20).content
    return trafilatura.extract(html, favor_recall=True) or ""


def snapshot(project: dict, now: datetime) -> list[dict]:
    """Fetch every watched page, record what changed since the last snapshot."""
    folder = DATA_DIR / project["slug"]
    snaps = _load(folder / "snapshots.json", {})
    history = _load(folder / "reviews.json", {})
    changes = _load(folder / "changes.json", [])
    day = now.date().isoformat()
    words = project.get("watch_words", [])
    found: list[dict] = []

    def record(name: str, url: str, change: dict) -> None:
        found.append({**change, "competitor": name, "url": url, "day": day})

    for comp in project.get("competitors", []):
        name = comp["name"]
        if comp.get("appstore"):
            url = APPSTORE.format(comp["appstore"])
            try:
                new = parse_listing(net.get(url, timeout=25, wait_on_429=30).content)
            except Exception as exc:
                log.warning("Market %s: listing %s failed (%s)", project["slug"], url, net.describe_error(exc))
            else:
                old = snaps.get(url)
                for change in (listing_changes(old, new) if old else []):
                    record(name, url, change)
                snaps[url] = new
                if new.get("reviews") is not None:
                    history.setdefault(name, {})[day] = new["reviews"]
            time.sleep(APPSTORE_PAUSE)
        for url in comp.get("pages", []):
            _snapshot_page(name, url, words, snaps, record)

    for sig in (project.get("signals") or {}).get("pages", []):
        _snapshot_page(sig["name"], sig["url"], words + ["read_all_orders", "training", "entraînement"],
                       snaps, record, signal=True)

    cutoff = (now - timedelta(days=60)).date().isoformat()
    changes = [c for c in changes if c.get("day", "") >= cutoff] + found
    _save(folder / "snapshots.json", snaps)
    _save(folder / "reviews.json", history)
    _save(folder / "changes.json", changes)
    log.info("Market %s: %d changement(s) aujourd'hui", project["slug"], len(found))
    return found


def _snapshot_page(name, url, words, snaps, record, signal=False) -> None:
    try:
        text = _page_text(url)
    except Exception as exc:
        log.warning("Market page %s failed (%s)", url, net.describe_error(exc))
        return
    old = snaps.get(url)
    if isinstance(old, str) and old != text:
        if signal:
            added, removed = page_changes(old, text, words + ["must", "required", "doit", "obligatoire"])
            if added or removed:
                record(name, url, {"kind": "signal", "added": added, "removed": removed})
        else:
            added, removed = page_changes(old, text, words)
            if added or removed:
                record(name, url, {"kind": "page", "added": added, "removed": removed})
    snaps[url] = text
