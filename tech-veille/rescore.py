#!/usr/bin/env python3
"""Re-score existing articles using updated user preferences.

Usage: python3 rescore.py <user_id>

Reads the user's scoring_notes from the database and re-scores
the most recent articles (up to 200) using Ollama.
"""
from __future__ import annotations

import sys
import logging
import json

import psycopg2
from psycopg2.extras import RealDictCursor

import config
from summarizer import score_article
from sources.base import Article

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def get_user_prefs(user_id: str) -> str:
    """Get scoring_notes for a specific user."""
    with psycopg2.connect(config.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "scoringNotes" FROM users WHERE id = %s',
                (user_id,),
            )
            row = cur.fetchone()
    if not row or not row[0]:
        return ""
    return row[0]


def get_recent_articles(limit: int = 200) -> list[dict]:
    """Fetch the most recent articles from the database."""
    with psycopg2.connect(config.DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, url, summary, score, category, source, platform,
                       title_original, is_official
                FROM articles
                ORDER BY found_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            return cur.fetchall()


def update_article_score(article_id: str, new_score: int) -> None:
    """Update an article's score in the database."""
    with psycopg2.connect(config.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE articles SET score = %s WHERE id = %s",
                (new_score, article_id),
            )
        conn.commit()


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 rescore.py <user_id>")
        sys.exit(1)

    user_id = sys.argv[1]
    user_prefs = get_user_prefs(user_id)

    if not user_prefs:
        log.warning("No scoring preferences found for user %s", user_id)
        sys.exit(0)

    log.info("Re-scoring articles for user %s", user_id)
    log.info("Preferences: %s", user_prefs[:100])

    articles = get_recent_articles(200)
    log.info("Found %d articles to re-score", len(articles))

    updated = 0
    for i, row in enumerate(articles):
        # Create a minimal Article-like object for the scorer
        art = Article(
            platform=row["platform"],
            external_id=row["id"],
            title=row["title"] or "",
            url=row["url"] or "",
            text=row["summary"] or row["title"] or "",
            source=row["source"] or "",
            category=row["category"] or "tech",
        )

        new_score = score_article(art, user_prefs)
        old_score = row["score"]

        if new_score != old_score:
            update_article_score(row["id"], new_score)
            updated += 1

        if (i + 1) % 20 == 0:
            log.info("Progress: %d/%d (updated %d)", i + 1, len(articles), updated)

    log.info("Done. Re-scored %d articles, updated %d scores", len(articles), updated)


if __name__ == "__main__":
    main()
