import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, passwordHash: true },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: true });
    }

    // Generate a secure token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600_000); // 1 hour

    // Delete any existing reset tokens for this user
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // In production, send email here. For now, log the reset link.
    const host = request.headers.get("host") || "localhost:3004";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const resetUrl = `${protocol}://${host}/veille/reset-password?token=${token}`;
    console.log(`[password-reset] Reset link for ${email}: ${resetUrl}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
