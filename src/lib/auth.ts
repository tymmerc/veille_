import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "veille_session";

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
}

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(payload);
  return `${payload}.${hmac.digest("hex")}`;
}

function verify(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.substring(0, lastDot);
  const expected = sign(payload);
  if (token.length !== expected.length) return null;
  const isValid = crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected)
  );
  return isValid ? payload : null;
}

export async function setSessionCookie(
  userId: string,
  discordId?: string
): Promise<void> {
  const cookieStore = await cookies();
  const data = JSON.stringify({
    userId,
    discordId: discordId || null,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  const encoded = Buffer.from(data).toString("base64url");
  cookieStore.set(COOKIE_NAME, sign(encoded), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/veille",
  });
}

export async function getSession(): Promise<{
  userId: string;
  discordId: string | null;
} | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const encoded = verify(cookie.value);
  if (!encoded) return null;
  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return { userId: data.userId, discordId: data.discordId };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: COOKIE_NAME, path: "/veille" });
}

/**
 * Verify a session token without using cookies() (for middleware).
 */
export function verifyToken(token: string): boolean {
  const encoded = verify(token);
  if (!encoded) return false;
  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    return data.exp > Date.now();
  } catch {
    return false;
  }
}
