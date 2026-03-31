import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
 try {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { likes: true } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getSession();
  let liked = false;
  let bookmarked = false;

  if (session) {
    const [userLike, userBookmark] = await Promise.all([
      prisma.like.findUnique({
        where: { userId_articleId: { userId: session.userId, articleId: params.id } },
      }),
      prisma.bookmark.findUnique({
        where: { userId_articleId: { userId: session.userId, articleId: params.id } },
      }),
    ]);
    liked = !!userLike;
    bookmarked = !!userBookmark;

    // Mark article as read (awaited for reliability)
    await prisma.articleRead.upsert({
      where: {
        userId_articleId: { userId: session.userId, articleId: params.id },
      },
      create: { userId: session.userId, articleId: params.id },
      update: {},
    }).catch(() => {});
  }

  return NextResponse.json({
    article: {
      id: article.id,
      platform: article.platform,
      title: article.title,
      titleOriginal: article.titleOriginal,
      url: article.url,
      summary: article.summary,
      score: article.score,
      category: article.category,
      source: article.source,
      foundAt: article.foundAt,
      liked,
      bookmarked,
      likeCount: article._count.likes,
    },
  });
 } catch (error) {
  console.error(`[API Error] GET /api/articles/[id]:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
