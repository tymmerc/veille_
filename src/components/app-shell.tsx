"use client";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { FriendsSidebar } from "@/components/friends-sidebar";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";

// Pages that get the full shell (header + sidebar)
const SHELL_PAGES = ["/feed", "/bookmarks", "/likes", "/article", "/guide", "/settings"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Determine if this page should show the shell
  const showShell = SHELL_PAGES.some((p) => pathname.startsWith(p)) || (pathname === "/" && !!user);

  if (loading) return <>{children}</>;

  if (!showShell) {
    // Landing page / login — no shell
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header />
      <div className="flex-1">
        <div className="mx-auto max-w-[1800px] px-3 sm:px-4 lg:px-6">
          <div className="flex gap-4">
            <Sidebar />
            <main className="flex-1 min-w-0">
              {children}
            </main>
            <FriendsSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
