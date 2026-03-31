import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

const testWebhookSchema = z.object({
  type: z.enum(["discord", "slack"], { message: "Type invalide (discord ou slack)" }),
});

export async function POST(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const data = await parseBody(request, testWebhookSchema);
  if (isApiError(data)) return data;
  const { type } = data;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { webhookUrl: true, slackWebhookUrl: true },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (type === "discord") {
    const url = user.webhookUrl;
    if (!url) {
      return NextResponse.json({ success: false, error: "Aucun webhook Discord configure" }, { status: 400 });
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "\ud83e\uddea Test veille_",
          description: "Webhook connecte !",
          color: 0x00FF9D,
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status !== 204 && !res.ok) {
      return NextResponse.json({ success: false, error: `Discord a repondu ${res.status}` });
    }
    return NextResponse.json({ success: true });
  }

  if (type === "slack") {
    const url = user.slackWebhookUrl;
    if (!url) {
      return NextResponse.json({ success: false, error: "Aucun webhook Slack configure" }, { status: 400 });
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "\ud83e\uddea *Test veille_* \u2014 Webhook connecte !",
          },
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (res.status !== 200 || text !== "ok") {
      return NextResponse.json({ success: false, error: `Slack a repondu ${res.status}` });
    }
    return NextResponse.json({ success: true });
  }
 } catch (error) {
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  console.error("[API Error] POST /api/settings/test-webhook:", error);
  return NextResponse.json({ success: false, error: message }, { status: 500 });
 }
}
