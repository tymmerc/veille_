import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

// Hardcoded allowed host — prevents open redirect via X-Forwarded headers
const ALLOWED_HOST = process.env.PUBLIC_HOST || "tymmerc.eu";
const BASE_URL = `https://${ALLOWED_HOST}`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/veille/login", BASE_URL));
  }

  // Validate CSRF state parameter
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/veille/login?error=csrf", BASE_URL));
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || "",
      client_secret: process.env.DISCORD_CLIENT_SECRET || "",
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI || "",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/veille/login?error=token", BASE_URL));
  }

  const tokenData = await tokenRes.json();

  // Fetch Discord user profile
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(new URL("/veille/login?error=profile", BASE_URL));
  }

  const discord = await userRes.json();

  // Upsert user
  const existing = await prisma.user.findUnique({
    where: { discordId: discord.id },
  });

  let userId: string;

  if (existing) {
    await prisma.user.update({
      where: { discordId: discord.id },
      data: { username: discord.username, avatar: discord.avatar },
    });
    userId = existing.id;
  } else {
    const user = await prisma.user.create({
      data: {
        discordId: discord.id,
        username: discord.username,
        avatar: discord.avatar,
      },
    });
    userId = user.id;
  }

  await setSessionCookie(userId, discord.id);

  // Clear the oauth_state cookie
  const response = NextResponse.redirect(new URL("/veille/feed", BASE_URL));
  response.cookies.delete({ name: "oauth_state", path: "/veille" });
  return response;
}
