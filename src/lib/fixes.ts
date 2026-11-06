// Fix briefs written by the scraper (tech-veille/fix_briefs.py): one prepared Claude Code
// prompt per vulnerable package of the server. Admin only.
import { promises as fs } from "fs";
import path from "path";

export const FIXES_DIR = process.env.FIXES_DIR || "/opt/tech-veille/data/fixes";
const FIX_ID = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const RANK: Record<string, number> = { critique: 0, haute: 1, moyenne: 2, basse: 3 };

export type FixBrief = {
  id: string;
  titre: string;
  paquet: string;
  version: string;
  ecosysteme: string;
  projets: string[];
  gravite: string;
  nb_failles: number;
  nb_critiques: number;
  cible: string;
  montee_majeure: boolean;
  failles: { id: string; gravite: string; resume: string; lien: string; corrige_en: string }[];
  prompt: string;
  cree_le: string;
};

export function isFixId(value: string): boolean {
  return FIX_ID.test(value) && !value.includes("..");
}

export async function readFix(id: string, dir = FIXES_DIR): Promise<FixBrief | null> {
  if (!isFixId(id)) return null; // never build a path from anything else
  try {
    return JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), "utf8")) as FixBrief;
  } catch {
    return null;
  }
}

export async function listFixes(dir = FIXES_DIR): Promise<FixBrief[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const briefs = await Promise.all(files.map((f) => readFix(f.replace(/\.json$/, ""), dir)));
  return briefs
    .filter((b): b is FixBrief => b !== null)
    .sort((a, b) => (RANK[a.gravite] ?? 9) - (RANK[b.gravite] ?? 9) || b.nb_critiques - a.nb_critiques || b.nb_failles - a.nb_failles);
}

export { claudeLink } from "./claude-link";
