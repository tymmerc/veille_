"""When to notify a user. Pure functions, Paris time.

Settings come from veille-app (06/11/2026):
- sync_hours / sync_days: when the summary goes out (null = after every run with news)
- notify_digest: summary on/off (null before the migration = on)
- notify_instant_min: instant alert from this score (null = off)
"""
from __future__ import annotations

import json
from datetime import datetime

import config
from sources.base import Article

MAX_INSTANT_PER_RUN = 5


def _as_list(value) -> list[int] | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return [int(v) for v in value] if isinstance(value, list) else None


def _as_int(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _digest_on(user: dict) -> bool:
    value = user.get("notify_digest")
    return value is None or value is True or value == "true"


def digest_due(user: dict, now: datetime) -> bool:
    if not _digest_on(user):
        return False
    local = now.astimezone(config.LOCAL_TZ)
    last = user.get("last_notified_at")
    if isinstance(last, datetime):
        sent = last.astimezone(config.LOCAL_TZ)
        if (sent.date(), sent.hour) == (local.date(), local.hour):
            return False  # already sent in this hour slot (a minutes gap failed: runs last up to 20 min)
    hours, days = _as_list(user.get("sync_hours")), _as_list(user.get("sync_days"))
    if not hours and not days:
        return True  # no schedule: every run that has news
    js_day = (local.weekday() + 1) % 7  # app stores Sunday = 0
    return local.hour in (hours or range(24)) and js_day in (days or range(7))


def fallback_hours(user: dict) -> int:
    """How far back to look when the user was never notified."""
    days = _as_list(user.get("sync_days"))
    return 24 * 7 if days and len(days) == 1 else 24


def instant_articles(fresh: list[Article], user: dict) -> list[Article]:
    threshold = _as_int(user.get("notify_instant_min"))
    if threshold is None:
        return []
    picked = sorted((a for a in fresh if a.score >= threshold), key=lambda a: a.score, reverse=True)
    return picked[:MAX_INSTANT_PER_RUN]
