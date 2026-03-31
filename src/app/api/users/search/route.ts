import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/search?q=xxx — search users by username
export async function GET(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q, mode: "insensitive" },
      id: { not: session.userId },
    },
    select: { id: true, username: true, avatar: true, discordId: true },
    take: 10,
  });

  return NextResponse.json({ users });
 } catch (error) {
  console.error(`[API Error] GET /api/users/search:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
