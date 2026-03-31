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

  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId: session.userId, articleId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
  } else {
    await prisma.bookmark.create({
      data: { userId: session.userId, articleId },
    });
  }

  return NextResponse.json({ bookmarked: !existing });
 } catch (error) {
  console.error(`[API Error] POST /api/articles/[id]/bookmark:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
