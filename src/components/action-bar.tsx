"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth, discordAvatarUrl } from "@/lib/auth-context";

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

type FriendForShare = { id: string; username: string; avatar: string | null; discordId: string | null };

function ShareDropdown({ articleId, onClose }: { articleId: string; onClose: () => void }) {
  const [friends, setFriends] = useState<FriendForShare[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/veille/api/friends").then((r) => r.json()).then((d) => setFriends(d.friends || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const [sending, setSending] = useState(false);

  const share = async (friendId: string) => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/veille/api/friends/shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, articleId, message: message.trim() || undefined }),
      });
      if (res.ok) {
        setSent((prev) => new Set(prev).add(friendId));
        setSelectedFriend(null);
        setMessage("");
      }
    } catch {} finally {
      setSending(false);
    }
  };

  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 rounded-xl border border-border bg-popover min-w-[220px] shadow-lg card-shadow z-50">
      <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider text-muted-foreground/40 font-mono font-bold">Envoyer a</p>
      {friends.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground/50 font-mono">Aucun ami</p>
      ) : (
        <div className="px-1 pb-1">
          {friends.map((f) => {
            const url = discordAvatarUrl(f, 48);
            const isSelected = selectedFriend === f.id;
            return (
              <div key={f.id}>
                <button
                  onClick={() => {
                    if (sent.has(f.id)) return;
                    setSelectedFriend(isSelected ? null : f.id);
                  }}
                  disabled={sent.has(f.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors disabled:opacity-40 ${
                    isSelected ? "bg-primary/[0.06]" : "hover:bg-surface"
                  }`}
                >
                  {url ? (
                    <img src={url} alt={`Avatar de ${f.username}`} className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary uppercase">{f.username.charAt(0)}</div>
                  )}
                  <span className="text-[11px] text-foreground font-mono truncate flex-1">{f.username}</span>
                  {sent.has(f.id) && <span className="text-[9px] text-primary font-mono">envoye</span>}
                </button>
                {isSelected && (
                  <div className="px-2 pb-1.5 flex gap-1.5">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && share(f.id)}
                      placeholder="un message..."
                      autoFocus
                      className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 font-mono"
                    />
                    <button
                      onClick={() => share(f.id)}
                      className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-[10px] text-primary font-mono hover:bg-primary/25 transition-colors"
                    >
                      envoyer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DismissIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function ActionBar({
  articleId,
  liked: initialLiked = false,
  bookmarked: initialBookmarked = false,
  likeCount: initialLikeCount = 0,
  size = "sm",
  onDismiss,
}: {
  articleId: string;
  liked?: boolean;
  bookmarked?: boolean;
  likeCount?: number;
  size?: "sm" | "md";
  onDismiss?: (articleId: string) => void;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [showShare, setShowShare] = useState(false);

  const handleLike = useCallback(async () => {
    if (!user) return;
    const prev = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);

    try {
      const res = await fetch(`/veille/api/articles/${articleId}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
      window.dispatchEvent(new CustomEvent("veille:stats-changed"));
    } catch {
      setLiked(prev);
      setLikeCount(prevCount);
    }
  }, [user, liked, likeCount, articleId]);

  const handleBookmark = useCallback(async () => {
    if (!user) return;
    const prev = bookmarked;
    setBookmarked(!bookmarked);

    try {
      const res = await fetch(`/veille/api/articles/${articleId}/bookmark`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBookmarked(data.bookmarked);
      window.dispatchEvent(new CustomEvent("veille:stats-changed"));
    } catch {
      setBookmarked(prev);
    }
  }, [user, bookmarked, articleId]);

  if (!user) return null;

  const iconSize = size === "md" ? "scale-110" : "";

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleLike}
        className={`flex items-center gap-1 transition-all active:scale-125 ${liked ? "text-primary" : "text-muted-foreground hover:text-foreground"} ${iconSize}`}
        aria-label={liked ? "Retirer le like" : "Liker"}
        aria-pressed={liked}
      >
        <span className={liked ? "animate-pop" : ""}><HeartIcon filled={liked} /></span>
        {likeCount > 0 && (
          <span className="text-[11px] sm:text-[12px] tabular-nums font-mono">{likeCount}</span>
        )}
      </button>

      <button
        onClick={handleBookmark}
        className={`transition-all active:scale-125 ${bookmarked ? "text-primary" : "text-muted-foreground hover:text-foreground"} ${iconSize}`}
        aria-label={bookmarked ? "Retirer le bookmark" : "Bookmarker"}
        aria-pressed={bookmarked}
      >
        <span className={bookmarked ? "animate-pop" : ""}><BookmarkIcon filled={bookmarked} /></span>
      </button>

      <div className="relative">
        <button
          onClick={() => setShowShare(!showShare)}
          className={`transition-colors ${showShare ? "text-primary" : "text-muted-foreground hover:text-foreground"} ${iconSize}`}
          aria-label="Partager"
          aria-expanded={showShare}
        >
          <ShareIcon />
        </button>
        {showShare && <ShareDropdown articleId={articleId} onClose={() => setShowShare(false)} />}
      </div>

      {onDismiss && (
        <button
          onClick={() => onDismiss(articleId)}
          className={`transition-colors text-muted-foreground/40 hover:text-muted-foreground ${iconSize}`}
          aria-label="Masquer cet article"
          title="Pas interesse"
        >
          <DismissIcon />
        </button>
      )}
    </div>
  );
}
