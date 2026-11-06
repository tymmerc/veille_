import { describe, it, expect } from "vitest";
import { splitPhrases, mergeConfigs, validatePhrases, MAX_PHRASES } from "./phrases";
import type { PromptConfig } from "./ollama";

const base = (over: Partial<PromptConfig>): PromptConfig => ({
  keywords: [], hn_keywords: [], subreddits: [], rss_feeds: [], arxiv_categories: [],
  scoring_instructions: "", ...over,
});

describe("splitPhrases", () => {
  it("one phrase per line, trimmed, no empty lines, no duplicates", () => {
    expect(splitPhrases("  Claude Code \n\nfailles Next.js\nclaude code")).toEqual([
      "Claude Code", "failles Next.js",
    ]);
  });
});

describe("validatePhrases", () => {
  it("accepts a normal list", () => {
    expect(validatePhrases(["Claude Code", "failles Next.js"])).toBeNull();
  });
  it("refuses an empty list, a too long phrase and too many phrases", () => {
    expect(validatePhrases([])).toMatch(/au moins une/);
    expect(validatePhrases(["x".repeat(301)])).toMatch(/300/);
    expect(validatePhrases(Array.from({ length: MAX_PHRASES + 1 }, (_, i) => `p${i}`))).toMatch(/8/);
  });
});

describe("mergeConfigs", () => {
  it("unions lists, keeps one repo per name and joins scoring rules", () => {
    const a = base({
      keywords: ["claude code"], subreddits: ["ClaudeAI"], scoring_instructions: "Claude Code: 8-10.",
      github_repos: [{ repo: "anthropics/claude-code", label: "Claude Code", category: "ia" }],
    });
    const b = base({
      keywords: ["next.js", "Claude Code"], rss_feeds: ["https://www.bleepingcomputer.com/feed/"],
      scoring_instructions: "Failles Next.js: 9-10.",
      github_repos: [{ repo: "anthropics/claude-code", label: "CC", category: "ia" }],
    });
    const merged = mergeConfigs([a, b]);
    expect(merged.keywords).toEqual(["claude code", "next.js"]);
    expect(merged.subreddits).toEqual(["ClaudeAI"]);
    expect(merged.rss_feeds).toEqual(["https://www.bleepingcomputer.com/feed/"]);
    expect(merged.github_repos).toHaveLength(1);
    expect(merged.scoring_instructions).toBe("Claude Code: 8-10.\nFailles Next.js: 9-10.");
  });

  it("removing a phrase removes its keywords", () => {
    const a = base({ keywords: ["claude code"] });
    expect(mergeConfigs([a]).keywords).toEqual(["claude code"]);
  });
});
