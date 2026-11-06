// Several interest phrases instead of one. Stored one per line in users.prompt,
// each interpreted once (cached in prompt_config.phrase_configs), then merged.
import type { PromptConfig } from "./ollama";

export const MAX_PHRASES = 8;
export const MAX_PHRASE_CHARS = 300;
export const MAX_NEW_PER_SAVE = 3; // each new phrase costs one local LLM call (~10-20 s)

export function splitPhrases(prompt: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of prompt.split("\n")) {
    const phrase = line.trim();
    const key = phrase.toLowerCase();
    if (!phrase || seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

export function validatePhrases(phrases: string[]): string | null {
  if (phrases.length === 0) return "Ajoute au moins une phrase.";
  if (phrases.length > MAX_PHRASES) return `${MAX_PHRASES} phrases au maximum.`;
  const long = phrases.find((p) => p.length > MAX_PHRASE_CHARS);
  if (long) return `Une phrase fait plus de ${MAX_PHRASE_CHARS} caractères.`;
  return null;
}

function union(lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

export function mergeConfigs(configs: PromptConfig[]): PromptConfig {
  const repos = new Map<string, NonNullable<PromptConfig["github_repos"]>[number]>();
  for (const c of configs) for (const r of c.github_repos ?? []) if (!repos.has(r.repo)) repos.set(r.repo, r);
  return {
    keywords: union(configs.map((c) => c.keywords)),
    hn_keywords: union(configs.map((c) => c.hn_keywords)),
    subreddits: union(configs.map((c) => c.subreddits)),
    rss_feeds: union(configs.map((c) => c.rss_feeds)),
    arxiv_categories: union(configs.map((c) => c.arxiv_categories)),
    twitter_accounts: union(configs.map((c) => c.twitter_accounts)),
    github_repos: Array.from(repos.values()),
    scoring_instructions: configs.map((c) => c.scoring_instructions?.trim()).filter(Boolean).join("\n"),
  };
}
