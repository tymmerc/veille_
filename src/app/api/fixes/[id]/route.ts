import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/analyses";
import { isFixId, readFix } from "@/lib/fixes";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  if (!isFixId(params.id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const fix = await readFix(params.id);
  if (!fix) return NextResponse.json({ error: "Faille introuvable ou déjà corrigée" }, { status: 404 });
  return NextResponse.json(fix);
}
