"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, discordAvatarUrl } from "@/lib/auth-context";

type Friend = { id: string; username: string; avatar: string | null; discordId: string | null };
type PendingRequest = Friend & { requestId: string };
type Reply = { id: string; userId: string; username?: string; message: string; createdAt: string };
type ActivityItem = {
  type: string;
  user: { id: string; username: string; avatar: string | null; discordId: string | null };
  article: { id: string; title: string; category: string; source: string; score: number };
  at: string;
};
type Share = {
  id: string;
  from: Friend;
  to: Friend;
  article: { id: string; title: string; category: string; source: string; score: number };
  message?: string | null;
  createdAt: string;
  seen: boolean;
  replyCount?: number;
};

type Conversation = {
  friend: Friend;
  shares: Share[];
  lastActivity: string;
  unreadCount: number;
};

function Avatar({ user, size = 32 }: { user: { discordId: string | null; avatar: string | null; username: string }; size?: number }) {
  const url = user.discordId && user.avatar ? discordAvatarUrl(user as { discordId: string; avatar: string | null }, size * 2) : null;
  const px = `${size}px`;
  if (url) return <img src={url} alt={`Avatar de ${user.username}`} className="rounded-full object-cover shrink-0" style={{ width: px, height: px }} />;
  return (
    <div className="rounded-full bg-primary/15 flex items-center justify-center text-primary uppercase font-bold shrink-0" style={{ width: px, height: px, fontSize: `${size * 0.4}px` }}>
      {user.username.charAt(0)}
    </div>
  );
}

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

function groupSharesByFriend(shares: Share[], userId: string): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const share of shares) {
    const friend = share.from.id === userId ? share.to : share.from;
    const key = friend.id;
    if (!map.has(key)) {
      map.set(key, { friend, shares: [], lastActivity: share.createdAt, unreadCount: 0 });
    }
    const conv = map.get(key)!;
    conv.shares.push(share);
    if (!share.seen && share.from.id !== userId) conv.unreadCount++;
    if (new Date(share.createdAt).getTime() > new Date(conv.lastActivity).getTime()) {
      conv.lastActivity = share.createdAt;
    }
  }
  const convs = Array.from(map.values());
  for (const conv of convs) {
    conv.shares.sort((a: Share, b: Share) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

const CAT_ACCENT: Record<string, string> = {
  ia: "bg-primary/8 border-primary/20",
  cyber: "bg-rose/8 border-rose/20",
  tech: "bg-tech/8 border-tech/20",
};
const CAT_SCORE: Record<string, string> = {
  ia: "text-primary",
  cyber: "text-rose",
  tech: "text-tech",
};

function ConversationThread({
  conversation,
  userId,
  isExpanded,
  onToggle,
}: {
  conversation: Conversation;
  userId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const { friend, shares, lastActivity, unreadCount } = conversation;
  const lastShare = shares[shares.length - 1];
  const lastPreview = lastShare.message || lastShare.article.title;

  const [expandedShare, setExpandedShare] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadReplies = useCallback((shareId: string) => {
    fetch(`/veille/api/friends/shared/${shareId}/replies`)
      .then((r) => r.json())
      .then((d) => setReplies((prev) => ({ ...prev, [shareId]: d.replies || [] })))
      .catch(() => {});
  }, []);

  const sendReply = async (shareId: string) => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/veille/api/friends/shared/${shareId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies((prev) => ({
          ...prev,
          [shareId]: [...(prev[shareId] || []), data.reply],
        }));
        setReplyText("");
      }
    } catch {} finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (isExpanded && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isExpanded]);

  return (
    <div className="rounded-xl overflow-hidden transition-all">
      {/* Conversation header — collapsed preview */}
      <button
        onClick={onToggle}
        className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-all rounded-xl ${
          isExpanded ? "bg-primary/[0.04]" : "hover:bg-surface/40"
        }`}
      >
        <div className="relative shrink-0">
          <Avatar user={friend} size={32} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-rose text-[8px] text-white font-bold flex items-center justify-center px-1 shadow-sm">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[12px] text-foreground font-mono font-semibold truncate">
              {friend.username}
            </span>
            <span className="text-[9px] text-muted-foreground/25 font-mono shrink-0">
              {timeAgoShort(lastActivity)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/40 font-mono truncate mt-0.5">
            {lastShare.from.id === userId ? <span className="text-primary/40">toi: </span> : ""}
            {lastPreview}
          </p>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-muted-foreground/15 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded chat thread */}
      {isExpanded && (
        <div className="mx-1 mb-1 rounded-lg border border-border/30 bg-background/50 overflow-hidden">
          <div className="px-2.5 py-2 space-y-3 max-h-[360px] overflow-y-auto scrollbar-none">
            {shares.map((share, idx) => {
              const isMine = share.from.id === userId;
              const shareReplies = replies[share.id] || [];
              const isShareExpanded = expandedShare === share.id;
              const catAccent = CAT_ACCENT[share.article.category] || "bg-surface/50 border-border/30";
              const catScore = CAT_SCORE[share.article.category] || "text-muted-foreground";

              // Show date separator if time gap > 1 hour
              const prev = idx > 0 ? shares[idx - 1] : null;
              const showTime = !prev || (new Date(share.createdAt).getTime() - new Date(prev.createdAt).getTime() > 3600000);

              return (
                <div key={share.id}>
                  {/* Time separator */}
                  {showTime && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-border/20" />
                      <span className="text-[8px] text-muted-foreground/20 font-mono shrink-0">
                        {timeAgoShort(share.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-border/20" />
                    </div>
                  )}

                  {/* Chat row */}
                  <div className={`flex gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar for friend messages only */}
                    {!isMine && <Avatar user={friend} size={20} />}

                    <div className={`max-w-[85%] space-y-1 ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                      {/* Text message bubble */}
                      {share.message && (
                        <div className={`rounded-2xl px-3 py-1.5 text-[11px] leading-snug ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-surface text-foreground/80 rounded-bl-md"
                        }`}>
                          {share.message}
                        </div>
                      )}

                      {/* Article link preview card */}
                      <button
                        onClick={() => router.push(`/article/${share.article.id}`)}
                        className={`w-full text-left rounded-xl border p-2 transition-all hover:brightness-95 active:scale-[0.98] ${catAccent}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-foreground/85 leading-snug line-clamp-2 font-medium">
                              {share.article.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[8px] text-muted-foreground/35 font-mono truncate">{share.article.source}</span>
                              <span className={`text-[9px] font-mono font-bold ${catScore}`}>{share.article.score}/10</span>
                            </div>
                          </div>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20 shrink-0 mt-0.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" x2="21" y1="14" y2="3" />
                          </svg>
                        </div>
                      </button>

                      {/* Reply button */}
                      <button
                        onClick={() => {
                          if (!isShareExpanded) loadReplies(share.id);
                          setExpandedShare(isShareExpanded ? null : share.id);
                          setReplyText("");
                        }}
                        className={`text-[9px] font-mono transition-colors px-1 ${
                          isShareExpanded ? "text-primary" : "text-muted-foreground/25 hover:text-primary/60"
                        }`}
                      >
                        {share.replyCount && share.replyCount > 0 ? (
                          <span>{isShareExpanded ? "fermer" : `${share.replyCount} reponse${share.replyCount > 1 ? "s" : ""}`}</span>
                        ) : (
                          <span>{isShareExpanded ? "fermer" : "repondre"}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Replies thread */}
                  {isShareExpanded && (
                    <div className={`mt-1.5 ${isMine ? "mr-0 ml-3" : "ml-6 mr-0"}`}>
                      <div className="rounded-lg bg-surface/30 border border-border/15 p-2 space-y-1.5">
                        {shareReplies.length > 0 && (
                          <div className="space-y-1">
                            {shareReplies.map((r) => {
                              const isMyReply = r.userId === userId;
                              return (
                                <div
                                  key={r.id}
                                  className={`flex gap-1.5 ${isMyReply ? "flex-row-reverse" : "flex-row"}`}
                                >
                                  <div className={`rounded-xl px-2.5 py-1 text-[10px] font-mono max-w-[90%] ${
                                    isMyReply
                                      ? "bg-primary/15 text-primary/80"
                                      : "bg-surface text-foreground/60"
                                  }`}>
                                    {!isMyReply && (
                                      <span className="text-[8px] font-bold opacity-50 mr-1">{r.username || friend.username}</span>
                                    )}
                                    {r.message}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendReply(share.id)}
                            placeholder="Aa"
                            className="flex-1 min-w-0 rounded-full border border-border/40 bg-background px-3 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/30 font-mono"
                          />
                          <button
                            onClick={() => sendReply(share.id)}
                            disabled={!replyText.trim() || sending}
                            className="shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center disabled:opacity-20 transition-all hover:brightness-110"
                            aria-label="Envoyer la reponse"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={threadEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export function FriendsSidebar() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [unreadShares, setUnreadShares] = useState(0);
  const [shares, setShares] = useState<Share[]>([]);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout>();

  const fetchActivity = useCallback(() => {
    fetch("/veille/api/friends/activity")
      .then((r) => r.json())
      .then((data) => setActivity(data.activity || []))
      .catch(() => {});
  }, []);

  const fetchFriends = useCallback(() => {
    fetch("/veille/api/friends")
      .then((r) => r.json())
      .then((data) => {
        setFriends(data.friends || []);
        setPending(data.pending || []);
        setUnreadShares(data.unreadShares || 0);
      })
      .catch(() => {});
  }, []);

  const fetchShares = useCallback(() => {
    fetch("/veille/api/friends/shared")
      .then((r) => r.json())
      .then((data) => {
        setShares(data.shares || []);
        setUnreadShares(0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchFriends();
    fetchShares();
    const interval = setInterval(() => { fetchFriends(); fetchShares(); }, 30000);
    return () => clearInterval(interval);
  }, [user, fetchFriends, fetchShares]);

  const handleSearch = (q: string) => {
    setSearch(q);
    setError(null);
    setRequestSent(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(() => {
      fetch(`/veille/api/users/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data.users || []))
        .catch(() => {});
    }, 300);
  };

  const sendRequest = async (username: string) => {
    setError(null);
    try {
      const res = await fetch("/veille/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRequestSent(username);
      setSearch("");
      setSearchResults([]);
    } catch { setError("Erreur reseau"); }
  };

  const handleRequest = async (requestId: string, action: "accept" | "reject") => {
    await fetch("/veille/api/friends/request", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    fetchFriends();
  };

  const removeFriend = async (friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    await fetch(`/veille/api/friends?friendId=${friendId}`, { method: "DELETE" });
  };

  if (!user) return null;

  const displayedFriends = showAllFriends ? friends : friends.slice(0, 5);
  const conversations = groupSharesByFriend(shares, user.id);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <aside className="hidden xl:block w-[280px] shrink-0">
      <div className="sticky top-[52px] space-y-3 py-5 max-h-[calc(100dvh-52px)] overflow-y-auto scrollbar-none">

        {/* ── Friends section ── */}
        <div className="rounded-2xl border border-border bg-card card-shadow overflow-hidden">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-mono font-bold flex-1">
              Amis {friends.length > 0 && <span className="text-muted-foreground/25">{friends.length}</span>}
            </h3>
            {pending.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary text-[9px] text-primary-foreground font-bold px-1">
                {pending.length}
              </span>
            )}
          </div>

          <div className="px-3 pb-3 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ajouter un ami..."
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 font-mono pr-7"
              />
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-0.5 border-b border-border/50 pb-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-1 py-1">
                    <Avatar user={u} size={22} />
                    <span className="flex-1 text-[11px] text-foreground font-mono truncate">{u.username}</span>
                    <button onClick={() => sendRequest(u.username)} className="text-[10px] text-primary font-mono hover:underline">ajouter</button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-[10px] text-cyber font-mono">{error}</p>}
            {requestSent && <p className="text-[10px] text-primary/70 font-mono">Demande envoyee a {requestSent}</p>}

            {pending.map((p) => (
              <div key={p.requestId} className="flex items-center gap-2 px-2 py-1.5 bg-primary/[0.04] rounded-lg border border-primary/10">
                <Avatar user={p} size={24} />
                <span className="flex-1 text-[11px] text-foreground font-mono truncate">{p.username}</span>
                <button onClick={() => handleRequest(p.requestId, "accept")} className="rounded-md bg-primary/15 px-2 py-0.5 text-[9px] text-primary font-mono font-medium hover:bg-primary/25 transition-colors">accepter</button>
                <button onClick={() => handleRequest(p.requestId, "reject")} className="text-muted-foreground/30 hover:text-cyber transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ))}

            {displayedFriends.length > 0 ? (
              <div className="space-y-0.5">
                {displayedFriends.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface transition-colors">
                    <Avatar user={f} size={24} />
                    <span className="flex-1 text-[11px] text-foreground/80 font-mono truncate">{f.username}</span>
                    <button onClick={() => removeFriend(f.id)} className="p-0.5 text-muted-foreground/20 hover:text-cyber transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Retirer ${f.username}`}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
                {friends.length > 5 && !showAllFriends && (
                  <button onClick={() => setShowAllFriends(true)} className="w-full text-center text-[10px] text-muted-foreground/40 hover:text-primary font-mono py-1 transition-colors">
                    voir les {friends.length - 5} autres
                  </button>
                )}
              </div>
            ) : pending.length === 0 && !search && (
              <div className="text-center py-3">
                <p className="text-[10px] text-muted-foreground/30 font-mono">Cherche un pseudo pour ajouter</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Messages section ── */}
        <div className="rounded-2xl border border-primary/[0.06] bg-card card-shadow overflow-hidden">
          <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3 className="text-[10px] uppercase tracking-wider text-primary/50 font-mono font-bold flex-1">
              Messages
            </h3>
            {(totalUnread > 0 || unreadShares > 0) && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-rose text-[9px] text-white font-bold px-1 animate-pulse">
                {totalUnread || unreadShares}
              </span>
            )}
          </div>

          <div className="px-1.5 pb-2">
            {conversations.length > 0 ? (
              <div className="space-y-0.5">
                {conversations.map((conv) => (
                  <ConversationThread
                    key={conv.friend.id}
                    conversation={conv}
                    userId={user.id}
                    isExpanded={expandedConv === conv.friend.id}
                    onToggle={() =>
                      setExpandedConv(expandedConv === conv.friend.id ? null : conv.friend.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-4">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/[0.06] mb-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/25">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-[11px] text-muted-foreground/35 font-mono">Aucun message</p>
                <p className="text-[9px] text-muted-foreground/20 font-mono mt-1">Partage un article depuis le feed</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </aside>
  );
}
