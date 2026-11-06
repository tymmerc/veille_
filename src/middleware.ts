import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "veille_session";

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return false;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  const token = cookie.value;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return false;

  const payload = token.substring(0, lastDot);
  const signature = token.substring(lastDot + 1);

  // Verify HMAC-SHA256 signature using Web Crypto API (Edge-compatible)
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedHex) return false;

    // Verify expiration — base64url decode
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(b64));
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

// The app listens on 127.0.0.1:3004 behind nginx: request.url carries that address, so a
// redirect built from it sent visitors to https://localhost:3004 (seen 06/11/2026).
// nginx passes the public host and scheme, use them.
function loginUrl(request: NextRequest): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "tymmerc.eu";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return new URL("/veille/login", `${proto}://${host}`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pages requiring auth
  if (
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/likes") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/analyse")
  ) {
    if (!(await isAuthenticated(request))) {
      return NextResponse.redirect(loginUrl(request));
    }
  }

  // Protected API routes
  if (
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/api/prompt") ||
    pathname.startsWith("/api/bookmarks") ||
    pathname.startsWith("/api/likes") ||
    pathname.startsWith("/api/sync") ||
    pathname.startsWith("/api/friends") ||
    pathname.startsWith("/api/presets") ||
    pathname.startsWith("/api/analyses") ||
    pathname.match(/^\/api\/articles\/[^/]+\/(like|bookmark|read)$/)
  ) {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
  }

  // Add security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export const config = {
  matcher: [
    "/bookmarks/:path*",
    "/likes/:path*",
    "/settings/:path*",
    "/api/settings/:path*",
    "/api/prompt/:path*",
    "/api/bookmarks/:path*",
    "/api/likes/:path*",
    "/api/sync/:path*",
    "/api/friends/:path*",
    "/api/presets/:path*",
    "/api/articles/:path*",
    "/api/users/:path*",
    "/u/:path*",
    "/analyse/:path*",
    "/api/analyses/:path*",
  ],
};
