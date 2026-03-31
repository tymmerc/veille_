import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = { ok: false, ms: Date.now() - dbStart, error: String(err) };
  }

  // Ollama check
  const ollamaStart = Date.now();
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
    checks.ollama = { ok: res.ok, ms: Date.now() - ollamaStart };
  } catch {
    checks.ollama = { ok: false, ms: Date.now() - ollamaStart, error: "unreachable" };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      uptime: Math.floor(process.uptime()),
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
