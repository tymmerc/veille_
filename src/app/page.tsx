"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PhraseList } from "@/components/phrase-list";
import { NotifyModesCard } from "@/components/notify-modes-card";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/header";


const EXAMPLES = [
  "les dernieres avancees en IA generative et les nouveaux modeles open-source",
  "vulnerabilites zero-day, CTF writeups et outils offensifs",
  "projets Rust et Go open-source, infra self-hosted, homelab",
  "papers de recherche en NLP et computer vision sur arxiv",
  "tout ce qui touche au dev web moderne, React, Next.js, edge computing",
];

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" x2="19" y1="12" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  );
}

type FollowedAccount = {
  platform: "twitter" | "blog";
  handle: string;
  label: string;
};

type PromptConfig = {
  keywords: string[];
  subreddits: string[];
  rss_feeds: string[];
  arxiv_categories: string[];
  hn_keywords: string[];
  followed_accounts?: FollowedAccount[];
  enabled_sources?: string[]; // ["reddit", "rss", "hackernews", "arxiv", "blog"]
};


// Source icons
function RedditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#FF4500]">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function RssIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400">
      <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function HnIcon() {
  return <span className="text-[11px] font-bold text-orange-500 font-mono leading-none">Y</span>;
}

function ArxivIcon() {
  return <span className="text-[10px] font-bold text-red-400 font-mono leading-none">arX</span>;
}

// ─── Landing hero (not logged in) ───────────────────────────
function LandingHero({
  exampleIdx,
}: {
  exampleIdx: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-orb absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/[0.10] blur-[120px]" />
        <div className="hero-orb-2 absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-tech/[0.07] blur-[100px]" />
        <div className="hero-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-rose/[0.04] blur-[80px]" />
      </div>

      <Header border={false} />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20">
        {/* Badge */}
        <div className="mb-6 flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-3.5 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] text-primary/70 font-mono">
            propulse par IA
          </span>
        </div>

        {/* Title */}
        <div className="mb-8 text-center max-w-2xl">
          <h1 className="text-[40px] sm:text-[52px] lg:text-[64px] font-bold tracking-tight leading-[1.02]">
            <span className="text-foreground">ta veille tech</span>
            <br />
            <span className="text-primary">en une phrase.</span>
          </h1>
          <p className="mt-5 text-[14px] sm:text-[16px] text-muted-foreground/60 max-w-lg mx-auto leading-relaxed">
            Decris tes interets, l&apos;IA configure tes sources,
            score chaque article et t&apos;envoie un digest personnalise.
          </p>
        </div>

        {/* Prompt preview with glow */}
        <div className="w-full max-w-xl mb-6">
          <div
            className={`prompt-border-glow rounded-xl bg-card card-shadow backdrop-blur-sm ${hovered ? "prompt-focused" : ""}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="px-5 pt-5 pb-3">
              <div className="text-[14px] sm:text-[15px] text-foreground/50 font-mono leading-relaxed min-h-[48px] flex items-center transition-all duration-500">
                &quot;{EXAMPLES[exampleIdx]}&quot;
              </div>
            </div>
            <div className="flex items-center justify-between px-5 pb-4">
              <span className="text-[11px] text-muted-foreground/20 font-mono">
                enter pour envoyer
              </span>
              <a
                href="/veille/login"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-all hover:brightness-110 glow"
              >
                <DiscordIcon />
                commencer
              </a>
            </div>
          </div>
        </div>

        {/* Sources */}
        <div className="flex items-center justify-center gap-5 text-[11px] text-muted-foreground/30 font-mono mb-12">
          {[
            { icon: <RedditIcon />, label: "reddit" },
            { icon: <HnIcon />, label: "hackernews" },
            { icon: <RssIcon />, label: "rss" },
            { icon: <BlogIcon />, label: "blogs" },
            { icon: <ArxivIcon />, label: "arxiv" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
              {s.icon}
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                title: "decris",
                desc: "Ecris ce que tu veux suivre en langage naturel",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "l'IA configure",
                desc: "Sources, mots-cles et scoring sont generes automatiquement",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "lis ton feed",
                desc: "Articles scores, resumes en francais et prets a lire",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 card-hover">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/[0.06] border border-primary/10">
                    {item.icon}
                  </div>
                  <span className="text-[10px] text-primary/30 font-mono">{item.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-[12px] text-muted-foreground/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <a
            href="/veille/login"
            className="inline-flex items-center gap-2.5 rounded-xl bg-primary px-8 py-3.5 text-[14px] font-semibold text-primary-foreground transition-all hover:brightness-110 glow"
          >
            <DiscordIcon />
            se connecter avec Discord
          </a>
          <p className="mt-3 text-[11px] text-muted-foreground/20 font-mono">
            gratuit · pas de spam · open-source
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Prompt section ──────────────────────────────────────────
function PromptSection({
  prompt,
  setPrompt,
  currentPrompt,
  submitting,
  onSubmit,
  error,
  exampleIdx,
  syncStep,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  currentPrompt: string | null;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
  exampleIdx: number;
  syncStep: string | null;
}) {
  const isFirstTime = !currentPrompt;
  const [focused, setFocused] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 400);
  };

  const glowClass = [
    "prompt-border-glow rounded-xl bg-card card-shadow",
    submitting ? "prompt-thinking" : "",
    !submitting && typing ? "prompt-typing" : "",
    !submitting && !typing && focused ? "prompt-focused" : "",
  ].filter(Boolean).join(" ");

  if (isFirstTime) {
    return (
      <div className="relative flex flex-col items-center justify-center px-6 pt-8 pb-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-orb absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-primary/[0.08] blur-[100px]" />
        </div>
        <div className="relative z-10 w-full max-w-xl text-center">
          <h1 className="text-[28px] sm:text-[36px] font-bold tracking-tight leading-[1.1] mb-3">
            <span className="text-foreground">ta veille tech</span>{" "}
            <span className="text-primary">en une phrase.</span>
          </h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Decris ce que tu veux suivre, l&apos;IA s&apos;occupe du reste.
          </p>
          <div className={`${glowClass} border border-border backdrop-blur-sm text-left`}>
            <textarea
              value={prompt}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
              }}
              placeholder={EXAMPLES[exampleIdx]}
              rows={3}
              className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[15px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none"
            />
            <div className="flex items-center justify-between px-5 pb-4">
              <span className="text-[11px] text-muted-foreground/25 font-mono">
                {submitting ? (
                  <span className="text-primary/50 animate-pulse">analyse en cours...</span>
                ) : prompt.length > 0 ? `${prompt.length} car.` : "entrée pour envoyer · maj+entrée pour une autre phrase"}
              </span>
              <button
                onClick={onSubmit}
                disabled={!prompt.trim() || submitting}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed glow"
              >
                {submitting ? (
                  <span className="animate-pulse">analyse...</span>
                ) : (
                  <>
                    <SparkIcon />
                    activer
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-[12px] text-cyber font-mono">{error}</p>
          )}
          {syncStep && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="text-[12px] text-primary font-mono">{syncStep}</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">~1 min</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className={`${glowClass} border border-transparent`}>
        <PhraseList value={prompt} onChange={setPrompt} onSubmit={onSubmit} submitting={submitting}
          unchanged={prompt.trim() === (currentPrompt ?? "").trim()} />
      </div>
      {error && (
        <p className="mt-2 text-[12px] text-cyber font-mono">{error}</p>
      )}
      {syncStep && (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span className="text-[12px] text-primary font-mono">{syncStep}</span>
        </div>
      )}
    </div>
  );
}

// ─── Prompt History ──────────────────────────────────────────

type HistoryEntry = {
  id: string;
  prompt: string;
  config: object;
  createdAt: string;
};

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function PromptHistorySection({ onRestore }: { onRestore: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/veille/api/prompt/history")
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.history || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleDelete = async (id: string) => {
    const prev = history;
    setHistory((h) => h.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/veille/api/prompt/history/${id}`, { method: "DELETE" });
      if (!res.ok) setHistory(prev);
    } catch {
      setHistory(prev);
    }
  };

  if (loaded && history.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors font-mono"
      >
        <ClockIcon />
        historique
        <span className="text-[10px]">{open ? "\u25be" : "\u25b8"}</span>
      </button>
      {open && (
        <div className="mt-2 max-h-[200px] overflow-y-auto rounded-lg border border-border/50 bg-card/50 divide-y divide-border/30">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center group"
            >
              <button
                onClick={() => onRestore(entry.prompt)}
                className="flex-1 text-left px-3 py-2 hover:bg-muted/30 transition-colors min-w-0"
              >
                <span className="text-[12px] text-muted-foreground/60 group-hover:text-foreground/80 font-mono truncate block">
                  {entry.prompt.length > 60 ? entry.prompt.slice(0, 60) + "..." : entry.prompt}
                </span>
                <span className="text-[10px] text-muted-foreground/30 font-mono">
                  {relativeDate(entry.createdAt)}
                </span>
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="shrink-0 p-2 text-muted-foreground/20 hover:text-cyber transition-colors opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard cards ─────────────────────────────────────────
const ALL_SOURCES = ["reddit", "rss", "hackernews", "arxiv", "blog"] as const;
type SourceKey = typeof ALL_SOURCES[number];

function BlogIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function SourcesCard({ config, onToggleSource }: { config: PromptConfig; onToggleSource: (source: SourceKey) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const enabled = new Set(config.enabled_sources || ALL_SOURCES);

  const handleToggle = (source: SourceKey) => {
    onToggleSource(source);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const sources = [
    { key: "reddit" as SourceKey, label: "reddit", icon: <RedditIcon />, count: config.subreddits?.length || 0, items: config.subreddits },
    { key: "rss" as SourceKey, label: "rss", icon: <RssIcon />, count: config.rss_feeds?.length || 0, items: config.rss_feeds?.map((u: string) => { try { return new URL(u).hostname; } catch { return u; } }) },
    { key: "hackernews" as SourceKey, label: "hackernews", icon: <HnIcon />, count: config.hn_keywords?.length || 0, items: config.hn_keywords },
    { key: "arxiv" as SourceKey, label: "arxiv", icon: <ArxivIcon />, count: config.arxiv_categories?.length || 0, items: config.arxiv_categories },
    { key: "blog" as SourceKey, label: "blogs officiels", icon: <BlogIcon />, count: 1, items: ["Anthropic", "Google DeepMind"] },
  ];

  const activeCount = sources.filter((s) => enabled.has(s.key)).length;

  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-mono">sources</h3>
        <span className="text-[10px] font-mono">
          {saved
            ? <span className="text-primary animate-pulse">sauvegarde</span>
            : <span className="text-muted-foreground/25">{activeCount}/{sources.length} actives</span>
          }
        </span>
      </div>
      <div className="space-y-1">
        {sources.map((s) => {
          const isEnabled = enabled.has(s.key);
          return (
            <div key={s.key}>
              <div className="flex items-center gap-2.5 py-1.5">
                <button
                  onClick={() => handleToggle(s.key)}
                  className={`shrink-0 w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                    isEnabled
                      ? "border-primary bg-primary/15"
                      : "border-muted-foreground/20 bg-transparent"
                  }`}
                >
                  {isEnabled && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className="shrink-0 w-5 flex justify-center opacity-60">{s.icon}</span>
                <button
                  onClick={() => s.count > 0 ? setExpanded(expanded === s.key ? null : s.key) : null}
                  className={`flex-1 flex items-center gap-2 text-left ${!isEnabled ? "opacity-30" : ""}`}
                >
                  <span className="text-[12px] text-foreground/70 font-mono flex-1">{s.label}</span>
                  {s.count > 0 && s.key !== "blog" && (
                    <span className="text-[11px] text-muted-foreground/40 font-mono tabular-nums">{s.count}</span>
                  )}
                  {s.count > 0 && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-muted-foreground/20 transition-transform ${expanded === s.key ? "rotate-180" : ""}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </button>
              </div>
              {expanded === s.key && s.items && (
                <div className="ml-12 mb-2 flex flex-wrap gap-1">
                  {s.items.slice(0, 12).map((item: string, i: number) => (
                    <span key={i} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground/60 font-mono">
                      {item}
                    </span>
                  ))}
                  {s.items.length > 12 && (
                    <span className="text-[10px] text-muted-foreground/30 self-center">+{s.items.length - 12}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {config.keywords?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex flex-wrap gap-1">
            {config.keywords.slice(0, 10).map((kw: string, i: number) => (
              <span key={i} className="rounded-full border border-primary/10 bg-primary/[0.04] px-2 py-0.5 text-[10px] text-primary/50 font-mono">
                {kw}
              </span>
            ))}
            {config.keywords.length > 10 && (
              <span className="text-[10px] text-muted-foreground/25 self-center">+{config.keywords.length - 10}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FollowedAccountsCard({
  accounts,
  onAdd,
  onRemove,
}: {
  accounts: FollowedAccount[];
  onAdd: (account: FollowedAccount) => void;
  onRemove: (index: number) => void;
}) {
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState<"twitter" | "blog">("twitter");

  const handleAdd = () => {
    if (!newHandle.trim()) return;
    const label = newHandle.trim().replace(/^@/, "");
    onAdd({
      platform: newPlatform,
      handle: newPlatform === "twitter" ? label : newHandle.trim(),
      label,
    });
    setNewHandle("");
  };

  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-mono mb-4">comptes suivis</h3>

      {accounts.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {accounts.map((acc, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-[10px] text-muted-foreground/40 font-mono w-12 shrink-0">
                {acc.platform === "twitter" ? "X" : "blog"}
              </span>
              <span className="flex-1 text-[11px] text-foreground/70 font-mono truncate">
                {acc.platform === "twitter" ? `@${acc.handle}` : acc.handle}
              </span>
              <button
                onClick={() => onRemove(i)}
                className="text-muted-foreground/20 hover:text-cyber transition-colors opacity-0 group-hover:opacity-100"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <select
          value={newPlatform}
          onChange={(e) => setNewPlatform(e.target.value as "twitter" | "blog")}
          className="shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground font-mono focus:outline-none"
        >
          <option value="twitter">X</option>
          <option value="blog">Blog</option>
        </select>
        <input
          type="text"
          value={newHandle}
          onChange={(e) => setNewHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={newPlatform === "twitter" ? "@AnthropicAI" : "https://claude.com/blog/"}
          className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/30 font-mono"
        />
        <button
          onClick={handleAdd}
          disabled={!newHandle.trim()}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-border-hover transition-all font-mono disabled:opacity-30"
        >
          +
        </button>
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground/25 font-mono">X via Nitter RSS &middot; Blogs scrapes automatiquement (ex: claude.com/blog)</p>
    </div>
  );
}

function SlackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#4A154B]">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}

function NotificationsCard({
  webhookUrl, setWebhookUrl, onSaveWebhook, webhookSaved,
  slackWebhookUrl, setSlackWebhookUrl, onSaveSlack, slackSaved,
  notifyEnabled, onToggleNotify, minScore, onMinScoreChange,
}: {
  webhookUrl: string; setWebhookUrl: (v: string) => void;
  onSaveWebhook: () => void; webhookSaved: boolean;
  slackWebhookUrl: string; setSlackWebhookUrl: (v: string) => void;
  onSaveSlack: () => void; slackSaved: boolean;
  notifyEnabled: boolean; onToggleNotify: () => void;
  minScore: number; onMinScoreChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-mono mb-4">notifications</h3>
      <button onClick={onToggleNotify} className="flex items-center gap-2 mb-3 w-full">
        <div className={`w-8 h-[18px] rounded-full transition-colors relative ${notifyEnabled ? "bg-primary/30" : "bg-surface"}`}>
          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all ${notifyEnabled ? "left-[15px] bg-primary" : "left-[2px] bg-muted-foreground/30"}`} />
        </div>
        <span className="text-[11px] text-muted-foreground/60 font-mono">
          {notifyEnabled ? "actives" : "desactivees"}
        </span>
      </button>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground/35 font-mono">score min</span>
          <span className="text-[11px] text-foreground/60 font-mono tabular-nums">{minScore}/10</span>
        </div>
        <input type="range" min={1} max={10} value={minScore}
          onChange={(e) => onMinScoreChange(parseInt(e.target.value))}
          className="w-full h-1 appearance-none bg-surface rounded-full cursor-pointer accent-primary" />
      </div>
      {/* Discord webhook */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <DiscordIcon />
          <span className="text-[10px] text-muted-foreground/40 font-mono">discord</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="webhook discord..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/30 font-mono" />
            {webhookUrl && (
              <div className={`absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full ${
                webhookUrl.startsWith("https://discord.com/api/webhooks/") ? "bg-primary" : "bg-cyber"
              }`} />
            )}
          </div>
          <button onClick={onSaveWebhook}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:border-border-hover transition-all font-mono">
            {webhookSaved ? "ok" : "sauver"}
          </button>
        </div>
      </div>
      {/* Slack webhook */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <SlackIcon />
          <span className="text-[10px] text-muted-foreground/40 font-mono">slack</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input type="text" value={slackWebhookUrl} onChange={(e) => setSlackWebhookUrl(e.target.value)}
              placeholder="webhook slack..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/30 font-mono" />
            {slackWebhookUrl && (
              <div className={`absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full ${
                slackWebhookUrl.startsWith("https://hooks.slack.com/") ? "bg-primary" : "bg-cyber"
              }`} />
            )}
          </div>
          <button onClick={onSaveSlack}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:border-border-hover transition-all font-mono">
            {slackSaved ? "ok" : "sauver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncCard({
  syncRunning, lastRun, syncStep, onSync,
}: {
  syncRunning: boolean; lastRun: number | null; syncStep: string | null; onSync: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-mono mb-4">synchronisation</h3>
      {syncRunning || syncStep ? (
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[12px] text-primary/70 font-mono">{syncStep || "collecte en cours..."}</span>
        </div>
      ) : (
        <div className="mb-3">
          <span className="text-[11px] text-muted-foreground/40 font-mono">
            {lastRun
              ? `dernier sync : ${new Date(lastRun).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
              : "jamais synchronise"}
          </span>
        </div>
      )}
      <button onClick={onSync} disabled={syncRunning || !!syncStep}
        className="w-full rounded-lg border border-border py-2 text-[11px] text-muted-foreground hover:text-foreground hover:border-border-hover transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed">
        {syncRunning || syncStep ? "en cours..." : "sync maintenant"}
      </button>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────
export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackSaved, setSlackSaved] = useState(false);
  // null = no schedule (summary after every hourly run with news)
  const [syncHours, setSyncHours] = useState<number[] | null>(null);
  const [syncDays, setSyncDays] = useState<number[] | null>(null);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [instantMin, setInstantMin] = useState<number | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [minScore, setMinScore] = useState(6);

  const [syncRunning, setSyncRunning] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [syncStep, setSyncStep] = useState<string | null>(null);
  const [articleCount, setArticleCount] = useState<number | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleInitialized = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLES.length), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/veille/api/auth/me").then((r) => r.json()),
      fetch("/veille/api/settings").then((r) => r.json()),
      fetch("/veille/api/sync").then((r) => r.json()),
      fetch("/veille/api/articles?limit=1").then((r) => r.json()),
    ]).then(([me, settings, sync, articles]) => {
      if (me.user?.prompt) { setCurrentPrompt(me.user.prompt); setPrompt(me.user.prompt); }
      if (me.user?.promptConfig) setConfig(me.user.promptConfig);
      setSyncHours(settings.syncHours ?? null);
      setSyncDays(settings.syncDays ?? null);
      setNotifyDigest(settings.notifyDigest ?? true);
      setInstantMin(settings.notifyInstantMin ?? null);
      if (me.user?.webhookUrl) setWebhookUrl(me.user.webhookUrl);
      if (settings.slackWebhookUrl) setSlackWebhookUrl(settings.slackWebhookUrl);
      setMinScore(settings.minScore ?? 6);
      setNotifyEnabled(settings.notifyEnabled ?? true);
      setSyncRunning(sync.running);
      setLastRun(sync.lastRun);
      // Show count of relevant articles (followed + relevant), not total DB count
      const relevant = (articles.stats?.bySection?.followed || 0) + (articles.stats?.bySection?.relevant || 0);
      setArticleCount(relevant > 0 ? relevant : articles.total);
      scheduleInitialized.current = true;
    }).catch(() => {});
  }, [user]);

  const [syncJustFinished, setSyncJustFinished] = useState(false);

  useEffect(() => {
    if (!syncRunning && !syncStep) return;
    setSyncJustFinished(false);
    const interval = setInterval(() => {
      fetch("/veille/api/sync").then((r) => r.json()).then((data) => {
        setSyncRunning(data.running);
        setLastRun(data.lastRun);
        if (!data.running) {
          setSyncStep(null);
          setSyncJustFinished(true);
          fetch("/veille/api/articles?limit=1").then((r) => r.json()).then((d) => {
            const relevant = (d.stats?.bySection?.followed || 0) + (d.stats?.bySection?.relevant || 0);
            setArticleCount(relevant > 0 ? relevant : d.total);
          });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [syncRunning, syncStep]);

  const saveSettings = useCallback((body: Record<string, unknown>) => {
    fetch("/veille/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) return;
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 1500);
    });
  }, []);

  const autoSaveSchedule = useCallback((hours: number[] | null, days: number[] | null) => {
    if (!scheduleInitialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSettings({ syncHours: hours, syncDays: days }), 800);
  }, [saveSettings]);

  const handleSchedule = ({ hours, days }: { hours: number[] | null; days: number[] | null }) => {
    setSyncHours(hours);
    setSyncDays(days);
    autoSaveSchedule(hours, days);
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setSyncStep("analyse du prompt...");
    try {
      const res = await fetch("/veille/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "");
      setPrompt(data.prompt ?? prompt.trim());
      setCurrentPrompt(data.prompt ?? prompt.trim());
      setConfig(data.config);
      if (data.syncTriggered) { setSyncStep("collecte en cours..."); setSyncRunning(true); }
    } catch (err) {
      setError((err instanceof Error && err.message) || "Erreur lors de l'analyse. Reessaie.");
      setSyncStep(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWebhookSave = async () => {
    try {
      await fetch("/veille/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 2000);
    } catch {}
  };

  const handleSlackSave = async () => {
    try {
      const res = await fetch("/veille/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slackWebhookUrl }),
      });
      if (!res.ok) return;
      setSlackSaved(true);
      setTimeout(() => setSlackSaved(false), 2000);
    } catch {}
  };

  const handleToggleNotify = () => {
    const next = !notifyEnabled;
    setNotifyEnabled(next);
    fetch("/veille/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyEnabled: next }),
    });
  };

  const handleMinScoreChange = (v: number) => {
    setMinScore(v);
    fetch("/veille/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minScore: v }),
    });
  };

  const handleSync = () => {
    setSyncStep("collecte en cours...");
    setSyncRunning(true);
    fetch("/veille/api/sync", { method: "POST" });
  };

  if (authLoading) return null;

  if (!user) return <LandingHero exampleIdx={exampleIdx} />;

  if (!config || !currentPrompt) {
    return (
      <div className="flex-1 flex flex-col justify-center py-6">
        <PromptSection prompt={prompt} setPrompt={setPrompt} currentPrompt={currentPrompt}
          submitting={submitting} onSubmit={handleSubmit} error={error} exampleIdx={exampleIdx} syncStep={syncStep} />
        <div className="text-center mt-4 pb-8">
          <Link href="/feed" className="text-[12px] text-muted-foreground/30 hover:text-muted-foreground transition-colors font-mono">
            consulter le feed global
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-8">
      <PromptSection prompt={prompt} setPrompt={setPrompt} currentPrompt={currentPrompt}
        submitting={submitting} onSubmit={handleSubmit} error={error} exampleIdx={exampleIdx} syncStep={syncStep} />

      <PromptHistorySection onRestore={(text) => setPrompt(text)} />

      {syncJustFinished && (
        <Link
          href="/feed"
          className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.04] px-5 py-3.5 mb-5 transition-all hover:bg-primary/[0.08] hover:border-primary/30 group"
          onClick={() => setSyncJustFinished(false)}
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[13px] font-medium text-foreground">
              {articleCount != null && articleCount > 0 ? `${articleCount} articles pertinents` : "Articles prets"}
            </span>
          </div>
          <span className="text-[13px] text-primary font-mono group-hover:translate-x-0.5 transition-transform">
            voir le feed &rarr;
          </span>
        </Link>
      )}

      <div className="flex items-center gap-3 mb-5">
        <div className={`h-2 w-2 rounded-full ${syncRunning || syncStep ? "bg-primary animate-pulse" : "bg-primary/40"}`} />
        <span className="text-[11px] font-mono text-primary/60 uppercase tracking-wider">veille active</span>
        {articleCount != null && articleCount > 0 && (
          <span className="text-[11px] text-muted-foreground/30 font-mono ml-auto">
            {articleCount} article{articleCount !== 1 ? "s" : ""} pertinent{articleCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SourcesCard config={config} onToggleSource={(source) => {
          const current = new Set(config.enabled_sources || [...ALL_SOURCES]);
          if (current.has(source)) {
            if (current.size <= 1) return; // keep at least 1
            current.delete(source);
          } else {
            current.add(source);
          }
          const enabled_sources = Array.from(current);
          const updated = { ...config, enabled_sources };
          setConfig(updated);
          fetch("/veille/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptConfig: updated }),
          });
        }} />
        <FollowedAccountsCard
          accounts={config.followed_accounts || []}
          onAdd={(account) => {
            const updated = { ...config, followed_accounts: [...(config.followed_accounts || []), account] };
            setConfig(updated);
            fetch("/veille/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ promptConfig: updated }),
            });
          }}
          onRemove={(index) => {
            const accounts = [...(config.followed_accounts || [])];
            accounts.splice(index, 1);
            const updated = { ...config, followed_accounts: accounts };
            setConfig(updated);
            fetch("/veille/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ promptConfig: updated }),
            });
          }}
        />
        <SyncCard syncRunning={syncRunning} lastRun={lastRun} syncStep={syncStep} onSync={handleSync} />
        <NotifyModesCard
          digest={notifyDigest}
          onDigest={(on) => { setNotifyDigest(on); saveSettings({ notifyDigest: on }); }}
          schedule={{ hours: syncHours, days: syncDays }}
          onSchedule={handleSchedule}
          instantMin={instantMin}
          onInstant={(min) => { setInstantMin(min); saveSettings({ notifyInstantMin: min }); }}
          saved={scheduleSaved} />
        <NotificationsCard webhookUrl={webhookUrl} setWebhookUrl={setWebhookUrl}
          onSaveWebhook={handleWebhookSave} webhookSaved={webhookSaved}
          slackWebhookUrl={slackWebhookUrl} setSlackWebhookUrl={setSlackWebhookUrl}
          onSaveSlack={handleSlackSave} slackSaved={slackSaved}
          notifyEnabled={notifyEnabled} onToggleNotify={handleToggleNotify}
          minScore={minScore} onMinScoreChange={handleMinScoreChange} />
      </div>

      <div className="mt-8 text-center">
        <Link href="/feed"
          className="inline-flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-6 py-3 text-[13px] font-medium text-foreground transition-all hover:bg-primary/[0.08] hover:border-primary/30 font-mono">
          voir mon feed <ArrowIcon />
        </Link>
        {user.username === "tym_merc" && (
          <Link href="/analyse"
            className="ml-3 inline-flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground font-mono">
            l&apos;analyse de la semaine
          </Link>
        )}
        {user.username === "tym_merc" && (
          <Link href="/fix"
            className="inline-flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground font-mono">
            failles à corriger
          </Link>
        )}
      </div>
    </div>
  );
}
