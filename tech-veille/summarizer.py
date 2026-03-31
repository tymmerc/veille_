from __future__ import annotations

import json
import logging
import re

import requests

import config
from sources.base import Article

log = logging.getLogger(__name__)

SCORE_PROMPT_WITH_PREFS = """Tu reçois un article tech. Note sa pertinence de 1 à 10.

Critères de l'utilisateur :
{user_prefs}

Échelle de notation :
- 8-10 : Article directement lié aux critères ci-dessus (sujet principal correspond)
- 5-7 : Article partiellement lié (même domaine, thème connexe, acteur mentionné)
- 3-4 : Article tech intéressant mais hors sujet
- 1-2 : Article sans rapport avec la tech ou de très mauvaise qualité

IMPORTANT : Ne sois PAS trop strict. Un article sur l'IA en général quand l'utilisateur s'intéresse à un outil IA spécifique mérite au moins 4-5, pas 1-2.

Réponds UNIQUEMENT avec un JSON : {{"score": <int>}}

Titre : {title}
Source : {source}
Contenu : {text}"""

SCORE_PROMPT_GENERIC = """Tu reçois un article tech. Note sa pertinence de 1 à 10 pour quelqu'un qui s'intéresse à :
- L'IA / Machine Learning / LLMs
- La cybersécurité
- La tech en général (dev, open source, self-hosted)

Réponds UNIQUEMENT avec un JSON : {{"score": <int>}}

Titre : {title}
Source : {source}
Contenu : {text}"""

HOOK_PROMPT = """Ecris UNE SEULE phrase d'accroche en français pour cet article tech.
La phrase doit donner envie de cliquer, être factuelle et concise (max 100 caractères).
Ne commence pas par "Découvrez". Pas de ponctuation excessive.
Base-toi UNIQUEMENT sur le titre et le contenu, n'invente rien.

Titre : {title}
Contenu : {text}"""

DETAIL_PROMPT = """Ecris un résumé détaillé de cet article tech en français, en 5-8 phrases.
Couvre le contexte, les points clés, les détails techniques importants et pourquoi c'est intéressant.
Ton factuel mais accessible, comme un bon article de blog tech.
Sois complet et informatif — le lecteur doit comprendre l'essentiel sans lire l'article original.
Base-toi UNIQUEMENT sur le titre et le contenu fournis.

Titre : {title}
Source : {source}
Contenu : {text}"""

TITLE_FR_PROMPT = """Traduis ce titre en francais correct et naturel.
Regles :
- Garde les noms propres en anglais (Anthropic, Claude, React, Python, OpenAI, Google, etc.)
- Garde les termes techniques anglais connus (LLM, API, malware, ransomware, open-source, etc.)
- Utilise un francais naturel et grammaticalement correct
- Maximum 100 caracteres
- Ne commence PAS par un article ("Un", "Une", "Le", "La") sauf si necessaire
- Reponds UNIQUEMENT avec le titre traduit, rien d'autre

Exemples :
"Iran-Backed Hackers Claim Wiper Attack on Medtech" -> "Des hackers soutenus par l'Iran revendiquent une attaque wiper sur une medtech"
"Woman In Jail After AI Face Recognition Mistake" -> "Une femme emprisonnee apres une erreur de reconnaissance faciale par IA"
"Anthropic invests $100M into Claude Partner Network" -> "Anthropic investit 100M$ dans le Claude Partner Network"

Titre a traduire : {title}"""


def _ask_ollama(prompt: str, max_tokens: int = 256) -> str | None:
    """Send a prompt to Ollama and return the response text."""
    try:
        resp = requests.post(
            f"{config.OLLAMA_URL}/api/generate",
            json={
                "model": config.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": max_tokens, "temperature": 0.3},
            },
            timeout=config.OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except requests.ConnectionError:
        log.error("Ollama request failed: connection error (is Ollama running at %s?)", config.OLLAMA_URL)
        return None
    except requests.Timeout:
        log.error("Ollama request timed out after %ds", config.OLLAMA_TIMEOUT)
        return None
    except requests.HTTPError as e:
        log.error("Ollama HTTP error: %s", e)
        return None
    except Exception:
        log.exception("Ollama request failed with unexpected error")
        return None


def score_article(article: Article, user_prefs: str = "") -> int:
    """Score an article 1-10 using Ollama. Returns 5 on failure."""
    # GitHub releases are changelogs - auto-score 9 (they're exactly what users tracking that repo want)
    if article.platform == "github":
        return 9

    if user_prefs:
        prompt = SCORE_PROMPT_WITH_PREFS.format(
            title=article.title,
            source=article.source,
            text=article.text[:1500],
            user_prefs=user_prefs,
        )
    else:
        prompt = SCORE_PROMPT_GENERIC.format(
            title=article.title,
            source=article.source,
            text=article.text[:1500],
        )
    raw = _ask_ollama(prompt, max_tokens=32)
    if not raw:
        return 5

    # Try to extract score from JSON or raw number
    score = 5
    try:
        data = json.loads(raw)
        score = max(1, min(10, int(data["score"])))
    except (json.JSONDecodeError, KeyError, ValueError):
        # Fallback: find first number in response
        match = re.search(r"\b(\d{1,2})\b", raw)
        if match:
            score = max(1, min(10, int(match.group(1))))

    # Post-check: if article doesn't contain ANY user keyword in title/text,
    # cap score at 5 (the LLM tends to over-score tangentially related articles)
    if user_prefs and score > 5:
        score = _cap_score_if_no_keyword_match(article, user_prefs, score)

    return score

    return 5


def _cap_score_if_no_keyword_match(article: Article, user_prefs: str, score: int) -> int:
    """Cap score at 5 if the article doesn't match any keyword from user prefs.

    The LLM scorer tends to give 7-8 to articles that are tangentially related
    (e.g. "Claude is a space to think" when user wants "Claude Code features").
    This ensures only truly relevant articles get high scores.
    """
    # Extract keywords from scoring_instructions (they contain the user's actual interests)
    text_lower = f"{article.title} {article.text[:500]}".lower()
    prefs_lower = user_prefs.lower()

    # Look for 2+ word phrases from user prefs that appear in article
    # Split prefs into meaningful phrases
    important_terms = []
    for segment in re.split(r'[.:;,\n]', prefs_lower):
        words = segment.strip().split()
        # Extract 2-3 word phrases
        for i in range(len(words) - 1):
            bigram = f"{words[i]} {words[i+1]}"
            if len(bigram) > 5:  # skip tiny phrases
                important_terms.append(bigram)

    # If any important term from prefs appears in the article, keep the score
    if any(term in text_lower for term in important_terms):
        return score

    # No keyword match found - cap at 5
    return min(score, 5)


def _clean(text: str, max_len: int) -> str:
    """Clean and truncate generated text."""
    text = text.strip('"\'').strip()
    if len(text) > max_len:
        for sep in [". ", "! ", "? "]:
            idx = text[:max_len].rfind(sep)
            if idx > 30:
                return text[: idx + 1]
        return text[:max_len].rsplit(" ", 1)[0] + "..."
    return text


def translate_title(article: Article) -> None:
    """Translate article title to French using Ollama. Modifies article in place."""
    # Skip if title already looks French (heuristic)
    fr_indicators = [" les ", " des ", " une ", " est ", " pour ", " dans ", " sur ", " avec ", " qui "]
    if any(ind in f" {article.title.lower()} " for ind in fr_indicators):
        return

    prompt = TITLE_FR_PROMPT.format(title=article.title)
    result = _ask_ollama(prompt, max_tokens=80)
    if not result or len(result) < 5 or len(result) > 200:
        return

    cleaned = _clean(result, 150)

    # Quality checks: reject bad translations
    # 1. If result is nearly identical to original (model didn't translate)
    if cleaned.lower().strip() == article.title.lower().strip():
        return
    # 2. If result contains obvious artifacts (quotes, explanations)
    if any(x in cleaned for x in ['\"', "voici", "traduction", "titre"]):
        return

    article.title_original = article.title
    article.title = cleaned


def summarize_article(article: Article) -> str:
    """Translate title + generate a hook + detailed summary. Stored as 'hook|||detail'."""
    # Translate title to French first
    translate_title(article)

    content = article.text[:3000]

    # Hook (short)
    hook_prompt = HOOK_PROMPT.format(title=article.title, text=content[:500])
    hook = _ask_ollama(hook_prompt, max_tokens=60)
    hook = _clean(hook or article.title, 120)

    # Detail (longer — 5-8 sentences)
    detail_prompt = DETAIL_PROMPT.format(
        title=article.title, source=article.source, text=content,
    )
    detail = _ask_ollama(detail_prompt, max_tokens=500)
    detail = _clean(detail or article.title, 1200)

    return f"{hook}|||{detail}"


def process_articles(articles: list[Article], user_prefs: str = "") -> list[Article]:
    """Score and summarize articles. Returns only those above MIN_SCORE.

    Scoring is now generic (article quality) — personalization is handled
    by keyword filtering in the web feed API.
    """
    kept: list[Article] = []

    for i, article in enumerate(articles):
        log.info(
            "Processing %d/%d: %s",
            i + 1, len(articles), article.title[:80],
        )

        article.score = score_article(article, user_prefs=user_prefs)
        if article.score < config.MIN_SCORE:
            log.debug("Dropped (score=%d): %s", article.score, article.title[:60])
            continue

        article.summary = summarize_article(article)
        kept.append(article)

    log.info(
        "Summarizer: %d/%d articles kept (score >= %d)",
        len(kept), len(articles), config.MIN_SCORE,
    )
    return kept
