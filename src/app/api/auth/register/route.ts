import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseBody, isApiError, usernameSchema, emailSchema, passwordSchema } from "@/lib/api-utils";
import crypto from "crypto";

const REGISTER_RATE_LIMIT = { name: "register", maxRequests: 3, windowSeconds: 3600 };

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
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

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, REGISTER_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Reessaie plus tard." },
        { status: 429 }
      );
    }

    const data = await parseBody(request, registerSchema);
    if (isApiError(data)) return data;

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Impossible de creer le compte. Verifie tes informations." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
      },
    });

    await setSessionCookie(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 }
    );
  }
}
