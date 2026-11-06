"use client";

import { useRef } from "react";
import { MAX_PHRASES, MAX_PHRASE_CHARS } from "@/lib/phrases";

// Edits several interest phrases. The value stays one string, one phrase per line,
// so the rest of the page (history, submit) keeps working unchanged.
export function PhraseList({
  value, onChange, onSubmit, submitting, unchanged,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  unchanged: boolean;
}) {
  const rows = value.split("\n");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const filled = rows.filter((r) => r.trim()).length;

  const update = (i: number, text: string) => onChange(rows.map((r, j) => (j === i ? text : r)).join("\n"));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i).join("\n") || "");
  const add = () => {
    if (rows.length >= MAX_PHRASES || rows[rows.length - 1]?.trim() === "") {
      inputs.current[rows.length - 1]?.focus();
      return;
    }
    onChange(`${value}\n`);
    setTimeout(() => inputs.current[rows.length]?.focus(), 0);
  };

  return (
    <div className="p-3 sm:p-4">
      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[11px] font-mono text-muted-foreground/40">{i + 1}</span>
            <input
              ref={(el) => { inputs.current[i] = el; }}
              value={row}
              maxLength={MAX_PHRASE_CHARS}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (e.shiftKey) add(); else onSubmit(); }
              }}
              placeholder={i === 0 ? "Décris ce que tu veux suivre…" : "Une autre chose à suivre…"}
              className="min-w-0 flex-1 rounded-md bg-surface px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {rows.length > 1 && (
              <button
                onClick={() => remove(i)}
                aria-label={`Retirer la phrase ${i + 1}`}
                className="shrink-0 rounded-md px-2 py-1 text-[14px] text-muted-foreground/40 hover:text-cyber transition-colors"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={add}
          disabled={rows.length >= MAX_PHRASES}
          className="text-[12px] font-mono text-primary/70 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + ajouter une phrase
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-muted-foreground/40">{filled}/{MAX_PHRASES}</span>
          <button
            onClick={onSubmit}
            disabled={filled === 0 || submitting || unchanged}
            className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting ? <span className="animate-pulse">analyse…</span> : "enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
