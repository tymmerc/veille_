import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  // Generate CSRF state parameter
  const state = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    redirect_uri: process.env.DISCORD_REDIRECT_URI || "",
    response_type: "code",
    scope: "identify",
    state,
  });

  const response = NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params}`
  );

  // Store state in httpOnly cookie for validation in callback
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/veille",
  });

  return response;
}
