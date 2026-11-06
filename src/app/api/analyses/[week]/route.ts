import { NextResponse } from "next/server";
import { isAdminSession, isWeek, readWeek } from "@/lib/analyses";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { week: string } }) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  if (!isWeek(params.week)) return NextResponse.json({ error: "Semaine invalide" }, { status: 400 });
  const analysis = await readWeek(params.week);
  if (!analysis) return NextResponse.json({ error: "Analyse introuvable" }, { status: 404 });
  return NextResponse.json(analysis);
}
