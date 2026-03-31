import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

// GET /api/friends/shared — get articles shared with me
export async function GET() {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const shares = await prisma.sharedArticle.findMany({
    where: { OR: [{ toId: session.userId }, { fromId: session.userId }] },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      from: { select: { id: true, username: true, avatar: true, discordId: true } },
      to: { select: { id: true, username: true, avatar: true, discordId: true } },
      article: { select: { id: true, title: true, category: true, source: true, score: true } },
      _count: { select: { replies: true } },
    },
  });

  // Mark as seen
  await prisma.sharedArticle.updateMany({
    where: { toId: session.userId, seen: false },
    data: { seen: true },
  });

  return NextResponse.json({
    shares: shares.map((s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      article: s.article,
      message: s.message,
      createdAt: s.createdAt,
      seen: s.seen,
      replyCount: s._count.replies,
    })),
  });
 } catch (error) {
  console.error(`[API Error] GET /api/friends/shared:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}

const shareSchema = z.object({
  friendId: z.string().min(1, "friendId requis"),
  articleId: z.string().min(1, "articleId requis"),
  message: z.string().max(500).optional().transform((v) => v?.trim() || null),
});

// POST /api/friends/shared — share an article with a friend
export async function POST(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const data = await parseBody(request, shareSchema);
  if (isApiError(data)) return data;
  const { friendId, articleId, message } = data;

  // Verify friendship exists
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { userId: session.userId, friendId },
        { userId: friendId, friendId: session.userId },
      ],
    },
  });

  if (!friendship) return NextResponse.json({ error: "Pas amis" }, { status: 403 });

  await prisma.sharedArticle.create({
    data: {
      fromId: session.userId,
      toId: friendId,
      articleId,
      message: message || null,
    },
  });

  return NextResponse.json({ ok: true });
 } catch (error) {
  console.error(`[API Error] POST /api/friends/shared:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
