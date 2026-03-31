"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { parseSummary, timeAgo, CATEGORY_LABELS, CATEGORY_TEXT_COLORS, type Category } from "@/lib/data";
import { ScoreBadge } from "@/components/score-badge";
import { Header } from "@/components/header";
import { discordAvatarUrl } from "@/lib/auth-context";

type ProfileUser = {
  username: string;
  avatar: string | null;
  discordId: string | null;
  createdAt: string;
  likeCount: number;
  bookmarkCount: number;
};

type ProfileArticle = {
  id: string;
  title: string;
  summary: string | null;
  score: number;
  category: string;
  source: string;
  foundAt: string;
  url: string;
  likedAt?: string;
  savedAt?: string;
};

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [likes, setLikes] = useState<ProfileArticle[]>([]);
  const [bookmarks, setBookmarks] = useState<ProfileArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"likes" | "saves">("likes");

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`/veille/api/users/${encodeURIComponent(username)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setProfileUser(data.user);
        setLikes(data.likes || []);
        setBookmarks(data.bookmarks || []);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [username]);

  const avatarUrl = profileUser?.discordId && profileUser?.avatar
    ? discordAvatarUrl({ discordId: profileUser.discordId, avatar: profileUser.avatar }, 128)
    : null;

  const articles = tab === "likes" ? likes : bookmarks;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        {loading ? (
          <div className="py-16 space-y-4">
            <div className="flex items-center gap-4">
              <div className="skeleton w-16 h-16 rounded-full" />
              <div className="space-y-2">
                <div className="skeleton h-5 w-32" />
                <div className="skeleton h-3 w-48" />
              </div>
            </div>
            <div className="skeleton h-10 w-full mt-6" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-24 w-full" />
            ))}
          </div>
        ) : notFound ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="17" y1="11" x2="22" y2="11" />
              </svg>
            </div>
            <p className="text-[16px] text-foreground font-medium mb-2">Profil introuvable ou prive</p>
            <p className="text-[13px] text-muted-foreground/50 font-mono mb-6">
              Cet utilisateur n&apos;existe pas ou son profil n&apos;est pas public.
            </p>
            <Link href="/feed" className="text-[13px] text-primary hover:underline font-mono">
              retour au feed
            </Link>
          </div>
        ) : profileUser ? (
          <div className="py-6 sm:py-8">
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-6">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center text-primary text-[24px] font-bold uppercase shrink-0">
                  {profileUser.username.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold text-foreground truncate">
                  {profileUser.username}
                </h1>
                <p className="text-[12px] text-muted-foreground/50 font-mono">
                  membre depuis {new Date(profileUser.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[11px] text-muted-foreground/40 font-mono">
                    {profileUser.likeCount} like{profileUser.likeCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground/40 font-mono">
                    {profileUser.bookmarkCount} save{profileUser.bookmarkCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-5 border-b border-border pb-0">
              <button
                onClick={() => setTab("likes")}
                className={`px-4 py-2.5 text-[12px] font-mono font-medium transition-all border-b-2 -mb-px ${
                  tab === "likes"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground/50 border-transparent hover:text-foreground"
                }`}
              >
                likes ({likes.length})
              </button>
              <button
                onClick={() => setTab("saves")}
                className={`px-4 py-2.5 text-[12px] font-mono font-medium transition-all border-b-2 -mb-px ${
                  tab === "saves"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground/50 border-transparent hover:text-foreground"
                }`}
              >
                saves ({bookmarks.length})
              </button>
            </div>

            {/* Article list */}
            {articles.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[13px] text-muted-foreground/40 font-mono">
                  {tab === "likes" ? "Aucun like" : "Aucun save"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 stagger-in">
                {articles.map((article) => {
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

            {/* Back link */}
            <div className="mt-8 text-center">
              <Link href="/feed" className="text-[12px] text-muted-foreground/40 hover:text-primary font-mono transition-colors">
                retour au feed
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
