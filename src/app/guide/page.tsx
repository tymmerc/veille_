import Link from "next/link";

function Step({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-lg bg-primary/10 text-[11px] font-bold text-primary font-mono">
        {number}
      </span>
      <span className="text-[13px] sm:text-[14px] text-foreground/70 leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}

export default function GuidePage() {
  return (
    <div className="py-6 sm:py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[24px] sm:text-[30px] font-bold tracking-tight text-foreground leading-[1.1]">
          Comment ca marche ?
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground/50 font-mono">
          tout ce qu&apos;il faut savoir sur veille_
        </p>
      </div>

      <div className="space-y-5 stagger-in">
        {/* How it works */}
        <div className="rounded-xl border border-border bg-card card-shadow p-5 sm:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-[20px]">&#9881;</span>
            <h2 className="text-[18px] font-semibold text-foreground">Le fonctionnement</h2>
          </div>
          <ol className="space-y-3">
            <Step number="1">
              Tu decris tes interets en une phrase sur la page <Link href="/settings" className="text-primary hover:underline font-medium">parametres</Link>. Notre <strong className="text-foreground">IA locale</strong> transforme ca en mots-cles et sources.
            </Step>
            <Step number="2">
              <strong className="text-foreground">Toutes les heures</strong>, on scanne Reddit, Hacker News, arXiv, des blogs et des flux RSS pour trouver les nouveaux articles.
            </Step>
            <Step number="3">
              Chaque article est <strong className="text-foreground">score de 1 a 10</strong> et <strong className="text-foreground">resume en francais</strong> par l&apos;IA. Seuls les articles pertinents apparaissent dans ton feed.
            </Step>
            <Step number="4">
              Tu retrouves tout dans ton feed, trie par pertinence. Like, bookmark, partage avec tes amis.
            </Step>
          </ol>
          <div className="mt-4 rounded-lg border border-border/50 bg-surface/30 px-4 py-2.5 text-[12px] text-muted-foreground/50 font-mono leading-relaxed">
            Les articles sont mis a jour toutes les heures. Le traitement IA (scoring, traduction, resume) se fait en arriere-plan au moment du scan, pas quand tu navigues. Ton feed est toujours instantane.
          </div>
        </div>

        {/* Discord */}
        <div className="rounded-xl border border-border bg-card card-shadow p-5 sm:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#5865F2]">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
            </svg>
            <h2 className="text-[18px] font-semibold text-foreground">Discord</h2>
          </div>
          <ol className="space-y-3">
            <Step number="1">
              Ouvre <strong className="text-foreground">Discord</strong> et va dans les parametres de ton serveur
            </Step>
            <Step number="2">
              <strong className="text-foreground">Integrations</strong> &rarr; <strong className="text-foreground">Webhooks</strong> &rarr; <strong className="text-foreground">Nouveau webhook</strong>
            </Step>
            <Step number="3">
              Choisis le <strong className="text-foreground">channel</strong> ou tu veux recevoir les articles, puis clique sur <strong className="text-foreground">Copier l&apos;URL du webhook</strong>
            </Step>
            <Step number="4">
              Retourne sur <strong className="text-foreground">veille_</strong>, page config &rarr; section <strong className="text-foreground">Notifications</strong> &rarr; colle l&apos;URL dans le champ Discord et clique <strong className="text-foreground">sauver</strong>
            </Step>
          </ol>
          <div className="mt-4 rounded-lg border border-border/50 bg-surface/30 px-4 py-2.5 text-[12px] text-muted-foreground/50 font-mono">
            Format attendu : https://discord.com/api/webhooks/...
          </div>
        </div>

        {/* Slack */}
        <div className="rounded-xl border border-border bg-card card-shadow p-5 sm:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#E01E5A]">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            <h2 className="text-[18px] font-semibold text-foreground">Slack</h2>
          </div>
          <ol className="space-y-3">
            <Step number="1">
              Va sur <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">api.slack.com/apps</a> et clique sur <strong className="text-foreground">Create New App</strong> &rarr; <strong className="text-foreground">From scratch</strong>
            </Step>
            <Step number="2">
              Nomme l&apos;app (ex: &quot;veille_&quot;) et selectionne ton workspace
            </Step>
            <Step number="3">
              Dans le menu gauche : <strong className="text-foreground">Incoming Webhooks</strong> &rarr; active le toggle &rarr; <strong className="text-foreground">Add New Webhook to Workspace</strong>
            </Step>
            <Step number="4">
              Choisis le channel, puis copie l&apos;URL du webhook
            </Step>
            <Step number="5">
              Sur <strong className="text-foreground">veille_</strong>, page config &rarr; section <strong className="text-foreground">Notifications</strong> &rarr; colle l&apos;URL dans le champ Slack et clique <strong className="text-foreground">sauver</strong>
            </Step>
          </ol>
          <div className="mt-4 rounded-lg border border-border/50 bg-surface/30 px-4 py-2.5 text-[12px] text-muted-foreground/50 font-mono">
            Format attendu : https://hooks.slack.com/services/...
          </div>
        </div>

        {/* Note */}
        <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-5">
          <p className="text-[13px] text-foreground/60 leading-relaxed">
            Les notifications sont envoyees automatiquement selon les <strong className="text-foreground">jours et horaires</strong> configures dans ton planning. Seuls les articles au-dessus de ton <strong className="text-foreground">score minimum</strong> sont inclus.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-6 py-3 text-[13px] font-medium text-foreground transition-all hover:bg-primary/[0.08] hover:border-primary/30 font-mono"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" x2="5" y1="12" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          retour au feed
        </Link>
      </div>
    </div>
  );
}
