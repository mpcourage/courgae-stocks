"use client";

import { useCallback, useState } from "react";
import RefreshRing from "@/components/RefreshRing";
import AddToTradeButton from "@/components/AddToTradeButton";
import { safeJson } from "@/lib/fetch";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import type { ScalpingCandidate } from "@/app/api/strategies/scalping/route";

const SIGNAL_META = {
  strong_buy:  { label: "Strong Buy",  bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" },
  buy:         { label: "Buy",         bg: "bg-green-500/20",   text: "text-green-400",   border: "border-green-500/40" },
  neutral:     { label: "Neutral",     bg: "bg-slate-700/40",   text: "text-slate-400",   border: "border-slate-600" },
  sell:        { label: "Sell",        bg: "bg-orange-500/20",  text: "text-orange-400",  border: "border-orange-500/40" },
  strong_sell: { label: "Strong Sell", bg: "bg-red-500/20",     text: "text-red-400",     border: "border-red-500/40" },
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-emerald-400" :
    score >= 60 ? "text-green-400" :
    score <= 25 ? "text-red-400" :
    score <= 40 ? "text-orange-400" :
    "text-slate-400";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 60 ? "bg-green-500" : score <= 40 ? "bg-red-500" : "bg-slate-500"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`font-mono text-xs font-semibold ${color}`}>{score}</span>
    </div>
  );
}

function RvolBadge({ rvol }: { rvol: number }) {
  const high = rvol >= 1.5;
  return (
    <span className={`font-mono text-xs ${high ? "text-amber-400 font-semibold" : "text-slate-400"}`}>
      {rvol.toFixed(2)}×
      {high && (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
          hot
        </span>
      )}
    </span>
  );
}

export default function ScalpingTab() {
  const [candidates, setCandidates] = useState<ScalpingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  // Filters
  const [minRvol, setMinRvol] = useState(0);
  const [signalFilter, setSignalFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/strategies/scalping");
      const data = await safeJson(res) as Record<string, unknown>;
      if (data.error) throw new Error(data.error as string);
      setCandidates((data.candidates as ScalpingCandidate[]) ?? []);
      setFetchedAt((data.fetchedAt as string) ?? null);
      setMarketOpen((data.marketOpen as boolean) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const { countdown, refresh } = useAutoRefresh(fetchData, 30);

  const sectors = Array.from(new Set(candidates.map((c) => c.sector))).sort();

  const filtered = candidates.filter((c) => {
    if (c.rvol < minRvol) return false;
    if (signalFilter !== "all" && c.signal !== signalFilter) return false;
    if (sectorFilter !== "all" && c.sector !== sectorFilter) return false;
    return true;
  });

  const summary = {
    strongBuy: candidates.filter((c) => c.signal === "strong_buy").length,
    buy: candidates.filter((c) => c.signal === "buy").length,
    sell: candidates.filter((c) => c.signal === "sell").length,
    strongSell: candidates.filter((c) => c.signal === "strong_sell").length,
    highRvol: candidates.filter((c) => c.rvol >= 1.5).length,
  };

  return (
    <div className="space-y-5">
      {/* Description */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-sm text-slate-400 space-y-1">
        <p className="text-slate-300 font-medium">Scalping Scanner — 5-minute bars</p>
        <p>
          Ranks blue chip stocks by scalping opportunity using VWAP bias, RSI, EMA9/20 crossover,
          relative volume, and ATR volatility. Score 0–100 (higher = better setup).
          Refreshes every 30 seconds.
        </p>
      </div>

      {/* Market closed notice */}
      {marketOpen === false && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-sm text-slate-400 text-center">
          <span className="text-slate-300 font-medium">Market is closed</span> — scalping signals require live intraday data (Mon–Fri 4 AM–8 PM ET).
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-950/50 border border-red-800 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Header row: stats + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 md:gap-3 flex-wrap">
          {[
            { label: "Strong Buy", value: summary.strongBuy, color: "text-emerald-400" },
            { label: "Buy", value: summary.buy, color: "text-green-400" },
            { label: "Sell", value: summary.sell, color: "text-orange-400" },
            { label: "Strong Sell", value: summary.strongSell, color: "text-red-400" },
            { label: "High RVOL", value: summary.highRvol, color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 md:px-4 py-2 md:py-2.5 text-center min-w-[64px] md:min-w-[80px]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5 leading-tight">{s.label}</p>
              <p className={`text-lg md:text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-xs text-slate-500">
              {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <RefreshRing countdown={countdown} total={30} loading={loading} onClick={refresh} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Min RVOL
          <select
            value={minRvol}
            onChange={(e) => setMinRvol(Number(e.target.value))}
            className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none"
          >
            {[0, 0.5, 1, 1.5, 2].map((v) => (
              <option key={v} value={v}>{v === 0 ? "Any" : `${v}×`}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-400">
          Signal
          <select
            value={signalFilter}
            onChange={(e) => setSignalFilter(e.target.value)}
            className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none"
          >
            <option value="all">All</option>
            <option value="strong_buy">Strong Buy</option>
            <option value="buy">Buy</option>
            <option value="neutral">Neutral</option>
            <option value="sell">Sell</option>
            <option value="strong_sell">Strong Sell</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-400">
          Sector
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none"
          >
            <option value="all">All</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} of {candidates.length} stocks
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        {loading && candidates.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-slate-500">
            <span className="animate-spin text-3xl">↻</span>
            <p className="text-sm">Fetching 5-min intraday data for 50 stocks…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
            {marketOpen === false ? "Market closed — no live data" : "No candidates match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-3 py-3 text-center w-10">#</th>
                  <th className="px-3 py-3 text-left">Signal</th>
                  <th className="px-3 py-3 text-left">Symbol</th>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-right">Price</th>
                  <th className="px-3 py-3 text-right">Change %</th>
                  <th className="px-3 py-3 text-right">VWAP Dev</th>
                  <th className="px-3 py-3 text-right">RSI</th>
                  <th className="px-3 py-3 text-right">RVOL</th>
                  <th className="px-3 py-3 text-right">ATR %</th>
                  <th className="px-3 py-3 text-right">EMA</th>
                  <th className="px-3 py-3 text-left">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const sig = SIGNAL_META[c.signal];
                  return (
                    <tr key={c.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${sig.bg} ${sig.text} ${sig.border}`}>
                          {sig.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          {c.symbol}
                          <AddToTradeButton symbol={c.symbol} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 max-w-[150px] truncate">{c.name}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">
                        ${c.price.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${c.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {c.changePct >= 0 ? "+" : ""}{c.changePct.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${c.vwapDevPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {c.vwapDevPct >= 0 ? "+" : ""}{c.vwapDevPct.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${c.rsi > 70 ? "text-red-400" : c.rsi < 30 ? "text-green-400" : c.rsi > 60 ? "text-orange-400" : c.rsi < 40 ? "text-sky-400" : "text-slate-300"}`}>
                        {c.rsi.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <RvolBadge rvol={c.rvol} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400">
                        {c.atrPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-semibold ${c.emaCross === "bullish" ? "text-green-400" : c.emaCross === "bearish" ? "text-red-400" : "text-slate-500"}`}>
                          {c.emaCross === "bullish" ? "▲ Bull" : c.emaCross === "bearish" ? "▼ Bear" : "— Flat"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <ScoreBadge score={c.score} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-xs text-slate-500">
        <div><span className="text-slate-300">VWAP Dev</span> — price deviation from VWAP (+ = above = bullish bias)</div>
        <div><span className="text-slate-300">RSI</span> — 14-period on 5-min closes; &lt;40 oversold · &gt;60 overbought (intraday thresholds)</div>
        <div><span className="text-slate-300">RVOL</span> — relative volume vs session avg; ≥1.5× highlighted</div>
        <div><span className="text-slate-300">ATR %</span> — volatility as % of price; higher = wider scalp range</div>
        <div><span className="text-slate-300">EMA</span> — EMA9 vs EMA20 cross; Bull = 9 above 20</div>
        <div><span className="text-slate-300">Score</span> — composite 0–100; ≥75 Strong Buy · ≤25 Strong Sell</div>
      </div>
    </div>
  );
}
