"""Source health: remember consecutive failures and alert once when a source stays down.

State lives in a small JSON file (data/health.json), outside the Prisma-managed
database on purpose: a `prisma db push` from veille-app would drop unknown tables.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

STATE_PATH = Path(__file__).resolve().parent / "data" / "health.json"
FAIL_THRESHOLD = 6  # hourly runs, so about 6 hours down before an alert


@dataclass(frozen=True)
class Check:
    key: str  # readable name, e.g. "RSS techcrunch.com"
    ok: bool
    detail: str = ""


def update_health(
    state: dict, checks: list[Check], now: datetime, threshold: int = FAIL_THRESHOLD
) -> tuple[dict, list[str]]:
    """Return (new_state, alert_lines). Never mutates `state`.

    Sources absent from `checks` are dropped (no longer configured).
    """
    new_state: dict = {}
    alerts: list[str] = []
    for check in _merge_duplicates(checks):
        prev = state.get(check.key) or {}
        if check.ok:
            if prev.get("alerted"):
                alerts.append(f"✅ {check.key} remarche.")
            new_state[check.key] = {"fails": 0, "alerted": False, "last_ok": now.isoformat()}
            continue

        fails = prev.get("fails", 0) + 1
        alerted = prev.get("alerted", False)
        if fails >= threshold and not alerted:
            alerts.append(f"⚠️ {check.key} ne répond plus depuis {fails} passages ({check.detail}).")
            alerted = True
        new_state[check.key] = {
            **prev,
            "fails": fails,
            "alerted": alerted,
            "detail": check.detail,
            "last_fail": now.isoformat(),
        }
    return new_state, alerts


def _merge_duplicates(checks: list[Check]) -> list[Check]:
    """One check per key: up if any of its checks succeeded this run."""
    merged: dict[str, Check] = {}
    for check in checks:
        current = merged.get(check.key)
        if current is None or (check.ok and not current.ok):
            merged[check.key] = check
    return list(merged.values())


def load_state(path: Path = STATE_PATH) -> dict:
    try:
        data = json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        log.warning("Health state %s unreadable, starting fresh", path)
        return {}
    return data if isinstance(data, dict) else {}


def save_state(path: Path, state: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False))
    os.replace(tmp, path)
