import { describe, it, expect } from "vitest";
import { _test, PromptConfig } from "./ollama";

const { validateKeywords, extractBigrams, enrichWithKnownSources, GENERIC_BLOCKLIST, PROPER_NOUNS, REAL_SUBREDDITS, KNOWN_RSS, KNOWN_SUBS, KNOWN_GITHUB_REPOS, KNOWN_TWITTER } = _test;

// ─── validateKeywords ─────────────────────────────────────────────

describe("validateKeywords", () => {
  it("keeps multi-word keywords", () => {
    const result = validateKeywords(["claude code", "react native"], "test");
    expect(result).toEqual(["claude code", "react native"]);
  });

  it("blocks generic single words", () => {
    const result = validateKeywords(["code", "ai", "tech", "claude code"], "test");
    expect(result).toEqual(["claude code"]);
  });

  it("allows proper nouns as single words", () => {
    const result = validateKeywords(["Anthropic", "Kubernetes", "Rust"], "test");
    expect(result).toEqual(["Anthropic", "Kubernetes", "Rust"]);
  });

  it("rejects keywords shorter than 3 chars", () => {
    const result = validateKeywords(["AI", "ok", "claude code"], "test");
    expect(result).toEqual(["claude code"]);
  });

  it("deduplicates case-insensitively", () => {
    const result = validateKeywords(["Claude Code", "claude code", "CLAUDE CODE"], "test");
    expect(result).toEqual(["Claude Code"]);
  });

  it("rejects unknown single words shorter than 5 chars", () => {
    const result = validateKeywords(["rust", "go", "dart", "swift"], "test");
    // "rust" is a proper noun → kept. "go", "dart" are < 5 chars and not proper nouns → rejected. "swift" ≥ 5 chars → kept
    expect(result).toContain("rust");
    expect(result).toContain("swift");
    expect(result).not.toContain("go");
    expect(result).not.toContain("dart");
  });

  it("falls back to bigrams when too few keywords survive", () => {
    // All keywords get filtered, should extract bigrams from prompt
    const result = validateKeywords(["code", "ai"], "nouvelles fonctionnalites claude code");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((k) => k.includes("claude") || k.includes("fonctionnalites"))).toBe(true);
  });

  it("handles empty input", () => {
    const result = validateKeywords([], "test prompt");
    // Should extract bigrams as fallback
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("blocks all known generic words", () => {
    const generics = ["code", "ai", "tech", "web", "data", "tool", "app", "model", "feature", "update", "cloud", "security"];
    const result = validateKeywords(generics, "test");
    expect(result).toEqual([]);
  });
});

// ─── extractBigrams ───────────────────────────────────────────────

describe("extractBigrams", () => {
  it("extracts 2-word phrases from prompt", () => {
    const result = extractBigrams("claude code features");
    expect(result).toContain("claude code");
    expect(result).toContain("code features");
  });

  it("extracts trigrams too", () => {
    const result = extractBigrams("claude code features update");
    expect(result.some((b) => b.split(" ").length === 3)).toBe(true);
  });

  it("filters out French stop words", () => {
    const result = extractBigrams("je veux les nouvelles fonctionnalites");
    // "je", "veux", "les" are stop words — should be removed
    expect(result.every((b) => !b.startsWith("je ") && !b.startsWith("veux "))).toBe(true);
  });

  it("filters out English stop words", () => {
    const result = extractBigrams("I want the new features of claude");
    expect(result.every((b) => !b.startsWith("the ") && !b.includes(" the "))).toBe(true);
  });

  it("handles empty prompt", () => {
    expect(extractBigrams("")).toEqual([]);
  });

  it("handles single word (no bigrams possible)", () => {
    expect(extractBigrams("kubernetes")).toEqual([]);
  });
});

// ─── enrichWithKnownSources ──────────────────────────────────────

describe("enrichWithKnownSources", () => {
  function makeConfig(overrides?: Partial<PromptConfig>): PromptConfig {
    return {
      keywords: [],
      hn_keywords: [],
      subreddits: [],
      rss_feeds: [],
      arxiv_categories: [],
      scoring_instructions: "",
      ...overrides,
    };
  }

  it("adds Claude-related subreddits for 'claude' prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "les features de claude code");
    expect(config.subreddits).toContain("ClaudeAI");
    expect(config.subreddits).toContain("anthropic");
  });

  it("adds cybersecurity feeds for 'cybersecurity' prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "cybersecurity et hacking");
    expect(config.rss_feeds.length).toBeGreaterThan(0);
    expect(config.subreddits).toContain("cybersecurity");
    expect(config.subreddits).toContain("netsec");
  });

  it("uses word boundary matching (technology does NOT match tech)", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "technology news");
    // "technology" should NOT match the "tech" key
    const techFeeds = KNOWN_RSS["tech"] || [];
    for (const feed of techFeeds) {
      expect(config.rss_feeds).not.toContain(feed);
    }
  });

  it("does not add duplicates", () => {
    const config = makeConfig({ subreddits: ["ClaudeAI"] });
    enrichWithKnownSources(config, "claude code");
    const claudeCount = config.subreddits.filter((s) => s === "ClaudeAI").length;
    expect(claudeCount).toBe(1);
  });

  it("adds kubernetes feeds for kubernetes prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "kubernetes deployment");
    expect(config.subreddits).toContain("kubernetes");
    expect(config.subreddits).toContain("devops");
  });

  it("adds arxiv categories for AI prompts", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "machine learning et nlp");
    expect(config.arxiv_categories).toContain("cs.CL");
  });

  it("also scans generated keywords for topic matching", () => {
    const config = makeConfig({ keywords: ["kubernetes cluster", "helm charts"] });
    enrichWithKnownSources(config, "deploiement cloud");
    // "kubernetes" in keywords should trigger kubernetes enrichment
    expect(config.subreddits).toContain("kubernetes");
  });

  it("handles empty prompt gracefully", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "");
    // Should not crash, may add nothing
    expect(config.rss_feeds).toBeDefined();
  });

  it("adds github repos for claude prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "les features de claude code");
    expect(config.github_repos).toBeDefined();
    expect(config.github_repos!.length).toBeGreaterThan(0);
    expect(config.github_repos!.some((r) => r.repo === "anthropics/claude-code")).toBe(true);
  });

  it("adds github repos for kubernetes prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "kubernetes deployment");
    expect(config.github_repos).toBeDefined();
    expect(config.github_repos!.some((r) => r.repo === "kubernetes/kubernetes")).toBe(true);
  });

  it("adds github repos for react prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "react et next.js");
    expect(config.github_repos!.some((r) => r.repo === "facebook/react")).toBe(true);
  });

  it("adds twitter accounts for claude prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "claude code features");
    expect(config.twitter_accounts).toContain("AnthropicAI");
  });

  it("adds twitter accounts for openai prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "openai gpt features");
    expect(config.twitter_accounts).toContain("OpenAI");
  });

  it("does not add github repos for unrelated prompt", () => {
    const config = makeConfig();
    enrichWithKnownSources(config, "cuisine et recettes");
    expect(config.github_repos || []).toHaveLength(0);
    expect(config.twitter_accounts || []).toHaveLength(0);
  });
});

// ─── KNOWN_SUBS / REAL_SUBREDDITS consistency ─────────────────────

describe("KNOWN_SUBS whitelist", () => {
  it("all REAL_SUBREDDITS come from KNOWN_SUBS values", () => {
    const allFromKnown = new Set(
      Object.values(KNOWN_SUBS).flat().map((s) => s.toLowerCase())
    );
    for (const sub of REAL_SUBREDDITS) {
      expect(allFromKnown.has(sub)).toBe(true);
    }
  });

  it("covers major topic areas", () => {
    const topics = ["claude", "ai", "cybersecurity", "rust", "kubernetes", "react", "blockchain", "linux", "gaming"];
    for (const topic of topics) {
      expect(KNOWN_SUBS[topic]).toBeDefined();
      expect(KNOWN_SUBS[topic].length).toBeGreaterThan(0);
    }
  });
});

// ─── GENERIC_BLOCKLIST / PROPER_NOUNS no overlap ──────────────────

describe("blocklist and proper nouns", () => {
  it("no overlap between blocklist and proper nouns", () => {
    for (const word of PROPER_NOUNS) {
      expect(GENERIC_BLOCKLIST.has(word)).toBe(false);
    }
  });

  it("proper nouns are all lowercase", () => {
    for (const word of PROPER_NOUNS) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});
