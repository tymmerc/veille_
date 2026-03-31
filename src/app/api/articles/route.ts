import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type FollowedAccount = {
  platform: "twitter" | "blog";
  handle: string;
  label: string;
};

type PromptConfig = {
  keywords?: string[];
  hn_keywords?: string[];
  subreddits?: string[];
  rss_feeds?: string[];
  enabled_sources?: string[];
  followed_accounts?: FollowedAccount[];
};

// Map source keys to platform/source values for filtering
const SOURCE_PLATFORM_MAP: Record<string, { platforms?: string[]; sources?: string[] }> = {
  reddit: { platforms: ["reddit"] },
  hackernews: { platforms: ["hackernews"] },
  rss: { platforms: ["rss"] },
  arxiv: { platforms: ["arxiv"] },
  blog: { platforms: ["blog"] },
  github: { platforms: ["github"] },
};

function matchesEnabledSources(
  article: { platform: string; isOfficial: boolean },
  enabledSources: string[] | undefined,
): boolean {
  if (!enabledSources || enabledSources.length === 0) return true;
  if (enabledSources.length >= 5) return true;

  for (const source of enabledSources) {
    const mapping = SOURCE_PLATFORM_MAP[source];
    if (!mapping) continue;
    if (mapping.platforms?.includes(article.platform)) return true;
  }
  return false;
}

// Pre-compiled keyword matcher for performance (avoids creating RegExp per article)
type KeywordMatcher = { multi: string[]; patterns: RegExp[] };

function buildKeywordMatcher(config: PromptConfig): KeywordMatcher {
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

function matchesUserInterests(
  article: { title: string; summary: string; source: string },
  config: PromptConfig,
  matcher: KeywordMatcher,
  subredditSet: Set<string>,
): boolean {
  // No keywords = nothing matches (don't show everything)
  if (matcher.multi.length === 0 && matcher.patterns.length === 0 && subredditSet.size === 0) return false;

  const text = `${article.title} ${article.summary || ""}`.toLowerCase();

  // Multi-word keywords: substring match
  if (matcher.multi.some((kw) => text.includes(kw))) return true;
  // Single-word: pre-compiled regex
  if (matcher.patterns.some((re) => re.test(text))) return true;
  // Subreddit source match
  if (subredditSet.has(article.source.toLowerCase())) return true;

  return false;
}

// Extract hostname from URL
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Classify article into a feed section
type FeedSection = "followed" | "relevant" | "discover";

// Pre-computed classification context (built once per request, reused for all articles)
type ClassifyContext = {
  followedSubs: Set<string>;
  followedDomains: string[];
  matcher: KeywordMatcher;
  subredditSet: Set<string>;
  enabledSources: string[] | undefined;
  config: PromptConfig | null;
};

function buildClassifyContext(config: PromptConfig | null): ClassifyContext {
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

function classifyArticle(
  article: { title: string; summary: string; source: string; platform: string; isOfficial: boolean; url: string },
  ctx: ClassifyContext,
): FeedSection {
  if (!ctx.config) return "discover";

  // "Followed" = source matches user's explicit subscriptions
  if (ctx.followedSubs.has(article.source.toLowerCase())) return "followed";

  const articleDomain = extractDomain(article.url);
  if (articleDomain && ctx.followedDomains.some((d) => articleDomain.includes(d) || d.includes(articleDomain))) {
    return "followed";
  }

  if (matchesUserInterests(article, ctx.config, ctx.matcher, ctx.subredditSet)) return "relevant";

  return "discover";
}

function classifyWithSourceFilter(
  article: { title: string; summary: string; source: string; platform: string; isOfficial: boolean; url: string },
  ctx: ClassifyContext,
): FeedSection {
  const section = classifyArticle(article, ctx);
  if (section !== "discover" && ctx.enabledSources && ctx.enabledSources.length > 0 && ctx.enabledSources.length < 5) {
    if (!matchesEnabledSources(article, ctx.enabledSources)) {
      return "discover";
    }
  }
  return section;
}

const ARTICLES_RATE_LIMIT = { name: "articles_read", maxRequests: 60, windowSeconds: 60 };

export async function GET(request: NextRequest) {
 try {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, ARTICLES_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de requetes" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  const session = await getSession();

  const where: Record<string, unknown> = {};
  if (category) where.category = category;

  let promptConfig: PromptConfig | null = null;
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { promptConfig: true, minScore: true },
    });
    if (user?.promptConfig && typeof user.promptConfig === "object") {
      promptConfig = user.promptConfig as PromptConfig;
    }
    if (user?.minScore) {
      where.score = { gte: user.minScore };
    }
  }

  const [allArticles, totalCount, categoryBreakdown] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { foundAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        url: true,
        summary: true,
        score: true,
        category: true,
        source: true,
        platform: true,
        foundAt: true,
        titleOriginal: true,
        isOfficial: true,
        _count: { select: { likes: true } },
      },
    }),
    prisma.article.count({ where }),
    prisma.article.groupBy({
      by: ["category"],
      where,
      _count: true,
    }),
  ]);

  const stats: { total: number; byCategory: Record<string, number>; bySection?: Record<string, number> } = {
    total: totalCount,
    byCategory: Object.fromEntries(
      categoryBreakdown.map((g) => [g.category, g._count]),
    ),
  };

  // Build classification context once, classify all articles once
  const ctx = buildClassifyContext(promptConfig);
  const sectionCache = new Map<string, FeedSection>();
  const sectionCounts: Record<FeedSection, number> = { followed: 0, relevant: 0, discover: 0 };
  for (const a of allArticles) {
    const section = classifyWithSourceFilter(a, ctx);
    sectionCache.set(a.id, section);
    sectionCounts[section]++;
  }
  stats.bySection = sectionCounts;

  // Sort: followed first, then relevant, then discover — within each group by score desc then date
  const sectionOrder: Record<FeedSection, number> = { followed: 0, relevant: 1, discover: 2 };
  allArticles.sort((a, b) => {
    const sa = sectionCache.get(a.id)!;
    const sb = sectionCache.get(b.id)!;
    if (sa !== sb) return sectionOrder[sa] - sectionOrder[sb];
    // Within same section: sort by score desc, then date desc
    if (a.score !== b.score) return b.score - a.score;
    return new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime();
  });

  const total = allArticles.length;
  const skip = (page - 1) * limit;
  const articles = allArticles.slice(skip, skip + limit);

  // Enrich with user-specific data
  const enrichArticle = (a: typeof allArticles[0], extra: { liked?: boolean; bookmarked?: boolean; read?: boolean }) => {
    const { _count, ...rest } = a;
    return {
      ...rest,
      ...extra,
      likeCount: _count.likes,
      section: sectionCache.get(a.id) || "discover",
    };
  };

  if (session) {
    const articleIds = articles.map((a) => a.id);
    const [userLikes, userBookmarks, userReads] = await Promise.all([
      prisma.like.findMany({
        where: { userId: session.userId, articleId: { in: articleIds } },
        select: { articleId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId: session.userId, articleId: { in: articleIds } },
        select: { articleId: true },
      }),
      prisma.articleRead.findMany({
        where: { userId: session.userId, articleId: { in: articleIds } },
        select: { articleId: true },
      }),
    ]);
    const likedSet = new Set(userLikes.map((l) => l.articleId));
    const bookmarkedSet = new Set(userBookmarks.map((b) => b.articleId));
    const readSet = new Set(userReads.map((r) => r.articleId));

    const enriched = articles.map((a) => enrichArticle(a, {
      liked: likedSet.has(a.id),
      bookmarked: bookmarkedSet.has(a.id),
      read: readSet.has(a.id),
    }));

    return NextResponse.json({ articles: enriched, total, page, pages: Math.ceil(total / limit), stats });
  }

  const withCounts = articles.map((a) => enrichArticle(a, {}));

  return NextResponse.json({ articles: withCounts, total, page, pages: Math.ceil(total / limit), stats });
 } catch (error) {
  console.error(`[API Error] GET /api/articles:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
