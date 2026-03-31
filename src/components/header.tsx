"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, discordAvatarUrl } from "@/lib/auth-context";

const LAST_SEEN_KEY = "veille_last_seen";

function NavLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`relative text-[13px] transition-colors font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 rounded px-1 ${
        isActive
          ? "text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {badge && badge > 0 ? (
        <span className="absolute -top-2 -right-4 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function MobileNavLink({ href, label, icon, onClick }: { href: string; label: string; icon: React.ReactNode; onClick: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 text-[13px] font-mono transition-colors ${
        isActive
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-surface"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Header({ border = true }: { border?: boolean }) {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen && !mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Fetch new article count
  useEffect(() => {
    if (!user) return;
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (!lastSeen) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      return;
    }
    fetch(`/veille/api/articles/new-count?since=${encodeURIComponent(lastSeen)}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.count === "number") setNewCount(data.count);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user && pathname === "/feed") {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setNewCount(0);
    }
  }, [user, pathname]);

  return (
    <>
      <header
        className={`relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 shrink-0 backdrop-blur-md bg-background/80 ${
          border ? "border-b border-border" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          {user && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
              aria-label="Menu de navigation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                  : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                }
              </svg>
            </button>
          )}
          <Link
            href="/"
            className="font-mono text-[14px] tracking-tight text-foreground transition-colors hover:text-primary font-semibold"
          >
            veille<span className="text-primary">_</span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4">
          {loading ? null : user ? (
            <>
              <NavLink href="/feed" label="feed" badge={newCount} />
              <NavLink href="/guide" label="guide" />
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 rounded px-1"
                  aria-label="Menu utilisateur"
                  aria-expanded={menuOpen}
                >
                  {discordAvatarUrl(user) ? (
                    <img src={discordAvatarUrl(user, 48)!} alt={`Avatar de ${user.username}`} className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
                      {user.username.charAt(0)}
                    </div>
                  )}
                  {user.username}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 rounded-xl border border-border bg-popover py-1 min-w-[160px] shadow-lg card-shadow">
                    <Link href="/settings" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors font-mono">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </svg>
                      parametres
                    </Link>
                    <button onClick={() => { setMenuOpen(false); logout(); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors font-mono">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      deconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink href="/feed" label="feed" />
              <NavLink href="/guide" label="guide" />
              <Link href="/login"
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[12px] text-primary transition-colors hover:bg-primary/20 font-mono font-medium">
                connexion
              </Link>
            </>
          )}
        </nav>

        {/* Mobile compact nav (no hamburger) */}
        <nav className="flex sm:hidden items-center gap-3">
          {loading ? null : user ? (
            <>
              <NavLink href="/feed" label="feed" badge={newCount} />
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors font-mono"
                  aria-label="Menu"
                >
                  {discordAvatarUrl(user) ? (
                    <img src={discordAvatarUrl(user, 48)!} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
                      {user.username.charAt(0)}
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 rounded-xl border border-border bg-popover py-1 min-w-[140px] shadow-lg card-shadow">
                    <Link href="/settings" onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors font-mono">
                      parametres
                    </Link>
                    <button onClick={() => { setMenuOpen(false); logout(); }}
                      className="block w-full text-left px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors font-mono">
                      deconnexion
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-primary/10 px-3 py-1.5 text-[12px] text-primary font-mono font-medium">
              connexion
            </Link>
          )}
        </nav>
      </header>

      {/* Mobile navigation drawer */}
      {mobileOpen && user && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 z-40 w-[260px] bg-card border-r border-border overflow-y-auto lg:hidden animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                {discordAvatarUrl(user) ? (
                  <img src={discordAvatarUrl(user, 80)!} alt="" className="h-10 w-10 rounded-full object-cover" />
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
            </div>

            <nav className="py-2">
              <MobileNavLink href="/feed" label="Mon feed" onClick={() => setMobileOpen(false)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>} />
              <MobileNavLink href="/bookmarks" label="Sauvegardes" onClick={() => setMobileOpen(false)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>} />
              <MobileNavLink href="/likes" label="Likes" onClick={() => setMobileOpen(false)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>} />
              <div className="mx-4 my-2 border-t border-border/50" />
              <MobileNavLink href="/" label="Mes interets" onClick={() => setMobileOpen(false)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>} />
              <MobileNavLink href="/settings" label="Parametres" onClick={() => setMobileOpen(false)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>} />
              <MobileNavLink href="/guide" label="Guide" onClick={() => setMobileOpen(false)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>} />
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
