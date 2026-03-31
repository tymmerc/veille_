// Article classification logic — extracted for testability
// Used by articles/route.ts and tested by classify.test.ts

type FollowedAccount = {
  platform: "twitter" | "blog";
  handle: string;
  label: string;
};

export type PromptConfig = {
  keywords?: string[];
  hn_keywords?: string[];
  subreddits?: string[];
  rss_feeds?: string[];
  enabled_sources?: string[];
  followed_accounts?: FollowedAccount[];
};

export type FeedSection = "followed" | "relevant" | "discover";

export type KeywordMatcher = { multi: string[]; patterns: RegExp[] };

export type ArticleLike = {
  title: string;
  summary: string;
  source: string;
  platform: string;
  isOfficial: boolean;
  url: string;
};

const SOURCE_PLATFORM_MAP: Record<string, { platforms?: string[] }> = {
  reddit: { platforms: ["reddit"] },
  hackernews: { platforms: ["hackernews"] },
  rss: { platforms: ["rss"] },
  arxiv: { platforms: ["arxiv"] },
  blog: { platforms: ["blog"] },
};

export function buildKeywordMatcher(config: PromptConfig): KeywordMatcher {
  const keywords = [
    ...(config.keywords || []),
    ...(config.hn_keywords || []),
  ].map((k) => k.toLowerCase());

  const multi: string[] = [];
  const patterns: RegExp[] = [];
  for (const kw of keywords) {
    if (kw.includes(" ")) {
      multi.push(kw);
    } else {
      try {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        patterns.push(new RegExp(`\\b${escaped}\\b`, "i"));
      } catch {
        multi.push(kw);
      }
    }
  }
  return { multi, patterns };
}

export function matchesUserInterests(
  article: { title: string; summary: string; source: string },
  matcher: KeywordMatcher,
  subredditSet: Set<string>,
): boolean {
  if (matcher.multi.length === 0 && matcher.patterns.length === 0) return true;

  const text = `${article.title} ${article.summary || ""}`.toLowerCase();

  if (matcher.multi.some((kw) => text.includes(kw))) return true;
  if (matcher.patterns.some((re) => re.test(text))) return true;
  if (subredditSet.has(article.source.toLowerCase())) return true;

  return false;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export type ClassifyContext = {
  followedSubs: Set<string>;
  followedDomains: string[];
  matcher: KeywordMatcher;
  subredditSet: Set<string>;
  enabledSources: string[] | undefined;
  config: PromptConfig | null;
};

export function buildClassifyContext(config: PromptConfig | null): ClassifyContext {
  if (!config) {
    return { followedSubs: new Set(), followedDomains: [], matcher: { multi: [], patterns: [] }, subredditSet: new Set(), enabledSources: undefined, config: null };
  }

  const followedSubs = new Set((config.subreddits || []).map((s) => `r/${s}`.toLowerCase()));
  const followedDomains = (config.rss_feeds || []).map((u) => extractDomain(u)).filter(Boolean);
  for (const account of config.followed_accounts || []) {
    if (account.platform === "blog" && account.handle) {
      const domain = extractDomain(account.handle);
      if (domain) followedDomains.push(domain);
    }
  }

  const matcher = buildKeywordMatcher(config);
  const subredditSet = new Set((config.subreddits || []).map((s) => `r/${s}`.toLowerCase()));

  return { followedSubs, followedDomains, matcher, subredditSet, enabledSources: config.enabled_sources, config };
}

export function classifyArticle(article: ArticleLike, ctx: ClassifyContext): FeedSection {
  if (!ctx.config) return "discover";

  if (ctx.followedSubs.has(article.source.toLowerCase())) return "followed";

  const articleDomain = extractDomain(article.url);
  if (articleDomain && ctx.followedDomains.some((d) => articleDomain.includes(d) || d.includes(articleDomain))) {
    return "followed";
  }

  if (matchesUserInterests(article, ctx.matcher, ctx.subredditSet)) return "relevant";

  return "discover";
}

function matchesEnabledSources(
  article: { platform: string },
  enabledSources: string[],
): boolean {
  for (const source of enabledSources) {
    const mapping = SOURCE_PLATFORM_MAP[source];
    if (!mapping) continue;
    if (mapping.platforms?.includes(article.platform)) return true;
  }
  return false;
}

export function classifyWithSourceFilter(article: ArticleLike, ctx: ClassifyContext): FeedSection {
  const section = classifyArticle(article, ctx);
  if (section !== "discover" && ctx.enabledSources && ctx.enabledSources.length > 0 && ctx.enabledSources.length < 5) {
    if (!matchesEnabledSources(article, ctx.enabledSources)) {
      return "discover";
    }
  }
  return section;
}
