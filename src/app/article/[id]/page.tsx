"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Category } from "@/lib/data";
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_COLORS,
  parseSummary,
  timeAgo,
} from "@/lib/data";
import { ActionBar } from "@/components/action-bar";
import { useAuth } from "@/lib/auth-context";
import { SourceIcon } from "@/components/source-icon";
import { ScoreBadge } from "@/components/score-badge";

function ExternalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

type ArticleDetail = {
  id: string;
  title: string;
  titleOriginal?: string;
  summary: string | null;
  source: string;
  platform?: string;
  url: string;
  category: string;
  score: number;
  foundAt: string;
  liked: boolean;
  bookmarked: boolean;
  likeCount: number;
};

type RelatedArticle = {
  id: string;
  title: string;
  url: string;
  score: number;
  category: string;
  source: string;
  foundAt: string;
};

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);

  const fetchArticle = useCallback(() => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    fetch(`/veille/api/articles/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.article) setArticle(data.article);
        else setError("Article introuvable");
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur de chargement");
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => { fetchArticle(); }, [fetchArticle]);

  // Mark as read
  useEffect(() => {
    if (!params.id || !user) return;
    fetch(`/veille/api/articles/${params.id}/read`, { method: "POST" }).catch(() => {});
  }, [params.id, user]);

  // Fetch related articles
  useEffect(() => {
    if (!params.id) return;
    fetch(`/veille/api/articles/${params.id}/related`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.articles) setRelatedArticles(data.articles);
      })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/feed");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  if (loading) {
    return (
      <div className="py-6">
        <div className="rounded-2xl bg-card border border-border p-6 sm:p-8">
          <div className="flex gap-2 mb-6">
            <div className="skeleton h-5 w-12" />
            <div className="skeleton h-5 w-20" />
            <div className="ml-auto skeleton h-10 w-10 rounded-xl" />
          </div>
          <div className="skeleton h-8 w-full mb-3" />
          <div className="skeleton h-8 w-3/4 mb-8" />
          <div className="skeleton h-5 w-full mb-2" />
          <div className="skeleton h-5 w-full mb-2" />
          <div className="skeleton h-5 w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyber/10 mb-2">
          <span className="text-cyber text-[18px]">!</span>
        </div>
        <p className="text-[14px] text-foreground">{error || "Article introuvable"}</p>
        {error === "Erreur de chargement" ? (
          <button onClick={fetchArticle} className="text-[13px] text-primary hover:underline font-mono">reessayer</button>
        ) : (
          <button onClick={() => router.push("/feed")} className="text-[13px] text-primary hover:underline font-mono">retour au feed</button>
        )}
      </div>
    );
  }

  const cat = article.category as Category;
  const { hook, detail } = parseSummary(article.summary);

  const gradientClass: Record<string, string> = {
    ia: "from-rose/4 via-transparent to-transparent",
    cyber: "from-cyber/4 via-transparent to-transparent",
    tech: "from-tech/4 via-transparent to-transparent",
  };

  return (
    <div className="py-6">
      {/* Main card */}
      <div className="relative rounded-2xl border border-border bg-card card-shadow overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass[cat] || "from-transparent"} pointer-events-none`} />

        <div className="relative p-5 sm:p-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground mb-6 font-mono rounded-lg hover:bg-surface px-2 py-1 -ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" x2="5" y1="12" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            retour
          </button>

          <div className="flex items-start gap-3.5 mb-5">
            <SourceIcon platform={article.platform} source={article.source} score={article.score} size="md" />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className={`text-[11px] font-bold uppercase tracking-wider font-mono ${CATEGORY_TEXT_COLORS[cat] || "text-muted-foreground"}`}>
                {CATEGORY_LABELS[cat] || cat}
              </span>
              <span className="text-[12px] text-muted-foreground/50">{article.source}</span>
              <span className="text-[12px] text-muted-foreground/40">{timeAgo(article.foundAt)}</span>
              <ScoreBadge score={article.score} category={article.category} size="md" />
            </div>
          </div>

          <h1 className="text-[22px] sm:text-[28px] lg:text-[32px] font-bold leading-[1.2] tracking-tight text-foreground">
            {article.title}
          </h1>
          {article.titleOriginal && article.titleOriginal !== article.title && (
            <p className="mt-1.5 text-[13px] text-muted-foreground/40 font-mono italic">{article.titleOriginal}</p>
          )}

          {hook && (
            <p className="mt-5 text-[15px] sm:text-[17px] leading-relaxed text-foreground/80">{hook}</p>
          )}

          {detail && detail !== hook && (
            <div className="mt-6 pt-6 border-t border-border/50 text-[14px] sm:text-[15px] leading-[1.8] text-muted-foreground">
              {detail.split("\n").map((p, i) => (
                <p key={i} className={i > 0 ? "mt-4" : ""}>{p}</p>
              ))}
            </div>
          )}

          {user && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <ActionBar articleId={article.id} liked={article.liked} bookmarked={article.bookmarked} likeCount={article.likeCount} size="md" />
            </div>
          )}
        </div>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card card-shadow p-4 sm:p-5 transition-all hover:bg-surface hover:border-border-hover card-hover group"
      >
        <div className="flex-1">
          <span className="text-[14px] font-medium text-foreground">Lire l&apos;article original</span>
          <span className="block text-[12px] text-muted-foreground/50 font-mono mt-0.5 truncate">
            {(() => { try { return new URL(article.url).hostname; } catch { return article.url; } })()}
          </span>
        </div>
        <ExternalIcon />
      </a>

      {relatedArticles.length > 0 && (
        <div className="border-t border-border mt-8 pt-6">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-4 font-mono">articles similaires</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedArticles.map((ra) => (
              <Link
                key={ra.id}
                href={`/article/${ra.id}`}
                className="group rounded-xl border border-border bg-card p-4 transition-all hover:bg-surface hover:border-border-hover card-hover"
              >
                <div className="flex items-start gap-3">
                  <ScoreBadge score={ra.score} category={ra.category} size="sm" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {ra.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-muted-foreground/50 font-mono">{ra.source}</span>
                      <span className="text-[11px] text-muted-foreground/40">{timeAgo(ra.foundAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
