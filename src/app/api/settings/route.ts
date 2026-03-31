import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { webhookUrl: true, slackWebhookUrl: true, minScore: true, notifyEnabled: true, syncHours: true, syncDays: true },
  });

  return NextResponse.json({
    webhookUrl: user?.webhookUrl || "",
    slackWebhookUrl: user?.slackWebhookUrl || "",
    minScore: user?.minScore ?? 6,
    notifyEnabled: user?.notifyEnabled ?? true,
    syncHours: user?.syncHours ?? [8, 19],
    syncDays: user?.syncDays ?? [0, 1, 2, 3, 4, 5, 6],
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
  syncHours: z.array(z.number().int().min(0).max(23)).optional(),
  syncDays: z.array(z.number().int().min(0).max(6)).optional(),
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
  if (data.syncHours !== undefined) update.syncHours = data.syncHours;
  if (data.syncDays !== undefined) update.syncDays = data.syncDays;
  if (data.promptConfig !== undefined) update.promptConfig = data.promptConfig;

  await prisma.user.update({
    where: { id: session.userId },
    data: update,
  });

  return NextResponse.json({ ok: true });
}
