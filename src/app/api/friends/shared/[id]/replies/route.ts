import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

const replySchema = z.object({
  message: z.string().min(1, "Message requis").max(500, "Message trop long (500 caracteres max)").transform((v) => v.trim()),
});

// GET /api/friends/shared/[id]/replies — list replies for a shared article
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;

    // Verify the share exists and user is sender or receiver
    const share = await prisma.sharedArticle.findUnique({
      where: { id },
      select: { fromId: true, toId: true },
    });

    if (!share)
      return NextResponse.json({ error: "Partage introuvable" }, { status: 404 });

    if (share.fromId !== session.userId && share.toId !== session.userId)
      return NextResponse.json({ error: "Acces interdit" }, { status: 403 });

    const replies = await prisma.shareReply.findMany({
      where: { sharedArticleId: id },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, avatar: true, discordId: true } },
      },
    });

    return NextResponse.json({
      replies: replies.map((r) => ({
        id: r.id,
        userId: r.user.id,
        username: r.user.username,
        message: r.message,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error(`[API Error] GET /api/friends/shared/[id]/replies:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

// POST /api/friends/shared/[id]/replies — add a reply to a shared article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;

    // Verify the share exists and user is sender or receiver
    const share = await prisma.sharedArticle.findUnique({
      where: { id },
      select: { fromId: true, toId: true },
    });

    if (!share)
      return NextResponse.json({ error: "Partage introuvable" }, { status: 404 });

    if (share.fromId !== session.userId && share.toId !== session.userId)
      return NextResponse.json({ error: "Acces interdit" }, { status: 403 });

    const data = await parseBody(request, replySchema);
    if (isApiError(data)) return data;
    const { message } = data;

    const reply = await prisma.shareReply.create({
      data: {
        sharedArticleId: id,
        userId: session.userId,
        message,
      },
    });

    return NextResponse.json({
      reply: {
        id: reply.id,
        userId: reply.userId,
        message: reply.message,
        createdAt: reply.createdAt,
      },
    });
  } catch (error) {
    console.error(`[API Error] POST /api/friends/shared/[id]/replies:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
