// Article classification for the feed, extracted for testability.
// Used by api/articles/route.ts and tested by classify.test.ts.
// Same rule as filter_for_user in /opt/tech-veille/storage.py (06/11/2026): a followed
// subreddit or RSS feed is not enough on its own, the article must hold a keyword.

type FollowedAccount = {
  platform: "twitter" | "blog";
  handle: string;
  label: string;
};

type GithubRepo = {
  repo: string;
  label?: string;
  category?: string;
};

export type PromptConfig = {
  keywords?: string[];
  hn_keywords?: string[];
  subreddits?: string[];
  rss_feeds?: string[];
  enabled_sources?: string[];
  followed_accounts?: FollowedAccount[];
  github_repos?: GithubRepo[];
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
  text?: string | null;
};

// Keywords are looked for in the title, the summary and the start of the text
export const KEYWORD_TEXT_CHARS = 1500;

// Settings keys (enabled_sources) mapped to article platforms
const SOURCE_PLATFORM_MAP: Record<string, { platforms?: string[] }> = {
  reddit: { platforms: ["reddit"] },
  hackernews: { platforms: ["hackernews"] },
  rss: { platforms: ["rss"] },
  arxiv: { platforms: ["arxiv"] },
  blog: { platforms: ["blog"] },
  github: { platforms: ["github"] },
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
        multi.push(kw); // fallback to substring
      }
    }
  }
  return { multi, patterns };
}

export function matchesUserInterests(
  article: { title: string; summary: string; text?: string | null },
  matcher: KeywordMatcher,
): boolean {
  // No keywords = nothing matches (don't show everything)
  if (matcher.multi.length === 0 && matcher.patterns.length === 0) return false;

  const head = (article.text || "").slice(0, KEYWORD_TEXT_CHARS);
  const text = `${article.title} ${article.summary || ""} ${head}`.toLowerCase();

  if (matcher.multi.some((kw) => text.includes(kw))) return true;
  return matcher.patterns.some((re) => re.test(text));
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// A followed blog, named as the scraper names its articles (source = label, or the url)
export function followedBlog(account: FollowedAccount): { name: string; url: string } | null {
  const handle = (account.handle || "").trim().replace(/^@+/, "");
  if (account.platform !== "blog" || !handle) return null;
  const url = handle.startsWith("http") ? handle : `https://${handle}`;
  return { name: (account.label ?? handle) || url, url };
}

// Source of a followed repo's releases, as the scraper sets it ("GitHub/<label>")
export function githubSourceName(repo: GithubRepo): string | null {
  if (!repo.repo || !repo.repo.includes("/")) return null;
  return `GitHub/${repo.label ?? repo.repo.split("/").pop()}`;
}

export type ClassifyContext = {
  followedBlogs: Set<string>;
  followedBlogDomains: string[];
  followedRepos: Set<string>;
  matcher: KeywordMatcher;
  enabledSources: string[] | undefined;
  config: PromptConfig | null;
};

export function buildClassifyContext(config: PromptConfig | null): ClassifyContext {
  const empty = { multi: [], patterns: [] };
  if (!config) {
    return { followedBlogs: new Set(), followedBlogDomains: [], followedRepos: new Set(), matcher: empty, enabledSources: undefined, config: null };
  }

  const followedBlogs = new Set<string>();
  const followedBlogDomains: string[] = [];
  for (const account of config.followed_accounts || []) {
    const blog = followedBlog(account);
    if (!blog) continue;
    followedBlogs.add(blog.name);
    const domain = extractDomain(blog.url);
    if (domain) followedBlogDomains.push(domain);
  }

  const followedRepos = new Set<string>();
  for (const repo of config.github_repos || []) {
    const source = githubSourceName(repo);
    if (source) followedRepos.add(source);
  }

  return {
    followedBlogs,
    followedBlogDomains,
    followedRepos,
    matcher: buildKeywordMatcher(config),
    enabledSources: config.enabled_sources,
    config,
  };
}

// "Followed" = the user's explicit subscriptions: blogs they follow and GitHub repos they track
function isFollowed(article: ArticleLike, ctx: ClassifyContext): boolean {
  if (article.platform === "github") return ctx.followedRepos.has(article.source);
  if (article.platform !== "blog") return false;
  if (ctx.followedBlogs.has(article.source)) return true;
  const domain = extractDomain(article.url);
  return !!domain && ctx.followedBlogDomains.some((d) => domain.includes(d) || d.includes(domain));
}

export function classifyArticle(article: ArticleLike, ctx: ClassifyContext): FeedSection {
  if (!ctx.config) return "discover";
  if (isFollowed(article, ctx)) return "followed";
  if (matchesUserInterests(article, ctx.matcher)) return "relevant";
  return "discover";
}

function matchesEnabledSources(article: { platform: string }, enabledSources: string[]): boolean {
  for (const source of enabledSources) {
    const mapping = SOURCE_PLATFORM_MAP[source];
    if (mapping?.platforms?.includes(article.platform)) return true;
  }
  return false;
}

// Soft source filter: a keyword match from a source the user turned off goes to "discover".
// Explicit subscriptions ("followed") are never pushed down: the settings page has no
// GitHub switch, so a followed repo would otherwise never show as followed.
export function classifyWithSourceFilter(article: ArticleLike, ctx: ClassifyContext): FeedSection {
  const section = classifyArticle(article, ctx);
  const sources = ctx.enabledSources;
  if (section === "relevant" && sources && sources.length > 0 && sources.length < 5) {
    if (!matchesEnabledSources(article, sources)) return "discover";
  }
  return section;
}
