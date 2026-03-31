"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, discordAvatarUrl } from "@/lib/auth-context";
import { TAGS, type Tag, type Category } from "@/lib/data";

// ─── Types ────────────────────────────────────────────────────
export type Preset = {
  id: string;
  name: string;
  categories: (Category | "all")[];
  tags?: string[];
  keywords?: string[];
};

const BUILT_IN_PRESETS: Preset[] = [
  { id: "all", name: "Tout", categories: ["all"] },
  { id: "ia", name: "IA", categories: ["ia"] },
  { id: "cyber", name: "Cyber", categories: ["cyber"] },
  { id: "tech", name: "Tech", categories: ["tech"] },
];

// ─── Icons ────────────────────────────────────────────────────
function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`text-muted-foreground/30 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Nav link ─────────────────────────────────────────────────
function NavLink({ href, icon, label, count }: { href: string; icon: React.ReactNode; label: string; count?: number }) {
  const pathname = usePathname();
  const active = pathname === href || pathname === href + "/";

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors ${
        active
          ? "text-primary font-medium bg-primary/5"
          : "text-muted-foreground hover:text-foreground hover:bg-surface"
      }`}
    >
      {icon}
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className={`ml-auto text-[11px] font-mono ${active ? "text-primary" : "text-muted-foreground/40"}`}>{count}</span>
      )}
    </Link>
  );
}

// ─── Category with expandable themes ─────────────────────────
const CATEGORY_COLORS: Record<string, { active: string; tag: string }> = {
  ia: { active: "bg-rose/15 text-rose border-rose/25", tag: "bg-rose/10 text-rose/70" },
  cyber: { active: "bg-cyber/15 text-cyber border-cyber/25", tag: "bg-cyber/10 text-cyber/70" },
  tech: { active: "bg-tech/15 text-tech border-tech/25", tag: "bg-tech/10 text-tech/70" },
};

function CategorySelector({
  selectedCats,
  onToggleCat,
  selectedTags,
  onToggleTag,
}: {
  selectedCats: Category[];
  onToggleCat: (cat: Category) => void;
  selectedTags: string[];
  onToggleTag: (id: string) => void;
}) {
  const [expandedCat, setExpandedCat] = useState<Category | null>(null);

  const catLabels: Record<Category, string> = { ia: "IA", cyber: "Cyber", tech: "Tech" };
  const cats: Category[] = ["ia", "cyber", "tech"];

  return (
    <div className="space-y-1">
      {cats.map((cat) => {
        const isSelected = selectedCats.includes(cat);
        const isExpanded = expandedCat === cat;
        const themes = TAGS.filter((t) => t.group === "topic" && t.category === cat);
        const colors = CATEGORY_COLORS[cat];
        const selectedThemeCount = themes.filter((t) => selectedTags.includes(t.id)).length;

        return (
          <div key={cat}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleCat(cat)}
                className={`flex-1 text-left rounded-lg px-3 py-2 text-[11px] font-mono font-bold uppercase transition-all ${
                  isSelected
                    ? `${colors.active} border`
                    : "text-muted-foreground/40 hover:text-muted-foreground/60 border border-transparent"
                }`}
              >
                {catLabels[cat]}
                {selectedThemeCount > 0 && (
                  <span className="ml-1.5 text-[9px] opacity-60">{selectedThemeCount} theme{selectedThemeCount > 1 ? "s" : ""}</span>
                )}
              </button>
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat)}
                className="p-1.5 rounded-md hover:bg-surface transition-colors"
                aria-label={isExpanded ? `Masquer les themes ${catLabels[cat]}` : `Afficher les themes ${catLabels[cat]}`}
                aria-expanded={isExpanded}
              >
                <ChevronIcon open={isExpanded} />
              </button>
            </div>

            {isExpanded && (
              <div className="ml-2 mt-1 mb-2 flex flex-wrap gap-1">
                {themes.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => onToggleTag(tag.id)}
                    className={`rounded-md px-2 py-1 text-[10px] font-mono transition-all ${
                      selectedTags.includes(tag.id)
                        ? `${colors.tag} border border-current/20`
                        : "bg-surface text-muted-foreground/35 border border-transparent hover:text-muted-foreground/50"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sidebar component ────────────────────────────────────────
export function Sidebar() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState("all");
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetCats, setNewPresetCats] = useState<Category[]>([]);
  const [newPresetTags, setNewPresetTags] = useState<string[]>([]);
  const [newPresetKeywords, setNewPresetKeywords] = useState("");
  const [stats, setStats] = useState({ articles: 0, saves: 0, likes: 0 });
  const [presetError, setPresetError] = useState<string | null>(null);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState("");
  const [editPresetKeywords, setEditPresetKeywords] = useState("");

  // Load presets from server
  const fetchPresets = useCallback(() => {
    fetch("/veille/api/presets")
      .then((r) => r.json())
      .then((data) => {
        setPresets(data.presets || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchPresets();
  }, [user, fetchPresets]);

  // Fetch basic stats
  const refreshStats = useCallback(() => {
    if (!user) return;
    Promise.all([
      fetch("/veille/api/articles?limit=1").then((r) => r.json()).catch(() => ({ total: 0 })),
      fetch("/veille/api/bookmarks?limit=1").then((r) => r.json()).catch(() => ({ total: 0 })),
      fetch("/veille/api/likes?limit=1").then((r) => r.json()).catch(() => ({ total: 0 })),
    ]).then(([articlesData, bookmarksData, likesData]) => {
      const bySection = articlesData.stats?.bySection;
      const relevant = bySection ? (bySection.followed || 0) + (bySection.relevant || 0) : 0;
      setStats({
        articles: relevant > 0 ? relevant : articlesData.total || 0,
        saves: bookmarksData.total || 0,
        likes: likesData.total || 0,
      });
    });
  }, [user]);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  // Auto-refresh stats when user likes/bookmarks
  useEffect(() => {
    const handler = () => refreshStats();
    window.addEventListener("veille:stats-changed", handler);
    return () => window.removeEventListener("veille:stats-changed", handler);
  }, [refreshStats]);

  const handlePresetChange = (preset: Preset) => {
    setActivePreset(preset.id);
    window.dispatchEvent(new CustomEvent("veille:preset-change", { detail: preset }));
  };

  const handleCreatePreset = async () => {
    if (!newPresetName.trim() || creatingPreset) return;
    setPresetError(null);
    setCreatingPreset(true);
    const keywords = newPresetKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    let cats: (Category | "all")[] = newPresetCats;
    if (cats.length === 0 && newPresetTags.length > 0) {
      const tagCats = new Set<Category>();
      for (const tagId of newPresetTags) {
        const tag = TAGS.find((t) => t.id === tagId);
        if (tag?.category) tagCats.add(tag.category);
      }
      cats = tagCats.size > 0 ? Array.from(tagCats) : ["all"];
    }
    if (cats.length === 0) cats = ["all"];

    try {
      const res = await fetch("/veille/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPresetName.trim(),
          categories: cats,
          keywords: keywords.length > 0 ? keywords : undefined,
        }),
      });
      if (res.ok) {
        fetchPresets();
        setNewPresetName("");
        setNewPresetCats([]);
        setNewPresetTags([]);
        setNewPresetKeywords("");
        setShowNewPreset(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setPresetError(data.error || "Erreur lors de la creation");
      }
    } catch {
      setPresetError("Erreur reseau");
    } finally {
      setCreatingPreset(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    setPresetError(null);
    try {
      const res = await fetch(`/veille/api/presets?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        setPresetError("Erreur lors de la suppression");
        return;
      }
      setPresets((prev) => prev.filter((p) => p.id !== id));
      if (activePreset === id) {
        handlePresetChange(BUILT_IN_PRESETS[0]);
      }
    } catch {
      setPresetError("Erreur reseau");
    }
  };

  const [editPresetCats, setEditPresetCats] = useState<Category[]>([]);

  const startEditPreset = (preset: Preset) => {
    setEditingPresetId(preset.id);
    setEditPresetName(preset.name);
    setEditPresetKeywords((preset.keywords || []).join(", "));
    setEditPresetCats((preset.categories || []).filter((c): c is Category => c !== "all"));
  };

  const handleSaveEdit = async () => {
    if (!editingPresetId || !editPresetName.trim()) return;
    const keywords = editPresetKeywords.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
    const categories: (Category | "all")[] = editPresetCats.length > 0 ? editPresetCats : ["all"];
    try {
      const res = await fetch("/veille/api/presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPresetId, name: editPresetName.trim(), keywords, categories }),
      });
      if (res.ok) {
        setPresets((prev) => prev.map((p) =>
          p.id === editingPresetId ? { ...p, name: editPresetName.trim(), keywords, categories } : p
        ));
      }
    } catch {}
    setEditingPresetId(null);
  };

  const toggleCat = (cat: Category) => {
    setNewPresetCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleTag = (tagId: string) => {
    setNewPresetTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  if (!user) return null;

  const allPresets = [...BUILT_IN_PRESETS, ...presets];

  return (
    <aside className="hidden lg:block w-[240px] shrink-0">
      <div className="sticky top-[52px] space-y-3 py-5 max-h-[calc(100dvh-52px)] overflow-y-auto scrollbar-none">
        {/* Profile card */}
        <div className="rounded-2xl border border-border bg-card card-shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            {discordAvatarUrl(user) ? (
              <img src={discordAvatarUrl(user, 80)!} alt={`Avatar de ${user.username}`} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-[15px] font-bold text-primary uppercase">
                {user.username.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-[14px] font-semibold text-foreground">{user.username}</p>
              <p className="text-[11px] text-muted-foreground/60 font-mono">veilleur actif</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
            <div className="text-center">
              <p className="text-[16px] font-bold text-foreground">{stats.articles}</p>
              <p className="text-[9px] text-muted-foreground/50 font-mono uppercase">articles</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-foreground">{stats.saves}</p>
              <p className="text-[9px] text-muted-foreground/50 font-mono uppercase">saves</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-foreground">{stats.likes}</p>
              <p className="text-[9px] text-muted-foreground/50 font-mono uppercase">likes</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="rounded-2xl border border-border bg-card card-shadow overflow-hidden">
          <NavLink href="/feed" icon={<FeedIcon />} label="Feed" />
          <div className="mx-4 border-t border-border/50" />
          <NavLink href="/bookmarks" icon={<BookmarkIcon />} label="Posts enregistres" count={stats.saves} />
          <div className="mx-4 border-t border-border/50" />
          <NavLink href="/likes" icon={<HeartIcon />} label="Posts likes" count={stats.likes} />
          <div className="mx-4 border-t border-border/50" />
          <NavLink href="/settings" icon={<SettingsIcon />} label="Parametres" />
        </div>

        {/* Presets */}
        <div className="rounded-2xl border border-border bg-card card-shadow p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-mono font-bold">Presets</h3>
            <button
              onClick={() => setShowNewPreset(!showNewPreset)}
              className={`p-0.5 transition-colors ${showNewPreset ? "text-primary" : "text-muted-foreground/30 hover:text-primary"}`}
              aria-label={showNewPreset ? "Fermer le formulaire" : "Creer un preset"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          <div className="space-y-0.5">
            {allPresets.map((preset) => {
              const isCustom = !BUILT_IN_PRESETS.find((d) => d.id === preset.id);
              const isEditing = editingPresetId === preset.id;

              if (isEditing) {
                return (
                  <div key={preset.id} className="rounded-lg bg-surface p-2 space-y-1.5">
                    <input
                      type="text"
                      value={editPresetName}
                      onChange={(e) => setEditPresetName(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground font-mono focus:outline-none focus:border-primary/30"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                    />
                    <div className="flex gap-1">
                      {(["ia", "cyber", "tech"] as Category[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditPresetCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                          className={`flex-1 rounded-md text-[9px] font-mono py-0.5 transition-colors ${
                            editPresetCats.includes(c)
                              ? c === "ia" ? "bg-rose/15 text-rose" : c === "cyber" ? "bg-cyber/15 text-cyber" : "bg-tech/15 text-tech"
                              : "bg-surface text-muted-foreground/30"
                          }`}
                        >{c}</button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={editPresetKeywords}
                      onChange={(e) => setEditPresetKeywords(e.target.value)}
                      placeholder="mots-cles (virgule)"
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground font-mono focus:outline-none focus:border-primary/30"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                    />
                    <div className="flex gap-1">
                      <button onClick={handleSaveEdit} className="flex-1 rounded-md bg-primary/15 text-primary text-[10px] font-mono py-1 hover:bg-primary/25">ok</button>
                      <button onClick={() => setEditingPresetId(null)} className="flex-1 rounded-md bg-surface text-muted-foreground text-[10px] font-mono py-1 hover:bg-surface/80">annuler</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={preset.id} className="group flex items-center">
                  <button
                    onClick={() => handlePresetChange(preset)}
                    className={`flex-1 text-left rounded-lg px-3 py-1.5 text-[11px] font-mono transition-all ${
                      activePreset === preset.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    <span>{preset.name}</span>
                    {preset.keywords && preset.keywords.length > 0 && (
                      <span className="ml-1.5 text-[9px] text-muted-foreground/25">{preset.keywords.length} mots-cles</span>
                    )}
                  </button>
                  {isCustom && (
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditPreset(preset)}
                        className="p-1 text-muted-foreground/15 hover:text-primary transition-colors"
                        aria-label={`Modifier le preset ${preset.name}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="p-1 text-muted-foreground/15 hover:text-cyber transition-colors"
                        aria-label={`Supprimer le preset ${preset.name}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* New preset form */}
          {showNewPreset && (
            <div className="mt-2 pt-2 border-t border-border/50 space-y-2.5">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Nom du preset..." maxLength={50}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 font-mono"
              />

              {/* Categories with expandable themes */}
              <CategorySelector
                selectedCats={newPresetCats}
                onToggleCat={toggleCat}
                selectedTags={newPresetTags}
                onToggleTag={toggleTag}
              />

              {/* Custom keywords */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/35 font-mono font-bold mb-1 px-1">Mots-cles</p>
                <input
                  type="text"
                  value={newPresetKeywords}
                  onChange={(e) => setNewPresetKeywords(e.target.value)}
                  placeholder="anthropic, claude code, llm..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 font-mono"
                />
                <p className="text-[9px] text-muted-foreground/25 font-mono mt-0.5 px-1">separes par des virgules</p>
              </div>

              {/* Sources filter */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/35 font-mono font-bold mb-1 px-1">Sources</p>
                <div className="flex flex-wrap gap-1">
                  {TAGS.filter((t) => t.group === "source").map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-md px-2 py-1 text-[10px] font-mono transition-all ${
                        newPresetTags.includes(tag.id)
                          ? "bg-primary/15 text-primary border border-primary/25"
                          : "bg-surface text-muted-foreground/35 border border-transparent hover:text-muted-foreground/50"
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {(newPresetTags.length > 0 || newPresetKeywords.trim()) && (
                <p className="text-[9px] text-muted-foreground/30 font-mono px-1">
                  {newPresetTags.filter((t) => t.startsWith("topic:")).length > 0 &&
                    `${newPresetTags.filter((t) => t.startsWith("topic:")).length} theme(s)`}
                  {newPresetKeywords.trim() && ` · ${newPresetKeywords.split(",").filter((k) => k.trim()).length} mot(s)-cle(s)`}
                </p>
              )}

              {presetError && (
                <p className="text-[10px] text-cyber font-mono px-1">{presetError}</p>
              )}

              <button
                onClick={handleCreatePreset}
                disabled={creatingPreset || !newPresetName.trim() || (newPresetCats.length === 0 && newPresetTags.length === 0 && !newPresetKeywords.trim())}
                className="w-full rounded-lg bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground font-mono disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                {creatingPreset ? "creation..." : "creer le preset"}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
