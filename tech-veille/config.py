import os
from dotenv import load_dotenv

load_dotenv()

# ── PostgreSQL ──
DATABASE_URL = os.getenv("DATABASE_URL", "")  # in .env, never in code

# ── Reddit ──
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_SECRET = os.getenv("REDDIT_SECRET", "")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "TechVeille/1.0")

# ── Ollama ──
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_TIMEOUT = 60  # seconds per request

# ── Filtres ──
MAX_AGE_HOURS = 48
MIN_UPVOTES_REDDIT = 10
MIN_SCORE = 3  # articles scored < 3 are dropped (feed-side filters handle relevance)
MAX_ARTICLES_PER_CATEGORY = 8
# Ollama does 1-2 calls per new article on a shared VPS: cap the work per hourly run.
# Leftovers stay "new" and are picked up by the next runs.
MAX_NEW_PER_RUN = 15  # 25 until 06/11/2026: runs took up to 20 min of CPU

# ── HackerNews mots-clés (toujours les mêmes pour la recherche Algolia) ──
HN_KEYWORDS = [
    "AI", "LLM", "GPT", "Claude", "machine learning", "neural",
    "cybersecurity", "vulnerability", "exploit", "hack",
    "open source", "self-hosted", "Rust", "Linux",
]

# ── Catégories et couleurs Discord ──
CATEGORIES = {
    "ia": {"label": "IA & Machine Learning", "color": 0x5865F2, "emoji": "🤖"},
    "cyber": {"label": "Cybersécurité", "color": 0xED4245, "emoji": "🔒"},
    "tech": {"label": "Tech Générale", "color": 0x57F287, "emoji": "💻"},
}

# ── Alertes de santé des sources (webhook Discord de ce compte) ──
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "tym_merc")

# ── Digest ──
from zoneinfo import ZoneInfo  # noqa: E402

DASHBOARD_URL = os.getenv("DASHBOARD_URL", "https://tymmerc.eu/veille")
LOCAL_TZ = ZoneInfo(os.getenv("VEILLE_TZ", "Europe/Paris"))

# ── Flux sécu ajoutés quand la surveillance de la stack est active ──
SECURITY_FEEDS = [
    "https://www.bleepingcomputer.com/feed/",
    "https://feeds.feedburner.com/TheHackersNews",
]

# ── Sources officielles Claude/Anthropic : toujours envoyées à l'admin, même sans mot-clé ──
OFFICIAL_SOURCES = {
    ("blog", "Claude"),
    ("blog", "Anthropic"),
    ("blog", "Anthropic Engineering"),
    ("release_notes", "Notes de version API Claude"),
}

# ── Analyse hebdo par Claude Code (jeton créé par `claude setup-token`, dans .env) ──
CLAUDE_TOKEN = os.getenv("CLAUDE_CODE_OAUTH_TOKEN", "")

# ── Zotero : favoris de l admin envoyés dans une collection (clé créée sur zotero.org/settings/keys) ──
ZOTERO_API_KEY = os.getenv("ZOTERO_API_KEY", "")
ZOTERO_COLLECTION = os.getenv("ZOTERO_COLLECTION", "Veille")
