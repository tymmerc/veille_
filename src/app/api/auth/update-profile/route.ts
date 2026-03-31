import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

const updateProfileSchema = z.object({
  username: z.string().min(2, "Le nom d'utilisateur doit faire au moins 2 caracteres").max(32, "Max 32 caracteres").transform((v) => v.trim()).optional(),
  isPublic: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const body = await parseBody(request, updateProfileSchema);
  if (isApiError(body)) return body;
  const { username, isPublic } = body;

  // Handle isPublic toggle (can be sent alone)
  if (typeof isPublic === "boolean" && username === undefined) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { isPublic },
    });
    return NextResponse.json({ ok: true, isPublic });
  }

  if (!username) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { discordId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Discord users cannot change their username (managed by Discord)
  if (user.discordId) {
    return NextResponse.json(
      { error: "Compte Discord — le nom est gere par Discord" },
      { status: 400 }
    );
  }

  const data: { username: string; isPublic?: boolean } = { username };
  if (typeof isPublic === "boolean") data.isPublic = isPublic;

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { username: true, isPublic: true },
  });

  return NextResponse.json({ ok: true, username: updated.username, isPublic: updated.isPublic });
}
