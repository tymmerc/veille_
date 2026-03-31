import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
 try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const bookmarks = await prisma.bookmark.findMany({
    where: {
      userId: session.userId,
      tags: { not: undefined },
    },
    select: { tags: true },
  });

  const tagSet = new Set<string>();
  for (const b of bookmarks) {
    if (Array.isArray(b.tags)) {
      for (const tag of b.tags) {
        if (typeof tag === "string") tagSet.add(tag);
      }
    }
  }

  const tags = Array.from(tagSet).sort();

  return NextResponse.json({ tags });
 } catch (error) {
  console.error(`[API Error] GET /api/bookmarks/tags/suggestions:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
