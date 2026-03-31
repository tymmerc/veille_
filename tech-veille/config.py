import os
from dotenv import load_dotenv

load_dotenv()

# ── PostgreSQL ──
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://veille:veille_s3cure_2026@localhost:5433/veille")

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
