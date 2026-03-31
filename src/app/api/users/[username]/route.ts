import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await prisma.user.findFirst({
    where: { username, isPublic: true },
    select: {
      id: true,
      username: true,
      avatar: true,
      discordId: true,
      createdAt: true,
      _count: {
        select: { likes: true, bookmarks: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  // Get liked articles (public)
  const likedArticles = await prisma.like.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      article: {
        select: {
          id: true, title: true, summary: true, score: true,
          category: true, source: true, foundAt: true, url: true,
        },
      },
    },
  });

  // Get bookmarked articles (public)
  const bookmarkedArticles = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      article: {
        select: {
          id: true, title: true, summary: true, score: true,
          category: true, source: true, foundAt: true, url: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: {
      username: user.username,
      avatar: user.avatar,
      discordId: user.discordId,
      createdAt: user.createdAt,
      likeCount: user._count.likes,
      bookmarkCount: user._count.bookmarks,
    },
    likes: likedArticles.map(l => ({ ...l.article, likedAt: l.createdAt })),
    bookmarks: bookmarkedArticles.map(b => ({ ...b.article, savedAt: b.createdAt })),
  });
}
