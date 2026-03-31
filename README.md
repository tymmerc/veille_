# veille_

Plateforme de veille technologique personnalisee par IA. Tu decris tes interets en une phrase, l'IA se charge du reste.

**https://tymmerc.eu/veille/**

## Comment ca marche

1. Tu ecris ce qui t'interesse ("les nouvelles features de claude code", "vulnerabilites zero-day", "react et next.js"...)
2. L'IA locale (Ollama/Qwen 2.5) analyse ta phrase et en extrait des mots-cles, subreddits, repos GitHub, comptes Twitter
3. Toutes les heures, le collecteur scrape 6 sources et score chaque article de 0 a 10
4. Ton feed affiche les articles pertinents en premier, le reste dans "Explorer"

## Sources

| Source | Methode |
|--------|---------|
| Hacker News | API Algolia |
| Reddit | PRAW |
| RSS | feedparser (blogs tech, Nitter) |
| arXiv | API officielle |
| GitHub Releases | API REST (changelogs des projets suivis) |
| Blogs | Scraping HTML (Anthropic, DeepMind) |

Les sources sont dynamiques par utilisateur. Si tu ecris "kubernetes", le systeme track automatiquement `kubernetes/kubernetes` sur GitHub, `r/kubernetes` sur Reddit, et `@kuboretes` sur Twitter.

## Stack

**Frontend** : Next.js 14, React, TypeScript, Tailwind CSS

**Backend** : Next.js API Routes (30 endpoints), Prisma ORM, PostgreSQL

**Collecteur** : Python, BeautifulSoup, feedparser, PRAW

**IA** : Ollama (Qwen 2.5 3B) pour l'interpretation des prompts, le scoring, les resumes et les digests de notifications

**Infra** : VPS Ubuntu, Nginx, systemd

## Structure du repo

```
veille_/
├── src/                  Frontend Next.js + API REST
│   ├── app/              Pages et routes API
│   ├── components/       Composants React (feed, sidebar, header...)
│   └── lib/              Auth, Prisma, Ollama, utils
├── prisma/               Schema DB + migrations
├── e2e/                  Tests E2E Playwright (41 tests)
├── tech-veille/          Collecteur Python
│   ├── main.py           Orchestrateur (collect, score, notify)
│   ├── sources/          6 scrapers (reddit, hn, rss, arxiv, github, blogs)
│   ├── summarizer.py     Scoring et resume via Ollama
│   ├── notifier.py       Digest IA vers Discord/Slack
│   └── storage.py        Acces DB + filtrage par user
├── public/               PWA (manifest, icons, service worker)
└── package.json
```

## Base de donnees

PostgreSQL, 12 tables gerees par Prisma :

- **users** : comptes, phrase d'interets, config JSON generee par l'IA, webhooks
- **articles** : articles collectes (titre, resume, score, categorie, source)
- **likes, bookmarks, article_reads** : interactions user/article
- **friendships, shared_articles, share_replies** : social
- **presets** : filtres sauvegardes
- **prompt_history** : historique des phrases

La classification (relevant/discover) est calculee a la volee par l'API, pas stockee en base.

## Features

- Auth email/mot de passe + Discord OAuth
- Interpretation de prompts en langage naturel par LLM
- Collecte auto depuis 6 sources (cron horaire)
- Suivi dynamique de 35+ technologies (GitHub releases, Twitter, subreddits)
- Feed personnalise avec 4 onglets (Pour toi, Sources, Amis, Explorer)
- Scoring de pertinence 0-10 par article
- Resume d'articles en francais par LLM
- Likes, bookmarks avec tags, marquage lu
- Social (amis, partage d'articles, discussions)
- Notifications Discord/Slack (digest IA des tendances)
- Presets de filtres sauvegardables
- Theme clair/sombre
- PWA (installable sur mobile)
- 59 tests unitaires + 41 tests E2E

## Dev

```bash
# Frontend
npm install
npx prisma generate
npm run dev

# Collecteur
cd tech-veille
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py          # run complet (scoring Ollama ~30min)
python main.py --fast   # collecte rapide sans scoring (~12s)

# Tests
npm test                # unit tests (vitest)
npm run test:e2e        # E2E (playwright)
```

## Environnement

```env
DATABASE_URL=postgresql://user:pass@localhost:5433/veille
SESSION_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://yourdomain.com/veille/api/auth/callback
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
```
