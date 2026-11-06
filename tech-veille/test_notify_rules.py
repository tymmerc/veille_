"""Tests for notification rules: summary on a Paris-time schedule, instant alerts by score."""

import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/opt/tech-veille")
import notify_rules as nr  # noqa: E402
from sources.base import Article  # noqa: E402

# Friday 06/11/2026 08:00 UTC = 09:00 in Paris
FRI_9H_PARIS = datetime(2026, 11, 6, 8, 0, tzinfo=timezone.utc)


def user(**kw):
    return {"username": "u", "sync_hours": None, "sync_days": None, "notify_digest": None,
            "notify_instant_min": None, "last_notified_at": None, **kw}


def art(score: int, n: int = 0) -> Article:
    a = Article(title=f"t{n}", url=f"https://x/{n}", text="", source="s", category="tech",
                platform="rss", external_id=str(n))
    a.score = score
    return a


class TestDigest:
    def test_daily_9h_uses_paris_time(self):
        u = user(sync_hours=[9], sync_days=[0, 1, 2, 3, 4, 5, 6])
        assert nr.digest_due(u, FRI_9H_PARIS)
        assert not nr.digest_due(u, FRI_9H_PARIS + timedelta(hours=1))

    def test_friday_only(self):
        u = user(sync_hours=[9], sync_days=[5])
        assert nr.digest_due(u, FRI_9H_PARIS)
        assert not nr.digest_due(u, FRI_9H_PARIS + timedelta(days=1))

    def test_no_schedule_means_every_run(self):
        assert nr.digest_due(user(), FRI_9H_PARIS + timedelta(hours=5))

    def test_digest_off(self):
        assert not nr.digest_due(user(notify_digest=False), FRI_9H_PARIS)

    def test_never_twice_in_the_same_hour(self):
        u = user(sync_hours=[9], last_notified_at=FRI_9H_PARIS + timedelta(minutes=2))
        assert not nr.digest_due(u, FRI_9H_PARIS + timedelta(minutes=30))

    def test_weekly_digest_looks_back_a_week(self):
        assert nr.fallback_hours(user(sync_hours=[9], sync_days=[5])) == 24 * 7
        assert nr.fallback_hours(user(sync_hours=[9])) == 24

    def test_json_strings_from_db_are_read(self):
        assert nr.digest_due(user(sync_hours="[9]", sync_days="[5]"), FRI_9H_PARIS)


class TestInstant:
    def test_only_articles_at_or_above_the_threshold(self):
        picked = nr.instant_articles([art(9, 1), art(7, 2), art(10, 3)], user(notify_instant_min=9))
        assert [a.title for a in picked] == ["t3", "t1"]

    def test_off_by_default(self):
        assert nr.instant_articles([art(10)], user()) == []

    def test_capped_per_run(self):
        picked = nr.instant_articles([art(10, i) for i in range(9)], user(notify_instant_min=8))
        assert len(picked) == nr.MAX_INSTANT_PER_RUN


def test_back_to_back_runs_in_different_hours_both_send():
    # 09:00 run sent at 10:18 Paris; the 10:00 UTC run ends at 11:08 Paris, 49 min later: must send
    u = user(last_notified_at=datetime(2026, 11, 6, 9, 18, 53, tzinfo=timezone.utc))
    assert nr.digest_due(u, datetime(2026, 11, 6, 10, 8, 26, tzinfo=timezone.utc))
