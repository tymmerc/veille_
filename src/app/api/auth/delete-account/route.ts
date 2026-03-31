import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  // The Prisma schema uses onDelete: Cascade on all relations,
  // so deleting the user will cascade-delete all related records.
  await prisma.user.delete({
    where: { id: session.userId },
  });

  await clearSession();

  return NextResponse.json({ ok: true });
}
