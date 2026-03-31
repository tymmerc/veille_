import type { Category } from "@/lib/data";

// ─── Platform/source SVG icons ──────────────────────────────────

function RedditIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function HackerNewsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 0v24h24V0H0zm12.8 13.5v5.2h-1.5v-5.2L7.5 5.3h1.6l3 6.1 3-6.1h1.6l-3.9 8.2z" />
    </svg>
  );
}

function ArxivIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M9 10l3-3 3 3" />
      <path d="M12 7v7" />
    </svg>
  );
}

function RssIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function AnthropicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.476-3.93H5.756l-1.461 3.93H.722L6.569 3.52zm2.327 4.604L6.588 14.2h4.58l-2.272-6.076z" />
    </svg>
  );
}

function GoogleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" opacity=".7" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".8" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".6" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".9" />
    </svg>
  );
}

function GitHubIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function BlogIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function TwitterIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ─── Source detection from article fields ────────────────────────

type SourceInfo = {
  icon: typeof RedditIcon;
  label: string;
  color: string;
  bg: string;
};

function detectSource(platform?: string, source?: string): SourceInfo {
  const p = (platform || "").toLowerCase();
  const s = (source || "").toLowerCase();

  if (p === "reddit" || s.startsWith("r/")) {
    return { icon: RedditIcon, label: "Reddit", color: "text-[#FF4500]", bg: "bg-[#FF4500]/10" };
  }
  if (p === "hackernews" || s === "hackernews" || s === "hacker news") {
    return { icon: HackerNewsIcon, label: "HN", color: "text-[#FF6600]", bg: "bg-[#FF6600]/10" };
  }
  if (p === "arxiv" || s === "arxiv") {
    return { icon: ArxivIcon, label: "arXiv", color: "text-[#B31B1B]", bg: "bg-[#B31B1B]/10" };
  }
  if (s.includes("anthropic")) {
    return { icon: AnthropicIcon, label: "Anthropic", color: "text-[#D4A574]", bg: "bg-[#D4A574]/10" };
  }
  if (s.includes("deepmind") || s.includes("google")) {
    return { icon: GoogleIcon, label: "DeepMind", color: "text-[#4285F4]", bg: "bg-[#4285F4]/10" };
  }
  if (s.includes("twitter") || s.includes("nitter") || p === "twitter") {
    return { icon: TwitterIcon, label: "X", color: "text-foreground", bg: "bg-foreground/10" };
  }
  if (p === "github" || s.includes("github")) {
    return { icon: GitHubIcon, label: "GitHub", color: "text-foreground", bg: "bg-foreground/10" };
  }
  if (p === "blog") {
    return { icon: BlogIcon, label: "Blog", color: "text-primary", bg: "bg-primary/10" };
  }
  // Default RSS
  return { icon: RssIcon, label: "RSS", color: "text-[#EE802F]", bg: "bg-[#EE802F]/10" };
}

// ─── Exported components ─────────────────────────────────────────

export function SourceIcon({
  platform,
  source,
  size = "sm",
  score,
  category,
}: {
  platform?: string;
  source?: string;
  size?: "sm" | "md" | "lg";
  score?: number;
  category?: string;
}) {
  const info = detectSource(platform, source);
  const Icon = info.icon;

  const px = size === "lg" ? 22 : size === "md" ? 16 : 13;
  const sizeClass = size === "lg" ? "w-14 h-14" : size === "md" ? "w-10 h-10" : "w-8 h-8";
  const isHigh = (score || 0) >= 8;

  return (
    <div
      className={`shrink-0 rounded-xl flex items-center justify-center ${info.bg} ${info.color} ${sizeClass} ${isHigh ? "ring-1 ring-current/20" : ""}`}
      title={`${info.label} · ${source || platform || ""}`}
    >
      <Icon size={px} />
    </div>
  );
}
