import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  // Get friend IDs
  const [sent, received] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId: session.userId, status: "accepted" },
      select: { friendId: true },
    }),
    prisma.friendship.findMany({
      where: { friendId: session.userId, status: "accepted" },
      select: { userId: true },
    }),
  ]);

  const friendIds = [...sent.map(f => f.friendId), ...received.map(f => f.userId)];
  if (friendIds.length === 0) return NextResponse.json({ activity: [] });

  // Get recent likes AND bookmarks from friends (last 48h)
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const articleSelect = {
    id: true, title: true, summary: true, score: true,
    category: true, source: true, platform: true, foundAt: true,
    isOfficial: true, titleOriginal: true, url: true,
    _count: { select: { likes: true } },
  } as const;
  const userSelect = { id: true, username: true, avatar: true, discordId: true } as const;

  const [friendLikes, friendBookmarks] = await Promise.all([
    prisma.like.findMany({
      where: { userId: { in: friendIds }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: userSelect }, article: { select: articleSelect } },
    }),
    prisma.bookmark.findMany({
      where: { userId: { in: friendIds }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: userSelect }, article: { select: articleSelect } },
    }),
  ]);

  // Merge, deduplicate by article id (keep earliest activity), sort by date
  const seen = new Set<string>();
  const activity = [
    ...friendLikes.map(l => ({ type: "like" as const, user: l.user, article: l.article, at: l.createdAt })),
    ...friendBookmarks.map(b => ({ type: "save" as const, user: b.user, article: b.article, at: b.createdAt })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter(item => {
      const key = `${item.article.id}-${item.user.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40)
    .map(item => {
      const { _count, ...articleRest } = item.article;
      return {
        type: item.type,
        user: item.user,
        article: { ...articleRest, likeCount: _count.likes },
        at: item.at,
      };
    });

  return NextResponse.json({ activity });
 } catch (error) {
  console.error(`[API Error] GET /api/friends/activity:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
