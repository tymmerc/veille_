import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
 try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: articleId } = await params;

  await prisma.articleRead.upsert({
    where: {
      userId_articleId: {
        userId: session.userId,
        articleId,
      },
    },
    create: {
      userId: session.userId,
      articleId,
    },
    update: {},
  });

  return NextResponse.json({ read: true });
 } catch (error) {
  console.error(`[API Error] POST /api/articles/[id]/read:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
