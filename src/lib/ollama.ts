const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";

export type FollowedAccount = {
  platform: "twitter" | "blog";
  handle: string;
  label: string;
};

export type PromptConfig = {
  keywords: string[];
  hn_keywords: string[];
  subreddits: string[];
  rss_feeds: string[];
  arxiv_categories: string[];
  scoring_instructions: string;
  followed_accounts?: FollowedAccount[];
  github_repos?: { repo: string; label: string; category: string }[];
  twitter_accounts?: string[];
};

// ─── Verified RSS feeds by topic ──────────────────────────────────
// ONLY verified, working URLs. The LLM is NOT asked for RSS — we map them here.
const KNOWN_RSS: Record<string, string[]> = {
  openai: ["https://blog.openai.com/rss/"],
  google: ["https://blog.google/technology/ai/rss/"],
  deepmind: ["https://blog.google/technology/ai/rss/"],
  ai: [
    "https://blog.openai.com/rss/",
    "https://feeds.technologyreview.com/technologyreview/ai/",
    "https://techcrunch.com/category/artificial-intelligence/feed/",
  ],
  llm: ["https://feeds.technologyreview.com/technologyreview/ai/"],
  cybersecurity: [
    "https://krebsonsecurity.com/feed/",
    "https://feeds.feedburner.com/TheHackersNews",
    "https://www.bleepingcomputer.com/feed/",
  ],
  securite: [
    "https://krebsonsecurity.com/feed/",
    "https://feeds.feedburner.com/TheHackersNews",
  ],
  ransomware: ["https://www.bleepingcomputer.com/feed/"],
  kubernetes: ["https://kubernetes.io/feed.xml"],
  devops: ["https://feeds.feedburner.com/TheNewStack"],
  react: ["https://thisweekinreact.com/rss.xml"],
  blockchain: ["https://cointelegraph.com/rss"],
  privacy: ["https://www.eff.org/rss/updates.xml"],
  gdpr: ["https://www.eff.org/rss/updates.xml"],
  tech: [
    "https://feeds.arstechnica.com/arstechnica/technology-lab",
    "https://www.theverge.com/rss/index.xml",
  ],
  linux: ["https://lwn.net/headlines/rss"],
  postgresql: ["https://planet.postgresql.org/rss20.xml"],
  rust: ["https://blog.rust-lang.org/feed.xml"],
  gaming: ["https://www.gamedeveloper.com/rss.xml"],
};

// ─── Verified subreddits by topic ─────────────────────────────────
const KNOWN_SUBS: Record<string, string[]> = {
  claude: ["ClaudeAI", "anthropic"],
  anthropic: ["ClaudeAI", "anthropic"],
  openai: ["OpenAI", "ChatGPT"],
  chatgpt: ["OpenAI", "ChatGPT"],
  copilot: ["github", "programming"],
  ai: ["MachineLearning", "LocalLLaMA", "artificial"],
  llm: ["MachineLearning", "LocalLLaMA", "LanguageTechnology"],
  cybersecurity: ["cybersecurity", "netsec", "hacking", "ReverseEngineering"],
  securite: ["cybersecurity", "netsec"],
  ransomware: ["cybersecurity", "netsec"],
  wifi: ["netsec", "cybersecurity"],
  bluetooth: ["netsec", "cybersecurity"],
  supply: ["cybersecurity", "netsec"],
  tech: ["technology", "programming", "selfhosted", "opensource"],
  layoff: ["technology", "cscareerquestions"],
  rust: ["rust", "rust_gamedev"],
  go: ["golang"],
  python: ["Python", "learnpython"],
  haskell: ["haskell"],
  elixir: ["elixir"],
  typescript: ["typescript", "javascript"],
  javascript: ["javascript", "webdev"],
  svelte: ["svelte", "webdev"],
  vue: ["vuejs", "webdev"],
  web: ["webdev", "nextjs", "reactjs"],
  react: ["reactjs", "nextjs"],
  nextjs: ["nextjs", "reactjs"],
  kubernetes: ["kubernetes", "devops"],
  devops: ["devops", "sysadmin"],
  terraform: ["Terraform", "devops"],
  docker: ["docker", "devops"],
  cicd: ["devops", "sysadmin"],
  monitoring: ["devops", "sysadmin", "PrometheusMonitoring"],
  observabilite: ["devops", "sysadmin"],
  blockchain: ["ethereum", "CryptoTechnology", "solidity"],
  linux: ["linux", "linuxadmin", "linux_gaming"],
  postgresql: ["PostgreSQL", "Database"],
  database: ["Database", "PostgreSQL"],
  selfhosted: ["selfhosted", "homelab", "HomeServer"],
  privacy: ["privacy", "europrivacy", "GDPR"],
  gdpr: ["privacy", "europrivacy", "GDPR"],
  quantum: ["QuantumComputing", "quantum"],
  mobile: ["FlutterDev", "reactnative", "androiddev", "iOSProgramming"],
  flutter: ["FlutterDev"],
  gaming: ["gamedev", "unrealengine", "Unity3D"],
  godot: ["godot", "gamedev"],
  unreal: ["unrealengine", "gamedev"],
  unity: ["Unity3D", "gamedev"],
  nlp: ["LanguageTechnology", "MachineLearning"],
  traduction: ["LanguageTechnology", "MachineLearning"],
  iot: ["IOT", "embedded", "raspberry_pi"],
  embedded: ["embedded", "rust", "arduino"],
  robotique: ["robotics", "arduino"],
  drone: ["drones", "robotics"],
  microservices: ["microservices", "softwarearchitecture"],
  agile: ["agile", "scrum", "projectmanagement"],
  webassembly: ["WebAssembly", "programming"],
  wasm: ["WebAssembly", "programming"],
  llvm: ["Compilers", "programming"],
  compiler: ["Compilers", "programming"],
  arm: ["hardware", "embedded"],
  riscv: ["RISCV", "hardware"],
  energie: ["renewable", "energy"],
  solaire: ["solar", "energy"],
  batterie: ["batteries", "energy_storage"],
  sante: ["HealthIT", "MachineLearning"],
  ux: ["userexperience", "webdev"],
  accessibilite: ["accessibility", "webdev"],
  performance: ["webdev", "webperf"],
  startup: ["startups", "Entrepreneur"],
  cloud: ["aws", "googlecloud", "azure"],
  environnement: ["sustainability", "technology"],
};

// ─── Known GitHub repos by topic ─────────────────────────────────
const KNOWN_GITHUB_REPOS: Record<string, { repo: string; label: string; category: string }[]> = {
  claude: [{ repo: "anthropics/claude-code", label: "Claude Code", category: "ia" }],
  anthropic: [{ repo: "anthropics/claude-code", label: "Claude Code", category: "ia" }],
  copilot: [{ repo: "github/copilot.vim", label: "Copilot", category: "ia" }],
  cursor: [{ repo: "getcursor/cursor", label: "Cursor", category: "ia" }],
  openai: [{ repo: "openai/openai-python", label: "OpenAI SDK", category: "ia" }],
  langchain: [{ repo: "langchain-ai/langchain", label: "LangChain", category: "ia" }],
  ollama: [{ repo: "ollama/ollama", label: "Ollama", category: "ia" }],
  llama: [{ repo: "meta-llama/llama", label: "Llama", category: "ia" }],
  kubernetes: [{ repo: "kubernetes/kubernetes", label: "Kubernetes", category: "tech" }],
  docker: [{ repo: "moby/moby", label: "Docker", category: "tech" }],
  react: [{ repo: "facebook/react", label: "React", category: "tech" }],
  nextjs: [{ repo: "vercel/next.js", label: "Next.js", category: "tech" }],
  svelte: [{ repo: "sveltejs/svelte", label: "Svelte", category: "tech" }],
  vue: [{ repo: "vuejs/core", label: "Vue.js", category: "tech" }],
  rust: [{ repo: "rust-lang/rust", label: "Rust", category: "tech" }],
  golang: [{ repo: "golang/go", label: "Go", category: "tech" }],
  python: [{ repo: "python/cpython", label: "Python", category: "tech" }],
  typescript: [{ repo: "microsoft/TypeScript", label: "TypeScript", category: "tech" }],
  deno: [{ repo: "denoland/deno", label: "Deno", category: "tech" }],
  bun: [{ repo: "oven-sh/bun", label: "Bun", category: "tech" }],
  terraform: [{ repo: "hashicorp/terraform", label: "Terraform", category: "tech" }],
  postgresql: [{ repo: "postgres/postgres", label: "PostgreSQL", category: "tech" }],
  redis: [{ repo: "redis/redis", label: "Redis", category: "tech" }],
  linux: [{ repo: "torvalds/linux", label: "Linux Kernel", category: "tech" }],
  flutter: [{ repo: "flutter/flutter", label: "Flutter", category: "tech" }],
  godot: [{ repo: "godotengine/godot", label: "Godot", category: "tech" }],
  unity: [{ repo: "Unity-Technologies/UnityCsReference", label: "Unity", category: "tech" }],
  pytorch: [{ repo: "pytorch/pytorch", label: "PyTorch", category: "ia" }],
  tensorflow: [{ repo: "tensorflow/tensorflow", label: "TensorFlow", category: "ia" }],
  vscode: [{ repo: "microsoft/vscode", label: "VS Code", category: "tech" }],
  neovim: [{ repo: "neovim/neovim", label: "Neovim", category: "tech" }],
};

// ─── Known Twitter/X accounts by topic ───────────────────────────
const KNOWN_TWITTER: Record<string, string[]> = {
  claude: ["AnthropicAI"],
  anthropic: ["AnthropicAI"],
  openai: ["OpenAI", "sama"],
  google: ["GoogleDeepMind"],
  deepmind: ["GoogleDeepMind"],
  meta: ["AIatMeta"],
  kubernetes: ["kuaboretes"],
  rust: ["rustlang"],
  golang: ["golang"],
  react: ["reactjs"],
  nextjs: ["vercel"],
  svelte: ["svaborejs"],
  linux: ["LinuxFoundation"],
  cybersecurity: ["ABOREUS_ICS_CERT"],
  docker: ["Docker"],
};

// Whitelist of verified real subreddit names (case-insensitive lookup)
const REAL_SUBREDDITS = new Set(
  Object.values(KNOWN_SUBS).flat().map((s) => s.toLowerCase())
);

// ─── Arxiv category hints ──────────────────────────────────────────
const ARXIV_HINTS: Record<string, string[]> = {
  ai: ["cs.AI", "cs.LG"],
  llm: ["cs.CL", "cs.AI"],
  nlp: ["cs.CL"],
  traduction: ["cs.CL"],
  cybersecurity: ["cs.CR"],
  securite: ["cs.CR"],
  quantum: ["quant-ph"],
  vision: ["cs.CV"],
  robotics: ["cs.RO"],
  robotique: ["cs.RO"],
  drone: ["cs.RO"],
  embedded: ["cs.AR"],
  arm: ["cs.AR"],
  riscv: ["cs.AR"],
  compiler: ["cs.PL"],
  llvm: ["cs.PL"],
  privacy: ["cs.CR", "cs.LG"],
  federated: ["cs.LG", "cs.CR"],
};

// ─── System prompt ────────────────────────────────────────────────
const INTERPRET_SYSTEM = `Tu es un assistant qui configure un agregateur de news tech.
L'utilisateur decrit ses centres d'interet en une phrase.
Tu dois generer un JSON avec:
- "keywords": expressions de 2+ mots pour filtrer les articles (8-15). Chaque keyword doit etre SPECIFIQUE au sujet. Inclus des variantes FR et EN. Les mots seuls sont OK uniquement pour les noms propres (Anthropic, Kubernetes, Rust...).
- "hn_keywords": mots-cles pour HackerNews Algolia (3-8, en anglais, specifiques).
- "subreddits": noms de subreddits REELS et CONNUS (3-8, sans "r/"). Exemples: MachineLearning, kubernetes, netsec, reactjs, rust, selfhosted, FlutterDev, PostgreSQL.
- "arxiv_categories": categories arxiv si pertinent. Exemples: cs.AI, cs.CR, cs.CL, cs.LG, cs.CV, quant-ph. Sinon liste vide.
- "scoring_instructions": instructions FR pour scorer 1-10, PRECIS sur ce qui merite 8+ vs 4-5.

IMPORTANT: PAS de champ "rss_feeds" — les RSS sont geres automatiquement.

REGLES:
- Privilegier les expressions composees specifiques (pas "mobile app" mais "flutter development", "react native app")
- Inclure le nom de la technologie/outil specifique dans les keywords
- Subreddits: uniquement des vrais (pas de noms inventes)
- Reponds UNIQUEMENT avec le JSON valide

EXEMPLES:

Phrase: "les nouvelles fonctionnalites de claude code"
{"keywords":["claude code","claude code features","anthropic claude code","claude code update","claude code CLI","claude code release notes"],"hn_keywords":["Claude Code","Anthropic Claude","Claude Code features"],"subreddits":["ClaudeAI","anthropic"],"arxiv_categories":[],"scoring_instructions":"Articles sur Claude Code et ses fonctionnalités: 8-10. Claude AI en général: 5-7. Autres IA: 2-4."}

Phrase: "les fuites de donnees et ransomware"
{"keywords":["fuite de données","data breach","ransomware attack","données volées","attaque ransomware","data leak","security breach","rançongiciel"],"hn_keywords":["data breach","ransomware","data leak","security breach"],"subreddits":["cybersecurity","netsec","ransomware"],"arxiv_categories":["cs.CR"],"scoring_instructions":"Fuites ou ransomware concrets: 8-10. Cybersécurité générale: 4-6. Autres: 1-3."}

Phrase: "développement mobile avec flutter et react native"
{"keywords":["flutter development","react native development","flutter widget","react native app","cross-platform mobile","flutter vs react native","dart flutter","mobile UI framework"],"hn_keywords":["Flutter","React Native","cross-platform mobile","Dart"],"subreddits":["FlutterDev","reactnative","androiddev"],"arxiv_categories":[],"scoring_instructions":"Articles sur Flutter ou React Native: 8-10. Développement mobile général: 5-7. Autres: 1-3."}

Phrase: "kubernetes et infrastructure cloud native"
{"keywords":["kubernetes deployment","cloud native architecture","kubernetes cluster","container orchestration","helm charts","kubernetes operator","k8s scaling"],"hn_keywords":["Kubernetes","cloud native","container orchestration","K8s"],"subreddits":["kubernetes","devops","cloudnative"],"arxiv_categories":[],"scoring_instructions":"Articles Kubernetes/cloud native concrets: 8-10. DevOps/infra général: 4-6. Autres: 1-3."}`;

export async function interpretPrompt(userPrompt: string): Promise<PromptConfig> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `Phrase utilisateur: "${userPrompt}"`,
      system: INTERPRET_SYSTEM,
      stream: false,
      options: { temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.response?.trim() || "";

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Ollama response");
  }

  const config = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  // Validate and sanitize — IGNORE rss_feeds from LLM (always hallucinated)
  const result: PromptConfig = {
    keywords: Array.isArray(config.keywords) ? (config.keywords as string[]).slice(0, 20).map(String) : [],
    hn_keywords: Array.isArray(config.hn_keywords) ? (config.hn_keywords as string[]).slice(0, 15).map(String) : [],
    subreddits: Array.isArray(config.subreddits)
      ? (config.subreddits as string[])
          .map((s) => String(s).replace(/^r\//, ""))
          .filter((s) => /^[a-zA-Z0-9_]+$/.test(s))
          .slice(0, 20)
      : [],
    rss_feeds: [], // Always empty — populated by enrichWithKnownSources()
    arxiv_categories: Array.isArray(config.arxiv_categories)
      ? (config.arxiv_categories as string[]).filter((c) => /^[a-z-]+\.[A-Z]{2,}$/i.test(c)).slice(0, 10)
      : [],
    scoring_instructions: typeof config.scoring_instructions === "string"
      ? config.scoring_instructions.slice(0, 1000)
      : "Scorer les articles selon leur pertinence technique et leur nouveaute.",
  };

  // Never let the LLM decide enabled_sources
  delete (result as Record<string, unknown>).enabled_sources;

  // Strip non-Latin characters from keywords (qwen2.5 sometimes outputs Chinese)
  const stripNonLatin = (s: string) => s.replace(/[^\u0000-\u024F\u1E00-\u1EFF\s\-'.]/g, "").trim();
  result.keywords = result.keywords.map(stripNonLatin).filter((k) => k.length > 2);
  result.hn_keywords = result.hn_keywords.map(stripNonLatin).filter((k) => k.length > 2);

  // Post-validate keywords
  result.keywords = validateKeywords(result.keywords, userPrompt);
  result.hn_keywords = validateKeywords(result.hn_keywords, userPrompt);

  // Filter LLM-suggested subreddits: only keep known real ones
  result.subreddits = result.subreddits.filter((s) => REAL_SUBREDDITS.has(s.toLowerCase()));

  // Filter irrelevant arxiv categories
  const promptLower = userPrompt.toLowerCase();
  if (!promptLower.includes("quantum") && !promptLower.includes("quantique")) {
    result.arxiv_categories = result.arxiv_categories.filter((c) => c !== "quant-ph");
  }

  // Enrich with verified sources based on user prompt + generated keywords
  enrichWithKnownSources(result, userPrompt);

  return result;
}

// ─── Keyword validation ──────────────────────────────────────────

const GENERIC_BLOCKLIST = new Set([
  "code", "ai", "tech", "web", "data", "tool", "app", "model", "new", "help",
  "feature", "update", "innovation", "confiance", "transparence", "importance",
  "cloud", "security", "open", "system", "project", "release", "test", "api",
  "information", "solution", "platform", "service", "intelligence", "learning",
  "technology", "software", "hardware", "network", "digital", "online",
  "verite", "analyse", "impact", "avenir", "futur", "monde", "recherche",
  "tools", "development", "mobile", "design", "management", "community",
]);

const PROPER_NOUNS = new Set([
  "anthropic", "openai", "google", "deepmind", "meta", "microsoft", "apple",
  "nvidia", "tesla", "amazon", "rust", "golang", "python", "typescript",
  "kubernetes", "docker", "linux", "github", "gitlab", "redis", "postgres",
  "pytorch", "tensorflow", "langchain", "ollama", "llama", "mistral", "gemini",
  "copilot", "chatgpt", "claude", "sonnet", "opus", "haiku", "flutter",
  "terraform", "ansible", "grafana", "prometheus", "elasticsearch", "mongodb",
  "postgresql", "mysql", "nginx", "vercel", "supabase", "prisma", "nextjs",
  "react", "vue", "svelte", "angular", "django", "fastapi", "express",
  "bitcoin", "ethereum", "solidity", "unity", "unreal", "godot",
]);

function validateKeywords(keywords: string[], userPrompt: string): string[] {
  const seen = new Set<string>();
  let filtered = keywords.filter((kw) => {
    const lower = kw.toLowerCase().trim();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  filtered = filtered.filter((kw) => {
    const trimmed = kw.trim();
    if (trimmed.length < 3) return false;

    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      const lower = trimmed.toLowerCase();
      if (PROPER_NOUNS.has(lower)) return true;
      if (GENERIC_BLOCKLIST.has(lower)) return false;
      if (lower.length < 5) return false;
    }
    return true;
  });

  // Fallback: extract bigrams from the user prompt if too few keywords
  if (filtered.length < 3) {
    const fallbackKeywords = extractBigrams(userPrompt);
    for (const fb of fallbackKeywords) {
      if (!seen.has(fb.toLowerCase())) {
        filtered.push(fb);
        seen.add(fb.toLowerCase());
      }
    }
  }

  return filtered;
}

function extractBigrams(prompt: string): string[] {
  const stopWords = new Set([
    "je", "tu", "il", "elle", "nous", "vous", "les", "des", "une", "un",
    "de", "du", "la", "le", "et", "en", "a", "au", "aux", "avec", "pour",
    "sur", "par", "dans", "qui", "que", "ce", "cette", "mon", "ma", "mes",
    "son", "sa", "ses", "tout", "toutes", "tous", "veux", "veut", "sont",
    "est", "suis", "faire", "comment", "elles", "peuvent", "peut",
    "i", "the", "a", "an", "and", "or", "to", "of", "in", "on", "with",
    "how", "they", "can", "me", "my", "all", "want",
  ]);

  const words = prompt.toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  for (let i = 0; i < words.length - 2; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return bigrams;
}

// ─── Source enrichment (verified sources only) ────────────────────

function enrichWithKnownSources(config: PromptConfig, prompt: string): void {
  const lower = prompt.toLowerCase();
  const rssSet = new Set(config.rss_feeds);
  const subSet = new Set(config.subreddits);
  const arxivSet = new Set(config.arxiv_categories);

  // Also scan generated keywords for topic matching
  const allText = `${lower} ${config.keywords.join(" ").toLowerCase()}`;

  for (const [topic, feeds] of Object.entries(KNOWN_RSS)) {
    if (new RegExp(`\\b${topic}\\b`, "i").test(allText)) {
      for (const feed of feeds) rssSet.add(feed);
    }
  }
  for (const [topic, subs] of Object.entries(KNOWN_SUBS)) {
    if (new RegExp(`\\b${topic}\\b`, "i").test(allText)) {
      for (const sub of subs) subSet.add(sub);
    }
  }
  for (const [topic, cats] of Object.entries(ARXIV_HINTS)) {
    if (new RegExp(`\\b${topic}\\b`, "i").test(allText)) {
      for (const cat of cats) arxivSet.add(cat);
    }
  }

  config.rss_feeds = Array.from(rssSet);
  config.subreddits = Array.from(subSet);
  config.arxiv_categories = Array.from(arxivSet);

  // Enrich with GitHub repos
  const repoKeys = new Set((config.github_repos || []).map((r) => r.repo));
  for (const [topic, repos] of Object.entries(KNOWN_GITHUB_REPOS)) {
    if (new RegExp(`\\b${topic}\\b`, "i").test(allText)) {
      for (const r of repos) {
        if (!repoKeys.has(r.repo)) {
          repoKeys.add(r.repo);
          config.github_repos = [...(config.github_repos || []), r];
        }
      }
    }
  }

  // Enrich with Twitter accounts
  const twitterSet = new Set(config.twitter_accounts || []);
  for (const [topic, accounts] of Object.entries(KNOWN_TWITTER)) {
    if (new RegExp(`\\b${topic}\\b`, "i").test(allText)) {
      for (const acc of accounts) twitterSet.add(acc);
    }
  }
  config.twitter_accounts = Array.from(twitterSet);
}

// ─── Test exports ─────────────────────────────────────────────────
export const _test = {
  validateKeywords,
  extractBigrams,
  enrichWithKnownSources,
  GENERIC_BLOCKLIST,
  PROPER_NOUNS,
  REAL_SUBREDDITS,
  KNOWN_RSS,
  KNOWN_SUBS,
  ARXIV_HINTS,
  KNOWN_GITHUB_REPOS,
  KNOWN_TWITTER,
};
