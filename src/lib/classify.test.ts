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
      { title: "New Claude Code Features", summary: "" },
      matcher,
    );
    expect(result).toBe(true);
  });

  it("matches multi-word keyword in summary", () => {
    const matcher = buildKeywordMatcher({ keywords: ["claude code"] });
    const result = matchesUserInterests(
      { title: "New Release", summary: "This claude code update is great" },
      matcher,
    );
    expect(result).toBe(true);
  });

  it("uses word boundary for single-word keywords", () => {
    const matcher = buildKeywordMatcher({ keywords: ["Rust"] });
    // "Rust" should match
    expect(matchesUserInterests(
      { title: "Rust 2026 Edition", summary: "" },
      matcher,
    )).toBe(true);
    // "Rustic" should NOT match (word boundary)
    expect(matchesUserInterests(
      { title: "Rustic Furniture Design", summary: "" },
      matcher,
    )).toBe(false);
  });

  it("does NOT match substring for single words (barcode vs code)", () => {
    const matcher = buildKeywordMatcher({ keywords: ["code"] });
    expect(matchesUserInterests(
      { title: "Barcode Scanner App", summary: "" },
      matcher,
    )).toBe(false);
    expect(matchesUserInterests(
      { title: "Code Review Tools", summary: "" },
      matcher,
    )).toBe(true);
  });

  it("matches a keyword at the start of the text", () => {
    const matcher = buildKeywordMatcher({ keywords: ["claude code"] });
    expect(matchesUserInterests(
      { title: "OpenAI IPO", summary: "", text: "Anthropic's Claude Code has gained share." },
      matcher,
    )).toBe(true);
  });

  it("ignores a keyword beyond the start of the text", () => {
    const matcher = buildKeywordMatcher({ keywords: ["claude code"] });
    expect(matchesUserInterests(
      { title: "Long post", summary: "", text: "x ".repeat(800) + "claude code" },
      matcher,
    )).toBe(false);
  });

  it("returns false when no keywords configured (nothing matches)", () => {
    const matcher = buildKeywordMatcher({});
    expect(matchesUserInterests(
      { title: "Anything", summary: "" },
      matcher,
    )).toBe(false);
  });

  it("case insensitive matching", () => {
    const matcher = buildKeywordMatcher({ keywords: ["CLAUDE CODE"] });
    expect(matchesUserInterests(
      { title: "claude code is great", summary: "" },
      matcher,
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

  // 06/11/2026 : un subreddit ou un flux RSS suivi laissait passer n'importe quel sujet
  it("followed subreddit: relevant with a keyword, discover without", () => {
    const ctx = buildClassifyContext(makeConfig({ keywords: ["claude code"], subreddits: ["ClaudeAI"] }));
    expect(classifyArticle(
      makeArticle({ title: "Claude Code hooks", source: "r/ClaudeAI", platform: "reddit" }),
      ctx,
    )).toBe("relevant");
    expect(classifyArticle(
      makeArticle({ title: "Random meme", summary: "", source: "r/ClaudeAI", platform: "reddit" }),
      ctx,
    )).toBe("discover");
  });

  it("followed RSS domain: relevant with a keyword, discover without", () => {
    const ctx = buildClassifyContext(makeConfig({
      keywords: ["claude code"],
      rss_feeds: ["https://techcrunch.com/category/artificial-intelligence/feed/"],
    }));
    const url = "https://techcrunch.com/2026/11/06/story/";
    expect(classifyArticle(
      makeArticle({ title: "Meta acquires Conductor", summary: "", platform: "rss", url }),
      ctx,
    )).toBe("discover");
    expect(classifyArticle(
      makeArticle({ title: "Anthropic ships Claude Code 3", platform: "rss", url }),
      ctx,
    )).toBe("relevant");
  });

  it("classifies as followed when a blog article comes from a followed account", () => {
    const ctx = buildClassifyContext(makeConfig({
      followed_accounts: [{ platform: "blog", handle: "https://www.anthropic.com/news", label: "Anthropic" }],
    }));
    expect(classifyArticle(
      makeArticle({ title: "Introducing a model", summary: "", source: "Anthropic", platform: "blog", url: "https://x.test/a" }),
      ctx,
    )).toBe("followed");
  });

  it("a link to a followed blog's site from another platform is not followed", () => {
    const ctx = buildClassifyContext(makeConfig({
      keywords: ["claude code"],
      followed_accounts: [{ platform: "blog", handle: "https://www.anthropic.com/news", label: "Anthropic" }],
    }));
    expect(classifyArticle(
      makeArticle({ title: "Some research", summary: "", url: "https://www.anthropic.com/research/x", platform: "hackernews" }),
      ctx,
    )).toBe("discover");
  });

  it("classifies as followed when a release comes from a followed GitHub repo", () => {
    const ctx = buildClassifyContext(makeConfig({
      keywords: ["hooks"],
      github_repos: [{ repo: "anthropics/claude-code", label: "Claude Code", category: "ia" }],
    }));
    expect(classifyArticle(
      makeArticle({ title: "Claude Code v3.1", summary: "", source: "GitHub/Claude Code", platform: "github" }),
      ctx,
    )).toBe("followed");
    expect(classifyArticle(
      makeArticle({ title: "Next.js 16.1", summary: "", source: "GitHub/Next.js", platform: "github" }),
      ctx,
    )).toBe("discover");
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
    // Release of a followed repo that also matches keywords
    const ctx = buildClassifyContext(makeConfig({
      keywords: ["claude code"],
      github_repos: [{ repo: "anthropics/claude-code", label: "Claude Code" }],
    }));
    expect(classifyArticle(
      makeArticle({ title: "Claude Code Update", source: "GitHub/Claude Code", platform: "github" }),
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

  it("never pushes a followed GitHub repo down (no GitHub switch in the settings)", () => {
    const ctx = buildClassifyContext(makeConfig({
      enabled_sources: ["blog", "rss"],
      github_repos: [{ repo: "anthropics/claude-code", label: "Claude Code" }],
    }));
    expect(classifyWithSourceFilter(
      makeArticle({ title: "Claude Code v3.1", source: "GitHub/Claude Code", platform: "github" }),
      ctx,
    )).toBe("followed");
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
    expect(ctx.followedBlogs.size).toBe(0);
    expect(ctx.followedBlogDomains).toEqual([]);
    expect(ctx.followedRepos.size).toBe(0);
    expect(ctx.matcher.multi).toEqual([]);
    expect(ctx.matcher.patterns).toEqual([]);
  });

  it("follows blogs and GitHub repos, never RSS feeds or subreddits", () => {
    const ctx = buildClassifyContext({
      rss_feeds: ["https://blog.openai.com/rss/"],
      subreddits: ["ClaudeAI"],
      followed_accounts: [
        { platform: "blog", handle: "https://anthropic.com/news", label: "Anthropic" },
        { platform: "blog", handle: "www.deepmind.google/blog", label: "" },
        { platform: "twitter", handle: "AnthropicAI", label: "Anthropic" },
      ],
      github_repos: [{ repo: "anthropics/claude-code" }, { repo: "not-a-repo" }],
    });
    expect([...ctx.followedBlogs]).toEqual(["Anthropic", "https://www.deepmind.google/blog"]);
    expect(ctx.followedBlogDomains).toEqual(["anthropic.com", "deepmind.google"]);
    expect([...ctx.followedRepos]).toEqual(["GitHub/claude-code"]);
  });
});
