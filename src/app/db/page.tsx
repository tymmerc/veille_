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

          {!activeTable ? (
            <div className="flex items-center justify-center h-full text-gray-400 font-mono text-[13px]">
              Selectionne une table a gauche
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
