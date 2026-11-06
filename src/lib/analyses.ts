// Weekly analyses written by the scraper (tech-veille/analysis.py) as JSON files.
// Admin only: they can mention unpatched packages of the server's stack.
import { promises as fs } from "fs";
import path from "path";
import { getSession } from "./auth";
import { prisma } from "./prisma";

export const ANALYSES_DIR = process.env.ANALYSES_DIR || "/opt/tech-veille/data/analyses";
export const ADMIN_USERS = ["tym_merc"];
const WEEK = /^\d{4}-W\d{2}$/;

export type Fact = { texte: string; sources: string[] };
export type Theme = { titre: string; faits: Fact[]; pour_toi: string; a_faire: string; priorite: "haute" | "moyenne" | "basse" };
export type Analysis = {
  semaine: string;
  en_une: string;
  themes: Theme[];
  signaux_faibles: Fact[];
  a_surveiller: string[];
  refs: Record<string, { titre: string; url: string; source: string }>;
  cree_le: string;
  nb_articles: number;
};

export function isWeek(value: string): boolean {
  return WEEK.test(value);
}

export async function listWeeks(dir = ANALYSES_DIR): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.map((f) => f.replace(/\.json$/, "")).filter(isWeek).sort().reverse();
  } catch {
    return [];
  }
}

export async function readWeek(week: string, dir = ANALYSES_DIR): Promise<Analysis | null> {
  if (!isWeek(week)) return null; // never build a path from anything else
  try {
    const raw = await fs.readFile(path.join(dir, `${week}.json`), "utf8");
    return JSON.parse(raw) as Analysis;
  } catch {
    return null;
  }
}

export async function isAdminSession(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { username: true } });
  return !!user && ADMIN_USERS.includes(user.username);
}
