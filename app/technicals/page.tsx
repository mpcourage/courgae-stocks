"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TechRow, TfLabel } from "@/app/api/technicals/route";
import type { SignalLabel } from "@/lib/indicators";

const TF_LABELS: TfLabel[] = ["1m", "5m", "15m", "30m", "1H", "5H", "1D", "1W", "1M"];

const SIGNAL_ORDER: Record<SignalLabel, number> = {
  "Strong Buy":  5,
  "Buy":         4,
  "Neutral":     3,
  "Sell":        2,
  "Strong Sell": 1,
};

const SIGNAL_WEIGHT: Record<SignalLabel, number> = {
  "Strong Buy":  2,
  "Buy":         1,
  "Neutral":     0,
  "Sell":       -1,
  "Strong Sell":-2,
};

function signalClass(s: SignalLabel | undefined): string {
  switch (s) {
    case "Strong Buy":  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "Buy":         return "bg-green-500/15  text-green-400   border-green-500/30";
    case "Neutral":     return "bg-slate-700/40  text-slate-400   border-slate-600/40";
    case "Sell":        return "bg-orange-500/20 text-orange-400  border-orange-500/30";
    case "Strong Sell": return "bg-red-500/20    text-red-400     border-red-500/30";
    default:            return "bg-slate-800/40  text-slate-600   border-slate-700/30";
  }
}

function signalShort(s: SignalLabel | undefined): string {
  switch (s) {
    case "Strong Buy":  return "S.Buy";
    case "Buy":         return "Buy";
    case "Neutral":     return "Neu";
    case "Sell":        return "Sell";
    case "Strong Sell": return "S.Sell";
    default:            return "—";
  }
}

function bullScore(row: TechRow): number {
  return TF_LABELS.reduce((sum, tf) => sum + (SIGNAL_WEIGHT[row.signals?.[tf]] ?? 0), 0);
}

function scoreColor(n: number): string {
  if (n >= 10)  return "text-emerald-400";
  if (n >= 4)   return "text-green-400";
  if (n <= -10) return "text-red-400";
  if (n <= -4)  return "text-orange-400";
  return "text-slate-400";
}

type SortKey = "symbol" | "sector" | "score" | TfLabel;

export default function TechnicalsPage() {
  const [rows, setRows]           = useState<TechRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [sector, setSector]       = useState("All");
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState<SortKey>("score");
  const [sortAsc, setSortAsc]     = useState(false);

  const load = useCallback(async (bust = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = bust ? `/api/technicals?bust=${Date.now()}` : "/api/technicals";
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.rows ?? []);
      setFetchedAt(json.fetchedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sectors = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.sector))).sort()], [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (sector !== "All") out = out.filter((r) => r.sector === sector);
    if (search.trim())    out = out.filter((r) =>
      r.symbol.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
    );
    return [...out].sort((a, b) => {
      let diff = 0;
      if (sortKey === "symbol")  diff = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "sector") diff = a.sector.localeCompare(b.sector);
      else if (sortKey === "score")  diff = bullScore(a) - bullScore(b);
      else {
        const sa = SIGNAL_ORDER[a.signals?.[sortKey]] ?? 0;
        const sb = SIGNAL_ORDER[b.signals?.[sortKey]] ?? 0;
        diff = sa - sb;
      }
      return sortAsc ? diff : -diff;
    });
  }, [rows, sector, search, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-700 ml-1">⇅</span>;
    return <span className="text-sky-400 ml-1">{sortAsc ? "↑" : "↓"}</span>;
  }

  // Per-timeframe signal distribution for summary bar
  const summary = useMemo(() =>
    TF_LABELS.map((tf) => {
      const counts = { "Strong Buy": 0, "Buy": 0, "Neutral": 0, "Sell": 0, "Strong Sell": 0 };
      for (const r of rows) {
        const s = r.signals?.[tf];
        if (s) counts[s]++;
      }
      return { tf, counts };
    }), [rows]);

  const ago = fetchedAt
    ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000)
    : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Technical Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Multi-timeframe signals for all 50 blue chips
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ago !== null && (
            <span className="text-xs text-slate-500">
              Updated {ago === 0 ? "just now" : `${ago}m ago`} · cached 5 min
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 disabled:opacity-40 transition-colors"
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Signal distribution summary */}
      {!loading && rows.length > 0 && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 overflow-x-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Signal distribution per timeframe
          </p>
          <div className="flex gap-3 min-w-max">
            {summary.map(({ tf, counts }) => {
              const bull = counts["Strong Buy"] + counts["Buy"];
              const bear = counts["Sell"] + counts["Strong Sell"];
              const total = rows.length;
              return (
                <div key={tf} className="text-center w-20">
                  <p className="text-xs font-mono text-slate-400 mb-1">{tf}</p>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(counts["Strong Buy"] / total) * 100}%` }} />
                    <div className="bg-green-500  h-full" style={{ width: `${(counts["Buy"]        / total) * 100}%` }} />
                    <div className="bg-slate-600  h-full" style={{ width: `${(counts["Neutral"]    / total) * 100}%` }} />
                    <div className="bg-orange-500 h-full" style={{ width: `${(counts["Sell"]       / total) * 100}%` }} />
                    <div className="bg-red-500    h-full" style={{ width: `${(counts["Strong Sell"]/ total) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-green-400 mt-1">{bull}B</p>
                  <p className="text-[10px] text-red-400">{bear}S</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search symbol or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-52"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
        >
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>
        {(search || sector !== "All") && (
          <button
            onClick={() => { setSearch(""); setSector("All"); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-600 ml-auto">
          {filtered.length} / {rows.length} stocks
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                {/* Sticky columns */}
                <th
                  onClick={() => handleSort("symbol")}
                  className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-white whitespace-nowrap sticky left-0 bg-slate-900 z-10"
                >
                  Symbol <SortIcon k="symbol" />
                </th>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap hidden sm:table-cell">
                  Name
                </th>
                <th
                  onClick={() => handleSort("sector")}
                  className="px-3 py-3 text-left font-semibold cursor-pointer hover:text-white whitespace-nowrap hidden md:table-cell"
                >
                  Sector <SortIcon k="sector" />
                </th>
                <th
                  onClick={() => handleSort("score")}
                  className="px-3 py-3 text-center font-semibold cursor-pointer hover:text-white whitespace-nowrap"
                >
                  Score <SortIcon k="score" />
                </th>
                {TF_LABELS.map((tf) => (
                  <th
                    key={tf}
                    onClick={() => handleSort(tf)}
                    className="px-2 py-3 text-center font-semibold cursor-pointer hover:text-white whitespace-nowrap"
                  >
                    {tf} <SortIcon k={tf} />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="px-4 py-2.5 sticky left-0 bg-slate-900">
                        <div className="h-4 w-14 bg-slate-800 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <div className="h-3.5 w-32 bg-slate-800 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="h-3.5 w-20 bg-slate-800 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="h-5 w-8 bg-slate-800 rounded animate-pulse mx-auto" />
                      </td>
                      {TF_LABELS.map((tf) => (
                        <td key={tf} className="px-2 py-2.5">
                          <div className="h-5 w-12 bg-slate-800 rounded animate-pulse mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((row) => {
                    const score = bullScore(row);
                    return (
                      <tr
                        key={row.symbol}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 sticky left-0 bg-slate-900 hover:bg-slate-800/30">
                          <Link
                            href={`/charts?symbol=${row.symbol}`}
                            className="font-mono font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                          >
                            {row.symbol}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap hidden sm:table-cell">
                          {row.name}
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-400">
                            {row.sector}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-mono font-bold text-sm ${scoreColor(score)}`}>
                            {score > 0 ? `+${score}` : score}
                          </span>
                        </td>
                        {TF_LABELS.map((tf) => {
                          const sig = row.signals?.[tf];
                          return (
                            <td key={tf} className="px-2 py-2.5 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium border ${signalClass(sig)}`}>
                                {signalShort(sig)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

              {!loading && filtered.length === 0 && rows.length > 0 && (
                <tr>
                  <td colSpan={4 + TF_LABELS.length} className="py-12 text-center text-slate-500">
                    No stocks match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>Score = sum of signal weights across all timeframes (+2 S.Buy, +1 Buy, 0 Neu, −1 Sell, −2 S.Sell)</span>
        <span className="ml-auto">Click any column header to sort</span>
      </div>
    </div>
  );
}
