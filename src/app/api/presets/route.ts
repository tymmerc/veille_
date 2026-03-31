import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, isApiError } from "@/lib/api-utils";

export async function GET() {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const presets = await prisma.preset.findMany({
    where: { userId: session.userId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ presets });
 } catch (error) {
  console.error(`[API Error] GET /api/presets:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}

const createPresetSchema = z.object({
  name: z.string().min(1, "Nom requis").max(50).transform((v) => v.trim()),
  categories: z.array(z.string()).optional().default(["all"]),
  keywords: z.array(z.string().max(100)).optional().default([]),
});

export async function POST(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const data = await parseBody(request, createPresetSchema);
  if (isApiError(data)) return data;
  const { name, categories, keywords } = data;

  const count = await prisma.preset.count({ where: { userId: session.userId } });
  if (count >= 20) return NextResponse.json({ error: "Maximum 20 presets" }, { status: 400 });

  const preset = await prisma.preset.create({
    data: {
      userId: session.userId,
      name,
      categories: categories || ["all"],
      keywords: keywords || [],
      order: count,
    },
  });

  return NextResponse.json({ preset });
 } catch (error) {
  console.error(`[API Error] POST /api/presets:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}

const updatePresetSchema = z.object({
  id: z.string().min(1, "ID requis"),
  name: z.string().min(1).max(50).transform((v) => v.trim()).optional(),
  categories: z.array(z.string()).optional(),
  keywords: z.array(z.string().max(100)).optional(),
  order: z.number().int().min(0).optional(),
});

export async function PUT(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const data = await parseBody(request, updatePresetSchema);
  if (isApiError(data)) return data;
  const { id, name, categories, keywords, order } = data;

  const preset = await prisma.preset.updateMany({
    where: { id, userId: session.userId },
    data: {
      ...(name !== undefined && { name }),
      ...(categories !== undefined && { categories }),
      ...(keywords !== undefined && { keywords }),
      ...(order !== undefined && { order }),
    },
  });

  if (preset.count === 0) {
    return NextResponse.json({ error: "Preset introuvable" }, { status: 404 });
  }

  return NextResponse.json({ updated: preset.count });
 } catch (error) {
  console.error(`[API Error] PUT /api/presets:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}

export async function DELETE(request: NextRequest) {
 try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.preset.deleteMany({ where: { id, userId: session.userId } });

  return NextResponse.json({ ok: true });
 } catch (error) {
  console.error(`[API Error] DELETE /api/presets:`, error);
  return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
 }
}
