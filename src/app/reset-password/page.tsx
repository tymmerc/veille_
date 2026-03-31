"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setError("Minimum 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/veille/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-foreground mb-4">Lien invalide. Pas de token.</p>
          <Link href="/login" className="text-primary hover:underline font-mono text-sm">retour a la connexion</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <span className="text-primary text-2xl">✓</span>
          </div>
          <p className="text-foreground mb-4">Mot de passe modifie avec succes.</p>
          <Link href="/login" className="text-primary hover:underline font-mono text-sm">se connecter</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-foreground mb-6 text-center font-mono">Nouveau mot de passe</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
            required
            minLength={6}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
            required
          />

          {error && <p className="text-cyber text-xs font-mono">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-mono font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
