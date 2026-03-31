import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scryptSync, randomBytes } from "crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Mot de passe trop court (min 6 caracteres)" }, { status: 400 });
    }

    const reset = await prisma.passwordReset.findUnique({ where: { token } });

    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return NextResponse.json({ error: "Lien expire ou invalide" }, { status: 400 });
    }

    const passwordHash = hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
