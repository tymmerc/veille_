"use client";

import { useState, useEffect, useCallback } from "react";

type TableInfo = { name: string; count: number; icon: string };
type TableData = { table: string; rows: Record<string, unknown>[]; total: number; page: number; pages: number; columns?: string[] };

export default function DBExplorer() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResult, setSqlResult] = useState<{ rows?: unknown[]; error?: string; count?: number } | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSchema, setShowSchema] = useState(false);

  useEffect(() => {
    fetch("/veille/api/db-explorer")
      .then((r) => r.json())
      .then((d) => { setTables(d.tables || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadTable = useCallback((name: string, pg = 1, q = "") => {
    setActiveTable(name);
    setPage(pg);
    setTableLoading(true);
    setExpandedRow(null);
    const params = new URLSearchParams({ table: name, page: String(pg), limit: "25" });
    if (q) params.set("search", q);
    fetch(`/veille/api/db-explorer?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setTableLoading(false); })
      .catch(() => setTableLoading(false));
  }, []);

  const handleSearch = () => {
    if (activeTable) loadTable(activeTable, 1, search);
  };

  const handleDelete = async (table: string, id: string) => {
    if (!confirm("Supprimer cette ligne ?")) return;
    const res = await fetch("/veille/api/db-explorer", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, id }),
    });
    if (res.ok) {
      loadTable(table, page, search);
      // Refresh table counts
      fetch("/veille/api/db-explorer").then((r) => r.json()).then((d) => setTables(d.tables || []));
    }
  };

  const runSQL = async () => {
    if (!sqlQuery.trim()) return;
    setSqlLoading(true);
    setSqlResult(null);
    try {
      const res = await fetch("/veille/api/db-explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlQuery }),
      });
      const d = await res.json();
      setSqlResult(d);
    } catch {
      setSqlResult({ error: "Erreur reseau" });
    }
    setSqlLoading(false);
  };

  const formatCell = (val: unknown, short = true): string => {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "object") {
      const s = JSON.stringify(val);
      return short && s.length > 40 ? s.substring(0, 37) + "..." : s;
    }
    const s = String(val);
    return short && s.length > 50 ? s.substring(0, 47) + "..." : s;
  };

  const cellColor = (val: unknown): string => {
    if (val === null || val === undefined) return "text-muted-foreground/30 italic";
    if (typeof val === "boolean") return val ? "text-green-400" : "text-red-400";
    if (typeof val === "number") return "text-blue-400";
    return "text-foreground/80";
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-muted-foreground font-mono text-[13px]">chargement...</div>;

  return (
    <div className="h-screen flex bg-white text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-56" : "w-0"} shrink-0 border-r border-gray-200 bg-gray-50 transition-all overflow-hidden`}>
        <div className="p-3 border-b border-gray-200">
          <div className="text-[11px] font-mono text-gray-500 uppercase tracking-wider mb-1">veille_ database</div>
          <div className="text-[10px] font-mono text-gray-400">
            {tables.reduce((s, t) => s + t.count, 0)} lignes / {tables.length} tables
          </div>
        </div>
        <div className="py-1">
          {tables.map((t) => (
            <button
              key={t.name}
              onClick={() => { loadTable(t.name); setSearch(""); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] font-mono flex items-center justify-between transition-colors hover:bg-blue-50 ${
                activeTable === t.name ? "bg-blue-50 text-blue-600" : "text-gray-900"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[10px]">{t.icon}</span>
                {t.name}
              </span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded">{t.count}</span>
            </button>
          ))}
        </div>
        {/* SQL section */}
        <div className="border-t border-gray-200 p-3">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">SQL Query</div>
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="SELECT * FROM articles LIMIT 5"
            className="w-full h-20 bg-white border border-gray-200 rounded text-[10px] font-mono p-2 text-gray-900 resize-none focus:border-[#58a6ff] focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) runSQL(); }}
          />
          <button
            onClick={runSQL}
            disabled={sqlLoading}
            className="mt-1 w-full py-1 bg-gray-100 hover:bg-gray-200 text-[10px] font-mono rounded border border-gray-200 transition-colors"
          >
            {sqlLoading ? "..." : "Executer (Ctrl+Enter)"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-900 text-[14px]">
            {sidebarOpen ? "◀" : "▶"}
          </button>
          <button
            onClick={() => { setShowSchema(!showSchema); setActiveTable(null); }}
            className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${showSchema ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"}`}
          >
            Schema
          </button>
          {activeTable && (
            <>
              <span className="text-[13px] font-mono font-semibold text-blue-600">{activeTable}</span>
              <span className="text-[11px] text-gray-400 font-mono">{data?.total || 0} lignes</span>
              <div className="flex-1" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="rechercher..."
                className="bg-white border border-gray-200 rounded px-2 py-1 text-[11px] font-mono w-48 focus:border-[#58a6ff] focus:outline-none"
              />
              <button onClick={handleSearch} className="text-[11px] font-mono bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border border-gray-200">
                filtrer
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {sqlResult && (
            <div className="border-b border-gray-200 bg-gray-50">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-mono text-gray-500">
                  {sqlResult.error ? "Erreur" : `${sqlResult.count} resultats`}
                </span>
                <button onClick={() => setSqlResult(null)} className="text-[10px] text-gray-400 hover:text-gray-900">fermer</button>
              </div>
              {sqlResult.error ? (
                <div className="px-3 pb-3 text-[11px] text-red-400 font-mono">{sqlResult.error}</div>
              ) : sqlResult.rows && Array.isArray(sqlResult.rows) && sqlResult.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        {Object.keys(sqlResult.rows[0] as Record<string, unknown>).map((col) => (
                          <th key={col} className="text-left px-3 py-1.5 text-gray-500 font-normal whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlResult.rows.map((row, i) => (
                        <tr key={i} className="border-b border-[#21262d] hover:bg-gray-50">
                          {Object.values(row as Record<string, unknown>).map((val, j) => (
                            <td key={j} className={`px-3 py-1 whitespace-nowrap ${cellColor(val)}`}>{formatCell(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-3 pb-3 text-[11px] text-gray-400">0 resultats</div>
              )}
            </div>
          )}

          {showSchema ? (
            <div className="p-6 overflow-auto">
              <h2 className="text-[18px] font-semibold mb-6">Schema de la base de donnees</h2>

              {/* Main ERD diagram */}
              <div className="mb-8">
                <h3 className="text-[14px] font-semibold mb-3 text-gray-600">Relations entre les tables</h3>
                <svg viewBox="0 0 920 540" className="w-full max-w-[920px] border border-gray-200 rounded-lg bg-gray-50" style={{fontFamily: "ui-monospace, monospace"}}>
                  <defs>
                    <marker id="fk" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto"><circle cx="4" cy="4" r="3" fill="#6b7280"/></marker>
                    <marker id="fkEnd" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 10 0 L 0 5 L 10 10 z" fill="#6b7280"/></marker>
                  </defs>

                  {/* ── USERS ── */}
                  <rect x="20" y="30" width="200" height="200" rx="8" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2"/>
                  <text x="120" y="55" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e40af">users</text>
                  <line x1="20" y1="65" x2="220" y2="65" stroke="#3b82f6" strokeWidth="1"/>
                  <text x="30" y="82" fontSize="10" fill="#374151">id (PK)</text>
                  <text x="30" y="97" fontSize="10" fill="#374151">username</text>
                  <text x="30" y="112" fontSize="10" fill="#374151">email / discordId</text>
                  <text x="30" y="127" fontSize="10" fill="#374151">prompt</text>
                  <text x="30" y="142" fontSize="10" fill="#6b7280">prompt_config (JSON)</text>
                  <text x="30" y="157" fontSize="10" fill="#374151">webhookUrl</text>
                  <text x="30" y="172" fontSize="10" fill="#6b7280">sync_hours (JSON)</text>
                  <text x="30" y="187" fontSize="10" fill="#374151">min_score</text>
                  <text x="30" y="202" fontSize="10" fill="#374151">is_public</text>

                  {/* ── ARTICLES ── */}
                  <rect x="450" y="30" width="200" height="200" rx="8" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2"/>
                  <text x="550" y="55" textAnchor="middle" fontSize="13" fontWeight="700" fill="#15803d">articles</text>
                  <line x1="450" y1="65" x2="650" y2="65" stroke="#22c55e" strokeWidth="1"/>
                  <text x="460" y="82" fontSize="10" fill="#374151">id (PK)</text>
                  <text x="460" y="97" fontSize="10" fill="#374151">title / title_original</text>
                  <text x="460" y="112" fontSize="10" fill="#374151">url</text>
                  <text x="460" y="127" fontSize="10" fill="#374151">summary</text>
                  <text x="460" y="142" fontSize="10" fill="#374151">platform / source</text>
                  <text x="460" y="157" fontSize="10" fill="#374151">score (0-10)</text>
                  <text x="460" y="172" fontSize="10" fill="#374151">category (ia/cyber/tech)</text>
                  <text x="460" y="187" fontSize="10" fill="#374151">is_official</text>
                  <text x="460" y="202" fontSize="10" fill="#6b7280">UNIQUE(platform, external_id)</text>

                  {/* ── JUNCTION TABLES (between users & articles) ── */}
                  <rect x="255" y="280" width="160" height="55" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
                  <text x="335" y="302" textAnchor="middle" fontSize="12" fontWeight="600" fill="#92400e">likes</text>
                  <text x="335" y="320" textAnchor="middle" fontSize="9" fill="#78716c">user_id + article_id (UNIQUE)</text>

                  <rect x="255" y="350" width="160" height="55" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
                  <text x="335" y="372" textAnchor="middle" fontSize="12" fontWeight="600" fill="#92400e">bookmarks</text>
                  <text x="335" y="390" textAnchor="middle" fontSize="9" fill="#78716c">user_id + article_id + tags (JSON)</text>

                  <rect x="255" y="420" width="160" height="50" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
                  <text x="335" y="442" textAnchor="middle" fontSize="12" fontWeight="600" fill="#92400e">article_reads</text>
                  <text x="335" y="458" textAnchor="middle" fontSize="9" fill="#78716c">user_id + article_id</text>

                  {/* Lines: users → junction tables (left side) */}
                  <line x1="220" y1="180" x2="255" y2="305" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <line x1="220" y1="190" x2="255" y2="375" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <line x1="220" y1="200" x2="255" y2="445" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#fk)"/>

                  {/* Lines: junction tables → articles (right side) */}
                  <line x1="415" y1="305" x2="450" y2="180" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <line x1="415" y1="375" x2="450" y2="190" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <line x1="415" y1="445" x2="450" y2="200" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#fk)"/>

                  {/* ── SOCIAL ── */}
                  <rect x="20" y="290" width="180" height="60" rx="6" fill="#fae8ff" stroke="#a855f7" strokeWidth="1.5"/>
                  <text x="110" y="313" textAnchor="middle" fontSize="12" fontWeight="600" fill="#7e22ce">friendships</text>
                  <text x="110" y="330" textAnchor="middle" fontSize="9" fill="#78716c">user_id + friend_id + status</text>

                  <rect x="20" y="365" width="180" height="60" rx="6" fill="#fae8ff" stroke="#a855f7" strokeWidth="1.5"/>
                  <text x="110" y="388" textAnchor="middle" fontSize="12" fontWeight="600" fill="#7e22ce">shared_articles</text>
                  <text x="110" y="405" textAnchor="middle" fontSize="9" fill="#78716c">from_id + to_id + article_id + msg</text>

                  <rect x="20" y="440" width="180" height="45" rx="6" fill="#fae8ff" stroke="#a855f7" strokeWidth="1.5"/>
                  <text x="110" y="460" textAnchor="middle" fontSize="12" fontWeight="600" fill="#7e22ce">share_replies</text>
                  <text x="110" y="475" textAnchor="middle" fontSize="9" fill="#78716c">shared_article_id + user_id + msg</text>

                  {/* Social lines: users → friendships, shared_articles */}
                  <line x1="120" y1="230" x2="120" y2="290" stroke="#a855f7" strokeWidth="1.5" markerEnd="url(#fk)"/>
                  <line x1="100" y1="230" x2="100" y2="365" stroke="#a855f7" strokeWidth="1.5" markerEnd="url(#fk)"/>
                  {/* shared_articles → share_replies */}
                  <line x1="110" y1="425" x2="110" y2="440" stroke="#a855f7" strokeWidth="1.5" markerEnd="url(#fk)"/>

                  {/* ── CONFIG (right side) ── */}
                  <rect x="700" y="30" width="190" height="50" rx="6" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5"/>
                  <text x="795" y="52" textAnchor="middle" fontSize="12" fontWeight="600" fill="#065f46">presets</text>
                  <text x="795" y="68" textAnchor="middle" fontSize="9" fill="#78716c">user_id + categories + keywords</text>

                  <rect x="700" y="95" width="190" height="50" rx="6" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5"/>
                  <text x="795" y="117" textAnchor="middle" fontSize="12" fontWeight="600" fill="#065f46">prompt_history</text>
                  <text x="795" y="133" textAnchor="middle" fontSize="9" fill="#78716c">user_id + prompt + config (JSON)</text>

                  <rect x="700" y="165" width="190" height="50" rx="6" fill="#fff7ed" stroke="#f97316" strokeWidth="1.5"/>
                  <text x="795" y="187" textAnchor="middle" fontSize="12" fontWeight="600" fill="#c2410c">notification_logs</text>
                  <text x="795" y="203" textAnchor="middle" fontSize="9" fill="#78716c">user_id + article_count + success</text>

                  <rect x="700" y="230" width="190" height="50" rx="6" fill="#fff7ed" stroke="#f97316" strokeWidth="1.5"/>
                  <text x="795" y="252" textAnchor="middle" fontSize="12" fontWeight="600" fill="#c2410c">password_resets</text>
                  <text x="795" y="268" textAnchor="middle" fontSize="9" fill="#78716c">user_id + token + expires_at</text>

                  {/* Config lines: horizontal from users right side → config left side */}
                  <path d="M220 80 L340 55 L700 55" stroke="#10b981" strokeWidth="1.5" fill="none" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <path d="M220 90 L340 120 L700 120" stroke="#10b981" strokeWidth="1.5" fill="none" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <path d="M220 100 L340 190 L700 190" stroke="#f97316" strokeWidth="1" fill="none" strokeDasharray="5,3" markerEnd="url(#fk)"/>
                  <path d="M220 110 L340 255 L700 255" stroke="#f97316" strokeWidth="1" fill="none" strokeDasharray="5,3" markerEnd="url(#fk)"/>

                  {/* ── LEGEND ── */}
                  <rect x="620" y="340" width="280" height="185" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
                  <text x="640" y="365" fontSize="12" fontWeight="700" fill="#374151">Legende</text>
                  <rect x="640" y="380" width="14" height="14" rx="3" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5"/>
                  <text x="662" y="392" fontSize="10" fill="#374151">Tables principales (users, articles)</text>
                  <rect x="640" y="402" width="14" height="14" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
                  <text x="662" y="414" fontSize="10" fill="#374151">Tables de liaison (many-to-many)</text>
                  <rect x="640" y="424" width="14" height="14" rx="3" fill="#fae8ff" stroke="#a855f7" strokeWidth="1.5"/>
                  <text x="662" y="436" fontSize="10" fill="#374151">Tables sociales</text>
                  <rect x="640" y="446" width="14" height="14" rx="3" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.5"/>
                  <text x="662" y="458" fontSize="10" fill="#374151">Configuration par utilisateur</text>
                  <rect x="640" y="468" width="14" height="14" rx="3" fill="#fff7ed" stroke="#f97316" strokeWidth="1.5"/>
                  <text x="662" y="480" fontSize="10" fill="#374151">Logs et tokens</text>
                  <line x1="640" y1="498" x2="665" y2="498" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,3"/>
                  <circle cx="668" cy="498" r="3" fill="#6b7280"/>
                  <text x="678" y="502" fontSize="10" fill="#374151">Cle etrangere (FK)</text>
                </svg>
              </div>

              {/* Data flow diagram */}
              <div className="mb-8">
                <h3 className="text-[14px] font-semibold mb-3 text-gray-600">Flux de donnees</h3>
                <svg viewBox="0 0 900 300" className="w-full max-w-[900px] border border-gray-200 rounded-lg bg-gray-50" style={{fontFamily: "ui-monospace, monospace"}}>
                  {/* User */}
                  <rect x="20" y="110" width="120" height="60" rx="30" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2"/>
                  <text x="80" y="145" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1e40af">Utilisateur</text>

                  {/* Arrow */}
                  <line x1="140" y1="140" x2="175" y2="140" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrow)"/>
                  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280"/></marker></defs>
                  <text x="157" y="132" textAnchor="middle" fontSize="8" fill="#9ca3af">phrase</text>

                  {/* Ollama */}
                  <rect x="180" y="100" width="130" height="80" rx="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2"/>
                  <text x="245" y="130" textAnchor="middle" fontSize="11" fontWeight="700" fill="#92400e">Ollama</text>
                  <text x="245" y="145" textAnchor="middle" fontSize="9" fill="#78716c">Qwen 2.5 3B</text>
                  <text x="245" y="160" textAnchor="middle" fontSize="8" fill="#78716c">interpretation + scoring</text>
                  <text x="245" y="172" textAnchor="middle" fontSize="8" fill="#78716c">+ resumes + digests</text>

                  {/* Arrow */}
                  <line x1="310" y1="140" x2="345" y2="140" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrow)"/>
                  <text x="327" y="132" textAnchor="middle" fontSize="8" fill="#9ca3af">JSON</text>

                  {/* PostgreSQL */}
                  <rect x="350" y="90" width="140" height="100" rx="8" fill="#dbeafe" stroke="#2563eb" strokeWidth="2"/>
                  <text x="420" y="120" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e40af">PostgreSQL</text>
                  <text x="420" y="138" textAnchor="middle" fontSize="9" fill="#64748b">12 tables</text>
                  <text x="420" y="153" textAnchor="middle" fontSize="9" fill="#64748b">users, articles,</text>
                  <text x="420" y="168" textAnchor="middle" fontSize="9" fill="#64748b">likes, bookmarks...</text>
                  <text x="420" y="183" textAnchor="middle" fontSize="9" fill="#64748b">Prisma ORM</text>

                  {/* Arrow left - collecteur */}
                  <line x1="420" y1="90" x2="420" y2="50" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrow)"/>

                  {/* Collecteur */}
                  <rect x="350" y="5" width="140" height="45" rx="8" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2"/>
                  <text x="420" y="25" textAnchor="middle" fontSize="11" fontWeight="700" fill="#15803d">tech-veille</text>
                  <text x="420" y="40" textAnchor="middle" fontSize="8" fill="#78716c">collecteur Python (cron 1h)</text>

                  {/* Sources */}
                  <rect x="550" y="5" width="330" height="45" rx="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1"/>
                  <text x="565" y="25" fontSize="9" fontWeight="600" fill="#475569">Sources :</text>
                  <text x="565" y="40" fontSize="8" fill="#64748b">Reddit  |  HackerNews  |  RSS  |  arXiv  |  GitHub Releases  |  Blogs</text>
                  <line x1="550" y1="27" x2="490" y2="27" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)"/>

                  {/* Arrow right - API */}
                  <line x1="490" y1="140" x2="545" y2="140" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrow)"/>

                  {/* Next.js API */}
                  <rect x="550" y="100" width="140" height="80" rx="8" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2"/>
                  <text x="620" y="130" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5b21b6">Next.js API</text>
                  <text x="620" y="148" textAnchor="middle" fontSize="9" fill="#78716c">30 endpoints REST</text>
                  <text x="620" y="163" textAnchor="middle" fontSize="9" fill="#78716c">classification a la volee</text>
                  <text x="620" y="175" textAnchor="middle" fontSize="8" fill="#a78bfa">relevant / discover</text>

                  {/* Arrow right - Frontend */}
                  <line x1="690" y1="140" x2="725" y2="140" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrow)"/>

                  {/* Frontend */}
                  <rect x="730" y="110" width="140" height="60" rx="8" fill="#fce7f3" stroke="#ec4899" strokeWidth="2"/>
                  <text x="800" y="135" textAnchor="middle" fontSize="11" fontWeight="700" fill="#be185d">Frontend React</text>
                  <text x="800" y="153" textAnchor="middle" fontSize="9" fill="#78716c">Feed, Bookmarks, Social</text>

                  {/* Notifications */}
                  <rect x="550" y="220" width="140" height="60" rx="8" fill="#ecfdf5" stroke="#10b981" strokeWidth="2"/>
                  <text x="620" y="245" textAnchor="middle" fontSize="11" fontWeight="700" fill="#065f46">Notifications</text>
                  <text x="620" y="262" textAnchor="middle" fontSize="9" fill="#78716c">Discord / Slack (digest IA)</text>
                  <line x1="420" y1="190" x2="420" y2="250" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4"/>
                  <line x1="420" y1="250" x2="550" y2="250" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow)" strokeDasharray="4"/>
                  <text x="485" y="242" textAnchor="middle" fontSize="8" fill="#9ca3af">nouveaux articles</text>

                  {/* Nginx */}
                  <rect x="730" y="220" width="140" height="45" rx="8" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5"/>
                  <text x="800" y="242" textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">Nginx</text>
                  <text x="800" y="257" textAnchor="middle" fontSize="8" fill="#94a3b8">reverse proxy + SSL</text>
                  <line x1="800" y1="170" x2="800" y2="220" stroke="#64748b" strokeWidth="1" strokeDasharray="3"/>
                </svg>
              </div>

              {/* JSON example */}
              <div className="mb-8">
                <h3 className="text-[14px] font-semibold mb-3 text-gray-600">Exemple : prompt_config (JSON stocke dans users)</h3>
                <p className="text-[12px] text-gray-500 mb-2">Quand un utilisateur ecrit &quot;les nouvelles features de Claude Code&quot;, l&apos;IA genere ce JSON :</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-[11px] leading-relaxed overflow-x-auto">{`{
  "keywords": ["claude code", "claude code features", "anthropic claude code"],
  "hn_keywords": ["Claude Code", "Claude Code features"],
  "subreddits": ["ClaudeAI", "anthropic"],
  "github_repos": [
    { "repo": "anthropics/claude-code", "label": "Claude Code", "category": "ia" }
  ],
  "twitter_accounts": ["AnthropicAI"],
  "scoring_instructions": "Articles Claude Code: 8-10. Claude AI general: 5-7. Autres: 2-4."
}`}</pre>
                <p className="text-[11px] text-gray-400 mt-2">Ce JSON sert a configurer le collecteur (quoi chercher) et l&apos;API (comment classer les articles dans le feed).</p>
              </div>

              {/* Classification explanation */}
              <div>
                <h3 className="text-[14px] font-semibold mb-3 text-gray-600">Classification des articles (calcul a la volee, pas en base)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                    <div className="text-[12px] font-bold text-blue-700 mb-1">followed</div>
                    <div className="text-[10px] text-blue-600">Source dans les RSS ou subreddits de l&apos;utilisateur</div>
                  </div>
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <div className="text-[12px] font-bold text-green-700 mb-1">relevant</div>
                    <div className="text-[10px] text-green-600">Titre ou resume contient un keyword de l&apos;utilisateur</div>
                  </div>
                  <div className="border border-gray-200 bg-gray-50 rounded-lg p-3">
                    <div className="text-[12px] font-bold text-gray-600 mb-1">discover</div>
                    <div className="text-[10px] text-gray-500">Tout le reste (articles pour explorer)</div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Cette classification change instantanement quand l&apos;utilisateur modifie sa phrase, sans toucher aux articles en base.</p>
              </div>
            </div>
          ) : !activeTable ? (
            <div className="flex items-center justify-center h-full text-gray-400 font-mono text-[13px]">
              Selectionne une table a gauche ou clique sur Schema
            </div>
          ) : tableLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 font-mono text-[12px]">chargement...</div>
          ) : data?.rows && data.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-normal w-8">#</th>
                    {Object.keys(data.rows[0]).filter(k => k !== "_count").map((col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 text-gray-500 font-normal whitespace-nowrap cursor-pointer hover:text-blue-600"
                        onClick={() => loadTable(activeTable, 1, search)}
                      >
                        {col}
                      </th>
                    ))}
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => {
                    const id = (row.id as string) || String(i);
                    const isExpanded = expandedRow === id;
                    return (
                      <>
                        <tr
                          key={id}
                          className={`border-b border-[#21262d] cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : "hover:bg-gray-50"}`}
                          onClick={() => setExpandedRow(isExpanded ? null : id)}
                        >
                          <td className="px-3 py-1.5 text-gray-400">{(page - 1) * 25 + i + 1}</td>
                          {Object.entries(row).filter(([k]) => k !== "_count").map(([key, val]) => (
                            <td key={key} className={`px-3 py-1.5 whitespace-nowrap max-w-[250px] overflow-hidden text-ellipsis ${cellColor(val)}`}>
                              {formatCell(val)}
                            </td>
                          ))}
                          <td className="px-3 py-1.5">
                            {activeTable !== "users" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(activeTable, id); }}
                                className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors"
                              >
                                suppr
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={id + "-detail"} className="bg-white">
                            <td colSpan={100} className="px-6 py-3">
                              <div className="grid grid-cols-1 gap-1.5 max-w-4xl">
                                {Object.entries(row).map(([key, val]) => (
                                  <div key={key} className="flex gap-3">
                                    <span className="text-[10px] text-gray-500 w-32 shrink-0 text-right pt-0.5">{key}</span>
                                    <pre className="text-[10px] text-gray-900 whitespace-pre-wrap break-all flex-1 bg-gray-50 rounded px-2 py-1 border border-[#21262d]">
                                      {formatCell(val, false)}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 font-mono text-[12px]">aucune donnee</div>
          )}
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
            <span className="text-[10px] text-gray-400 font-mono">
              Page {data.page}/{data.pages} ({data.total} lignes)
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => activeTable && loadTable(activeTable, page - 1, search)}
                className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 disabled:opacity-30"
              >
                Precedent
              </button>
              <button
                disabled={page >= (data.pages || 1)}
                onClick={() => activeTable && loadTable(activeTable, page + 1, search)}
                className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 disabled:opacity-30"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
