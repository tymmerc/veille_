import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";

const FRIEND_REQUEST_RATE_LIMIT = { name: "friend-request", maxRequests: 10, windowSeconds: 3600 };

const friendRequestSchema = z.object({
  username: z.string().min(1, "Username requis").max(50).transform((v) => v.trim()),
});

// POST /api/friends/request — send friend request by username
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const rl = checkRateLimit(session.userId, FRIEND_REQUEST_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Trop de demandes" }, { status: 429 });

  const data = await parseBody(request, friendRequestSchema);
  if (isApiError(data)) return data;
  const username = data.username;

  const target = await prisma.user.findFirst({
    where: { username: { equals: username.trim(), mode: "insensitive" } },
    select: { id: true, username: true },
  });

  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  if (target.id === session.userId) return NextResponse.json({ error: "Tu ne peux pas t'ajouter toi-meme" }, { status: 400 });

  // Check if friendship already exists (either direction)
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: session.userId, friendId: target.id },
        { userId: target.id, friendId: session.userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === "accepted") return NextResponse.json({ error: "Deja amis" }, { status: 409 });
    return NextResponse.json({ error: "Demande deja envoyee" }, { status: 409 });
  }

  await prisma.friendship.create({
    data: { userId: session.userId, friendId: target.id, status: "pending" },
  });

  return NextResponse.json({ ok: true, username: target.username });
}

const patchSchema = z.object({
  requestId: z.string().min(1, "requestId requis"),
  action: z.enum(["accept", "reject"], { message: "action doit etre 'accept' ou 'reject'" }),
});

// PATCH /api/friends/request — accept or reject a request
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const patchData = await parseBody(request, patchSchema);
  if (isApiError(patchData)) return patchData;
  const { requestId, action } = patchData;

  const friendship = await prisma.friendship.findUnique({ where: { id: requestId } });
  if (!friendship || friendship.friendId !== session.userId || friendship.status !== "pending") {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (action === "accept") {
    await prisma.friendship.update({ where: { id: requestId }, data: { status: "accepted" } });
  } else {
    await prisma.friendship.delete({ where: { id: requestId } });
  }

  return NextResponse.json({ ok: true });
}
