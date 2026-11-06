"""Weekly market brief of a project: competitors, platforms and rules, press. Private (Discord)."""
from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone

import feedparser

import config
import market
from sources import net
from sources.github_releases import is_stable

log = logging.getLogger(__name__)

GOOGLE_NEWS = "https://news.google.com/rss/search"
GITHUB_ATOM = "https://github.com/{}/releases.atom"
MAX_PLATFORM = 8


def _entry_date(entry) -> datetime | None:
    for field in ("published_parsed", "updated_parsed"):
        raw = entry.get(field)
        if raw:
            return datetime(*raw[:6], tzinfo=timezone.utc)
    return None


def _feed(url: str, params: dict | None = None) -> list:
    try:
        return feedparser.parse(net.get(url, params=params, timeout=25).content).entries
    except Exception as exc:
        log.warning("Brief feed %s failed (%s)", url, net.describe_error(exc))
        return []


def platform_lines(project: dict, since: datetime) -> list[str]:
    signals = project.get("signals") or {}
    lines = []
    for feed in signals.get("feeds", []):
        keep = [k.lower() for k in feed.get("keep", [])]
        for e in _feed(feed["url"]):
            when = _entry_date(e)
            title = e.get("title", "")
            if when and when >= since and (not keep or any(k in title.lower() for k in keep)):
                lines.append(f"▸ [{title}]({e.get('link', feed['url'])}) · *{feed['name']}, {when:%d/%m}*")
    for item in signals.get("github", []):
        repo, prefix = (item, "") if isinstance(item, str) else (item["repo"], item.get("tag_prefix", ""))
        for e in _feed(GITHUB_ATOM.format(repo)):
            when = _entry_date(e)
            tag = e.get("link", "").rsplit("/", 1)[-1]
            if when and when >= since and is_stable({"tag_name": tag}, prefix):
                lines.append(f"▸ [{repo.split('/')[-1]} {e.get('title', '')}]({e.get('link', '')}) · *GitHub, {when:%d/%m}*")
    return lines[:MAX_PLATFORM]


STOPWORDS = {"les", "des", "une", "pour", "dans", "avec", "sur", "the", "and", "for", "mise", "jour", "app"}


def _tokens(query: str) -> list[str]:
    phrases = re.findall(r'"([^"]+)"', query)
    rest = re.sub(r'"[^"]+"', " ", query)
    words = [w for w in re.findall(r"[\w&-]+", rest.lower()) if len(w) >= 3 and w not in STOPWORDS]
    return [p.lower() for p in phrases] + words


def relevant(title: str, query: str) -> bool:
    """Google News matches loosely: keep a title only if it has most of the query's words."""
    text = title.lower()
    tokens = _tokens(query)
    if not tokens:
        return True
    phrases = re.findall(r'"([^"]+)"', query)
    if phrases and not all(p.lower() in text for p in phrases):
        return False
    hits = sum(1 for t in tokens if t in text)
    return hits >= min(2, len(tokens)) or (phrases and hits >= 1)


def news_lines(project: dict, since: datetime) -> list[str]:
    seen, items = set(), []
    for query in (project.get("signals") or {}).get("news", []):
        params = {"q": f"{query} when:7d", "hl": "fr", "gl": "FR", "ceid": "FR:fr"}
        for e in _feed(GOOGLE_NEWS, params):
            when = _entry_date(e)
            title = e.get("title", "").rsplit(" - ", 1)[0]
            key = title.lower()[:80]
            if not when or when < since or key in seen or not relevant(title, query):
                continue
            seen.add(key)
            source = (e.get("source") or {}).get("title", "")
            items.append((when, f"▸ [{title}]({e.get('link', '')}) · *{source}, {when:%d/%m}*"))
        time.sleep(1)
    items.sort(key=lambda x: x[0], reverse=True)
    return [line for _, line in items[:market.MAX_NEWS]]


def build(project: dict, now: datetime) -> list[dict]:
    """Discord embeds for the brief."""
    slug = project["slug"]
    folder = market.DATA_DIR / slug
    since = now - timedelta(days=7)
    week_start = since.date().isoformat()
    changes = [c for c in market._load(folder / "changes.json", []) if c.get("day", "") > week_start]
    snaps = market._load(folder / "snapshots.json", {})
    history = market._load(folder / "reviews.json", {})
    today = now.date().isoformat()

    comp_changes = [c for c in changes if c["kind"] in ("note", "prix", "page")]
    moved = {c["competitor"] for c in comp_changes}
    names = [c["name"] for c in project.get("competitors", [])]
    deltas = {n: market.review_delta(history.get(n, {}), today) for n in names}
    lines = market.competitor_lines(comp_changes, [n for n in names if n not in moved], deltas)
    status = []
    for comp in project.get("competitors", []):
        snap = snaps.get(market.APPSTORE.format(comp["appstore"])) if comp.get("appstore") else None
        if snap:
            status.append(market.status_line(comp["name"], snap, deltas.get(comp["name"])))

    rules = []
    for c in (c for c in changes if c["kind"] == "signal"):
        sig = next((s for s in project["signals"]["pages"] if s["name"] == c["competitor"]), {})
        rules.append(f"⚠️ **{c['competitor']}** a changé · [voir]({c['url']})\n→ {sig.get('hint', 'À relire.')}")
    rules += platform_lines(project, since)

    local = now.astimezone(config.LOCAL_TZ)
    monday = (local - timedelta(days=local.weekday())).date()
    embeds = [
        {"title": "🎯 Concurrents", "color": 0xE8664F,
         "description": "\n\n".join(lines) + ("\n\n**État cette semaine**\n" + "\n".join(status) if status else "")},
        {"title": "🔧 Plateformes et règles", "color": 0x5865F2,
         "description": "\n".join(rules) or "Rien de notable cette semaine."},
        {"title": "📰 Dans la presse", "color": 0x2F3136,
         "description": "\n".join(news_lines(project, since)) or "Rien trouvé cette semaine."},
    ]
    if project.get("manual_checks"):
        embeds.append({"title": "✋ À vérifier à la main", "color": 0x2F3136,
                       "description": "\n".join(f"▸ {m}" for m in project["manual_checks"])})
    for e in embeds:
        e["description"] = e["description"][:4000]
    embeds[0]["author"] = {"name": f"Veille marché {project['name']} · semaine du {monday.day}/{monday.month}"}
    return embeds


def send(project: dict, embeds: list[dict], admin_webhook: str) -> bool:
    from notifier import _post

    webhook = os.getenv(project.get("webhook_env", ""), "") or admin_webhook
    if not webhook:
        log.warning("Market %s: no webhook, brief not sent", project["slug"])
        return False
    return _post(webhook, {"embeds": embeds[:10]}, {200, 204}, f"Discord market {project['slug']}")


def run_all(now: datetime, admin_webhook_getter) -> None:
    """Called every hour by main.py: daily snapshot, weekly brief."""
    for slug in market.project_slugs():
        try:
            project = market.load_project(slug)
            folder = market.DATA_DIR / slug
            state = market._load(folder / "state.json", {})
            today = now.date().isoformat()
            if state.get("last_snapshot") != today:
                market.snapshot(project, now)
                state["last_snapshot"] = today
                market._save(folder / "state.json", state)
            if market.brief_due(now, state.get("last_brief"), project.get("brief_weekday", 0)):
                if send(project, build(project, now), admin_webhook_getter()):
                    state["last_brief"] = now.astimezone(config.LOCAL_TZ).date().isoformat()
                    market._save(folder / "state.json", state)
                    log.info("Market brief %s sent", slug)
        except Exception:
            log.exception("Market watch %s failed", slug)


if __name__ == "__main__":
    import json
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s — %(message)s")
    proj = market.load_project(sys.argv[1] if len(sys.argv) > 1 else "shimmer")
    current = datetime.now(timezone.utc)
    if "--snapshot" in sys.argv:
        market.snapshot(proj, current)
    print(json.dumps(build(proj, current), indent=1, ensure_ascii=False))
