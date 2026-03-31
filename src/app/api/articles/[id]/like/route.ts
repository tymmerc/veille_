import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const articleId = params.id;

  const existing = await prisma.like.findUnique({
    where: { userId_articleId: { userId: session.userId, articleId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({
      data: { userId: session.userId, articleId },
    });
  }

  const likeCount = await prisma.like.count({ where: { articleId } });

  return NextResponse.json({ liked: !existing, likeCount });
 } catch (error) {
  console.error(`[API Error] POST /api/articles/[id]/like:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
