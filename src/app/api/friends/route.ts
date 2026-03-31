import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/friends — list accepted friends + pending requests received
export async function GET() {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const [sentAccepted, recvAccepted, pendingReceived, pendingCount] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId: session.userId, status: "accepted" },
      include: { friend: { select: { id: true, username: true, avatar: true, discordId: true } } },
    }),
    prisma.friendship.findMany({
      where: { friendId: session.userId, status: "accepted" },
      include: { user: { select: { id: true, username: true, avatar: true, discordId: true } } },
    }),
    prisma.friendship.findMany({
      where: { friendId: session.userId, status: "pending" },
      include: { user: { select: { id: true, username: true, avatar: true, discordId: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sharedArticle.count({
      where: { toId: session.userId, seen: false },
    }),
  ]);

  const friends = [
    ...sentAccepted.map((f) => f.friend),
    ...recvAccepted.map((f) => f.user),
  ];

  const pending = pendingReceived.map((f) => ({
    requestId: f.id,
    ...f.user,
  }));

  return NextResponse.json({ friends, pending, unreadShares: pendingCount });
 } catch (error) {
  console.error(`[API Error] GET /api/friends:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}

// DELETE /api/friends?friendId=xxx — remove a friend
export async function DELETE(request: Request) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const friendId = searchParams.get("friendId");
  if (!friendId) return NextResponse.json({ error: "friendId requis" }, { status: 400 });

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId: session.userId, friendId },
        { userId: friendId, friendId: session.userId },
      ],
    },
  });

  return NextResponse.json({ ok: true });
 } catch (error) {
  console.error(`[API Error] DELETE /api/friends:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
