"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TEXT_COLORS,
  filterByTags,
  parseSummary,
  timeAgo,
  type Category,
  type Article,
} from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { ActionBar } from "@/components/action-bar";
import { SourceIcon } from "@/components/source-icon";
import type { Preset } from "@/components/sidebar";

// ─── Date section helpers ────────────────────────────────────────
function dateSectionLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const articleDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - articleDay.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 7) return d.toLocaleDateString("fr-FR", { weekday: "long" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function groupByDate(articles: Article[]): { label: string; articles: Article[] }[] {
  const groups: { label: string; articles: Article[] }[] = [];
  let currentLabel = "";
  for (const article of articles) {
    const label = dateSectionLabel(article.foundAt);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, articles: [article] });
    } else {
      groups[groups.length - 1].articles.push(article);
    }
  }
  return groups;
}

// ─── Score pill ──────────────────────────────────────────────────
function ScorePill({ score, category }: { score: number; category: string }) {
  const bgColors: Record<string, string> = {
    ia: "bg-rose",
    cyber: "bg-cyber",
    tech: "bg-tech",
  };
  const textColors: Record<string, string> = {
    ia: "text-rose",
    cyber: "text-cyber",
    tech: "text-tech",
  };
  const filledCount = Math.round(score / 2);
  const bg = bgColors[category] || "bg-muted-foreground";
  const txt = textColors[category] || "text-muted-foreground";

  return (
    <span className="inline-flex items-center gap-1.5" title={`Score: ${score}/10`}>
      <span className="inline-flex items-center gap-[2px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`inline-block w-[6px] h-[6px] rounded-[1px] ${
              i < filledCount ? `${bg} opacity-80` : "bg-muted-foreground/15"
            }`}
          />
        ))}
      </span>
      <span className={`text-[10px] font-mono font-bold ${txt}`}>{score}</span>
    </span>
  );
}

// ─── Hero card (rank 0) ───────────────────────────────────────
function HeroCard({ article, isActive, onMouseEnter, onDismiss }: { article: Article; isActive: boolean; onMouseEnter: () => void; onDismiss?: (id: string) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const cat = article.category as Category;
  const { hook, detail } = parseSummary(article.summary);
  const gradientClass: Record<string, string> = {
    ia: "from-rose/8 via-rose/3 to-transparent",
    cyber: "from-cyber/8 via-cyber/3 to-transparent",
    tech: "from-tech/8 via-tech/3 to-transparent",
  };

  return (
    <div
      data-article-id={article.id}
      onClick={() => router.push(`/article/${article.id}`)}
      onMouseEnter={onMouseEnter}
      className={`group relative rounded-2xl border bg-card card-shadow overflow-hidden cursor-pointer card-hover ${
        isActive ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      } ${article.read ? "opacity-60" : ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass[cat] || "from-transparent"} pointer-events-none`} />
      <div className="relative p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary font-mono uppercase tracking-wider">a la une</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${CATEGORY_TEXT_COLORS[cat] || "text-muted-foreground"}`}>
            {CATEGORY_LABELS[cat] || cat}
          </span>
          <ScorePill score={article.score} category={cat} />
          {article.section === "followed" && <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">suivi</span>}
          {article.read && <span className="text-[9px] text-muted-foreground/50 font-mono">lu</span>}
          <span className="text-[11px] text-muted-foreground/60 ml-auto">{timeAgo(article.foundAt)}</span>
        </div>
        <div className="flex items-start gap-3 mb-3">
          <SourceIcon platform={article.platform} source={article.source} score={article.score} size="lg" />
          <div>
            <h2 className="text-[18px] sm:text-[22px] lg:text-[26px] font-bold leading-[1.2] tracking-tight text-foreground">
              {article.title}
            </h2>
            {article.titleOriginal && article.titleOriginal !== article.title && (
              <p className="mt-1 text-[12px] text-muted-foreground/60 font-mono italic">{article.titleOriginal}</p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground/70 font-mono">{article.source}</p>
          </div>
        </div>
        {hook && (
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-muted-foreground/80 mb-2 max-w-3xl">{hook}</p>
        )}
        {detail && detail !== hook && (
          <p className="text-[13px] leading-relaxed text-muted-foreground/60 max-w-3xl hidden sm:block">{detail}</p>
        )}
        {user && (
          <div className="mt-4 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            <ActionBar articleId={article.id} liked={article.liked} bookmarked={article.bookmarked} likeCount={article.likeCount} onDismiss={onDismiss} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Secondary featured card ──────────────────────────────────
function FeaturedCard({ article, isActive, onMouseEnter, onDismiss }: { article: Article; isActive: boolean; onMouseEnter: () => void; onDismiss?: (id: string) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const cat = article.category as Category;
  const { hook } = parseSummary(article.summary);

  return (
    <div
      data-article-id={article.id}
      onClick={() => router.push(`/article/${article.id}`)}
      onMouseEnter={onMouseEnter}
      className={`group rounded-2xl border bg-card card-shadow overflow-hidden cursor-pointer card-hover ${
        isActive ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      } ${article.read ? "opacity-60" : ""}`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5 mb-3">
          <SourceIcon platform={article.platform} source={article.source} score={article.score} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${CATEGORY_TEXT_COLORS[cat] || "text-muted-foreground"}`}>
                {CATEGORY_LABELS[cat] || cat}
              </span>
              <ScorePill score={article.score} category={cat} />
              <span className="text-[11px] text-muted-foreground/50">{article.source}</span>
              {article.section === "followed" && <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">suivi</span>}
              <span className="text-[11px] text-muted-foreground/60">{timeAgo(article.foundAt)}</span>
              {article.read && <span className="text-[9px] text-muted-foreground/50 font-mono">lu</span>}
            </div>
            <h3 className="text-[15px] sm:text-[17px] font-semibold leading-snug text-foreground">
              {article.title}
            </h3>
            {article.titleOriginal && article.titleOriginal !== article.title && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/35 font-mono italic truncate">{article.titleOriginal}</p>
            )}
          </div>
        </div>
        {hook && (
          <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-3">{hook}</p>
        )}
        {user && (
          <div className="mt-4 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            <ActionBar articleId={article.id} liked={article.liked} bookmarked={article.bookmarked} likeCount={article.likeCount} onDismiss={onDismiss} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Regular article card ─────────────────────────────────────
function ArticleCard({ article, isActive, onMouseEnter, onDismiss }: { article: Article; isActive: boolean; onMouseEnter: () => void; onDismiss?: (id: string) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const cat = article.category as Category;
  const { hook } = parseSummary(article.summary);

  return (
    <div
      data-article-id={article.id}
      onClick={() => router.push(`/article/${article.id}`)}
      onMouseEnter={onMouseEnter}
      className={`group rounded-2xl border bg-card card-shadow overflow-hidden cursor-pointer card-hover ${
        isActive ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      } ${article.read ? "opacity-60" : ""}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <SourceIcon platform={article.platform} source={article.source} score={article.score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${CATEGORY_TEXT_COLORS[cat] || "text-muted-foreground"}`}>
                {CATEGORY_LABELS[cat] || cat}
              </span>
              <ScorePill score={article.score} category={cat} />
              <span className="text-[11px] text-muted-foreground/50">{article.source}</span>
              {article.section === "followed" && <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">suivi</span>}
              {"_friendAction" in article && (article as Record<string, string>)._friendAction && (
                <span className="text-[9px] font-mono text-rose bg-rose/10 px-1.5 py-0.5 rounded">{(article as Record<string, string>)._friendAction}</span>
              )}
              <span className="text-[11px] text-muted-foreground/60">{timeAgo(article.foundAt)}</span>
              {article.read && <span className="text-[9px] text-muted-foreground/50 font-mono">lu</span>}
            </div>
            <h3 className="text-[15px] sm:text-[17px] font-semibold leading-snug text-foreground">
              {article.title}
            </h3>
            {article.titleOriginal && article.titleOriginal !== article.title && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/35 font-mono italic truncate">{article.titleOriginal}</p>
            )}
            {hook && (
              <p className="mt-1.5 text-[13px] sm:text-[14px] leading-relaxed text-muted-foreground line-clamp-3">{hook}</p>
            )}
          </div>
        </div>
        {user && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <ActionBar articleId={article.id} liked={article.liked} bookmarked={article.bookmarked} likeCount={article.likeCount} onDismiss={onDismiss} />
            <span className="text-[11px] text-primary/50 font-mono opacity-0 group-hover:opacity-100 transition-opacity">lire &rarr;</span>
          </div>
        )}
        {!user && (
          <div className="mt-3 flex justify-end">
            <span className="text-[11px] text-primary/50 font-mono opacity-0 group-hover:opacity-100 transition-opacity">lire &rarr;</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Source / Time / Score types ─────────────────────────────
type SourceFilter = "all" | "reddit" | "hackernews" | "arxiv" | "rss" | "blog";
type TimeFilter = "all" | "today" | "week" | "month";

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "tout" },
  { key: "reddit", label: "Reddit" },
  { key: "hackernews", label: "HN" },
  { key: "arxiv", label: "arXiv" },
  { key: "rss", label: "RSS" },
  { key: "blog", label: "Blogs" },
];

const TIME_OPTIONS: { key: TimeFilter; label: string }[] = [
  { key: "all", label: "tout" },
  { key: "today", label: "aujourd'hui" },
  { key: "week", label: "cette semaine" },
  { key: "month", label: "ce mois" },
];

const SCORE_OPTIONS = [1, 3, 5, 7, 9];

function matchesTimeFilter(foundAt: string, filter: TimeFilter): boolean {
  if (filter === "all") return true;
  const now = new Date();
  const date = new Date(foundAt);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / 86400000;
  if (filter === "today") return diffDays < 1;
  if (filter === "week") return diffDays < 7;
  if (filter === "month") return diffDays < 30;
  return true;
}

function matchesSourceFilter(platform: string | undefined, filter: SourceFilter): boolean {
  if (filter === "all") return true;
  if (!platform) return false;
  const p = platform.toLowerCase();
  if (filter === "hackernews") return p === "hackernews" || p === "hn" || p === "hacker news";
  if (filter === "blog") return p === "blog" || p === "blogs";
  return p === filter;
}

// ─── Advanced filter bar ─────────────────────────────────────
function AdvancedFilters({
  sourceFilter,
  setSourceFilter,
  timeFilter,
  setTimeFilter,
  minScore,
  setMinScore,
}: {
  sourceFilter: SourceFilter;
  setSourceFilter: (v: SourceFilter) => void;
  timeFilter: TimeFilter;
  setTimeFilter: (v: TimeFilter) => void;
  minScore: number;
  setMinScore: (v: number) => void;
}) {
  return (
    <div className="space-y-3 py-3 animate-in slide-in-from-top-2 duration-200">
      {/* Source filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider w-14 shrink-0">source</span>
        <div className="flex items-center gap-1 flex-wrap">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSourceFilter(opt.key)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all ${
                sourceFilter === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider w-14 shrink-0">temps</span>
        <div className="flex items-center gap-1 flex-wrap">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTimeFilter(opt.key)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all ${
                timeFilter === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider w-14 shrink-0">score</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinScore(0)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all ${
              minScore === 0
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            tout
          </button>
          {SCORE_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setMinScore(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all ${
                minScore === s
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}+
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher..."
        className="w-full rounded-xl border border-border bg-card pl-9 pr-12 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 font-mono"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[9px] text-muted-foreground/50 font-mono">
        {value ? "esc" : "/"}
      </kbd>
    </div>
  );
}

// ─── Date section header ─────────────────────────────────────
function DateSection({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-2 first:pt-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">{label}</span>
      <div className="flex-1 border-t border-border/30" />
    </div>
  );
}

// ─── Main Feed ────────────────────────────────────────────────
export function ArticleFeed() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [presetFilter, setPresetFilter] = useState<(Category | "all")[]>(["all"]);
  const [presetTags, setPresetTags] = useState<string[]>([]);
  const [presetKeywords, setPresetKeywords] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [stats, setStats] = useState<{ total: number; byCategory: Record<string, number> } | null>(null);
  type FeedTab = "feed" | "suivis" | "amis" | "discover";
  const [activeTab, setActiveTab] = useState<FeedTab>("feed");
  const [friendActivity, setFriendActivity] = useState<Article[]>([]);
  const [friendLoading, setFriendLoading] = useState(false);

  // Dismissed articles (persisted in localStorage)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("veille_dismissed");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const handleDismiss = useCallback((articleId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(articleId);
      try { localStorage.setItem("veille_dismissed", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Preset change handler is after fetchArticles definition

  const fetchArticles = useCallback((pageNum: number = 1, append: boolean = false) => {
    // Cancel any in-flight request to prevent race conditions
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    const params = new URLSearchParams({ limit: "50", page: String(pageNum) });
    if (activeCategory !== "all") params.set("category", activeCategory);

    fetch(`/veille/api/articles?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const newArticles = data.articles || [];
        if (append) {
          setArticles((prev) => [...prev, ...newArticles]);
        } else {
          setArticles(newArticles);
        }
        if (data.stats) setStats(data.stats);
        setHasMore(newArticles.length >= 50 && data.page < data.pages);
        setLoading(false);
        setLoadingMore(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError("Erreur de chargement");
        setLoading(false);
        setLoadingMore(false);
      });
  }, [activeCategory]);

  useEffect(() => {
    setPage(1);
    fetchArticles(1);
  }, [fetchArticles]);

  // Re-fetch when user navigates back to the feed (e.g. after changing prompt on config page)
  useEffect(() => {
    const handleFocus = () => {
      setPage(1);
      fetchArticles(1);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchArticles]);

  // Listen for preset changes from sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const preset = (e as CustomEvent<Preset>).detail;
      setPresetFilter(preset.categories);
      setPresetTags(preset.tags || []);
      setPresetKeywords(preset.keywords || []);
      const newCat = preset.categories.length === 1 && (!preset.tags || preset.tags.length === 0)
        ? preset.categories[0] as Category
        : "all";
      if (newCat === activeCategory) {
        // Category didn't change, but preset did — force re-fetch
        setPage(1);
        fetchArticles(1);
      } else {
        setActiveCategory(newCat);
        // The category change will trigger fetchArticles via the useEffect above
      }
    };
    window.addEventListener("veille:preset-change", handler);
    return () => window.removeEventListener("veille:preset-change", handler);
  }, [activeCategory, fetchArticles]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchArticles(nextPage, true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, page, fetchArticles]);

  // Fetch friend activity when amis tab is selected
  useEffect(() => {
    if (activeTab !== "amis" || !user) return;
    setFriendLoading(true);
    fetch("/veille/api/friends/activity")
      .then((r) => r.json())
      .then((data) => {
        const items = (data.activity || []).map((a: { article: Article; user: { username: string }; type: string }) => ({
          ...a.article,
          // Inject friend info into article for display
          _friendAction: `${a.type === "like" ? "♥" : "★"} ${a.user.username}`,
        })).filter(Boolean);
        setFriendActivity(items);
        setFriendLoading(false);
      })
      .catch(() => setFriendLoading(false));
  }, [activeTab, user]);

  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    const syncAbort = new AbortController();
    fetch("/veille/api/sync", { signal: syncAbort.signal }).then((r) => r.json()).then((d) => { setSyncRunning(d.running); if (d.lastRun) setLastSync(d.lastRun); }).catch(() => {});
    let pendingAbort: AbortController | null = null;
    const interval = setInterval(() => {
      pendingAbort?.abort();
      pendingAbort = new AbortController();
      fetch("/veille/api/sync", { signal: pendingAbort.signal }).then((r) => r.json()).then((d) => {
        if (syncRunning && !d.running) fetchArticles(1);
        setSyncRunning(d.running);
        if (d.lastRun) setLastSync(d.lastRun);
      }).catch(() => {});
    }, 10000);
    return () => { clearInterval(interval); syncAbort.abort(); pendingAbort?.abort(); };
  }, [syncRunning, fetchArticles]);

  // Multi-category + tag + keyword + search filtering (memoized)
  const filteredArticles = useMemo(() => {
    let result = !presetFilter.includes("all") && presetFilter.length > 1
      ? articles.filter((a) => presetFilter.includes(a.category as Category))
      : articles;

    if (presetTags.length > 0) {
      result = filterByTags(result, presetTags);
    }

    if (presetKeywords.length > 0) {
      const kwLower = presetKeywords.map((k) => k.toLowerCase());
      result = result.filter((a) => {
        const text = `${a.title} ${a.summary || ""}`.toLowerCase();
        return kwLower.some((kw) => {
          // Multi-word: substring match
          if (kw.includes(" ")) return text.includes(kw);
          // Single word: word boundary
          try { return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text); }
          catch { return text.includes(kw); }
        });
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((a) => {
        const text = `${a.title} ${a.summary || ""} ${a.source}`.toLowerCase();
        return text.includes(q);
      });
    }

    // Filter out dismissed articles
    if (dismissedIds.size > 0) {
      result = result.filter((a) => !dismissedIds.has(a.id));
    }

    return result;
  }, [articles, presetFilter, presetTags, presetKeywords, search, dismissedIds]);

  // Split articles by section + compute tab data (memoized)
  const { tabArticles, tabCounts } = useMemo(() => {
    const followedArticles = filteredArticles.filter((a) => a.section === "followed");
    const relevantArticles = filteredArticles.filter((a) => a.section === "relevant");
    const discoverArticles = filteredArticles.filter((a) => !a.section || a.section === "discover");

    const relevantIds = new Set(relevantArticles.map((a) => a.id));
    const uniqueFollowed = followedArticles.filter((a) => !relevantIds.has(a.id));

    let currentTabArticles: Article[];
    if (activeTab === "suivis") {
      // Sources tab: only articles from followed sources
      currentTabArticles = [...followedArticles].sort((a, b) => b.score - a.score);
    } else if (activeTab === "amis") {
      currentTabArticles = friendActivity;
    } else if (activeTab === "discover") {
      // Explorer: only discover articles (not relevant/followed)
      currentTabArticles = [...discoverArticles].sort((a, b) => b.score - a.score);
    } else {
      // "Pour toi": ONLY relevant + followed articles (discover stays in Explorer tab)
      const feedArticles = [...followedArticles, ...relevantArticles.filter((a) => !followedArticles.some((f) => f.id === a.id))];
      currentTabArticles = feedArticles.sort((a, b) => b.score - a.score);
    }

    return {
      tabArticles: currentTabArticles,
      tabCounts: {
        feed: followedArticles.length + relevantArticles.filter((a) => !followedArticles.some((f) => f.id === a.id)).length,
        suivis: followedArticles.length,
        amis: friendActivity.length,
        discover: discoverArticles.length,
      } as Record<FeedTab, number>,
    };
  }, [filteredArticles, activeTab, friendActivity]);

  const allDisplayed = tabArticles;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, allDisplayed.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if ((e.key === "o" || e.key === "Enter") && activeIndex >= 0 && activeIndex < allDisplayed.length) {
        e.preventDefault();
        const article = allDisplayed[activeIndex];
        router.push(`/article/${article.id}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allDisplayed, activeIndex, router]);

  // Scroll active article into view
  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= allDisplayed.length) return;
    const id = allDisplayed[activeIndex].id;
    const el = document.querySelector(`[data-article-id="${id}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex, allDisplayed]);

  // Apply advanced filters + group by date (memoized)
  const { displayArticles, dateGroups } = useMemo(() => {
    let result = tabArticles;
    if (sourceFilter !== "all") result = result.filter((a) => matchesSourceFilter(a.platform, sourceFilter));
    if (timeFilter !== "all") result = result.filter((a) => matchesTimeFilter(a.foundAt, timeFilter));
    if (minScoreFilter > 0) result = result.filter((a) => a.score >= minScoreFilter);
    return { displayArticles: result, dateGroups: groupByDate(result) };
  }, [tabArticles, sourceFilter, timeFilter, minScoreFilter]);

  const TAB_CONFIG: { key: FeedTab; label: string; icon: string; hint: string }[] = [
    { key: "feed", label: "Pour toi", icon: "◉", hint: "Articles pertinents pour ta veille" },
    { key: "suivis", label: "Sources", icon: "★", hint: "Articles de tes sources suivies" },
    { key: "amis", label: "Amis", icon: "♥", hint: "Activite de tes amis" },
    { key: "discover", label: "Explorer", icon: "◇", hint: "Decouvrir d'autres articles tech" },
  ];

  return (
    <div className="py-5">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 py-2 mb-4 border-b border-border backdrop-blur-xl bg-background/90">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setActiveIndex(-1); }}
              title={tab.hint}
              className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-mono transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                activeTab === tab.key
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface"
              }`}
            >
              <span className="text-[10px]">{tab.icon}</span>
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-mono ${
                  activeTab === tab.key
                    ? "bg-primary/20 text-primary"
                    : "bg-surface text-muted-foreground/50"
                }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <div className="shrink-0 ml-auto flex items-center gap-1.5">
            {syncRunning ? (
              <span className="flex items-center gap-1 text-[10px] text-primary font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                mise a jour...
              </span>
            ) : lastSync ? (
              <span className="text-[10px] text-muted-foreground/40 font-mono" title="Les articles sont mis a jour toutes les heures par notre IA">
                maj {timeAgo(new Date(lastSync).toISOString())}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Search bar + filter toggle */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setActiveIndex(-1); }} />
          </div>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            aria-label={filtersOpen ? "Masquer les filtres" : "Afficher les filtres"}
            aria-expanded={filtersOpen}
            className={`relative shrink-0 rounded-xl border px-3 py-2.5 text-[11px] font-mono transition-all ${
              filtersOpen
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/20"
            }`}
          >
            filtres
            {(sourceFilter !== "all" || timeFilter !== "all" || minScoreFilter > 0) && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        </div>
        {filtersOpen && (
          <div className="rounded-xl border border-border bg-card px-4">
            <AdvancedFilters
              sourceFilter={sourceFilter}
              setSourceFilter={setSourceFilter}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              minScore={minScoreFilter}
              setMinScore={setMinScoreFilter}
            />
          </div>
        )}
      </div>

      {loading || (activeTab === "amis" && friendLoading) ? (
        <div className="space-y-4 stagger-in">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-5">
              <div className="flex gap-3 mb-3">
                <div className="skeleton h-8 w-8 rounded-xl shrink-0" />
                <div className="flex-1">
                  <div className="flex gap-2 mb-2">
                    <div className="skeleton h-3 w-10" />
                    <div className="skeleton h-3 w-16" />
                  </div>
                  <div className="skeleton h-5 w-full mb-2" />
                  <div className="skeleton h-5 w-4/5" />
                </div>
              </div>
              <div className="skeleton h-4 w-full mb-1.5" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyber/10 mb-4">
            <span className="text-cyber text-[18px]">!</span>
          </div>
          <p className="text-[14px] text-foreground mb-2">{error}</p>
          <button onClick={() => fetchArticles(1)} className="text-[13px] text-primary hover:underline font-mono">reessayer</button>
        </div>
      ) : displayArticles.length === 0 ? (
        <div className="text-center py-20">
          {search.trim() ? (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-4">
                <span className="text-muted-foreground text-[18px]">?</span>
              </div>
              <p className="text-[14px] text-foreground mb-2">Aucun resultat pour &quot;{search}&quot;</p>
              <button onClick={() => setSearch("")} className="text-[13px] text-primary hover:underline font-mono">effacer la recherche</button>
            </>
          ) : activeTab === "suivis" ? (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-4">
                <span className="text-muted-foreground text-[18px]">★</span>
              </div>
              <p className="text-[14px] text-foreground mb-1">Aucune source suivie</p>
              <p className="text-[13px] text-muted-foreground">Les blogs et comptes que tu suis apparaitront ici</p>
            </>
          ) : activeTab === "amis" ? (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-4">
                <span className="text-muted-foreground text-[18px]">♥</span>
              </div>
              <p className="text-[14px] text-foreground mb-1">Pas encore d&apos;activite</p>
              <p className="text-[13px] text-muted-foreground">Les likes et saves de tes amis apparaitront ici</p>
            </>
          ) : syncRunning ? (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              </div>
              <p className="text-[14px] text-foreground mb-1">Sync en cours</p>
              <p className="text-[13px] text-muted-foreground">Les articles arrivent...</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-4">
                <span className="text-muted-foreground text-[18px]">?</span>
              </div>
              <p className="text-[14px] text-foreground mb-2">Aucun article</p>
              <Link href="/" className="text-[13px] text-primary hover:underline font-mono">configurer ma veille</Link>
            </>
          )}
        </div>
      ) : (
        <div className="stagger-in">
          {/* Articles by date — first article gets FeaturedCard */}
          {dateGroups.map((group, gi) => {
            const groupStartIndex = displayArticles.indexOf(group.articles[0]);
            return (
              <div key={group.label}>
                <DateSection label={group.label} />
                <div className="space-y-3">
                  {group.articles.map((article, i) => {
                    const idx = groupStartIndex + i;
                    const isFirst = gi === 0 && i === 0 && !search.trim();
                    const Card = isFirst ? FeaturedCard : ArticleCard;
                    return (
                      <Card
                        key={article.id}
                        article={article}
                        isActive={activeIndex === idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onDismiss={handleDismiss}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
          )}
          {!hasMore && articles.length > 0 && (
            <p className="text-center text-[11px] text-muted-foreground/25 font-mono py-4">fin des articles</p>
          )}
        </div>
      )}
    </div>
  );
}
