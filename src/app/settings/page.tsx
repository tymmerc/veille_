"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

// ─── Icons ────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ─── Section wrapper ──────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card card-shadow p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-mono font-bold mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Appearance section ───────────────────────────────────────
function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Clair", icon: <SunIcon /> },
    { value: "dark", label: "Sombre", icon: <MoonIcon /> },
    { value: "system", label: "Systeme", icon: <MonitorIcon /> },
  ];

  return (
    <Section title="Apparence">
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex-1 flex flex-col items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-mono transition-all border ${
              theme === opt.value
                ? "bg-primary/10 text-primary border-primary/25 font-medium"
                : "bg-surface text-muted-foreground border-transparent hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

// ─── Profile section ──────────────────────────────────────────
function ProfileSection() {
  const { user, refresh } = useAuth();
  const [username, setUsername] = useState(user?.username || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPublic, setIsPublic] = useState(user?.isPublic ?? false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const isDiscord = !!user?.discordId;

  const handleTogglePublic = async () => {
    setTogglingPublic(true);
    const newValue = !isPublic;
    try {
      const res = await fetch("/veille/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newValue }),
      });
      if (res.ok) {
        setIsPublic(newValue);
        refresh();
      }
    } catch {
      // revert on error
    } finally {
      setTogglingPublic(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!username.trim() || username === user?.username) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/veille/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: "Nom mis a jour" });
        refresh();
      } else {
        setMsg({ type: "err", text: data.error || "Erreur" });
      }
    } catch {
      setMsg({ type: "err", text: "Erreur reseau" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Profil">
      <div className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
            Nom d&apos;utilisateur
          </label>
          {isDiscord ? (
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium text-foreground">{user?.username}</span>
              <span className="text-[10px] font-mono text-muted-foreground/40 bg-surface px-2 py-0.5 rounded-md">
                Discord
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 font-mono"
              />
              <button
                onClick={handleSaveUsername}
                disabled={saving || !username.trim() || username === user?.username}
                className="rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground font-mono disabled:opacity-30 hover:brightness-110 transition-all"
              >
                {saving ? "..." : "Sauver"}
              </button>
            </div>
          )}
        </div>

        {/* Email */}
        {user?.email && (
          <div>
            <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
              Email
            </label>
            <span className="text-[14px] text-foreground">{user.email}</span>
          </div>
        )}

        {/* Public profile toggle */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-[12px] font-mono text-muted-foreground mb-0.5">
                Profil public
              </label>
              <p className="text-[11px] text-muted-foreground/40 font-mono">
                Rend tes likes et saves visibles sur /u/{user?.username}
              </p>
            </div>
            <button
              onClick={handleTogglePublic}
              disabled={togglingPublic}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                isPublic ? "bg-primary" : "bg-surface-hover"
              }`}
              role="switch"
              aria-checked={isPublic}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPublic ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {isPublic && user?.username && (
            <a
              href={`/veille/u/${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-1.5 text-[10px] text-primary/60 hover:text-primary font-mono transition-colors"
            >
              voir mon profil public
            </a>
          )}
        </div>

        {msg && (
          <p className={`text-[11px] font-mono ${msg.type === "ok" ? "text-green-500" : "text-cyber"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </Section>
  );
}

// ─── Password section ─────────────────────────────────────────
function PasswordSection() {
  const { user } = useAuth();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isDiscord = !!user?.discordId;

  if (isDiscord) return null;

  const handleChangePassword = async () => {
    setMsg(null);
    if (newPwd !== confirmPwd) {
      setMsg({ type: "err", text: "Les mots de passe ne correspondent pas" });
      return;
    }
    if (newPwd.length < 6) {
      setMsg({ type: "err", text: "6 caracteres minimum" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/veille/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: "Mot de passe modifie" });
        setCurrentPwd("");
        setNewPwd("");
        setConfirmPwd("");
      } else {
        setMsg({ type: "err", text: data.error || "Erreur" });
      }
    } catch {
      setMsg({ type: "err", text: "Erreur reseau" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Mot de passe">
      <div className="space-y-3 max-w-md">
        <div>
          <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
            Mot de passe actuel
          </label>
          <input
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/40 font-mono"
          />
        </div>
        <div>
          <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/40 font-mono"
          />
        </div>
        <div>
          <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
            Confirmer le nouveau mot de passe
          </label>
          <input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/40 font-mono"
          />
        </div>
        <button
          onClick={handleChangePassword}
          disabled={saving || !currentPwd || !newPwd || !confirmPwd}
          className="rounded-xl bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground font-mono disabled:opacity-30 hover:brightness-110 transition-all"
        >
          {saving ? "..." : "Changer le mot de passe"}
        </button>
        {msg && (
          <p className={`text-[11px] font-mono ${msg.type === "ok" ? "text-green-500" : "text-cyber"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </Section>
  );
}

// ─── Notifications section ────────────────────────────────────
function NotificationsSection() {
  const [settings, setSettings] = useState<{
    webhookUrl: string;
    slackWebhookUrl: string;
    minScore: number;
    notifyEnabled: boolean;
  } | null>(null);
  const [discordUrl, setDiscordUrl] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [testResult, setTestResult] = useState<{ type: "discord" | "slack"; ok: boolean } | null>(null);
  const [testing, setTesting] = useState<"discord" | "slack" | null>(null);
  const [saving, setSaving] = useState<"discord" | "slack" | "notify" | "score" | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/veille/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setDiscordUrl(data.webhookUrl || "");
        setSlackUrl(data.slackWebhookUrl || "");
      })
      .catch(() => {});
  }, []);

  const handleSave = async (field: "discord" | "slack") => {
    setSaving(field);
    const body = field === "discord" ? { webhookUrl: discordUrl } : { slackWebhookUrl: slackUrl };
    try {
      const res = await fetch("/veille/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSettings((prev) => prev ? { ...prev, ...(field === "discord" ? { webhookUrl: discordUrl } : { slackWebhookUrl: slackUrl }) } : prev);
        setSaved(field);
        setTimeout(() => setSaved(null), 2000);
      }
    } catch {} finally {
      setSaving(null);
    }
  };

  const handleTest = async (type: "discord" | "slack") => {
    setTesting(type);
    setTestResult(null);
    try {
      const res = await fetch("/veille/api/settings/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setTestResult({ type, ok: data.success });
    } catch {
      setTestResult({ type, ok: false });
    } finally {
      setTesting(null);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleToggleNotify = async () => {
    if (!settings) return;
    const next = !settings.notifyEnabled;
    setSettings({ ...settings, notifyEnabled: next });
    fetch("/veille/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyEnabled: next }),
    });
  };

  const handleMinScoreChange = async (v: number) => {
    if (!settings) return;
    setSettings({ ...settings, minScore: v });
    fetch("/veille/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minScore: v }),
    });
  };

  return (
    <Section title="Notifications">
      {!settings ? (
        <div className="space-y-2">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-4 w-40" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Notify toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-[12px] font-mono text-muted-foreground mb-0.5">
                Notifications
              </label>
              <p className="text-[11px] text-muted-foreground/40 font-mono">
                Recevoir un digest par webhook
              </p>
            </div>
            <button
              onClick={handleToggleNotify}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.notifyEnabled ? "bg-primary" : "bg-surface-hover"
              }`}
              role="switch"
              aria-checked={settings.notifyEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.notifyEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Discord webhook */}
          <div>
            <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
              Discord webhook
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/40 font-mono"
              />
              <button
                onClick={() => handleSave("discord")}
                disabled={saving === "discord" || discordUrl === (settings.webhookUrl || "")}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground font-mono disabled:opacity-30 hover:brightness-110 transition-all"
              >
                {saving === "discord" ? "..." : saved === "discord" ? "\u2713" : "sauver"}
              </button>
              {settings.webhookUrl && (
                <button
                  onClick={() => handleTest("discord")}
                  disabled={testing === "discord"}
                  className="shrink-0 rounded-xl bg-surface px-3 py-2 text-[11px] font-mono text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {testing === "discord" ? "..." : "tester"}
                </button>
              )}
            </div>
            {testResult?.type === "discord" && (
              <span className={`block mt-1.5 text-[11px] font-mono ${testResult.ok ? "text-green-500" : "text-cyber"}`}>
                {testResult.ok ? "\u2713 Webhook Discord connecte" : "\u2717 Erreur de connexion"}
              </span>
            )}
          </div>

          {/* Slack webhook */}
          <div>
            <label className="block text-[12px] font-mono text-muted-foreground mb-1.5">
              Slack webhook
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/40 font-mono"
              />
              <button
                onClick={() => handleSave("slack")}
                disabled={saving === "slack" || slackUrl === (settings.slackWebhookUrl || "")}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground font-mono disabled:opacity-30 hover:brightness-110 transition-all"
              >
                {saving === "slack" ? "..." : saved === "slack" ? "\u2713" : "sauver"}
              </button>
              {settings.slackWebhookUrl && (
                <button
                  onClick={() => handleTest("slack")}
                  disabled={testing === "slack"}
                  className="shrink-0 rounded-xl bg-surface px-3 py-2 text-[11px] font-mono text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {testing === "slack" ? "..." : "tester"}
                </button>
              )}
            </div>
            {testResult?.type === "slack" && (
              <span className={`block mt-1.5 text-[11px] font-mono ${testResult.ok ? "text-green-500" : "text-cyber"}`}>
                {testResult.ok ? "\u2713 Webhook Slack connecte" : "\u2717 Erreur de connexion"}
              </span>
            )}
          </div>

          {/* Min score */}
          <div className="pt-2 border-t border-border/50">
            <label className="block text-[12px] font-mono text-muted-foreground mb-2">
              Score minimum pour les notifications
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
                <button
                  key={v}
                  onClick={() => handleMinScoreChange(v)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-mono transition-all ${
                    settings.minScore === v
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground/40 font-mono">
              Seuls les articles avec un score &ge; {settings.minScore} seront envoyes
            </p>
          </div>

          <a
            href="/veille/"
            className="inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2 text-[12px] font-mono text-foreground hover:bg-surface-hover transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configurer mes sources et mots-cles
          </a>
        </div>
      )}
    </Section>
  );
}

// ─── Delete account section ───────────────────────────────────
function DeleteAccountSection() {
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/veille/api/auth/delete-account", {
        method: "DELETE",
      });
      if (res.ok) {
        logout();
      }
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Section title="Compte">
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          Supprimer ton compte supprimera toutes tes donnees de maniere irreversible.
        </p>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-xl border border-cyber/30 bg-cyber/5 px-5 py-2 text-[12px] font-semibold text-cyber font-mono hover:bg-cyber/10 transition-all"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-cyber/30 bg-cyber/5">
            <p className="text-[12px] text-cyber font-mono flex-1">
              Es-tu sur ? Cette action est irreversible.
            </p>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-lg bg-surface px-4 py-1.5 text-[11px] font-mono text-foreground hover:bg-surface-hover transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-cyber px-4 py-1.5 text-[11px] font-mono font-semibold text-white hover:brightness-110 transition-all disabled:opacity-50"
            >
              {deleting ? "Suppression..." : "Confirmer"}
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Veille config link section ──────────────────────────────
function VeilleConfigSection() {
  return (
    <Section title="Ma veille">
      <p className="text-[13px] text-muted-foreground mb-3">
        Configure ta phrase de veille, tes sources, ton planning de collecte et tes comptes suivis.
      </p>
      <a
        href="/veille/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-[12px] font-mono text-primary font-medium hover:bg-primary/20 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        Configurer mes interets et sources
      </a>
    </Section>
  );
}

// ─── Settings page ────────────────────────────────────────────
export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-8 space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground font-mono text-[14px]">Connecte-toi pour acceder aux parametres.</p>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-8 max-w-2xl space-y-4">
      <h1 className="text-[20px] font-bold text-foreground mb-6">
        Parametres
      </h1>
      <VeilleConfigSection />
      <AppearanceSection />
      <ProfileSection />
      <PasswordSection />
      <NotificationsSection />
      <DeleteAccountSection />
    </div>
  );
}
