"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RefreshRing from "@/components/RefreshRing";
import { getMarketSession } from "@/lib/marketSession";
import AddToTradeButton from "@/components/AddToTradeButton";

interface RisingStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  ret1d: number;
  ret5d: number;
  ret20d: number;
  rsi: number;
  rvol: number;
  streak: number;
  aboveSma5: boolean;
  aboveSma20: boolean;
  sma5: number;
  sma20: number;
  score: number;
  bars: number;
}

interface Summary {
  total: number;
  rising: number;
  aboveSma20: number;
}

type SortKey = "score" | "ret1d" | "ret5d" | "ret20d" | "rsi" | "rvol" | "streak";

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Empty response (${res.status})`);
  try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
}

function pct(v: number, digits = 2) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function RetBadge({ value }: { value: number }) {
  if (value >= 3) return <span className="text-emerald-400 font-mono font-semibold">{pct(value)}</span>;
  if (value >= 1) return <span className="text-green-400 font-mono">{pct(value)}</span>;
  if (value > 0) return <span className="text-green-500/70 font-mono">{pct(value)}</span>;
  if (value > -1) return <span className="text-red-500/70 font-mono">{pct(value)}</span>;
  if (value > -3) return <span className="text-red-400 font-mono">{pct(value)}</span>;
  return <span className="text-red-500 font-mono font-semibold">{pct(value)}</span>;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-400" :
    score >= 60 ? "bg-green-500" :
    score >= 45 ? "bg-yellow-500" :
    score >= 30 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="relative w-28 h-5 rounded-full bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${score}%` }} />
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-white" style={{ textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>
        {score}
      </span>
    </div>
  );
}

function RsiGauge({ rsi }: { rsi: number }) {
  const color =
    rsi >= 70 ? "text-orange-400" :
    rsi >= 50 ? "text-green-400" :
    rsi >= 30 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono text-sm ${color}`}>{rsi}</span>;
}

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
        active ? "text-sky-400" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
      <span className="text-[10px]">{active ? (dir === "desc" ? "▼" : "▲") : "⇅"}</span>
    </button>
  );
}

const SECTORS = ["All", "Technology", "Consumer Disc.", "Financials", "Healthcare", "Cons. Staples", "Energy", "Industrials", "Comm. Services", "Materials", "Real Estate"];

export default function RisingPage() {
  const [stocks, setStocks] = useState<RisingStock[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sector, setSector] = useState("All");
  const [minScore, setMinScore] = useState(0);
  const [onlyRising, setOnlyRising] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rising");
      const data = await safeJson(res);
      if (data.error) throw new Error(data.error);
      setStocks(data.stocks ?? []);
      setSummary(data.summary ?? null);
      setGeneratedAt(data.generatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setCountdown(60);
    const t = setInterval(() => {
      if (getMarketSession() === "closed") return;
      setCountdown((c) => {
        if (c <= 1) { fetchData(); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let list = [...stocks];
    if (sector !== "All") list = list.filter((s) => s.sector === sector);
    if (minScore > 0) list = list.filter((s) => s.score >= minScore);
    if (onlyRising) list = list.filter((s) => s.ret20d > 0 && s.aboveSma20);
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [stocks, sector, minScore, onlyRising, sortKey, sortDir]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rising Stocks</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Momentum ranking across 50 blue chips — scored by trend strength, RSI, and volume
          </p>
        </div>
        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="text-[11px] text-slate-500 tabular-nums">
              Updated {new Date(generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" })}
            </span>
          )}
          <RefreshRing countdown={countdown} total={60} loading={loading} onClick={() => { fetchData(); setCountdown(60); }} />
        </div>
      </div>

      {/* Summary chips */}
      {summary && (
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
            <span className="text-slate-500 text-xs mr-1.5">Universe</span>
            <span className="text-white font-semibold">{summary.total}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-900 border border-emerald-900/60 text-sm">
            <span className="text-slate-500 text-xs mr-1.5">Rising (score ≥ 60)</span>
            <span className="text-emerald-400 font-semibold">{summary.rising}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
            <span className="text-slate-500 text-xs mr-1.5">Above SMA-20</span>
            <span className="text-sky-400 font-semibold">{summary.aboveSma20}</span>
          </div>
          {generatedAt && (
            <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-500 flex items-center">
              Updated {new Date(generatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
        >
          {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="text-xs">Min score:</span>
          <input
            type="range" min={0} max={90} step={5} value={minScore}
            onChange={(e) => setMinScore(+e.target.value)}
            className="w-24 accent-sky-500"
          />
          <span className="text-white font-mono w-6">{minScore}</span>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox" checked={onlyRising} onChange={(e) => setOnlyRising(e.target.checked)}
            className="w-3.5 h-3.5 accent-emerald-500"
          />
          <span>Above SMA-20 + positive 20d</span>
        </label>

        <span className="ml-auto text-xs text-slate-500">{filtered.length} stocks</span>
      </div>

      {/* Table */}
      {error ? (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center text-red-400 text-sm">{error}</div>
      ) : loading && stocks.length === 0 ? (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center text-slate-500 text-sm">
          <span className="animate-spin inline-block mr-2">↻</span>Computing momentum signals…
        </div>
      ) : (
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="1D" sortKey="ret1d" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="5D" sortKey="ret5d" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="20D" sortKey="ret20d" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-center">
                  <SortHeader label="RSI" sortKey="rsi" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-center">
                  <SortHeader label="RVOL" sortKey="rvol" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-center">
                  <SortHeader label="Streak" sortKey="streak" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SMA</th>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Score" sortKey="score" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((stock, idx) => (
                <tr key={stock.symbol} className={`hover:bg-slate-800/30 transition-all duration-150 hover:border-l-2 ${
                  stock.score >= 75 ? "hover:border-l-emerald-400" :
                  stock.score >= 60 ? "hover:border-l-green-500" :
                  stock.score >= 45 ? "hover:border-l-yellow-500" :
                  stock.score >= 30 ? "hover:border-l-orange-500" : "hover:border-l-red-500"
                }`}>
                  {/* Rank */}
                  <td className="px-4 py-3 text-slate-600 text-xs">{idx + 1}</td>

                  {/* Symbol */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/equity?symbol=${stock.symbol}`} className="font-bold text-sky-400 hover:text-sky-300 transition-colors">
                        {stock.symbol}
                      </Link>
                      <AddToTradeButton symbol={stock.symbol} />
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-[140px]">{stock.name}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{stock.sector}</div>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right font-mono text-slate-200">${stock.price.toFixed(2)}</td>

                  {/* Returns */}
                  <td className="px-4 py-3 text-right"><RetBadge value={stock.ret1d} /></td>
                  <td className="px-4 py-3 text-right"><RetBadge value={stock.ret5d} /></td>
                  <td className="px-4 py-3 text-right"><RetBadge value={stock.ret20d} /></td>

                  {/* RSI */}
                  <td className="px-4 py-3 text-center"><RsiGauge rsi={stock.rsi} /></td>

                  {/* RVOL */}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono text-sm ${stock.rvol >= 1.5 ? "text-orange-400 font-semibold" : "text-slate-400"}`}>
                      {stock.rvol.toFixed(2)}x
                      {stock.rvol >= 1.5 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                          hot
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Streak */}
                  <td className="px-4 py-3 text-center">
                    {stock.streak > 0 ? (
                      <span className={`font-mono text-sm ${stock.streak >= 5 ? "text-emerald-400 font-bold" : stock.streak >= 3 ? "text-green-400" : "text-slate-400"}`}>
                        {stock.streak >= 3 && "↑"}{stock.streak}d
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* SMA badges */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stock.aboveSma5 ? "bg-green-900/50 text-green-400 border border-green-800/50" : "bg-slate-800 text-slate-600 border border-slate-700"}`}>
                        5
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stock.aboveSma20 ? "bg-sky-900/50 text-sky-400 border border-sky-800/50" : "bg-slate-800 text-slate-600 border border-slate-700"}`}>
                        20
                      </span>
                    </div>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3"><ScoreBar score={stock.score} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500 text-sm">
                    No stocks match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-500">
        <span><span className="text-emerald-400 font-semibold">Score ≥ 75</span> — Strong uptrend</span>
        <span><span className="text-green-500 font-semibold">Score 60–74</span> — Rising</span>
        <span><span className="text-yellow-500 font-semibold">Score 45–59</span> — Neutral</span>
        <span><span className="text-orange-500 font-semibold">Score 30–44</span> — Weak</span>
        <span><span className="text-red-500 font-semibold">Score &lt; 30</span> — Declining</span>
        <span className="ml-auto">RSI: <span className="text-green-400">50–68</span> = healthy uptrend · <span className="text-orange-400">&gt;70</span> = overbought</span>
        <span>RVOL <span className="text-orange-400 font-semibold">HOT</span> ≥ 1.5× = volume spike</span>
      </div>
    </div>
  );
}
