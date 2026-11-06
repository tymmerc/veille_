"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FixBrief } from "@/lib/fixes";

type Summary = Omit<FixBrief, "prompt" | "failles">;
const DOT: Record<string, string> = { critique: "bg-cyber", haute: "bg-primary", moyenne: "bg-muted-foreground/40", basse: "bg-muted-foreground/20" };

export default function FixListPage() {
  const [fixes, setFixes] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/veille/api/fixes")
      .then((r) => (r.status === 403 ? Promise.reject(new Error("Cette page est réservée.")) : r.json()))
      .then((d) => setFixes(d.fixes))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="py-16 text-center text-[13px] text-muted-foreground">{error}</p>;
  if (!fixes) return <p className="py-16 text-center text-[12px] font-mono text-muted-foreground/40 animate-pulse">chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">failles à corriger</span>
      <h1 className="mt-2 text-[22px] sm:text-[28px] font-semibold tracking-tight text-foreground">
        {fixes.length === 0 ? "Aucune faille connue dans ta stack." : `${fixes.length} paquets à mettre à jour`}
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Chaque paquet a un brief prêt pour Claude Code : ouvre-le, choisis l&apos;environnement VPS, envoie.
      </p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {fixes.map((f) => (
          <li key={f.id}>
            <Link href={`/fix/${f.id}`} className="flex items-center gap-3 py-3.5 transition-colors hover:bg-surface/50">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[f.gravite] ?? DOT.basse}`} aria-label={`gravité ${f.gravite}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-foreground">{f.paquet} <span className="font-mono text-[12px] text-muted-foreground">{f.version}</span></span>
                <span className="block truncate text-[12px] text-muted-foreground/60">{f.projets.length ? f.projets.map((p) => p.replace("/opt/", "")).join(", ") : "serveur"}</span>
              </span>
              <span className="shrink-0 text-right font-mono text-[11px] text-muted-foreground/60">
                {f.nb_failles} failles{f.nb_critiques ? ` · ${f.nb_critiques} crit.` : ""}
                <span className="block text-primary/70">{f.cible ? `→ ${f.cible}` : "pas de correctif"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
