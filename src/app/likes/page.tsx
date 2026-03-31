"use client";

import { useEffect, useState, useCallback } from "react";
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

type LikedArticle = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  source: string;
  score: number;
  foundAt: string;
  likedAt: string;
};

export default function LikesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<LikedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [sort, setSort] = useState<"recent" | "score">("recent");

  const fetchLikes = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/veille/api/likes?limit=50")
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

  useEffect(() => { fetchLikes(); }, [fetchLikes]);

  const handleRemove = async (articleId: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    try {
      await fetch(`/veille/api/articles/${articleId}/like`, { method: "POST" });
    } catch {
      fetchLikes();
    }
  };

  const filtered = articles
    .filter((a) => filter === "all" || a.category === filter)
    .sort((a, b) => {
      if (sort === "score") return (b.score || 0) - (a.score || 0);
      return new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime();
    });

  return (
    <div className="py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight text-foreground">
          likes
        </h1>
        {articles.length > 0 && (
          <span className="text-[12px] text-muted-foreground/50 font-mono">{articles.length}</span>
        )}
      </div>

      {articles.length > 0 && (
        <div className="flex items-center justify-between mb-5">
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
          <button onClick={fetchLikes} className="text-[13px] text-primary hover:underline font-mono">
            reessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <p className="text-[14px] text-foreground mb-2">
            {articles.length === 0 ? "Aucun article like" : "Aucun resultat"}
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
