import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { parseBody, isApiError } from "@/lib/api-utils";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      webhookUrl: true, slackWebhookUrl: true, minScore: true, notifyEnabled: true, syncHours: true, syncDays: true,
      notifyDigest: true, notifyInstantMin: true,
    },
  });

  return NextResponse.json({
    webhookUrl: user?.webhookUrl || "",
    slackWebhookUrl: user?.slackWebhookUrl || "",
    minScore: user?.minScore ?? 6,
    notifyEnabled: user?.notifyEnabled ?? true,
    // null = no schedule: the scraper sends a summary after every hourly run with news
    syncHours: user?.syncHours ?? null,
    syncDays: user?.syncDays ?? null,
    notifyDigest: user?.notifyDigest ?? true,
    notifyInstantMin: user?.notifyInstantMin ?? null,
  });
}

const discordWebhookSchema = z.string().url("URL invalide").refine((url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "discord.com" && parsed.pathname.startsWith("/api/webhooks/");
  } catch { return false; }
}, "L'URL doit etre un webhook Discord valide (discord.com/api/webhooks/...)");

const slackWebhookSchema = z.string().url("URL invalide").refine((url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "hooks.slack.com" && parsed.pathname.startsWith("/services/");
  } catch { return false; }
}, "L'URL doit etre un webhook Slack valide (hooks.slack.com/services/...)");

const settingsSchema = z.object({
  webhookUrl: z.union([discordWebhookSchema, z.literal("")]).optional(),
  slackWebhookUrl: z.union([slackWebhookSchema, z.literal("")]).optional(),
  minScore: z.number().int().min(1).max(10).optional(),
  notifyEnabled: z.boolean().optional(),
  syncHours: z.array(z.number().int().min(0).max(23)).max(24).nullable().optional(),
  syncDays: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
  notifyDigest: z.boolean().optional(),
  // null = no instant alert; otherwise the minimum score (7 to 10) that triggers one
  notifyInstantMin: z.number().int().min(7).max(10).nullable().optional(),
  promptConfig: z.record(z.string(), z.unknown()).optional(),
}).strict();

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const data = await parseBody(request, settingsSchema);
  if (isApiError(data)) return data;

  const update: Record<string, unknown> = {};

  if (data.webhookUrl !== undefined) update.webhookUrl = data.webhookUrl || null;
  if (data.slackWebhookUrl !== undefined) update.slackWebhookUrl = data.slackWebhookUrl || null;
  if (data.minScore !== undefined) update.minScore = data.minScore;
  if (data.notifyEnabled !== undefined) update.notifyEnabled = data.notifyEnabled;
  if (data.syncHours !== undefined) update.syncHours = data.syncHours ?? Prisma.DbNull;
  if (data.syncDays !== undefined) update.syncDays = data.syncDays ?? Prisma.DbNull;
  if (data.notifyDigest !== undefined) update.notifyDigest = data.notifyDigest;
  if (data.notifyInstantMin !== undefined) update.notifyInstantMin = data.notifyInstantMin;
  if (data.promptConfig !== undefined) {
    // The client edits source toggles; the phrases and their cached analysis stay server-side
    const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { promptConfig: true } });
    const old = (current?.promptConfig as Record<string, unknown>) || {};
    update.promptConfig = { ...data.promptConfig, phrases: old.phrases, phrase_configs: old.phrase_configs };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: update,
  });

  return NextResponse.json({ ok: true });
}
