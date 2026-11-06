import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  buildClassifyContext,
  classifyWithSourceFilter,
  type FeedSection,
  type PromptConfig,
} from "@/lib/classify";

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
        text: true, // keyword match on the start of the text, never sent to the browser
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
    const { _count, text: _text, ...rest } = a;
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
