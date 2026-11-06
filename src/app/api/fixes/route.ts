import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/analyses";
import { listFixes } from "@/lib/fixes";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  // The list stays light: no prompt, no flaw details
  const fixes = (await listFixes()).map((f) => ({
    id: f.id, titre: f.titre, paquet: f.paquet, version: f.version, ecosysteme: f.ecosysteme, projets: f.projets,
    gravite: f.gravite, nb_failles: f.nb_failles, nb_critiques: f.nb_critiques, cible: f.cible,
    montee_majeure: f.montee_majeure, cree_le: f.cree_le,
  }));
  return NextResponse.json({ fixes });
}
