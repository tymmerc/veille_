import type { Category } from "@/lib/data";

// Category icons — visual identity per category
function IaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M10 12h4" />
      <path d="M9 16h6" />
      <path d="M12 12v8" />
      <circle cx="8" cy="20" r="1" />
      <circle cx="16" cy="20" r="1" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  );
}

function CyberIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

function TechIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="14" y1="4" x2="10" y2="20" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<Category, typeof IaIcon> = {
  ia: IaIcon,
  cyber: CyberIcon,
  tech: TechIcon,
};

const CATEGORY_BG: Record<Category, string> = {
  ia: "bg-rose/10 text-rose",
  cyber: "bg-cyber/10 text-cyber",
  tech: "bg-tech/10 text-tech",
};

const CATEGORY_BG_HIGH: Record<Category, string> = {
  ia: "bg-rose/20 text-rose score-glow",
  cyber: "bg-cyber/20 text-cyber",
  tech: "bg-tech/20 text-tech",
};

export function CategoryIcon({ category, size = "sm" }: { category: string; size?: "sm" | "md" }) {
  const cat = category as Category;
  const Icon = CATEGORY_ICONS[cat];
  if (!Icon) return null;

  const px = size === "md" ? 18 : 14;
  const sizeClass = size === "md" ? "w-10 h-10" : "w-8 h-8";
  const bgClass = CATEGORY_BG[cat] || "bg-muted text-muted-foreground";

  return (
    <div className={`shrink-0 rounded-xl flex items-center justify-center ${bgClass} ${sizeClass}`}>
      <Icon size={px} />
    </div>
  );
}

const CATEGORY_STROKE: Record<Category, string> = {
  ia: "var(--rose)",
  cyber: "var(--cyber)",
  tech: "var(--tech)",
};

const CATEGORY_DOT_BG: Record<Category, string> = {
  ia: "bg-rose",
  cyber: "bg-cyber",
  tech: "bg-tech",
};

type ScoreTier = "fire" | "hot" | "decent" | "low";

function getScoreTier(score: number): ScoreTier {
  if (score >= 9) return "fire";
  if (score >= 7) return "hot";
  if (score >= 5) return "decent";
  return "low";
}

export function ScoreBadge({
  score,
  category,
  size = "sm",
}: {
  score: number;
  category?: string;
  size?: "sm" | "md" | "lg";
}) {
  const cat = (category || "ia") as Category;
  const tier = getScoreTier(score);

  // Dimensions per size
  const dims = size === "lg"
    ? { box: 56, radius: 22, stroke: 3, font: "text-[18px]", dot: "w-1.5 h-1.5", dotPos: "-top-0.5 -right-0.5" }
    : size === "md"
    ? { box: 40, radius: 15, stroke: 2.5, font: "text-[14px]", dot: "w-1.5 h-1.5", dotPos: "-top-0.5 -right-0.5" }
    : { box: 32, radius: 11, stroke: 2, font: "text-[11px]", dot: "w-1 h-1", dotPos: "-top-px -right-px" };

  const circumference = 2 * Math.PI * dims.radius;
  const offset = circumference * (1 - score / 10);
  const strokeColor = CATEGORY_STROKE[cat] || "var(--primary)";
  const dotBg = CATEGORY_DOT_BG[cat] || "bg-primary";

  // Opacity/styling per tier
  const tierStyles: Record<ScoreTier, { opacity: string; fontWeight: string; glowClass: string; trackOpacity: number; arcOpacity: number }> = {
    fire:   { opacity: "opacity-100", fontWeight: "font-black", glowClass: "score-glow-pulse", trackOpacity: 0.15, arcOpacity: 1 },
    hot:    { opacity: "opacity-100", fontWeight: "font-bold",  glowClass: "score-glow-subtle", trackOpacity: 0.12, arcOpacity: 0.85 },
    decent: { opacity: "opacity-80",  fontWeight: "font-semibold", glowClass: "", trackOpacity: 0.08, arcOpacity: 0.6 },
    low:    { opacity: "opacity-50",  fontWeight: "font-medium", glowClass: "", trackOpacity: 0.06, arcOpacity: 0.4 },
  };
  const ts = tierStyles[tier];

  return (
    <div
      className={`shrink-0 relative inline-flex items-center justify-center ${ts.glowClass}`}
      style={{ width: dims.box, height: dims.box }}
      title={`${cat} · ${score}/10`}
    >
      {/* SVG progress ring */}
      <svg
        width={dims.box}
        height={dims.box}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={dims.box / 2}
          cy={dims.box / 2}
          r={dims.radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={dims.stroke}
          opacity={ts.trackOpacity}
        />
        {/* Foreground arc */}
        <circle
          cx={dims.box / 2}
          cy={dims.box / 2}
          r={dims.radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity={ts.arcOpacity}
          className="transition-all duration-500"
        />
      </svg>
      {/* Score number */}
      <span className={`relative font-mono ${dims.font} ${ts.fontWeight} ${ts.opacity}`} style={{ color: strokeColor }}>
        {score}
      </span>
      {/* Category color dot */}
      <span className={`absolute ${dims.dotPos} ${dims.dot} rounded-full ${dotBg}`} />
    </div>
  );
}
