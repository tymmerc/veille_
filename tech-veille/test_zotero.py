"""Tests for bookmarks → Zotero: item content, note, sync without duplicates."""

import sys
from datetime import datetime, timezone

sys.path.insert(0, "/opt/tech-veille")
import zotero_sync as zs  # noqa: E402

ROW = {
    "article_id": "art1", "bookmark_tags": ["à lire", "shimmer"],
    "title": "Claude Code: new mods", "url": "https://x/1", "source": "GitHub/Claude Code",
    "category": "ia", "summary": "Les mods arrivent.|||• Point un\n• Point deux",
    "text": "Body <b>with</b> html & stuff", "published": datetime(2026, 11, 5, tzinfo=timezone.utc),
}


class FakeClient:
    def __init__(self, fail_on=None):
        self.items, self.notes, self.collections = [], [], {}
        self.fail_on = fail_on

    def collection_key(self, name):
        return self.collections.setdefault(name, f"COL{len(self.collections) + 1}")

    def create_item(self, item):
        if self.fail_on and item["url"] == self.fail_on:
            raise RuntimeError("Zotero 500")
        self.items.append(item)
        return f"KEY{len(self.items)}"

    def create_note(self, parent, html):
        self.notes.append((parent, html))


def test_item_is_a_webpage_in_the_collection_with_tags():
    item = zs.item_payload(ROW, "COL1")
    assert item["itemType"] == "webpage"
    assert item["title"] == "Claude Code: new mods" and item["url"] == "https://x/1"
    assert item["websiteTitle"] == "GitHub/Claude Code"
    assert item["date"] == "2026-11-05"
    assert item["collections"] == ["COL1"]
    assert {t["tag"] for t in item["tags"]} == {"veille", "ia", "à lire", "shimmer"}
    assert item["abstractNote"].startswith("Les mods arrivent.")


def test_note_keeps_summary_and_text_escaped():
    html = zs.note_html(ROW)
    assert "Point un" in html and "Point deux" in html
    assert "&lt;b&gt;with&lt;/b&gt; html &amp; stuff" in html
    assert "<b>with</b>" not in html


def test_sync_sends_each_bookmark_once():
    client = FakeClient()
    state = zs.sync(client, [ROW], {})
    assert state == {"art1": "KEY1"}
    assert client.notes == [("KEY1", zs.note_html(ROW))]
    state2 = zs.sync(client, [ROW], state)
    assert len(client.items) == 1 and state2 == state


def test_a_failure_does_not_stop_the_others_and_is_retried_later():
    other = {**ROW, "article_id": "art2", "url": "https://x/2"}
    client = FakeClient(fail_on="https://x/1")
    state = zs.sync(client, [ROW, other], {})
    assert state == {"art2": "KEY1"}  # art1 failed: not marked, retried next run


def test_no_key_means_no_sync(caplog):
    from unittest.mock import patch
    with patch("zotero_sync.config.ZOTERO_API_KEY", ""):
        assert zs.run() is False
