"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { claudeLink } from "@/lib/claude-link";
import type { FixBrief } from "@/lib/fixes";

export default function FixPage({ params }: { params: { id: string } }) {
  const [fix, setFix] = useState<FixBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/veille/api/fixes/${encodeURIComponent(params.id)}`)
      .then(async (r) => {
        if (r.status === 403) throw new Error("Cette page est réservée.");
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Faille introuvable.");
        return r.json();
      })
      .then(setFix)
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  const copy = async () => {
    if (!fix) return;
    try {
      await navigator.clipboard.writeText(fix.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible : sélectionne le texte du brief à la main.");
    }
  };

  if (error) return <p className="py-16 text-center text-[13px] text-muted-foreground">{error} <Link href="/fix" className="text-primary">toutes les failles</Link></p>;
  if (!fix) return <p className="py-16 text-center text-[12px] font-mono text-muted-foreground/40 animate-pulse">chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <Link href="/fix" className="text-[11px] font-mono text-muted-foreground/50 hover:text-foreground">&larr; failles à corriger</Link>
      <h1 className="mt-3 text-[22px] sm:text-[28px] font-semibold tracking-tight text-foreground">
        {fix.paquet} <span className="font-mono text-[18px] text-muted-foreground">{fix.version}</span>
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {fix.nb_failles} failles connues{fix.nb_critiques ? `, dont ${fix.nb_critiques} critiques` : ""} ·{" "}
        {fix.projets.length ? fix.projets.map((p) => p.replace("/opt/", "")).join(", ") : "paquet système"} ·{" "}
        {fix.cible ? `corrigé en ${fix.cible}` : "pas encore de correctif"}
        {fix.montee_majeure && <span className="text-cyber"> · montée de version majeure</span>}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a href={claudeLink(fix.prompt)}
          className="rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-all hover:brightness-110">
          Ouvrir dans Claude Code
        </a>
        <button onClick={copy}
          className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface">
          {copied ? "Copié" : "Copier le prompt"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/60">
        Le prompt s&apos;écrit dans l&apos;app de bureau sans partir : choisis l&apos;environnement VPS dans la zone de saisie, relis, envoie.
        Sur téléphone, copie le prompt et colle-le dans une session Claude Code ouverte sur le VPS.
      </p>

      <h2 className="mt-10 border-t border-border pt-6 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">failles</h2>
      <ul className="mt-3 space-y-2">
        {fix.failles.slice(0, 20).map((f) => (
          <li key={f.id} className="text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-mono text-[11px] text-foreground/70">[{f.gravite}]</span>{" "}
            <a href={f.lien} target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary">{f.id}</a>{" "}
            {f.resume}{f.corrige_en && <span className="text-muted-foreground/50"> · corrigé en {f.corrige_en}</span>}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 border-t border-border pt-6 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">le brief envoyé à claude</h2>
      <pre className="mt-3 whitespace-pre-wrap rounded-md bg-surface p-4 text-[12px] leading-relaxed text-muted-foreground">{fix.prompt}</pre>
    </div>
  );
}
