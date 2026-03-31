import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const [likes, total] = await Promise.all([
    prisma.like.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        article: {
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
          },
        },
      },
    }),
    prisma.like.count({ where: { userId: session.userId } }),
  ]);

  return NextResponse.json({
    articles: likes.map((l) => ({ ...l.article, likedAt: l.createdAt })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
 } catch (error) {
  console.error(`[API Error] GET /api/likes:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
