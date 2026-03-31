import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ count: 0 });

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  if (!since) return NextResponse.json({ count: 0 });

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { minScore: true },
  });

  const count = await prisma.article.count({
    where: {
      foundAt: { gt: sinceDate },
      score: { gte: user?.minScore ?? 6 },
    },
  });

  return NextResponse.json({ count });
 } catch (error) {
  console.error(`[API Error] GET /api/articles/new-count:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
