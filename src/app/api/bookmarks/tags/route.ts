import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

const tagsSchema = z.object({
  articleId: z.string().min(1, "articleId requis"),
  tags: z.array(z.string().max(20)).max(5, "Maximum 5 tags"),
});

export async function PUT(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const data = await parseBody(request, tagsSchema);
  if (isApiError(data)) return data;
  const { articleId } = data;

  const validTags = data.tags
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüçæœ-]/g, ""))
    .filter((t) => t.length > 0);

  const bookmark = await prisma.bookmark.updateMany({
    where: { userId: session.userId, articleId },
    data: { tags: validTags },
  });

  if (bookmark.count === 0) {
    return NextResponse.json({ error: "Bookmark introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, tags: validTags });
 } catch (error) {
  console.error(`[API Error] PUT /api/bookmarks/tags:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
