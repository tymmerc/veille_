export type Category = "ia" | "cyber" | "tech";

export interface Article {
  id: string;
  title: string;
  titleOriginal?: string;
  summary: string | null;
  source: string;
  platform?: string;
  url: string;
  category: string;
  score: number;
  foundAt: string;
  liked?: boolean;
  bookmarked?: boolean;
  read?: boolean;
  likeCount?: number;
  isOfficial?: boolean;
  section?: "followed" | "relevant" | "discover";
}

export const CATEGORIES: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "tout" },
  { key: "ia", label: "ia" },
  { key: "cyber", label: "cyber" },
  { key: "tech", label: "tech" },
];

export const CATEGORY_COLORS: Record<Category, string> = {
  ia: "bg-rose",
  cyber: "bg-cyber",
  tech: "bg-tech",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  ia: "ia",
  cyber: "cyber",
  tech: "tech",
};

export const CATEGORY_TEXT_COLORS: Record<Category, string> = {
  ia: "text-rose",
  cyber: "text-cyber",
  tech: "text-tech",
};

// ─── Tags for presets ─────────────────────────────────────────
export type TagGroup = "category" | "source" | "topic";

export type Tag = {
  id: string;
  label: string;
  group: TagGroup;
  category?: Category; // parent category for topic tags
};

export const TAGS: Tag[] = [
  // Categories
  { id: "cat:ia", label: "IA", group: "category", category: "ia" },
  { id: "cat:cyber", label: "Cyber", group: "category", category: "cyber" },
  { id: "cat:tech", label: "Tech", group: "category", category: "tech" },
  // Sources
  { id: "src:reddit", label: "Reddit", group: "source" },
  { id: "src:hackernews", label: "Hacker News", group: "source" },
  { id: "src:arxiv", label: "arXiv", group: "source" },
  { id: "src:rss", label: "RSS", group: "source" },
  { id: "src:blog", label: "Blogs officiels", group: "source" },
  { id: "src:official", label: "Officiel uniquement", group: "source" },
  // IA topics
  { id: "topic:llm", label: "LLM", group: "topic", category: "ia" },
  { id: "topic:ml", label: "Machine Learning", group: "topic", category: "ia" },
  { id: "topic:nlp", label: "NLP", group: "topic", category: "ia" },
  { id: "topic:cv", label: "Computer Vision", group: "topic", category: "ia" },
  { id: "topic:genai", label: "IA Generative", group: "topic", category: "ia" },
  { id: "topic:opensource-ai", label: "Open Source AI", group: "topic", category: "ia" },
  { id: "topic:agents", label: "Agents", group: "topic", category: "ia" },
  // Cyber topics
  { id: "topic:vuln", label: "Vulnerabilites", group: "topic", category: "cyber" },
  { id: "topic:malware", label: "Malware", group: "topic", category: "cyber" },
  { id: "topic:ctf", label: "CTF", group: "topic", category: "cyber" },
  { id: "topic:osint", label: "OSINT", group: "topic", category: "cyber" },
  { id: "topic:pentest", label: "Pentest", group: "topic", category: "cyber" },
  { id: "topic:zeroday", label: "Zero-day", group: "topic", category: "cyber" },
  { id: "topic:ransomware", label: "Ransomware", group: "topic", category: "cyber" },
  // Tech topics
  { id: "topic:web", label: "Dev Web", group: "topic", category: "tech" },
  { id: "topic:rust", label: "Rust", group: "topic", category: "tech" },
  { id: "topic:go", label: "Go", group: "topic", category: "tech" },
  { id: "topic:python", label: "Python", group: "topic", category: "tech" },
  { id: "topic:devops", label: "DevOps", group: "topic", category: "tech" },
  { id: "topic:selfhost", label: "Self-hosted", group: "topic", category: "tech" },
  { id: "topic:cloud", label: "Cloud", group: "topic", category: "tech" },
  { id: "topic:linux", label: "Linux", group: "topic", category: "tech" },
  { id: "topic:react", label: "React", group: "topic", category: "tech" },
  { id: "topic:nextjs", label: "Next.js", group: "topic", category: "tech" },
  { id: "topic:opensource", label: "Open Source", group: "topic", category: "tech" },
];

// Keywords for topic-based client-side filtering
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  "topic:llm": ["llm", "gpt", "claude", "gemini", "mistral", "llama", "language model", "chatgpt", "openai", "anthropic"],
  "topic:ml": ["machine learning", "deep learning", "neural", "training", "model", "dataset", "pytorch", "tensorflow"],
  "topic:nlp": ["nlp", "natural language", "text generation", "tokeniz", "embedding", "sentiment"],
  "topic:cv": ["computer vision", "image recognition", "object detection", "segmentation", "yolo", "diffusion", "stable diffusion", "midjourney", "dall-e"],
  "topic:genai": ["generative", "genai", "gen ai", "text-to-image", "text-to-video", "image generation", "sora", "diffusion"],
  "topic:opensource-ai": ["open source", "open-source", "hugging face", "huggingface", "ollama", "localllama", "gguf", "ggml"],
  "topic:agents": ["agent", "autogpt", "langchain", "langgraph", "crew ai", "tool use", "function calling", "agentic", "mcp"],
  "topic:vuln": ["vulnerability", "vulnerabilit", "cve-", "exploit", "patch", "zero-day", "0day", "flaw"],
  "topic:malware": ["malware", "trojan", "worm", "botnet", "backdoor", "spyware", "infostealer", "rat "],
  "topic:ctf": ["ctf", "capture the flag", "writeup", "write-up", "challenge", "pwn", "reverse eng"],
  "topic:osint": ["osint", "open source intelligence", "recon", "reconnaissance", "shodan", "maltego"],
  "topic:pentest": ["pentest", "penetration test", "red team", "offensive", "bug bounty", "burp"],
  "topic:zeroday": ["zero-day", "0-day", "0day", "zero day", "in the wild"],
  "topic:ransomware": ["ransomware", "ransom", "lockbit", "blackcat", "alphv", "clop"],
  "topic:web": ["react", "vue", "angular", "next.js", "nextjs", "svelte", "tailwind", "css", "javascript", "typescript", "frontend", "backend", "api", "rest", "graphql"],
  "topic:rust": ["rust", "cargo", "crate", "rustc", "tokio", "axum"],
  "topic:go": ["golang", " go ", "goroutine", "gin ", "cobra"],
  "topic:python": ["python", "pip", "django", "flask", "fastapi", "pandas", "numpy"],
  "topic:devops": ["devops", "ci/cd", "github actions", "jenkins", "terraform", "ansible", "kubernetes", "k8s", "docker", "container"],
  "topic:selfhost": ["self-host", "selfhost", "homelab", "home server", "nas ", "docker compose"],
  "topic:cloud": ["aws", "azure", "gcp", "cloud", "serverless", "lambda", "vercel", "netlify", "edge"],
  "topic:linux": ["linux", "ubuntu", "debian", "fedora", "arch ", "kernel", "systemd", "bash"],
  "topic:react": ["react", "jsx", "hooks", "next.js", "nextjs", "remix", "gatsby"],
  "topic:nextjs": ["next.js", "nextjs", "vercel", "app router", "server component"],
  "topic:opensource": ["open source", "open-source", "github", "foss", "mit license", "apache license"],
};

// Match source string against source tag
export function matchesSourceTag(tagId: string, articleSource: string): boolean {
  const src = articleSource.toLowerCase();
  switch (tagId) {
    case "src:reddit": return src.startsWith("r/");
    case "src:hackernews": return src === "hackernews" || src === "hacker news";
    case "src:arxiv": return src === "arxiv";
    case "src:rss": return !src.startsWith("r/") && src !== "hackernews" && src !== "hacker news" && src !== "arxiv" && !["anthropic", "openai blog", "google deepmind"].some(b => src.toLowerCase().includes(b));
    case "src:blog": return ["anthropic", "openai blog", "google deepmind"].some(b => src.toLowerCase().includes(b));
    default: return false;
  }
}

// Match article text against topic tag keywords
export function matchesTopicTag(tagId: string, title: string, summary: string | null): boolean {
  const keywords = TOPIC_KEYWORDS[tagId];
  if (!keywords) return false;
  const text = `${title} ${summary || ""}`.toLowerCase();
  return keywords.some((kw) => text.includes(kw));
}

// Filter articles by a set of tag IDs
export function filterByTags(articles: Article[], tagIds: string[]): Article[] {
  if (tagIds.length === 0) return articles;

  const catTags = tagIds.filter((t) => t.startsWith("cat:"));
  const srcTags = tagIds.filter((t) => t.startsWith("src:"));
  const topicTags = tagIds.filter((t) => t.startsWith("topic:") || t.startsWith("custom:"));

  return articles.filter((article) => {
    // Category filter (OR within group)
    if (catTags.length > 0) {
      const matchesCat = catTags.some((t) => t === `cat:${article.category}`);
      if (!matchesCat) return false;
    }
    // Source filter (OR within group)
    if (srcTags.length > 0) {
      const matchesSrc = srcTags.some((t) => matchesSourceTag(t, article.source));
      if (!matchesSrc) return false;
    }
    // Topic filter (OR within group) — includes custom tags
    if (topicTags.length > 0) {
      const matchesTopic = topicTags.some((t) => {
        // Built-in topic tags use keyword lists
        if (matchesTopicTag(t, article.title, article.summary)) return true;
        // Custom tags: match by tag label as keyword (extracted from ID)
        if (t.startsWith("custom:")) {
          const label = t.replace(/^custom:/, "").replace(/-\d+$/, "").replace(/-/g, " ");
          const text = `${article.title} ${article.summary || ""}`.toLowerCase();
          return text.includes(label);
        }
        return false;
      });
      if (!matchesTopic) return false;
    }
    return true;
  });
}

export function parseSummary(summary: string | null): {
  hook: string;
  detail: string;
} {
  if (!summary) return { hook: "", detail: "" };
  const sep = summary.indexOf("|||");
  if (sep === -1) return { hook: summary, detail: summary };
  return {
    hook: summary.substring(0, sep).trim(),
    detail: summary.substring(sep + 3).trim(),
  };
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}
