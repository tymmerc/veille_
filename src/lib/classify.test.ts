import { describe, it, expect } from "vitest";
import {
  buildKeywordMatcher,
  matchesUserInterests,
  buildClassifyContext,
  classifyArticle,
  classifyWithSourceFilter,
  extractDomain,
  type PromptConfig,
  type ArticleLike,
} from "./classify";

// ─── Helpers ──────────────────────────────────────────────────────

function makeArticle(overrides: Partial<ArticleLike> = {}): ArticleLike {
  return {
    title: "Test Article",
    summary: "A test summary",
    source: "HackerNews",
    platform: "hackernews",
    isOfficial: false,
    url: "https://example.com/article",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<PromptConfig> = {}): PromptConfig {
  return {
    keywords: ["claude code", "anthropic"],
    hn_keywords: ["Claude Code"],
    subreddits: ["ClaudeAI", "anthropic"],
    rss_feeds: [],
    enabled_sources: [],
    ...overrides,
  };
}

// ─── buildKeywordMatcher ──────────────────────────────────────────

describe("buildKeywordMatcher", () => {
  it("separates multi-word and single-word keywords", () => {
    const matcher = buildKeywordMatcher({
      keywords: ["claude code", "Anthropic"],
      hn_keywords: ["Claude Code CLI"],
    });
    expect(matcher.multi).toContain("claude code");
    expect(matcher.multi).toContain("claude code cli");
    expect(matcher.patterns.length).toBe(1); // "anthropic"
  });

  it("handles empty config", () => {
    const matcher = buildKeywordMatcher({});
    expect(matcher.multi).toEqual([]);
    expect(matcher.patterns).toEqual([]);
  });

  it("escapes regex special characters in single words", () => {
    const matcher = buildKeywordMatcher({ keywords: ["C++", "node.js"] });
    // Both contain special chars but should not throw
    expect(matcher.patterns.length + matcher.multi.length).toBe(2);
  });
});

// ─── matchesUserInterests ─────────────────────────────────────────

describe("matchesUserInterests", () => {
  it("matches multi-word keyword in title", () => {
    const matcher = buildKeywordMatcher({ keywords: ["claude code"] });
    const result = matchesUserInterests(
      { title: "New Claude Code Features", summary: "", source: "HN" },
      matcher,
      new Set(),
    );
    expect(result).toBe(true);
  });

  it("matches multi-word keyword in summary", () => {
    const matcher = buildKeywordMatcher({ keywords: ["claude code"] });
    const result = matchesUserInterests(
      { title: "New Release", summary: "This claude code update is great", source: "HN" },
      matcher,
      new Set(),
    );
    expect(result).toBe(true);
  });

  it("uses word boundary for single-word keywords", () => {
    const matcher = buildKeywordMatcher({ keywords: ["Rust"] });
    // "Rust" should match
    expect(matchesUserInterests(
      { title: "Rust 2026 Edition", summary: "", source: "HN" },
      matcher, new Set(),
    )).toBe(true);
    // "Rustic" should NOT match (word boundary)
    expect(matchesUserInterests(
      { title: "Rustic Furniture Design", summary: "", source: "HN" },
      matcher, new Set(),
    )).toBe(false);
  });

  it("does NOT match substring for single words (barcode vs code)", () => {
    const matcher = buildKeywordMatcher({ keywords: ["code"] });
    expect(matchesUserInterests(
      { title: "Barcode Scanner App", summary: "", source: "HN" },
      matcher, new Set(),
    )).toBe(false);
    expect(matchesUserInterests(
      { title: "Code Review Tools", summary: "", source: "HN" },
      matcher, new Set(),
    )).toBe(true);
  });

  it("matches by subreddit source", () => {
    const matcher = buildKeywordMatcher({ keywords: ["something rare"] });
    const subs = new Set(["r/clauudeai"]);
    const result = matchesUserInterests(
      { title: "Random Title", summary: "", source: "r/ClauudeAI" },
      matcher, subs,
    );
    expect(result).toBe(true);
  });

  it("returns true when no keywords configured (show everything)", () => {
    const matcher = buildKeywordMatcher({});
    expect(matchesUserInterests(
      { title: "Anything", summary: "", source: "HN" },
      matcher, new Set(),
    )).toBe(true);
  });

  it("case insensitive matching", () => {
    const matcher = buildKeywordMatcher({ keywords: ["CLAUDE CODE"] });
    expect(matchesUserInterests(
      { title: "claude code is great", summary: "", source: "HN" },
      matcher, new Set(),
    )).toBe(true);
  });
});

// ─── extractDomain ────────────────────────────────────────────────

describe("extractDomain", () => {
  it("extracts hostname without www", () => {
    expect(extractDomain("https://www.anthropic.com/news")).toBe("anthropic.com");
  });

  it("handles non-www URLs", () => {
    expect(extractDomain("https://blog.openai.com/rss/")).toBe("blog.openai.com");
  });

  it("returns empty string for invalid URL", () => {
    expect(extractDomain("not a url")).toBe("");
    expect(extractDomain("")).toBe("");
  });
});

// ─── classifyArticle ──────────────────────────────────────────────

describe("classifyArticle", () => {
  it("classifies as discover when no config", () => {
    const ctx = buildClassifyContext(null);
    expect(classifyArticle(makeArticle(), ctx)).toBe("discover");
  });

  it("classifies as followed when source matches subreddit", () => {
    const ctx = buildClassifyContext(makeConfig({ subreddits: ["ClaudeAI"] }));
    expect(classifyArticle(
      makeArticle({ source: "r/ClaudeAI", platform: "reddit" }),
      ctx,
    )).toBe("followed");
  });

  it("classifies as followed when URL domain matches followed_accounts", () => {
    const ctx = buildClassifyContext(makeConfig({
      followed_accounts: [{ platform: "blog", handle: "https://www.anthropic.com/news", label: "Anthropic" }],
    }));
    expect(classifyArticle(
      makeArticle({ url: "https://www.anthropic.com/news/claude-4", platform: "blog" }),
      ctx,
    )).toBe("followed");
  });

  it("classifies as relevant when keywords match", () => {
    const ctx = buildClassifyContext(makeConfig({ keywords: ["claude code"], subreddits: [] }));
    expect(classifyArticle(
      makeArticle({ title: "New Claude Code Features", source: "HackerNews" }),
      ctx,
    )).toBe("relevant");
  });

  it("classifies as discover when nothing matches", () => {
    const ctx = buildClassifyContext(makeConfig({ keywords: ["claude code"], subreddits: [] }));
    expect(classifyArticle(
      makeArticle({ title: "Bitcoin Price Surges", summary: "Crypto market up" }),
      ctx,
    )).toBe("discover");
  });

  it("followed takes priority over relevant", () => {
    // Article from followed subreddit that also matches keywords
    const ctx = buildClassifyContext(makeConfig({
      keywords: ["claude code"],
      subreddits: ["ClaudeAI"],
    }));
    expect(classifyArticle(
      makeArticle({ title: "Claude Code Update", source: "r/ClaudeAI", platform: "reddit" }),
      ctx,
    )).toBe("followed");
  });
});

// ─── classifyWithSourceFilter ─────────────────────────────────────

describe("classifyWithSourceFilter", () => {
  it("pushes non-enabled source articles to discover (soft filter)", () => {
    const config = makeConfig({
      keywords: ["claude code"],
      subreddits: [],
      enabled_sources: ["blog"], // only blog enabled
    });
    const ctx = buildClassifyContext(config);

    // HN article matching keywords → would be "relevant" but source not enabled → discover
    expect(classifyWithSourceFilter(
      makeArticle({ title: "Claude Code Update", platform: "hackernews" }),
      ctx,
    )).toBe("discover");

    // Blog article matching keywords → "relevant" and source enabled → stays relevant
    expect(classifyWithSourceFilter(
      makeArticle({ title: "Claude Code Update", platform: "blog" }),
      ctx,
    )).toBe("relevant");
  });

  it("does not filter when all 5 sources enabled", () => {
    const config = makeConfig({
      keywords: ["claude code"],
      enabled_sources: ["blog", "reddit", "hackernews", "rss", "arxiv"],
    });
    const ctx = buildClassifyContext(config);
    expect(classifyWithSourceFilter(
      makeArticle({ title: "Claude Code Update", platform: "hackernews" }),
      ctx,
    )).toBe("relevant");
  });

  it("does not filter when no enabled_sources set", () => {
    const config = makeConfig({ keywords: ["claude code"], enabled_sources: undefined });
    const ctx = buildClassifyContext(config);
    expect(classifyWithSourceFilter(
      makeArticle({ title: "Claude Code Update", platform: "hackernews" }),
      ctx,
    )).toBe("relevant");
  });

  it("discover articles stay discover regardless of source filter", () => {
    const config = makeConfig({
      keywords: ["claude code"],
      enabled_sources: ["blog"],
    });
    const ctx = buildClassifyContext(config);
    // Non-matching article → discover, source filter irrelevant
    expect(classifyWithSourceFilter(
      makeArticle({ title: "Bitcoin Price" }),
      ctx,
    )).toBe("discover");
  });
});

// ─── buildClassifyContext ─────────────────────────────────────────

describe("buildClassifyContext", () => {
  it("builds empty context for null config", () => {
    const ctx = buildClassifyContext(null);
    expect(ctx.followedSubs.size).toBe(0);
    expect(ctx.followedDomains).toEqual([]);
    expect(ctx.matcher.multi).toEqual([]);
    expect(ctx.matcher.patterns).toEqual([]);
  });

  it("extracts followed domains from rss_feeds and followed_accounts", () => {
    const ctx = buildClassifyContext({
      rss_feeds: ["https://blog.openai.com/rss/"],
      followed_accounts: [{ platform: "blog", handle: "https://anthropic.com/news", label: "Anthropic" }],
    });
    expect(ctx.followedDomains).toContain("blog.openai.com");
    expect(ctx.followedDomains).toContain("anthropic.com");
  });

  it("builds subreddit set with r/ prefix", () => {
    const ctx = buildClassifyContext({ subreddits: ["ClaudeAI", "netsec"] });
    expect(ctx.subredditSet.has("r/claudeai")).toBe(true);
    expect(ctx.subredditSet.has("r/netsec")).toBe(true);
  });
});
