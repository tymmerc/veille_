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

SUMMARY_PROMPT = """Tu résumes un article tech pour un développeur français pressé.

Règles :
- Utilise UNIQUEMENT les faits écrits dans le TEXTE. Si une information n'y est pas, ne l'écris pas.
- N'explique jamais un sigle ou un nom que le texte n'explique pas.
- Pas d'introduction ("Dans cet article", "Cet article", "Voici") ni de conclusion ou d'avis.
- Garde les noms propres et les termes techniques tels quels (Claude Code, MCP, Next.js, CVE-2026-1234).

Réponds en JSON : {{"accroche": "...", "points": ["...", "..."]}}
- accroche : une phrase de 15 à 25 mots qui dit le fait principal (qui fait quoi, ou ce qui change).
- points : de 0 à 3 faits concrets en plus (chiffre, version, date, prix, conséquence), une phrase courte chacun.
  Liste vide si le texte n'en contient pas.

Exemple :
TITRE : Show HN: K8sman – A Native Kubernetes IDE
TEXTE : K8sman is a native Kubernetes IDE built with Flutter and a Go backend. Nothing to install in the cluster. It uses less than half the RAM of Lens and ships with Argo CD, Prometheus and Trivy integrations. Apache 2.0, available for macOS, Windows and Linux.
JSON : {{"accroche": "K8sman est un IDE Kubernetes natif écrit en Flutter et Go, sans rien à installer dans le cluster.", "points": ["Il consomme moins de la moitié de la RAM de Lens.", "Intégrations Argo CD, Prometheus et Trivy fournies.", "Licence Apache 2.0, pour macOS, Windows et Linux."]}}

TITRE : {title}
SOURCE : {source}
TEXTE : {text}
JSON :"""

TITLE_ONLY_PROMPT = """Reformule ce titre d'article tech en une phrase française claire de 8 à 20 mots.
N'ajoute AUCUNE information absente du titre. Garde les noms propres et termes techniques tels quels.
Réponds uniquement avec la phrase.

Titre : {title}
Phrase :"""

RELEASE_PROMPT = """Voici les changements d'une nouvelle version de {label}.
Écris UNE phrase française de 12 à 25 mots qui cite les 1 ou 2 changements les plus utiles pour un développeur.
Pas d'introduction, ne commence pas par "Cette version". Réponds uniquement avec la phrase.

Changements :
{changes}
Phrase :"""

# Openers the small model loves and that say nothing.
FILLER_OPENERS = re.compile(
    r"^\s*(?:"
    r"dans (?:cet|ce|un|une) (?:article|post|billet)[^,.:]*[,:]\s*"
    r"|(?:cet|cet autre) article\s+(?:explique|présente|décrit|montre)\s+(?:que\s+|comment\s+)?"
    r"|voici[^:]*:\s*"
    r"|le résumé[^:]*:\s*"
    r"|découvrez\s+"
    r"|résumé\s*:\s*"
    r")",
    re.IGNORECASE,
)
MAX_POINTS = 3
MAX_HOOK_CHARS = 220
MAX_POINT_CHARS = 200
MIN_TEXT_FOR_DETAILS = 400
MAX_RELEASE_POINTS = 5
# Below this score an article is kept for the global feed but gets no Ollama summary
SUMMARY_MIN_SCORE = 5
# Changelog-like platforms: the real change lines become the points, preset score kept
RELEASE_PLATFORMS = {"github", "release_notes"}
RELEASE_LABEL_PREFIXES = ("GitHub/", "Notes de version ")


def _ask_ollama(prompt: str, max_tokens: int = 256, json_mode: bool = False) -> str | None:
    """Send a prompt to Ollama and return the response text."""
    payload = {
        "model": config.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.2},
    }
    if json_mode:
        payload["format"] = "json"
    try:
        resp = requests.post(
            f"{config.OLLAMA_URL}/api/generate",
            json=payload,
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
    # GitHub releases and official release notes are changelogs: preset score, 9 by default
    if article.platform in RELEASE_PLATFORMS:
        return article.score or 9  # stack repos come preset lower (6), the floor lifts security fixes

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


def _tidy(sentence: str, max_len: int) -> str:
    """Remove filler openers and quotes, capitalize, cap the length."""
    text = FILLER_OPENERS.sub("", sentence.strip().strip("\"'«» ")).strip()
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    return _clean(text, max_len)


# French words the model may add that will not appear in an English source.
GROUNDING_ALLOW = {"IA", "UE"}
_WORD = re.compile(r"[A-Za-zÀ-ÿ0-9][\w\-./]*")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def _norm_numbers(text: str) -> str:
    return re.sub(r"(?<=\d),(?=\d)", ".", text)


def is_grounded(sentence: str, source: str) -> bool:
    """True if every proper name and number of `sentence` appears in `source`.

    A cheap guard against the small model's inventions ("développé par Google").
    The first word is skipped: it is capitalized only because it starts the sentence.
    """
    haystack = _norm_numbers(source).lower()
    words = _WORD.findall(sentence)
    for word in words[1:]:
        word = word.rstrip(".-/")
        if not word or not word[0].isupper() or word in GROUNDING_ALLOW:
            continue
        if word.lower() not in haystack:
            return False
    for number in _NUMBER.findall(_norm_numbers(sentence)):
        if number not in haystack:
            return False
    return True


def parse_summary_json(raw: str | None) -> tuple[str, list[str]] | None:
    """Parse the model's JSON. None when unusable."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    hook = _tidy(str(data.get("accroche") or ""), MAX_HOOK_CHARS)
    if not hook:
        return None
    raw_points = data.get("points") if isinstance(data.get("points"), list) else []
    points = [p for p in (_tidy(str(x), MAX_POINT_CHARS) for x in raw_points) if p]
    return hook, points[:MAX_POINTS]


def format_summary(hook: str, points: list[str]) -> str:
    """Stored as 'hook|||detail' (veille-app splits on |||). Detail = bullet lines."""
    detail = "\n".join(f"• {p}" for p in points)
    return f"{hook}|||{detail}"


def _release_changes(article: Article) -> list[str]:
    lines = [ln.strip() for ln in (article.text or "").splitlines()[1:]]  # line 0 = header
    return [ln for ln in lines if ln][:MAX_RELEASE_POINTS]


def _release_label(source: str) -> str:
    """Name shown in the release prompt: the source without its "GitHub/" or
    "Notes de version " prefix (so "Notes de version API Claude" gives "API Claude")."""
    for prefix in RELEASE_LABEL_PREFIXES:
        if source.startswith(prefix):
            return source.removeprefix(prefix)
    return source


def summarize_article(article: Article) -> str:
    """French hook + up to 3 facts, taken only from the text we really have.

    Titles stay as published: the small model's translations were often wrong
    (and sometimes changed the meaning).
    """
    article.title_original = article.title
    fallback = format_summary(article.title, [])

    if article.platform in RELEASE_PLATFORMS:
        changes = _release_changes(article)
        label = _release_label(article.source)
        raw = _ask_ollama(RELEASE_PROMPT.format(label=label, changes="\n".join(changes)), max_tokens=80)
        hook = _tidy(raw or "", MAX_HOOK_CHARS) or article.title
        return format_summary(hook, changes)

    text = (article.text or "").strip()
    if len(text) < MIN_TEXT_FOR_DETAILS:
        raw = _ask_ollama(TITLE_ONLY_PROMPT.format(title=article.title), max_tokens=60)
        hook = _tidy(raw or "", MAX_HOOK_CHARS)
        return format_summary(hook, []) if hook else fallback

    prompt = SUMMARY_PROMPT.format(title=article.title, source=article.source, text=text[:3000])
    parsed = parse_summary_json(_ask_ollama(prompt, max_tokens=320, json_mode=True))
    if not parsed:
        return fallback
    hook, points = parsed
    source = f"{article.title}\n{text}"
    kept = [p for p in points if is_grounded(p, source)]
    if len(kept) < len(points):
        log.info("Dropped %d invented point(s) for: %s", len(points) - len(kept), article.title[:60])
    if not is_grounded(hook, source):
        log.info("Invented hook replaced by the title for: %s", article.title[:60])
        hook = article.title
    return format_summary(hook, kept)


def process_articles(
    articles: list[Article], user_prefs: str = "", floor=None,
) -> list[Article]:
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
        if floor:  # e.g. security news about our own stack never falls under 8
            article.score = max(article.score, floor(article))
        if article.score < config.MIN_SCORE:
            log.debug("Dropped (score=%d): %s", article.score, article.title[:60])
            continue

        if article.score < SUMMARY_MIN_SCORE:
            # Kept for the global feed; not worth an Ollama call (06/11/2026, CPU load)
            article.title_original = article.title
            article.summary = format_summary(article.title, [])
        else:
            article.summary = summarize_article(article)
        kept.append(article)

    log.info(
        "Summarizer: %d/%d articles kept (score >= %d)",
        len(kept), len(articles), config.MIN_SCORE,
    )
    return kept
