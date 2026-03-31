"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  );
}

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/veille/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de connexion.");
        return;
      }
      router.push("/feed");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword !== regConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/veille/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription.");
        return;
      }
      router.push("/feed");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-orb absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/[0.12] blur-[100px]" />
        <div className="hero-orb-2 absolute -bottom-48 -right-48 h-[600px] w-[600px] rounded-full bg-tech/[0.08] blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <span className="font-mono text-[15px] tracking-tight text-foreground mb-1">
          veille<span className="text-primary">_</span>
        </span>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Connecte-toi pour configurer ta veille personnalisee
          et recevoir tes digests.
        </p>

        {/* Tab switcher */}
        <div className="mt-6 flex w-full rounded-lg bg-card/50 border border-border p-1">
          <button
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 rounded-md py-2 text-[12px] font-mono transition-all ${
              tab === "login"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            connexion
          </button>
          <button
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 rounded-md py-2 text-[12px] font-mono transition-all ${
              tab === "register"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            inscription
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-4 w-full rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-[12px] text-red-400 font-mono">
            {error}
          </div>
        )}

        {/* Login tab */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="mt-4 flex w-full flex-col gap-3">
            <input
              type="email"
              placeholder="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <input
              type="password"
              placeholder="mot de passe"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!loginEmail) { setError("Entre ton email d'abord."); return; }
                  setError(null);
                  const res = await fetch("/veille/api/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: loginEmail }),
                  });
                  if (res.ok) setError("Si ce compte existe, un lien de reinitialisation a ete genere. Contacte l'admin.");
                }}
                className="text-[10px] text-muted-foreground/50 hover:text-primary font-mono transition-colors"
              >
                mot de passe oublie ?
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition-all hover:brightness-110 glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "connexion..." : "se connecter"}
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground font-mono">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Discord button */}
            <a
              href="/veille/api/auth/login"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-4 py-3 text-[13px] font-semibold text-white transition-all hover:brightness-110"
            >
              <DiscordIcon />
              Continuer avec Discord
            </a>
          </form>
        )}

        {/* Register tab */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="mt-4 flex w-full flex-col gap-3">
            <input
              type="text"
              placeholder="nom d'utilisateur"
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <input
              type="email"
              placeholder="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <input
              type="password"
              placeholder="mot de passe"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <input
              type="password"
              placeholder="confirmer le mot de passe"
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition-all hover:brightness-110 glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "inscription..." : "creer un compte"}
            </button>
          </form>
        )}

        <Link
          href="/feed"
          className="mt-5 text-[12px] text-muted-foreground transition-colors hover:text-foreground font-mono"
        >
          consulter le feed sans compte
        </Link>
      </div>
    </div>
  );
}
