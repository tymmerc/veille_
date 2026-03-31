from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import requests

import config
from sources.base import Article

log = logging.getLogger(__name__)

# ─── Digest generation via Ollama ─────────────────────────────────

DIGEST_PROMPT = """Ecris un bulletin tech du jour en 4-6 lignes a partir de ces articles.

Exemple de format:
- **Claude Code sort en open source** : Anthropic rend son CLI de coding dispo pour tous, avec un mode auto-accept securise
- **Faille critique dans Kubernetes** : CVE-2026-1234 permet une escalation de privileges, patch dispo
- **Levee record pour Granola** : $125M pour transformer le notetaker en plateforme IA complete

Regle: regroupe par theme, sois factuel, en francais, pas de blabla.

Articles:
{articles}

Bulletin:"""


def _generate_digest(articles: list[Article]) -> str:
    """Use Ollama to generate a short trend digest from articles."""
    # Build article list for the prompt
    lines = []
    for a in articles[:20]:  # Cap at 20 to fit context
        hook = _extract_hook(a.summary)
        lines.append(f"- [{a.category}] {a.title} (score {a.score}/10) — {hook}")

    article_text = "\n".join(lines)
    prompt = DIGEST_PROMPT.format(articles=article_text)

    try:
        resp = requests.post(
            f"{config.OLLAMA_URL}/api/generate",
            json={
                "model": config.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 500},
            },
            timeout=120,
        )
        if resp.ok:
            text = resp.json().get("response", "").strip()
            if text:
                return text
    except Exception:
        log.warning("Ollama digest generation failed, falling back to simple format", exc_info=True)

    # Fallback: simple top-5 list
    fallback = []
    for a in articles[:5]:
        fallback.append(f"- **{a.title}** ({a.score}/10)")
    return "\n".join(fallback)


# ─── Discord ──────────────────────────────────────────────────────

def send_discord(articles: list[Article], webhook_url: str = "") -> bool:
    """Send a trend digest to Discord via webhook."""
    webhook_url = webhook_url or ""
    if not webhook_url:
        log.error("No webhook URL provided")
        return False
    if not articles:
        log.info("No articles to send")
        return True

    now = datetime.now(timezone.utc)
    period = "matin" if now.hour < 14 else "soir"
    date_str = now.strftime("%d/%m/%Y")

    # Sort by score desc, take top articles
    sorted_articles = sorted(articles, key=lambda a: a.score, reverse=True)

    # Generate AI digest
    digest = _generate_digest(sorted_articles)

    # Count by category
    cats = {}
    for a in articles:
        cat_info = config.CATEGORIES.get(a.category, {"emoji": "📰", "label": a.category})
        cats[a.category] = cats.get(a.category, 0) + 1
    cat_summary = " · ".join(f"{config.CATEGORIES.get(c, {}).get('emoji', '📰')} {n}" for c, n in cats.items())

    # Top 3 articles with links
    top_links = []
    for a in sorted_articles[:3]:
        emoji = _pick_emoji(a.score)
        top_links.append(f"{emoji} [{a.title[:60]}]({a.url}) `{a.score}/10`")

    embeds = [
        {
            "title": f"📡 Veille Tech — {date_str} ({period})",
            "description": digest,
            "color": 0x6C5CE7,
        },
        {
            "title": "🔗 Top articles",
            "description": "\n".join(top_links),
            "color": 0x2F3136,
        },
        {
            "description": f"📊 **{len(articles)} articles** | {cat_summary}",
            "color": 0x2F3136,
        },
    ]

    for attempt in range(2):
        try:
            resp = requests.post(webhook_url, json={"embeds": embeds}, timeout=10)
            if resp.status_code == 204:
                log.info("Discord digest sent (%d articles)", len(articles))
                return True
            elif resp.status_code >= 500 and attempt == 0:
                time.sleep(2)
                continue
            else:
                log.error("Discord error %d: %s", resp.status_code, resp.text[:200])
                return False
        except Exception:
            if attempt == 0:
                time.sleep(2)
                continue
            log.exception("Failed to send Discord message")
            return False

    return False


# ─── Slack ────────────────────────────────────────────────────────

def send_slack(articles: list[Article], webhook_url: str = "") -> bool:
    """Send a trend digest to Slack via webhook."""
    webhook_url = webhook_url or ""
    if not webhook_url:
        log.error("No Slack webhook URL provided")
        return False
    if not articles:
        log.info("No articles to send to Slack")
        return True

    now = datetime.now(timezone.utc)
    period = "matin" if now.hour < 14 else "soir"
    date_str = now.strftime("%d/%m/%Y")

    sorted_articles = sorted(articles, key=lambda a: a.score, reverse=True)

    # Generate AI digest
    digest = _generate_digest(sorted_articles)

    # Top 3 with links
    top_links = []
    for a in sorted_articles[:3]:
        emoji = _pick_emoji(a.score)
        top_links.append(f"{emoji} *{a.title[:60]}* ({a.score}/10) — <{a.url}|lire>")

    cats = {}
    for a in articles:
        cats[a.category] = cats.get(a.category, 0) + 1
    cat_summary = " · ".join(f"{config.CATEGORIES.get(c, {}).get('emoji', '📰')} {n}" for c, n in cats.items())

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"📡 Veille Tech — {date_str} ({period})", "emoji": True},
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": digest},
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*🔗 Top articles*\n" + "\n".join(top_links)},
        },
        {"type": "divider"},
        {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"📊 *{len(articles)} articles* | {cat_summary}"}],
        },
    ]

    for attempt in range(2):
        try:
            resp = requests.post(webhook_url, json={"blocks": blocks}, timeout=10)
            if resp.status_code == 200 and resp.text == "ok":
                log.info("Slack digest sent (%d articles)", len(articles))
                return True
            elif resp.status_code >= 500 and attempt == 0:
                time.sleep(2)
                continue
            else:
                log.error("Slack error %d: %s", resp.status_code, resp.text[:200])
                return False
        except Exception:
            if attempt == 0:
                time.sleep(2)
                continue
            log.exception("Failed to send Slack message")
            return False

    return False


# ─── Helpers ──────────────────────────────────────────────────────

def _extract_hook(summary: str | None) -> str:
    """Extract the hook (TL;DR) from a summary in 'hook|||detail' format."""
    if not summary:
        return ""
    sep = summary.find("|||")
    hook = summary[:sep].strip() if sep != -1 else summary.strip()
    if len(hook) > 150:
        hook = hook[:147] + "..."
    return hook


def _pick_emoji(score: int) -> str:
    if score >= 9:
        return "🔥"
    if score >= 7:
        return "👀"
    return "📌"
