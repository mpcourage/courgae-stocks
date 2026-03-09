"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RefreshRing from "@/components/RefreshRing";
import { getMarketSession } from "@/lib/marketSession";
import AddToTradeButton from "@/components/AddToTradeButton";
import type { TechRow, TfLabel } from "@/app/api/technicals/route";
import type { SignalLabel, MAComponent } from "@/lib/indicators";

const TF_LABELS: TfLabel[] = ["1m", "5m", "15m", "30m", "1H", "5H", "1D", "1W", "1M"];
const MA_COMPONENTS: MAComponent[] = ["SMA20", "SMA50", "GX", "EMA12", "EMA26", "EMA200"];

const SIGNAL_ORDER: Record<SignalLabel, number> = {
  "Strong Buy": 5, "Buy": 4, "Neutral": 3, "Sell": 2, "Strong Sell": 1,
};
const SIGNAL_WEIGHT: Record<SignalLabel, number> = {
  "Strong Buy": 2, "Buy": 1, "Neutral": 0, "Sell": -1, "Strong Sell": -2,
};

const SIGNAL_LETTER: Record<string, { letter: string; cls: string }> = {
  "Strong Buy":  { letter: "B", cls: "text-green-700 font-bold" },
  "Buy":         { letter: "B", cls: "text-green-200 font-semibold" },
  "Neutral":     { letter: "N", cls: "text-slate-500 font-normal" },
  "Sell":        { letter: "S", cls: "text-orange-400 font-semibold" },
  "Strong Sell": { letter: "S", cls: "text-red-500 font-bold" },
};

function SignalLetter({ signal }: { signal: string | undefined }) {
  const s = signal ? (SIGNAL_LETTER[signal] ?? SIGNAL_LETTER["Neutral"]) : { letter: "·", cls: "text-slate-700 font-normal" };
  return (
    <span className={`text-[11px] leading-none select-none ${s.cls}`} title={signal ?? "—"}>
      {s.letter}
    </span>
  );
}

function bullScore(row: TechRow): number {
  return TF_LABELS.reduce((s, tf) => s + (SIGNAL_WEIGHT[row.signals?.[tf]] ?? 0), 0);
}

function tfScoreColor(n: number) {
  if (n >= 10) return "text-emerald-400";
  if (n >= 4)  return "text-green-400";
  if (n <= -10) return "text-red-400";
  if (n <= -4) return "text-orange-400";
  return "text-slate-400";
}

function maScoreColor(n: number) {
  if (n >= 4)  return "text-emerald-400";
  if (n >= 2)  return "text-green-400";
  if (n <= -4) return "text-red-400";
  if (n <= -2) return "text-orange-400";
  return "text-slate-500";
}

function MABar({ score }: { score: number }) {
  const max = 6;
  const pos = Math.max(0, score);
  const neg = Math.abs(Math.min(0, score));
  return (
    <div className="flex items-center gap-1 justify-center">
      <div className="flex w-14 h-1.5 bg-slate-800 overflow-hidden rounded-full">
        <div className="w-1/2 flex items-center justify-end overflow-hidden">
          <div className="h-full bg-red-500/80" style={{ width: `${(neg / max) * 100}%` }} />
        </div>
        <div className="w-px h-full bg-slate-600 shrink-0" />
        <div className="w-1/2 flex items-center overflow-hidden">
          <div className="h-full bg-green-500/80" style={{ width: `${(pos / max) * 100}%` }} />
        </div>
      </div>
      <span className={`text-[10px] font-mono font-semibold w-4 text-right ${maScoreColor(score)}`}>
        {score > 0 ? `+${score}` : score}
      </span>
    </div>
  );
}

const MA_ABBR: Record<string, string> = {
  SMA20: "20", SMA50: "50", GX: "GX", EMA12: "E12", EMA26: "E26", EMA200: "E200",
};

type SortKey = "symbol" | "score" | "ma" | TfLabel | MAComponent;

export default function TechnicalsPage() {
  const [rows, setRows]           = useState<TechRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [sector, setSector]       = useState("All");
  const [search, setSearch]       = useState("");
  const [sort, setSort]           = useState<{ key: SortKey; asc: boolean }>({ key: "score", asc: false });
  const [countdown, setCountdown] = useState(60);

  const load = useCallback(async (bust = false) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(bust ? `/api/technicals?bust=${Date.now()}` : "/api/technicals");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.rows ?? []); setFetchedAt(json.fetchedAt ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setCountdown(60);
    const t = setInterval(() => {
      if (getMarketSession() === "closed") return;
      setCountdown((c) => {
        if (c <= 1) { load(true); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(rows.map(r => r.sector))).sort()],
    [rows]
  );

  const overview = useMemo(() => {
    if (!rows.length) return null;
    const bullish = rows.filter(r => bullScore(r) > 3).length;
    const bearish = rows.filter(r => bullScore(r) < -3).length;
    const avg = rows.reduce((s, r) => s + bullScore(r), 0) / rows.length;
    const sorted = [...rows].sort((a, b) => bullScore(b) - bullScore(a));
    return {
      bullish, bearish, neutral: rows.length - bullish - bearish, avg,
      topBulls: sorted.slice(0, 4), topBears: sorted.slice(-4).reverse(),
    };
  }, [rows]);

  const tfSummary = useMemo(() =>
    TF_LABELS.map(tf => {
      const c = { "Strong Buy": 0, "Buy": 0, "Neutral": 0, "Sell": 0, "Strong Sell": 0 } as Record<SignalLabel, number>;
      for (const r of rows) { const s = r.signals?.[tf]; if (s) c[s]++; }
      return { tf, c, bull: c["Strong Buy"] + c["Buy"], bear: c["Sell"] + c["Strong Sell"] };
    }), [rows]);

  const maSummary = useMemo(() =>
    MA_COMPONENTS.map(comp => {
      let buy = 0, sell = 0;
      for (const r of rows) {
        if (r.ma?.components?.[comp] === "Buy") buy++;
        else if (r.ma?.components?.[comp] === "Sell") sell++;
      }
      return { comp, buy, sell };
    }), [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (sector !== "All") out = out.filter(r => r.sector === sector);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    return [...out].sort((a, b) => {
      let diff = 0;
      if (sort.key === "symbol")     diff = a.symbol.localeCompare(b.symbol);
      else if (sort.key === "score") diff = bullScore(a) - bullScore(b);
      else if (sort.key === "ma")    diff = (a.ma?.score ?? 0) - (b.ma?.score ?? 0);
      else if ((TF_LABELS as string[]).includes(sort.key)) {
        diff = (SIGNAL_ORDER[a.signals?.[sort.key as TfLabel]] ?? 0) -
               (SIGNAL_ORDER[b.signals?.[sort.key as TfLabel]] ?? 0);
      } else {
        const comp = sort.key as MAComponent;
        const va = a.ma?.components?.[comp] === "Buy" ? 1 : a.ma?.components?.[comp] === "Sell" ? -1 : 0;
        const vb = b.ma?.components?.[comp] === "Buy" ? 1 : b.ma?.components?.[comp] === "Sell" ? -1 : 0;
        diff = va - vb;
      }
      return sort.asc ? diff : -diff;
    });
  }, [rows, sector, search, sort]);

  function handleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, asc: !prev.asc } : { key, asc: false });
  }

  function SI({ k }: { k: SortKey }) {
    if (sort.key !== k) return <span className="text-slate-700 ml-0.5 text-[10px]">⇅</span>;
    return <span className="text-sky-400 ml-0.5 text-[10px]">{sort.asc ? "↑" : "↓"}</span>;
  }


  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Technical Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Multi-timeframe signals + MA breakdown — all 50 blue chips, grouped by symbol
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-[11px] text-slate-500 tabular-nums">
              Updated {new Date(fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" })}
            </span>
          )}
          <RefreshRing countdown={countdown} total={60} loading={loading} onClick={() => { load(true); setCountdown(60); }} />
        </div>
      </div>

      {/* Overview banner */}
      {overview && !loading && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Bullish", value: overview.bullish,                  color: "text-green-400",   note: "score > 3" },
              { label: "Neutral", value: overview.neutral,                  color: "text-slate-400",   note: "−3 to +3" },
              { label: "Bearish", value: overview.bearish,                  color: "text-orange-400",  note: "score < −3" },
              { label: "Avg Score", value: (overview.avg >= 0 ? "+" : "") + overview.avg.toFixed(1),
                color: tfScoreColor(overview.avg), note: "TF weighted" },
            ].map(({ label, value, color, note }) => (
              <div key={label} className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{note}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-800">
            <span className="text-xs text-slate-500">Top Bulls</span>
            {overview.topBulls.map(r => (
              <Link key={r.symbol} href={`/equity?symbol=${r.symbol}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 hover:border-green-400/40 transition-colors">
                <span className="text-xs font-bold text-green-400">{r.symbol}</span>
                <span className="text-[10px] font-mono text-green-500/70">{bullScore(r) > 0 ? `+${bullScore(r)}` : bullScore(r)}</span>
              </Link>
            ))}
            <span className="text-slate-700 mx-0.5">·</span>
            <span className="text-xs text-slate-500">Top Bears</span>
            {overview.topBears.map(r => (
              <Link key={r.symbol} href={`/equity?symbol=${r.symbol}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 hover:border-red-400/40 transition-colors">
                <span className="text-xs font-bold text-orange-400">{r.symbol}</span>
                <span className="text-[10px] font-mono text-red-500/70">{bullScore(r)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Signal distributions — two side-by-side strips */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* TF distribution */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Timeframe signals
            </p>
            <div className="flex gap-1.5">
              {tfSummary.map(({ tf, c, bull, bear }) => (
                <div key={tf} className="flex-1 text-center">
                  <p className="text-[10px] font-mono text-slate-500 mb-1.5">{tf}</p>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(c["Strong Buy"] / rows.length) * 100}%` }} />
                    <div className="bg-green-500  h-full" style={{ width: `${(c["Buy"]        / rows.length) * 100}%` }} />
                    <div className="bg-slate-600  h-full" style={{ width: `${(c["Neutral"]    / rows.length) * 100}%` }} />
                    <div className="bg-orange-500 h-full" style={{ width: `${(c["Sell"]       / rows.length) * 100}%` }} />
                    <div className="bg-red-500    h-full" style={{ width: `${(c["Strong Sell"]/ rows.length) * 100}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-green-400">{bull}</span>
                    <span className="text-[9px] text-red-400">{bear}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MA component distribution */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              MA signals <span className="text-slate-600 font-normal normal-case">(daily)</span>
            </p>
            <div className="flex gap-1.5">
              {maSummary.map(({ comp, buy, sell }) => (
                <div key={comp} className="flex-1 text-center">
                  <p className="text-[10px] font-mono text-slate-500 mb-1.5">{comp}</p>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                    <div className="bg-green-500 h-full" style={{ width: `${(buy  / rows.length) * 100}%` }} />
                    <div className="bg-red-500   h-full" style={{ width: `${(sell / rows.length) * 100}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-green-400">{buy}</span>
                    <span className="text-[9px] text-red-400">{sell}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search symbol or name…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-52" />
        <select value={sector} onChange={e => setSector(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500">
          {sectors.map(s => <option key={s}>{s}</option>)}
        </select>
        {(search || sector !== "All") && (
          <button onClick={() => { setSearch(""); setSector("All"); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
        )}
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} / {rows.length} stocks</span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* ── Unified table ── */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div>
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Group headers */}
              <tr className="border-b border-slate-800">
                <th colSpan={1} className="px-3 py-1.5 text-left" />
                <th
                  colSpan={TF_LABELS.length + 1}
                  className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-widest border-l border-slate-700 bg-slate-800/20"
                >
                  Timeframe Signals
                </th>
                <th
                  colSpan={MA_COMPONENTS.length + 1}
                  className="px-2 py-1.5 text-center text-[10px] font-semibold text-sky-600 uppercase tracking-widest border-l border-slate-700 bg-sky-950/20"
                >
                  Moving Average
                </th>
              </tr>
              {/* Column headers */}
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                <th onClick={() => handleSort("symbol")}
                  className="px-3 py-2 text-left font-semibold cursor-pointer hover:text-white whitespace-nowrap sticky left-0 bg-slate-900 z-10">
                  Symbol <SI k="symbol" />
                </th>

                {/* TF section */}
                <th onClick={() => handleSort("score")}
                  className="px-1 py-2 text-center font-semibold cursor-pointer hover:text-white whitespace-nowrap border-l border-slate-700 bg-slate-800/10">
                  Sc <SI k="score" />
                </th>
                {TF_LABELS.map(tf => (
                  <th key={tf} onClick={() => handleSort(tf)}
                    className="px-1 py-2 text-center font-semibold cursor-pointer hover:text-white whitespace-nowrap bg-slate-800/10">
                    {tf} <SI k={tf} />
                  </th>
                ))}

                {/* MA section */}
                <th onClick={() => handleSort("ma")}
                  className="px-1 py-2 text-center font-semibold cursor-pointer hover:text-white whitespace-nowrap border-l border-slate-700 bg-sky-950/10">
                  MA <SI k="ma" />
                </th>
                {MA_COMPONENTS.map(comp => (
                  <th key={comp} onClick={() => handleSort(comp)}
                    className="px-1 py-2 text-center font-semibold cursor-pointer hover:text-white whitespace-nowrap bg-sky-950/10">
                    {MA_ABBR[comp] ?? comp} <SI k={comp} />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="px-3 py-2 sticky left-0 bg-slate-900">
                        <div className="h-3 w-10 bg-slate-800 rounded animate-pulse" />
                      </td>
                      <td className="px-1 py-2 border-l border-slate-800">
                        <div className="h-3 w-6 bg-slate-800 rounded animate-pulse mx-auto" />
                      </td>
                      {TF_LABELS.map(tf => (
                        <td key={tf} className="px-1 py-2">
                          <div className="w-2 h-2 rounded-full bg-slate-800 mx-auto animate-pulse" />
                        </td>
                      ))}
                      <td className="px-1 py-2 border-l border-slate-800">
                        <div className="h-1.5 w-14 bg-slate-800 rounded animate-pulse mx-auto" />
                      </td>
                      {MA_COMPONENTS.map(c => (
                        <td key={c} className="px-1 py-2">
                          <div className="h-4 w-6 bg-slate-800 rounded animate-pulse mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map(row => {
                    const tfScore = bullScore(row);
                    const ma = row.ma ?? { components: {}, score: 0, signal: "Neutral" as SignalLabel };
                    return (
                      <tr key={row.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-all duration-150 group">
                        {/* Symbol */}
                        <td className="px-3 py-2 sticky left-0 bg-slate-900 group-hover:bg-slate-800/20 z-10">
                          <div className="flex items-center gap-1.5">
                            <div className="relative inline-block group/sym">
                              <Link href={`/equity?symbol=${row.symbol}`}
                                className="font-mono font-semibold text-sky-400 hover:text-sky-300 transition-colors text-sm">
                                {row.symbol}
                              </Link>
                              <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/sym:block pointer-events-none">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                                  <div className="text-xs text-white font-medium">{row.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{row.sector}</div>
                                </div>
                              </div>
                            </div>
                            <AddToTradeButton symbol={row.symbol} />
                          </div>
                        </td>

                        {/* TF Score */}
                        <td className="px-1 py-2 text-center border-l border-slate-800 bg-slate-800/10">
                          <span className={`font-mono font-bold tabular-nums ${tfScoreColor(tfScore)}`}>
                            {tfScore > 0 ? `+${tfScore}` : tfScore}
                          </span>
                        </td>

                        {/* TF signals */}
                        {TF_LABELS.map(tf => (
                          <td key={tf} className="px-1 py-2 text-center bg-slate-800/10">
                            <SignalLetter signal={row.signals?.[tf]} />
                          </td>
                        ))}

                        {/* MA Score bar */}
                        <td className="px-1 py-2 border-l border-slate-800 bg-sky-950/10">
                          <MABar score={ma.score} />
                        </td>

                        {/* MA component badges */}
                        {MA_COMPONENTS.map(comp => {
                          const val = ma.components[comp];
                          return (
                            <td key={comp} className="px-1 py-2 text-center bg-sky-950/10">
                              <SignalLetter signal={val} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

              {!loading && filtered.length === 0 && rows.length > 0 && (
                <tr>
                  <td colSpan={1 + 1 + TF_LABELS.length + 1 + MA_COMPONENTS.length}
                    className="py-12 text-center text-slate-500 text-sm">
                    No stocks match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        <span>TF Score = signal weights (+2 S.Buy → −2 S.Sell) across all 9 timeframes</span>
        <span>MA Score = daily components (+1 Buy / −1 Sell): SMA20, SMA50, GX, EMA12, EMA26, EMA200</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1"><span className="text-[11px] font-bold text-green-700">B</span> S.Buy</span>
          <span className="flex items-center gap-1"><span className="text-[11px] font-semibold text-green-200">B</span> Buy</span>
          <span className="flex items-center gap-1"><span className="text-[11px] font-normal text-slate-500">N</span> Neutral</span>
          <span className="flex items-center gap-1"><span className="text-[11px] font-semibold text-orange-400">S</span> Sell</span>
          <span className="flex items-center gap-1"><span className="text-[11px] font-black text-red-500">S</span> S.Sell</span>
        </div>
      </div>

    </div>
  );
}
