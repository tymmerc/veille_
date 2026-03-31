import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError, passwordSchema } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

const CHANGE_PW_RATE_LIMIT = { name: "change-password", maxRequests: 5, windowSeconds: 900 };

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: passwordSchema,
});

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey));
    });
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const rl = checkRateLimit(session.userId, CHANGE_PW_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  const data = await parseBody(request, changePasswordSchema);
  if (isApiError(data)) return data;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true, discordId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (user.discordId && !user.passwordHash) {
    return NextResponse.json(
      { error: "Compte Discord — changement de mot de passe non disponible" },
      { status: 400 }
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "Aucun mot de passe configure" }, { status: 400 });
  }

  const valid = await verifyPassword(data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
  }

  const newHash = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}
