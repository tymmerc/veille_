"""Shared HTTP helper: one User-Agent for every source and readable error reasons.

Several sites (OpenAI, TechCrunch, BleepingComputer) answer 403 to the default
"Python-urllib" agent, which silently emptied the RSS source for weeks.
"""
from __future__ import annotations

import logging
import time

import requests

log = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; TechVeille/1.1)"
DEFAULT_TIMEOUT = 15
MAX_WAIT_ON_429 = 60


def get(
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    wait_on_429: float = 0,
) -> requests.Response:
    """GET with our User-Agent. Raises requests exceptions on failure.

    wait_on_429 > 0 means: on a rate limit, wait (Retry-After if given, capped)
    and try exactly once more.
    """
    merged = {"User-Agent": USER_AGENT, **(headers or {})}
    resp = requests.get(url, params=params, headers=merged, timeout=timeout)
    if resp.status_code == 429 and wait_on_429 > 0:
        delay = _retry_after(resp, default=wait_on_429)
        log.info("Rate limited by %s, retrying in %ss", url, delay)
        time.sleep(delay)
        resp = requests.get(url, params=params, headers=merged, timeout=timeout)
    resp.raise_for_status()
    return resp


def _retry_after(resp: requests.Response, default: float) -> float:
    try:
        value = float(resp.headers.get("Retry-After", default))
    except (TypeError, ValueError):
        value = default
    return min(max(value, 1), MAX_WAIT_ON_429)


def describe_error(exc: BaseException) -> str:
    """Short French reason for a failed request, for logs and alerts."""
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return f"HTTP {exc.response.status_code}"
    if isinstance(exc, requests.Timeout):
        return "délai dépassé"
    if isinstance(exc, requests.ConnectionError):
        text = str(exc)
        if "Name or service not known" in text or "NameResolution" in text:
            return "adresse introuvable (DNS)"
        return "connexion impossible"
    return type(exc).__name__
