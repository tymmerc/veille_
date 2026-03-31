"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TEXT_COLORS,
  parseSummary,
  timeAgo,
  type Category,
} from "@/lib/data";
import { ScoreBadge } from "@/components/score-badge";

type BookmarkedArticle = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  source: string;
  score: number;
  foundAt: string;
  bookmarkedAt: string;
  tags: string[];
};

// Shared suggestions cache across all TagEditor instances
let _suggestionsCache: string[] | null = null;
let _suggestionsFetching = false;
let _suggestionsListeners: Array<(tags: string[]) => void> = [];

function fetchSuggestionsOnce(cb: (tags: string[]) => void) {
  if (_suggestionsCache) {
    cb(_suggestionsCache);
    return;
  }
  _suggestionsListeners.push(cb);
  if (_suggestionsFetching) return;
  _suggestionsFetching = true;
  fetch("/veille/api/bookmarks/tags/suggestions")
    .then((r) => r.json())
    .then((data) => {
      _suggestionsCache = data.tags || [];
      for (const listener of _suggestionsListeners) listener(_suggestionsCache!);
      _suggestionsListeners = [];
    })
    .catch(() => {
      _suggestionsCache = [];
      for (const listener of _suggestionsListeners) listener([]);
      _suggestionsListeners = [];
    });
}

function TagEditor({ articleId, tags, onUpdate }: { articleId: string; tags: string[]; onUpdate: (tags: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adding && tagInputRef.current) tagInputRef.current.focus();
  }, [adding]);

  const filteredSuggestions = suggestions
    .filter((s) => !tags.includes(s))
    .filter((s) => !newTag || s.startsWith(newTag.trim().toLowerCase()));

  const addTag = async (value?: string) => {
    const tag = (value ?? newTag).trim().toLowerCase();
    setShowSuggestions(false);
    if (!tag || tags.includes(tag) || tags.length >= 5) {
      setNewTag("");
      setAdding(false);
      return;
    }
    const updated = [...tags, tag];
    onUpdate(updated);
    setNewTag("");
    setAdding(false);
    await fetch("/veille/api/bookmarks/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, tags: updated }),
    });
  };

  const removeTag = async (tag: string) => {
    const updated = tags.filter(t => t !== tag);
    onUpdate(updated);
    await fetch("/veille/api/bookmarks/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, tags: updated }),
    });
  };

  const handleFocus = () => {
    fetchSuggestionsOnce((tags) => setSuggestions(tags));
    setShowSuggestions(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking inside the dropdown
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
    addTag();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2" onClick={(e) => e.stopPropagation()}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary/60 px-2 py-0.5 text-[10px] font-mono"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="ml-0.5 text-primary/30 hover:text-primary/80 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}
      {adding ? (
        <div className="relative">
          <input
            ref={tagInputRef}
            type="text"
            value={newTag}
            onChange={(e) => { setNewTag(e.target.value); setShowSuggestions(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
              if (e.key === "Escape") { setNewTag(""); setAdding(false); setShowSuggestions(false); }
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxLength={20}
            placeholder="tag..."
            className="rounded-full bg-surface border border-border px-2 py-0.5 text-[10px] font-mono text-foreground outline-none w-16 focus:border-primary/30"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-10 bg-card border border-border rounded-lg shadow-lg mt-1 max-h-32 overflow-y-auto"
            >
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                  className="block w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-muted cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tags.length < 5 ? (
        <button
          onClick={() => setAdding(true)}
          className="rounded-full bg-surface/50 hover:bg-surface text-muted-foreground/30 hover:text-muted-foreground/60 px-1.5 py-0.5 text-[10px] font-mono transition-colors"
        >
          +
        </button>
      ) : null}
    </div>
  );
}

export default function BookmarksPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<BookmarkedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [sort, setSort] = useState<"recent" | "score">("recent");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const fetchBookmarks = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/veille/api/bookmarks?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.articles || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur de chargement");
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  const handleRemove = async (articleId: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    try {
      await fetch(`/veille/api/articles/${articleId}/bookmark`, { method: "POST" });
    } catch {
      fetchBookmarks();
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => (a.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [articles]);

  const handleTagUpdate = (articleId: string, tags: string[]) => {
    setArticles((prev) => prev.map((a) => a.id === articleId ? { ...a, tags } : a));
  };

  const filtered = articles
    .filter((a) => filter === "all" || a.category === filter)
    .filter((a) => !tagFilter || (a.tags || []).includes(tagFilter))
    .sort((a, b) => {
      if (sort === "score") return (b.score || 0) - (a.score || 0);
      return new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime();
    });

  return (
    <div className="py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight text-foreground">
            saves
          </h1>
          {articles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground/50 font-mono">{articles.length}</span>
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-surface transition-all"
                  title="Exporter"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 rounded-xl border border-border bg-popover py-1 min-w-[120px] shadow-lg card-shadow z-30">
                    {[
                      { label: "JSON", format: "json" },
                      { label: "CSV", format: "csv" },
                      { label: "Markdown", format: "markdown" },
                    ].map((opt) => (
                      <button
                        key={opt.format}
                        onClick={() => {
                          setExportOpen(false);
                          window.open(`/veille/api/bookmarks/export?format=${opt.format}`, "_blank");
                        }}
                        className="flex items-center w-full px-3 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors font-mono"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filters + sort */}
        {articles.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setFilter(cat.key)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all font-mono ${
                      filter === cat.key
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSort(sort === "recent" ? "score" : "recent")}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface transition-all font-mono ml-2"
              >
                {sort === "recent" ? "recent" : "score"}
              </button>
            </div>
            {allTags.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setTagFilter(null)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-mono transition-all ${
                    tagFilter === null
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-surface"
                  }`}
                >
                  tous
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-mono transition-all ${
                      tagFilter === tag
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-surface"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 stagger-in">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-5">
                <div className="flex gap-2 mb-3">
                  <div className="skeleton h-3 w-10" />
                  <div className="skeleton h-3 w-16" />
                </div>
                <div className="skeleton h-5 w-full mb-2" />
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
            <button onClick={fetchBookmarks} className="text-[13px] text-primary hover:underline font-mono">
              reessayer
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-[14px] text-foreground mb-2">
              {articles.length === 0 ? "Aucun article sauvegarde" : "Aucun resultat"}
            </p>
            {articles.length === 0 && (
              <Link href="/feed" className="text-[13px] text-primary hover:underline font-mono">
                decouvrir des articles
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 stagger-in">
            {filtered.map((article) => {
              const cat = article.category as Category;
              const { hook } = parseSummary(article.summary);
              return (
                <div
                  key={article.id}
                  className="group rounded-2xl border border-border bg-card card-shadow overflow-hidden card-hover cursor-pointer"
                  onClick={() => router.push(`/article/${article.id}`)}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <ScoreBadge score={article.score} category={cat} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${
                            CATEGORY_TEXT_COLORS[cat] || "text-muted-foreground"
                          }`}>
                            {CATEGORY_LABELS[cat] || cat}
                          </span>
                          <span className="text-[11px] text-muted-foreground/50">{article.source}</span>
                          <span className="text-[11px] text-muted-foreground/40">{timeAgo(article.foundAt)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(article.id); }}
                            className="ml-auto p-1 text-muted-foreground/20 hover:text-cyber transition-colors opacity-0 group-hover:opacity-100"
                            title="Retirer"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <h3 className="text-[15px] sm:text-[16px] font-semibold text-foreground leading-snug">
                          {article.title}
                        </h3>
                        {hook && (
                          <p className="mt-1.5 text-[13px] text-muted-foreground line-clamp-2">{hook}</p>
                        )}
                        <TagEditor
                          articleId={article.id}
                          tags={article.tags || []}
                          onUpdate={(tags) => handleTagUpdate(article.id, tags)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
