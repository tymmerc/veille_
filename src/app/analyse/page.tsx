"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Analysis, Fact } from "@/lib/analyses";

const PRIO_DOT: Record<string, string> = {
  haute: "bg-cyber",
  moyenne: "bg-primary",
  basse: "bg-muted-foreground/30",
};

function weekLabel(week: string) {
  return `semaine ${Number(week.split("-W")[1])}`;
}

function Sources({ fact, refs }: { fact: Fact; refs: Analysis["refs"] }) {
  return (
    <span className="ml-1 inline-flex gap-1 align-baseline">
      {fact.sources.map((id) => {
        const ref = refs[id];
        const label = id.startsWith("A") ? id.slice(1) : id;
        if (!ref?.url) {
          return (
            <span key={id} title={ref?.titre} className="font-mono text-[10px] text-muted-foreground/50">
              {label}
            </span>
          );
        }
        return (
          <a key={id} href={ref.url} target="_blank" rel="noopener noreferrer" title={`${ref.titre} · ${ref.source}`}
            className="font-mono text-[10px] text-primary/70 hover:text-primary underline-offset-2 hover:underline">
            {label}
          </a>
        );
      })}
    </span>
  );
}

export default function AnalysePage() {
  const [weeks, setWeeks] = useState<string[] | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/veille/api/analyses")
      .then(async (r) => {
        if (r.status === 403) throw new Error("Cette page est réservée.");
        if (!r.ok) throw new Error("Impossible de charger les analyses.");
        return r.json();
      })
      .then((d) => { setWeeks(d.weeks); setWeek(d.weeks[0] ?? null); })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!week) return;
    setData(null);
    fetch(`/veille/api/analyses/${week}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Analyse introuvable."))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [week]);

  if (error) return <p className="py-16 text-center text-[13px] text-muted-foreground">{error}</p>;
  if (weeks && weeks.length === 0) {
    return (
      <p className="py-16 text-center text-[13px] text-muted-foreground">
        Pas encore d&apos;analyse. La première arrive lundi matin.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="mr-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">analyse</span>
        {(weeks ?? []).map((w) => (
          <button key={w} onClick={() => setWeek(w)}
            className={`rounded-md px-2 py-1 text-[11px] font-mono transition-colors ${
              w === week ? "bg-primary/15 text-primary" : "text-muted-foreground/50 hover:text-foreground"}`}>
            {weekLabel(w)}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="text-[12px] font-mono text-muted-foreground/40 animate-pulse">chargement…</p>
      ) : (
        <article>
          <h1 className="text-[22px] sm:text-[28px] font-semibold leading-tight tracking-tight text-foreground">
            {data.en_une}
          </h1>
          <p className="mt-2 text-[11px] font-mono text-muted-foreground/50">
            {weekLabel(data.semaine)} · {data.nb_articles} articles lus · {new Date(data.cree_le).toLocaleDateString("fr-FR")}
          </p>

          {data.themes.map((theme, i) => (
            <section key={i} className="mt-10 border-t border-border pt-6">
              <h2 className="flex items-center gap-2.5 text-[16px] font-semibold text-foreground">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIO_DOT[theme.priorite] ?? PRIO_DOT.basse}`} aria-label={`priorité ${theme.priorite}`} />
                {theme.titre}
              </h2>
              <ul className="mt-3 space-y-1.5">
                {theme.faits.map((fact, j) => (
                  <li key={j} className="text-[14px] leading-relaxed text-muted-foreground">
                    {fact.texte}<Sources fact={fact} refs={data.refs} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[14px] leading-relaxed text-foreground">
                <span className="mr-2 text-[10px] font-mono uppercase tracking-wider text-primary/70">pour toi</span>
                {theme.pour_toi}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
                <span className="mr-2 text-[10px] font-mono uppercase tracking-wider text-primary/70">à faire</span>
                {theme.a_faire}
              </p>
            </section>
          ))}

          {(data.signaux_faibles.length > 0 || data.a_surveiller.length > 0) && (
            <section className="mt-10 grid gap-8 border-t border-border pt-6 sm:grid-cols-2">
              {data.signaux_faibles.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">signaux faibles</h3>
                  <ul className="mt-2 space-y-1.5">
                    {data.signaux_faibles.map((s, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">
                        {s.texte}<Sources fact={s} refs={data.refs} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.a_surveiller.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">à surveiller</h3>
                  <ul className="mt-2 space-y-1.5">
                    {data.a_surveiller.map((w, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <p className="mt-12 text-[11px] font-mono text-muted-foreground/40">
            Chaque fait renvoie à ses sources (numéros). Les faits sans source connue sont retirés avant l&apos;affichage.{" "}
            <Link href="/feed" className="hover:text-foreground">voir le fil</Link> ·{" "}
            <Link href="/fix" className="hover:text-foreground">failles à corriger</Link>
          </p>
        </article>
      )}
    </div>
  );
}
