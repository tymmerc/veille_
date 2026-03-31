import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseBody, isApiError, emailSchema } from "@/lib/api-utils";
import crypto from "crypto";

const LOGIN_RATE_LIMIT = { name: "login", maxRequests: 20, windowSeconds: 900 };

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis"),
});

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
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, LOGIN_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Reessaie dans quelques minutes." },
        { status: 429 }
      );
    }

    const data = await parseBody(request, loginSchema);
    if (isApiError(data)) return data;

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    await setSessionCookie(user.id, user.discordId || undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email login error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 }
    );
  }
}
