"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BLUE_CHIPS } from "@/lib/bluechips";
import type { OHLCBar, SMAConfig } from "@/components/CandlestickChart";

const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartEntry {
  symbol: string;
  name: string;
  sector: string;
  bars: OHLCBar[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: "1m",  value: "1m"  },
  { label: "5m",  value: "5m"  },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H",  value: "1h"  },
  { label: "1D",  value: "1d"  },
  { label: "1W",  value: "1wk" },
];

const SECTORS = ["All", ...Array.from(new Set(BLUE_CHIPS.map((c) => c.sector)))];

const COLS_OPTIONS = [
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
];

const PALETTE = ["#38bdf8", "#ef4444", "#1d4ed8", "#4ade80", "#f472b6", "#a78bfa", "#fb923c"];

const DEFAULT_SMAS: SMAConfig[] = [
  { period: 22, color: "#38bdf8", visible: true }, // light blue
  { period: 33, color: "#ef4444", visible: true }, // red
  { period: 44, color: "#1d4ed8", visible: true }, // dark blue
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Empty response (${res.status})`);
  try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
}

// ─── Mini chart card ──────────────────────────────────────────────────────────

function ChartCard({ entry, smas, height }: { entry: ChartEntry; smas: SMAConfig[]; height: number }) {
  const last = entry.bars[entry.bars.length - 1];
  const prev = entry.bars[entry.bars.length - 2];
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{entry.symbol}</span>
          <span className="text-slate-500 text-xs hidden sm:inline truncate max-w-[120px]">{entry.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          {last && <span className="text-slate-300">${last.close.toFixed(2)}</span>}
          {change !== null && (
            <span className={change >= 0 ? "text-green-400" : "text-red-400"}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div style={{ height }} className="relative">
        {entry.bars.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">No data</div>
        ) : (
          <CandlestickChart bars={entry.bars} smas={smas} />
        )}
      </div>
    </div>
  );
}

// ─── SMA controls ─────────────────────────────────────────────────────────────

function SMAControls({
  smas,
  palette,
  onToggle,
  onRemove,
  onAdd,
}: {
  smas: SMAConfig[];
  palette: string[];
  onToggle: (i: number) => void;
  onRemove: (i: number) => void;
  onAdd: (period: number, color: string) => void;
}) {
  const [customPeriod, setCustomPeriod] = useState("");
  const [customColor, setCustomColor] = useState(palette[smas.length % palette.length]);

  const handleAdd = () => {
    const p = parseInt(customPeriod);
    if (!p || p < 2 || p > 500) return;
    if (smas.some((s) => s.period === p)) return;
    onAdd(p, customColor);
    setCustomPeriod("");
    setCustomColor(palette[(smas.length + 1) % palette.length]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider shrink-0">SMAs:</span>

      {smas.map((sma, i) => (
        <div key={`${sma.period}-${sma.color}`} className="flex items-center gap-0.5">
          <button
            onClick={() => onToggle(i)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
              sma.visible ? "bg-slate-800 text-slate-200" : "bg-transparent text-slate-600 border border-slate-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sma.color }} />
            SMA {sma.period}
          </button>
          <button
            onClick={() => onRemove(i)}
            className="text-slate-700 hover:text-red-400 transition-colors text-[10px] px-0.5"
          >✕</button>
        </div>
      ))}

      <div className="flex items-center gap-1 ml-1">
        <input
          type="number"
          placeholder="Period"
          value={customPeriod}
          onChange={(e) => setCustomPeriod(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          min={2} max={500}
          className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
        />
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
        />
        <button
          onClick={handleAdd}
          disabled={!customPeriod}
          className="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-30 text-white text-xs font-semibold transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MultiChartsPage() {
  const [charts, setCharts] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("1d");
  const [sector, setSector] = useState("All");
  const [cols, setCols] = useState(3);
  const [chartHeight, setChartHeight] = useState(200);
  const [smas, setSmas] = useState<SMAConfig[]>(DEFAULT_SMAS);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCharts = useCallback(async (tf: string, sec: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const symbols =
      sec === "All"
        ? undefined
        : BLUE_CHIPS.filter((c) => c.sector === sec).map((c) => c.symbol).join(",");

    const url = `/api/charts/batch?timeframe=${tf}${symbols ? `&symbols=${symbols}` : ""}`;

    try {
      const res = await fetch(url, { signal: controller.signal });
      const json = await safeJson(res);
      if (json.error) throw new Error(json.error);

      const entries: ChartEntry[] = BLUE_CHIPS
        .filter((c) => sec === "All" || c.sector === sec)
        .map((chip) => {
          const d = json.data?.[chip.symbol];
          return { symbol: chip.symbol, name: chip.name, sector: chip.sector, bars: d?.bars ?? [] };
        });

      setCharts(entries);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCharts(timeframe, sector); }, [timeframe, sector, fetchCharts]);

  const colClass: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Multi Chart View</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          All stocks at a glance — shared timeframe and moving averages across every chart
        </p>
      </div>

      {/* Control bar */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-3">
        {/* Row 1: timeframe + sector + cols + height + refresh */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Timeframe */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeframe === tf.value
                    ? "bg-sky-500 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Sector */}
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
          >
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Columns */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Cols:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              {COLS_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCols(c.value)}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    cols === c.value
                      ? "bg-slate-600 text-white"
                      : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart height */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-500">Height:</span>
            <input
              type="range" min={140} max={400} step={20} value={chartHeight}
              onChange={(e) => setChartHeight(+e.target.value)}
              className="w-20 accent-sky-500"
            />
            <span className="text-white font-mono w-8">{chartHeight}</span>
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            {loading && <span className="animate-spin">↻</span>}
            <span>{charts.length} charts</span>
            <button
              onClick={() => fetchCharts(timeframe, sector)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Row 2: shared SMA controls */}
        <div className="border-t border-slate-800 pt-3">
          <SMAControls
            smas={smas}
            palette={PALETTE}
            onToggle={(i) => setSmas((prev) => prev.map((s, idx) => idx === i ? { ...s, visible: !s.visible } : s))}
            onRemove={(i) => setSmas((prev) => prev.filter((_, idx) => idx !== i))}
            onAdd={(p, c) => setSmas((prev) => [...prev, { period: p, color: c, visible: true }])}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-800/50 p-4 text-red-400 text-sm">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && charts.length === 0 && (
        <div className={`grid ${colClass[cols] ?? "grid-cols-3"} gap-3`}>
          {Array.from({ length: cols * 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
              style={{ height: chartHeight + 40 }}
            />
          ))}
        </div>
      )}

      {/* Chart grid */}
      {charts.length > 0 && (
        <div className={`grid ${colClass[cols] ?? "grid-cols-3"} gap-3`}>
          {charts.map((entry) => (
            <ChartCard key={entry.symbol} entry={entry} smas={smas} height={chartHeight} />
          ))}
        </div>
      )}
    </div>
  );
}
