"""Bookmarks of the admin → Zotero, collection « Veille » (asked by Tym, 06/11/2026).

Hourly, from main.py. Each new bookmark becomes a Zotero « webpage » item (title, link,
source, date, summary, tags of the bookmark) with a child note holding the summary and
the article text we extracted, so it stays readable even if the site changes. Sent once:
data/zotero.json remembers article id → Zotero item key. Removing a bookmark in the app
leaves the Zotero item alone (Zotero is where Tym curates).
"""
from __future__ import annotations

import html
import json
import logging
import os
from pathlib import Path

import requests

import config

log = logging.getLogger(__name__)

STATE_PATH = Path(__file__).resolve().parent / "data" / "zotero.json"
API = "https://api.zotero.org"
MAX_PER_RUN = 20
TEXT_CHARS = 4000


# ─── Pure ─────────────────────────────────────────────────────────

def _hook_points(summary: str | None) -> tuple[str, list[str]]:
    hook, _, detail = (summary or "").partition("|||")
    return hook.strip(), [ln.removeprefix("•").strip() for ln in detail.splitlines() if ln.strip()]


def item_payload(row: dict, collection_key: str) -> dict:
    hook, points = _hook_points(row.get("summary"))
    tags = ["veille", row.get("category") or "", *(row.get("bookmark_tags") or [])]
    published = row.get("published")
    return {
        "itemType": "webpage",
        "title": row["title"][:500],
        "url": row["url"],
        "websiteTitle": row.get("source") or "",
        "date": published.date().isoformat() if published else "",
        "accessDate": "CURRENT_TIMESTAMP",
        "abstractNote": "\n".join([hook, *(f"• {p}" for p in points)]).strip(),
        "tags": [{"tag": t} for t in dict.fromkeys(t.strip() for t in tags if t and t.strip())],
        "collections": [collection_key],
    }


def note_html(row: dict) -> str:
    hook, points = _hook_points(row.get("summary"))
    parts = [f"<h2>{html.escape(row['title'])}</h2>"]
    if hook:
        parts.append(f"<p><strong>{html.escape(hook)}</strong></p>")
    if points:
        parts.append("<ul>" + "".join(f"<li>{html.escape(p)}</li>" for p in points) + "</ul>")
    text = (row.get("text") or "")[:TEXT_CHARS]
    if text:
        parts.append("<h3>Texte de l'article (copie de la veille)</h3>")
        parts += [f"<p>{html.escape(par)}</p>" for par in text.split("\n") if par.strip()]
    parts.append(f'<p><a href="{html.escape(row["url"])}">Source : {html.escape(row.get("source") or "")}</a></p>')
    return "".join(parts)


def sync(client, rows: list[dict], state: dict) -> dict:
    """Send bookmarks not yet in Zotero. Returns the new state (input not mutated)."""
    new_state = dict(state)
    todo = [r for r in rows if r["article_id"] not in state][:MAX_PER_RUN]
    if not todo:
        return new_state
    collection = client.collection_key(config.ZOTERO_COLLECTION)
    for row in todo:
        try:
            key = client.create_item(item_payload(row, collection))
            client.create_note(key, note_html(row))
        except Exception:
            log.warning("Zotero: favori %s non envoyé, nouvel essai au prochain passage", row["url"], exc_info=True)
            continue
        new_state[row["article_id"]] = key
    return new_state


# ─── Zotero client (pyzotero) ─────────────────────────────────────

class ZoteroClient:
    def __init__(self, api_key: str):
        from pyzotero import zotero

        info = requests.get(f"{API}/keys/current", headers={"Zotero-API-Key": api_key, "Zotero-API-Version": "3"},
                            timeout=20)
        info.raise_for_status()
        data = info.json()
        if not data.get("access", {}).get("user", {}).get("write"):
            raise PermissionError("la clé Zotero n'a pas le droit d'écriture")
        self.zot = zotero.Zotero(str(data["userID"]), "user", api_key)

    def collection_key(self, name: str) -> str:
        for col in self.zot.collections(q=name):
            if col["data"]["name"] == name:
                return col["key"]
        created = self.zot.create_collections([{"name": name}])
        return created["successful"]["0"]["key"]

    def create_item(self, item: dict) -> str:
        resp = self.zot.create_items([item])
        if resp.get("failed"):
            raise RuntimeError(f"Zotero a refusé l'élément : {resp['failed']}")
        return resp["successful"]["0"]["key"]

    def create_note(self, parent: str, note: str) -> None:
        resp = self.zot.create_items([{"itemType": "note", "note": note, "tags": [], "collections": []}],
                                     parentid=parent)
        if resp.get("failed"):
            raise RuntimeError(f"Zotero a refusé la note : {resp['failed']}")


# ─── Run ──────────────────────────────────────────────────────────

def _load() -> dict:
    try:
        data = json.loads(STATE_PATH.read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=1))
    os.chmod(tmp, 0o600)
    os.replace(tmp, STATE_PATH)


def admin_bookmarks() -> list[dict]:
    import storage
    from psycopg2.extras import RealDictCursor

    with storage._conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """SELECT b.article_id, b.tags AS bookmark_tags, a.title, a.url, a.source, a.category,
                          a.summary, a.text, a.created_at AS published
                   FROM bookmarks b
                   JOIN articles a ON a.id = b.article_id
                   JOIN users u ON u.id = b.user_id
                   WHERE u.username = %s
                   ORDER BY b.created_at""",
                (config.ADMIN_USERNAME,),
            )
            rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        tags = r.get("bookmark_tags")
        r["bookmark_tags"] = tags if isinstance(tags, list) else []
    return rows


def run() -> bool:
    if not config.ZOTERO_API_KEY:
        return False  # not set up: nothing to do, no noise in the logs
    state = _load()
    rows = admin_bookmarks()
    if all(r["article_id"] in state for r in rows):
        return True
    try:
        client = ZoteroClient(config.ZOTERO_API_KEY)
    except Exception:
        log.exception("Zotero: connexion impossible")
        return False
    new_state = sync(client, rows, state)
    if new_state != state:
        _save(new_state)
        log.info("Zotero: %d favori(s) envoyé(s)", len(new_state) - len(state))
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s — %(message)s")
    print("ok" if run() else "Zotero non configuré ou injoignable (voir les logs)")
