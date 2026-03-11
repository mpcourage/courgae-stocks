"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import RefreshRing from "@/components/RefreshRing";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Sparkline from "@/components/Sparkline";
import AddToTradeButton from "@/components/AddToTradeButton";
import { safeJson } from "@/lib/fetch";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";

interface StockSnapshot {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
}

interface HistoryBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type SortKey = "symbol" | "price" | "change" | "changePct" | "volume";
type SortDir = "asc" | "desc";

function fmt(n: number) {
  return n > 0 ? `$${n.toFixed(2)}` : "—";
}

function fmtVol(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n > 0 ? String(n) : "—";
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BlueChipsPage() {
  const [stocks, setStocks] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [sparkloading, setSparkloading] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [historyBars, setHistoryBars] = useState<HistoryBar[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [showUniverse, setShowUniverse] = useState(false);
  const [universeList, setUniverseList] = useState<{ symbol: string; name: string; sector: string }[]>([]);
  const [addSymbol, setAddSymbol] = useState("");
  const [addSector, setAddSector] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUniverse = useCallback(async () => {
    const res = await fetch("/api/universe");
    const data = await res.json();
    if (Array.isArray(data)) setUniverseList(data);
  }, []);

  const handleAddSymbol = async () => {
    const sym = addSymbol.trim().toUpperCase();
    if (!sym) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/universe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, sector: addSector || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAddSymbol("");
      setAddSector("");
      await fetchUniverse();
      fetchStocks();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    await fetch(`/api/universe?symbol=${symbol}`, { method: "DELETE" });
    await fetchUniverse();
    fetchStocks();
  };

  useEffect(() => {
    if (showUniverse) fetchUniverse();
  }, [showUniverse, fetchUniverse]);

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/bluechips");
      const data = await safeJson(res) as Record<string, unknown>;
      if (data.error) throw new Error(data.error as string);
      setStocks((data.stocks as StockSnapshot[]) ?? []);
      setUpdatedAt((data.updatedAt as string) ?? null);
      setMarketOpen((data.marketOpen as boolean) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSparklines = useCallback(async () => {
    setSparkloading(true);
    try {
      const res = await fetch("/api/bluechips/sparklines");
      const data = await safeJson(res) as Record<string, number[]>;
      setSparklines(data);
    } catch {
      // non-critical — sparklines stay empty
    } finally {
      setSparkloading(false);
    }
  }, []);

  const fetchAll = useCallback(() => {
    fetchStocks();
    fetchSparklines();
  }, [fetchStocks, fetchSparklines]);

  const { countdown, refresh } = useAutoRefresh(fetchAll, 60);

  useEffect(() => {
    if (!selectedSymbol) { setHistoryBars([]); return; }
    setHistoryLoading(true);
    fetch(`/api/bluechips/history?symbol=${selectedSymbol}`)
      .then((r) => safeJson(r) as Promise<Record<string, unknown>>)
      .then((d) => { if (!d.error) setHistoryBars((d.bars as HistoryBar[]) ?? []); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [selectedSymbol]);

  const sectors = useMemo(() => {
    return Array.from(new Set(stocks.map((s) => s.sector))).sort();
  }, [stocks]);

  const stats = useMemo(() => {
    const gainers = stocks.filter((s) => s.changePct > 0).length;
    const losers = stocks.filter((s) => s.changePct < 0).length;
    const avg = stocks.length > 0
      ? stocks.reduce((sum, s) => sum + s.changePct, 0) / stocks.length
      : 0;
    return { gainers, losers, avg };
  }, [stocks]);

  const filtered = useMemo(() => {
    let list = [...stocks];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }
    if (sectorFilter !== "all") {
      list = list.filter((s) => s.sector === sectorFilter);
    }
    list.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortKey === "symbol") { va = a.symbol; vb = b.symbol; }
      else if (sortKey === "price") { va = a.price; vb = b.price; }
      else if (sortKey === "change") { va = a.change; vb = b.change; }
      else if (sortKey === "changePct") { va = a.changePct; vb = b.changePct; }
      else if (sortKey === "volume") { va = a.volume; vb = b.volume; }
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [stocks, search, sectorFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol) ?? null;

  const chartData = historyBars.map((b) => ({
    date: fmtDate(b.date),
    price: b.close,
  }));

  const minPrice = chartData.length > 0 ? Math.min(...chartData.map((d) => d.price)) * 0.98 : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map((d) => d.price)) * 1.02 : 100;

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 md:gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white">Watch List</h1>
            {marketOpen !== null && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${marketOpen ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-slate-700/50 text-slate-400 border border-slate-600"}`}>
                {marketOpen ? "● Open" : "● Closed"}
              </span>
            )}
          </div>
          <p className="hidden md:block text-sm text-slate-400 mt-0.5">
            Top 50 US blue chip stocks · 60-day sparklines · auto-refreshes every 60s
            {marketOpen === false && " · showing cached data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="hidden md:block text-[11px] text-slate-500 tabular-nums">
              Updated {new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" })}
            </span>
          )}
          <RefreshRing
            countdown={countdown}
            total={60}
            loading={loading}
            onClick={refresh}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-950/50 border border-red-800 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {[
          { label: "Gainers", value: stats.gainers, color: "text-green-400", tint: "from-green-500/5 to-transparent border-green-500/20", icon: "▲" },
          { label: "Losers",  value: stats.losers,  color: "text-red-400",   tint: "from-red-500/5 to-transparent border-red-500/20",   icon: "▼" },
          { label: "Avg",     value: fmtPct(stats.avg), color: stats.avg >= 0 ? "text-green-400" : "text-red-400", tint: stats.avg >= 0 ? "from-green-500/5 to-transparent border-green-500/20" : "from-red-500/5 to-transparent border-red-500/20", icon: "~" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.tint} border p-3 md:p-4`}>
            <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider mb-1">{s.icon} {s.label}</p>
            <p className={`text-xl md:text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-center">
        <input
          type="text"
          placeholder="Search symbol or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 w-full md:w-56"
        />
        <div className="flex gap-2">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="flex-1 md:flex-none px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
          >
            <option value="all">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => setShowUniverse(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 transition-colors whitespace-nowrap"
          >
            ⚙ <span className="hidden md:inline">Manage </span>Universe
          </button>
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        {loading && stocks.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500">
            <span className="animate-spin text-2xl mr-2">↻</span> Loading 50 stocks...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 backdrop-blur-sm bg-slate-900/90">
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-3 py-3 text-center w-10">#</th>
                  <th className="px-3 py-3 text-left cursor-pointer hover:text-white select-none" onClick={() => handleSort("symbol")}>Symbol <SortArrow col="symbol" /></th>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-left">Sector</th>
                  <th className="px-3 py-3 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort("price")}>Price <SortArrow col="price" /></th>
                  <th className="px-3 py-3 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort("changePct")}>Change % <SortArrow col="changePct" /></th>
                  <th className="px-3 py-3 text-center">60-Day Chart</th>
                  <th className="px-3 py-3 text-right">Day Range</th>
                  <th className="px-3 py-3 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort("volume")}>Volume <SortArrow col="volume" /></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((stock, idx) => (
                  <tr
                    key={stock.symbol}
                    onClick={() => setSelectedSymbol(selectedSymbol === stock.symbol ? null : stock.symbol)}
                    className={`border-b border-slate-800/50 cursor-pointer transition-all duration-150 ${
                      selectedSymbol === stock.symbol
                        ? "bg-slate-800 border-l-2 border-l-sky-500"
                        : `hover:bg-slate-800/40 hover:border-l-2 ${stock.changePct >= 0 ? "hover:border-l-green-500" : "hover:border-l-red-500"}`
                    }`}
                  >
                    <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/equity?symbol=${stock.symbol}`} onClick={(e) => e.stopPropagation()} className="text-sky-400 hover:text-sky-300 transition-colors">{stock.symbol}</Link>
                        <AddToTradeButton symbol={stock.symbol} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate">{stock.name}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-300">{stock.sector}</span></td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-white tabular-nums">{fmt(stock.price)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${stock.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>{stock.changePct !== 0 ? fmtPct(stock.changePct) : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {sparkloading && !sparklines[stock.symbol]
                        ? <div className="w-[120px] h-[36px] rounded bg-slate-800 animate-pulse mx-auto" />
                        : <div className="flex justify-center"><Sparkline data={sparklines[stock.symbol] ?? []} positive={stock.changePct >= 0} /></div>
                      }
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">{stock.dayHigh > 0 ? `$${stock.dayLow.toFixed(2)} – $${stock.dayHigh.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm text-slate-300 tabular-nums">{fmtVol(stock.volume)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">No stocks match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mobile card list ── */}
      <div className="md:hidden space-y-2">
        {loading && stocks.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-slate-500">
            <span className="animate-spin text-2xl mr-2">↻</span> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">No stocks match your filters.</div>
        ) : filtered.map((stock) => (
          <div
            key={stock.symbol}
            onClick={() => setSelectedSymbol(selectedSymbol === stock.symbol ? null : stock.symbol)}
            className={`rounded-xl bg-slate-900 border p-3 cursor-pointer transition-all ${
              selectedSymbol === stock.symbol ? "border-sky-500/50 bg-slate-800" : "border-slate-800 active:bg-slate-800/60"
            }`}
          >
            {/* Row 1: symbol + name + change */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link href={`/equity?symbol=${stock.symbol}`} onClick={(e) => e.stopPropagation()}
                  className="text-sky-400 font-bold text-sm shrink-0">{stock.symbol}</Link>
                <span className="text-slate-500 text-xs truncate">{stock.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AddToTradeButton symbol={stock.symbol} />
                <span className={`font-mono font-semibold text-sm tabular-nums ${stock.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {stock.changePct !== 0 ? fmtPct(stock.changePct) : "—"}
                </span>
              </div>
            </div>
            {/* Row 2: price + sparkline + volume */}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-white text-sm tabular-nums">{fmt(stock.price)}</span>
                <span className="text-slate-600 text-xs">{fmtVol(stock.volume)}</span>
              </div>
              <div>
                {sparkloading && !sparklines[stock.symbol]
                  ? <div className="w-[80px] h-[28px] rounded bg-slate-800 animate-pulse" />
                  : <Sparkline data={sparklines[stock.symbol] ?? []} positive={stock.changePct >= 0} />
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manage Universe modal */}
      {showUniverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUniverse(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Manage Universe</h2>
              <button onClick={() => setShowUniverse(false)} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Add symbol */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Add Symbol</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ticker (e.g. SHOP)"
                    value={addSymbol}
                    onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="Sector (optional)"
                    value={addSector}
                    onChange={(e) => setAddSector(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  onClick={handleAddSymbol}
                  disabled={addLoading || !addSymbol.trim()}
                  className="w-full px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {addLoading ? "…" : "Add Symbol"}
                </button>
              </div>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
              <p className="text-[10px] text-slate-600">Name and sector are auto-fetched from Yahoo Finance if available.</p>
            </div>

            {/* Current list */}
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active Universe ({universeList.length})</p>
              <div className="max-h-72 overflow-y-auto space-y-0.5 pr-1">
                {universeList.map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-800 group">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-sky-400 text-sm w-14">{s.symbol}</span>
                      <span className="text-slate-400 text-xs truncate max-w-[180px]">{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500">{s.sector}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveSymbol(s.symbol)}
                      className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs px-1"
                      title="Remove"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full 60-day chart on row/card click */}
      {selectedSymbol && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                {selectedStock?.name ?? selectedSymbol} — 60-Day Price History
              </h2>
              {selectedStock && (
                <p className="text-sm text-slate-400 mt-0.5">
                  {fmt(selectedStock.price)}{" "}
                  <span className={selectedStock.changePct >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                    {fmtPct(selectedStock.changePct)}
                  </span>{" "}
                  today
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedSymbol(null)}
              className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {historyLoading ? (
            <div className="h-56 flex items-center justify-center text-slate-500">
              <span className="animate-spin text-2xl mr-2">↻</span> Loading history...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.floor(chartData.length / 8)}
                />
                <YAxis
                  domain={[minPrice, maxPrice]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#38bdf8" }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Close"]}
                />
                <Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} fill="url(#grad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
              No history available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
