"""Digest messages for Discord and Slack.

The layout is built from stored summaries only: no LLM call here. The old
"bulletin" written by the local model was one more place where it invented facts.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime

import requests

import config
from sources.base import Article

log = logging.getLogger(__name__)

THEME_ORDER = ["cyber", "ia", "tech"]
DIGEST_LIMIT = 10
TITLE_MAX = 110
HOOK_MAX = 220
DAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


@dataclass(frozen=True)
class Section:
    key: str
    label: str
    emoji: str
    color: int
    items: tuple[str, ...]


@dataclass(frozen=True)
class Digest:
    header: str
    sections: tuple[Section, ...]
    more: int


# ─── Layout ───────────────────────────────────────────────────────

def _hook(article: Article) -> str:
    summary = article.summary or ""
    hook = summary.split("|||", 1)[0].strip()
    if not hook or hook == article.title.strip():
        return ""
    return hook if len(hook) <= HOOK_MAX else hook[: HOOK_MAX - 1].rsplit(" ", 1)[0] + "…"


def _short(text: str, limit: int) -> str:
    text = text.replace("[", "(").replace("]", ")")  # keeps markdown links intact
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _item(article: Article) -> str:
    marker = "🔥" if article.score >= 9 else "▸"
    lines = [f"{marker} **[{_short(article.title, TITLE_MAX)}]({article.url})**"]
    hook = _hook(article)
    if hook:
        lines.append(hook)
    lines.append(f"*{article.source} · {article.score}/10*")
    return "\n".join(lines)


def build_digest(
    articles: list[Article], now: datetime, limit: int = DIGEST_LIMIT, header: str | None = None,
) -> Digest:
    ranked = sorted(articles, key=lambda a: a.score, reverse=True)
    shown, more = ranked[:limit], max(len(ranked) - limit, 0)

    period = "matin" if now.hour < 12 else ("après-midi" if now.hour < 18 else "soir")
    count = f"{len(articles)} article" + ("s" if len(articles) > 1 else "")
    title_override = header
    header = f"📡 Veille du {DAYS_FR[now.weekday()]} {now.day}/{now.month} · {period} · {count}"

    keys = THEME_ORDER + sorted({a.category for a in shown} - set(THEME_ORDER))
    sections = []
    for key in keys:
        items = tuple(_item(a) for a in shown if a.category == key)
        if not items:
            continue
        info = config.CATEGORIES.get(key, {"label": key, "emoji": "📰", "color": 0x2F3136})
        sections.append(Section(key, info["label"], info["emoji"], info["color"], items))
    return Digest(header=title_override or header, sections=tuple(sections), more=more)


def _footer(digest: Digest) -> str:
    rest = f"+{digest.more} autres · " if digest.more else ""
    return f"{rest}Tout voir : {config.DASHBOARD_URL}"


def discord_payload(digest: Digest) -> dict:
    embeds = [
        {
            "title": f"{s.emoji} {s.label}",
            "description": "\n\n".join(s.items)[:4000],
            "color": s.color,
        }
        for s in digest.sections
    ]
    if embeds:
        embeds[-1]["footer"] = {"text": _footer(digest)}
    return {"content": f"**{digest.header}**", "embeds": embeds[:10]}


def slack_blocks(digest: Digest) -> list[dict]:
    blocks: list[dict] = [
        {"type": "header", "text": {"type": "plain_text", "text": digest.header, "emoji": True}},
    ]
    for s in digest.sections:
        text = f"*{s.emoji} {s.label}*\n\n" + "\n\n".join(_to_slack(i) for i in s.items)
        blocks.append({"type": "divider"})
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": text[:2900]}})
    blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": _footer(digest)}]})
    return blocks


def _to_slack(item: str) -> str:
    """Discord markdown → Slack mrkdwn for our own item format."""
    import re

    item = re.sub(r"\*\*\[(.+?)\]\((\S+?)\)\*\*", r"*<\2|\1>*", item)
    return re.sub(r"^\*(.+)\*$", r"_\1_", item, flags=re.MULTILINE)


# ─── Sending ──────────────────────────────────────────────────────

def _post(webhook_url: str, payload: dict, ok_statuses: set[int], what: str) -> bool:
    for attempt in range(2):
        try:
            resp = requests.post(webhook_url, json=payload, timeout=10)
        except Exception:
            if attempt == 0:
                time.sleep(2)
                continue
            log.exception("Failed to send %s message", what)
            return False
        if resp.status_code in ok_statuses:
            return True
        if resp.status_code == 429 and attempt == 0:
            time.sleep(min(float(resp.headers.get("Retry-After", 2) or 2), 10))
            continue
        if resp.status_code >= 500 and attempt == 0:
            time.sleep(2)
            continue
        log.error("%s error %d: %s", what, resp.status_code, resp.text[:200])
        return False
    return False


def send_alert(lines: list[str], webhook_url: str) -> bool:
    """Plain Discord message for source health alerts."""
    if not lines or not webhook_url:
        return False
    content = "**Veille : état des sources**\n" + "\n".join(lines)
    return _post(webhook_url, {"content": content[:1900]}, {200, 204}, "Discord alert")


def send_stack_report(blocks: list[str], webhook_url: str) -> bool:
    """Private Discord report of known flaws in the stack (admin webhook only)."""
    if not blocks or not webhook_url:
        return False
    embeds = [{"description": b, "color": 0xED4245} for b in blocks[:10]]
    embeds[0]["title"] = "🛡️ Failles connues dans ta stack"
    return _post(webhook_url, {"embeds": embeds}, {200, 204}, "Discord stack")


def send_discord(articles: list[Article], webhook_url: str = "", now: datetime | None = None) -> bool:
    if not webhook_url:
        log.error("No webhook URL provided")
        return False
    if not articles:
        return True
    digest = build_digest(articles, now or datetime.now(config.LOCAL_TZ))
    ok = _post(webhook_url, discord_payload(digest), {200, 204}, "Discord")
    if ok:
        log.info("Discord digest sent (%d articles)", len(articles))
    return ok


def send_instant(articles: list[Article], discord_url: str = "", slack_url: str = "") -> bool:
    """Instant alert for important articles, right after they are found."""
    if not articles:
        return False
    now = datetime.now(config.LOCAL_TZ)
    noun = "article important" if len(articles) == 1 else "articles importants"
    digest = build_digest(articles, now, header=f"⚡ Alerte veille · {len(articles)} {noun}")
    sent = False
    if discord_url:
        sent = _post(discord_url, discord_payload(digest), {200, 204}, "Discord instant") or sent
    if slack_url:
        sent = _post(slack_url, {"blocks": slack_blocks(digest)}, {200}, "Slack instant") or sent
    return sent


def send_slack(articles: list[Article], webhook_url: str = "", now: datetime | None = None) -> bool:
    if not webhook_url:
        log.error("No Slack webhook URL provided")
        return False
    if not articles:
        return True
    digest = build_digest(articles, now or datetime.now(config.LOCAL_TZ))
    ok = _post(webhook_url, {"blocks": slack_blocks(digest)}, {200}, "Slack")
    if ok:
        log.info("Slack digest sent (%d articles)", len(articles))
    return ok
