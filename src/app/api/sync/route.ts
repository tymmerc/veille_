import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { spawn } from "child_process";
import { checkRateLimit } from "@/lib/rate-limit";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";

const LOCK_FILE = "/tmp/veille-sync.lock";
const COOLDOWN_MS = 60_000;
const SYNC_RATE_LIMIT = { name: "sync", maxRequests: 3, windowSeconds: 3600 };

function isRunning(): boolean {
  if (!existsSync(LOCK_FILE)) return false;
  try {
    const data = JSON.parse(readFileSync(LOCK_FILE, "utf-8"));
    const pid = data.pid as number;
    // Check if process is still alive
    try { process.kill(pid, 0); return true; } catch { /* process dead, stale lock */ }
    unlinkSync(LOCK_FILE);
    return false;
  } catch {
    // Corrupted lock file
    try { unlinkSync(LOCK_FILE); } catch {}
    return false;
  }
}

function acquireLock(pid: number): boolean {
  if (isRunning()) return false;
  try {
    writeFileSync(LOCK_FILE, JSON.stringify({ pid, startedAt: Date.now() }), { flag: "wx" });
    return true;
  } catch {
    return false; // Another process created the file first
  }
}

function releaseLock(): void {
  try { unlinkSync(LOCK_FILE); } catch {}
}

function getLastRun(): number {
  try {
    if (!existsSync(LOCK_FILE + ".last")) return 0;
    return parseInt(readFileSync(LOCK_FILE + ".last", "utf-8"), 10) || 0;
  } catch { return 0; }
}

function setLastRun(): void {
  try { writeFileSync(LOCK_FILE + ".last", String(Date.now())); } catch {}
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const rl = checkRateLimit(session.userId, SYNC_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { status: "rate_limited", error: "Trop de syncs. Reessaie plus tard." },
      { status: 429 }
    );
  }

  if (isRunning()) {
    return NextResponse.json({ status: "already_running" });
  }

  const now = Date.now();
  const lastRun = getLastRun();
  if (now - lastRun < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastRun)) / 1000);
    return NextResponse.json({ status: "cooldown", waitSeconds: wait });
  }

  const child = spawn(
    "/opt/tech-veille/venv/bin/python3",
    ["/opt/tech-veille/main.py"],
    {
      timeout: 300_000,
      stdio: "ignore",
      detached: false,
      env: {
        PATH: process.env.PATH || "/usr/bin:/bin",
        HOME: process.env.HOME || "/root",
        LANG: "en_US.UTF-8",
      } as unknown as NodeJS.ProcessEnv,
    },
  );

  if (!acquireLock(child.pid!)) {
    return NextResponse.json({ status: "already_running" });
  }

  child.on("close", (code) => {
    releaseLock();
    setLastRun();
    if (code !== 0) console.error(`[sync] exited with code ${code}`);
    else console.log("[sync] completed");
  });

  child.on("error", (err) => {
    releaseLock();
    console.error("[sync] error:", err);
  });

  return NextResponse.json({ status: "started" });
}

export async function GET() {
  return NextResponse.json({ running: isRunning(), lastRun: getLastRun() || null });
}
