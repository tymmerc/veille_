import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
 try {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    select: { id: true, category: true, score: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find 4 articles from the same category, excluding the current one,
  // ordered by score proximity then foundAt desc
  const related = await prisma.article.findMany({
    where: {
      category: article.category,
      id: { not: article.id },
    },
    orderBy: [{ foundAt: "desc" }],
    take: 20,
    select: {
      id: true,
      title: true,
      url: true,
      score: true,
      category: true,
      source: true,
      foundAt: true,
    },
  });

  // Sort by score proximity to the current article, then by foundAt desc
  const sorted = related
    .sort((a, b) => {
      const diffA = Math.abs(a.score - article.score);
      const diffB = Math.abs(b.score - article.score);
      if (diffA !== diffB) return diffA - diffB;
      return new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime();
    })
    .slice(0, 4);

  return NextResponse.json({ articles: sorted });
 } catch (error) {
  console.error(`[API Error] GET /api/articles/[id]/related:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
