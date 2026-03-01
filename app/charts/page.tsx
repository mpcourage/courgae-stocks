"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { BLUE_CHIPS } from "@/lib/bluechips";
import type { OHLCBar, SMAConfig } from "@/components/CandlestickChart";

// Dynamically import to avoid SSR issues (lightweight-charts is canvas-based)
const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });

const PERIODS = [
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
];

const SMA_PRESETS: SMAConfig[] = [
  { period: 20,  color: "#f59e0b", visible: true },
  { period: 50,  color: "#38bdf8", visible: false },
  { period: 200, color: "#a78bfa", visible: false },
];

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Empty response (${res.status})`);
  try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
}

export default function ChartsPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("3m");
  const [bars, setBars] = useState<OHLCBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smas, setSmas] = useState<SMAConfig[]>(SMA_PRESETS);
  const [customPeriod, setCustomPeriod] = useState("");
  const [customColor, setCustomColor] = useState("#ff6b6b");

  const fetchChart = useCallback(async (sym: string, per: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/charts?symbol=${sym}&period=${per}`);
      const data = await safeJson(res);
      if (data.error) throw new Error(data.error);
      setBars(data.bars ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChart(symbol, period); }, [symbol, period, fetchChart]);

  const toggleSMA = (i: number) => {
    setSmas((prev) => prev.map((s, idx) => idx === i ? { ...s, visible: !s.visible } : s));
  };

  const addCustomSMA = () => {
    const p = parseInt(customPeriod);
    if (!p || p < 2 || p > 500) return;
    if (smas.some((s) => s.period === p)) return;
    setSmas((prev) => [...prev, { period: p, color: customColor, visible: true }]);
    setCustomPeriod("");
  };

  const removeSMA = (i: number) => {
    setSmas((prev) => prev.filter((_, idx) => idx !== i));
  };

  const selectedChip = BLUE_CHIPS.find((c) => c.symbol === symbol);
  const lastBar = bars[bars.length - 1];
  const firstBar = bars[0];
  const totalChange = lastBar && firstBar ? ((lastBar.close - firstBar.close) / firstBar.close) * 100 : null;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Price Charts</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Candlestick chart with SMA overlays for blue chip stocks
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Stock selector */}
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500 min-w-[180px]"
        >
          {BLUE_CHIPS.map((c) => (
            <option key={c.symbol} value={c.symbol}>
              {c.symbol} — {c.name}
            </option>
          ))}
        </select>

        {/* Period selector */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-sky-500 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        {lastBar && (
          <div className="flex gap-4 ml-auto text-sm">
            <span className="text-slate-400">
              <span className="text-slate-500 text-xs mr-1">Close</span>
              <span className="text-white font-mono font-semibold">${lastBar.close.toFixed(2)}</span>
            </span>
            <span className="text-slate-400">
              <span className="text-slate-500 text-xs mr-1">H</span>
              <span className="font-mono text-green-400">${lastBar.high.toFixed(2)}</span>
            </span>
            <span className="text-slate-400">
              <span className="text-slate-500 text-xs mr-1">L</span>
              <span className="font-mono text-red-400">${lastBar.low.toFixed(2)}</span>
            </span>
            {totalChange !== null && (
              <span className={`font-mono font-semibold ${totalChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalChange >= 0 ? "+" : ""}{totalChange.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Chart */}
        <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden relative" style={{ height: "520px" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
              <span className="animate-spin text-3xl text-slate-400">↻</span>
            </div>
          )}
          {error ? (
            <div className="h-full flex items-center justify-center text-red-400 text-sm">{error}</div>
          ) : bars.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data</div>
          ) : (
            <CandlestickChart bars={bars} smas={smas} />
          )}
        </div>

        {/* SMA panel */}
        <div className="w-52 shrink-0 space-y-3">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Moving Averages
            </p>

            {smas.map((sma, i) => (
              <div key={`${sma.period}-${sma.color}`} className="flex items-center gap-2">
                <button
                  onClick={() => toggleSMA(i)}
                  className={`flex items-center gap-2 flex-1 text-left rounded-md px-2 py-1.5 transition-colors text-sm ${
                    sma.visible ? "bg-slate-800" : "bg-transparent opacity-40"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: sma.color }}
                  />
                  <span className="text-slate-200">SMA {sma.period}</span>
                </button>
                <button
                  onClick={() => removeSMA(i)}
                  className="text-slate-600 hover:text-red-400 transition-colors text-xs px-1"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add custom SMA */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <p className="text-xs text-slate-500">Add custom SMA</p>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  placeholder="Period"
                  value={customPeriod}
                  onChange={(e) => setCustomPeriod(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSMA()}
                  min={2}
                  max={500}
                  className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  title="Pick color"
                />
              </div>
              <button
                onClick={addCustomSMA}
                disabled={!customPeriod}
                className="w-full py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                Add SMA
              </button>
            </div>
          </div>

          {/* Symbol info */}
          {selectedChip && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1.5 text-xs text-slate-400">
              <p className="font-semibold text-slate-200 text-sm">{selectedChip.symbol}</p>
              <p>{selectedChip.name}</p>
              <p className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 inline-block">
                {selectedChip.sector}
              </p>
              <p className="text-slate-500 pt-1">{bars.length} trading days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
