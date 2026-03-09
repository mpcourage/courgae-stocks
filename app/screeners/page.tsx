"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BLUE_CHIPS } from "@/lib/bluechips";
import RefreshRing from "@/components/RefreshRing";
import { getMarketSession } from "@/lib/marketSession";
import AddToTradeButton from "@/components/AddToTradeButton";
import type { OHLCBar, SMAConfig } from "@/components/CandlestickChart";

const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartEntry {
  symbol: string;
  name: string;
  sector: string;
  bars: OHLCBar[];
}

interface Screener {
  id: string;
  name: string;
  timeframe: string;
  lookbackDays: number;
  sector: string;
  smas: SMAConfig[];
  smaFilters: Record<number, Trend[]>; // Set serialised as array
  cols: number;
  chartHeight: number;
  candidateSmas?: number[];
  candidateProximity?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: "1m",  value: "1m",  defaultDays: 2,    maxDays: 7    },
  { label: "3m",  value: "3m",  defaultDays: 3,    maxDays: 7    }, // synthetic from 1m
  { label: "5m",  value: "5m",  defaultDays: 5,    maxDays: 60   },
  { label: "15m", value: "15m", defaultDays: 14,   maxDays: 60   },
  { label: "30m", value: "30m", defaultDays: 20,   maxDays: 60   },
  { label: "1H",  value: "1h",  defaultDays: 30,   maxDays: 730  },
  { label: "1D",  value: "1d",  defaultDays: 90,   maxDays: 1826 },
  { label: "1W",  value: "1wk", defaultDays: 730,  maxDays: 1826 },
  { label: "1Mo", value: "1mo", defaultDays: 1826, maxDays: 1826 },
];

const LOOKBACKS = [
  { label: "1D",  days: 1    },
  { label: "2D",  days: 2    },
  { label: "5D",  days: 5    },
  { label: "2W",  days: 14   },
  { label: "1M",  days: 30   },
  { label: "3M",  days: 90   },
  { label: "6M",  days: 180  },
  { label: "1Y",  days: 365  },
  { label: "2Y",  days: 730  },
  { label: "5Y",  days: 1826 },
];

const SECTORS = ["All", ...Array.from(new Set(BLUE_CHIPS.map((c) => c.sector)))];

const COLS_OPTIONS = [
  { label: "1", value: 1 },
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

// Compute the last `windowSize` SMA values from bar closes
function smaSlice(bars: OHLCBar[], period: number, windowSize: number): number[] {
  if (bars.length < period) return [];
  const out: number[] = [];
  // Only compute the last `windowSize` values
  const start = Math.max(period - 1, bars.length - windowSize);
  for (let i = start; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    out.push(sum / period);
  }
  return out;
}

type Trend = "up" | "sideways" | "down";

// Compare avg of first-half vs second-half of the recent SMA window
function detectTrend(bars: OHLCBar[], period: number): Trend {
  const window = Math.min(10, Math.max(4, Math.ceil(period / 3)));
  const vals = smaSlice(bars, period, window);
  if (vals.length < 4) return "sideways";

  const mid = Math.floor(vals.length / 2);
  const avgFirst  = vals.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
  const avgSecond = vals.slice(mid).reduce((s, v) => s + v, 0) / (vals.length - mid);
  const pct = (avgSecond - avgFirst) / avgFirst * 100;

  if (pct >  0.25) return "up";
  if (pct < -0.25) return "down";
  return "sideways";
}


// Returns true if the last candle is green AND its close is within proximityPct%
// of the SMA for ANY of the given periods.
function isSignalCandidate(bars: OHLCBar[], periods: number[], proximityPct: number): boolean {
  if (bars.length === 0 || periods.length === 0) return false;
  const last = bars[bars.length - 1];
  if (last.close < last.open) return false; // must be green
  // AND condition: stock must be within proximity of ALL selected SMAs
  return periods.every((period) => {
    if (bars.length < period) return false;
    let sum = 0;
    for (let i = bars.length - period; i < bars.length; i++) sum += bars[i].close;
    const smaVal = sum / period;
    return Math.abs(last.close - smaVal) / smaVal * 100 <= proximityPct;
  });
}

// ─── Mini chart card ──────────────────────────────────────────────────────────

function SmaTrendStrip({ bars, smas }: { bars: OHLCBar[]; smas: SMAConfig[] }) {
  const visible = smas.filter((s) => s.visible && typeof s.period === "number");
  if (visible.length === 0 || bars.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-slate-950/50 border-b border-slate-800/40">
      {visible.map((sma) => {
        const trend = detectTrend(bars, sma.period as number);
        const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
        const arrowColor =
          trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "#64748b";
        return (
          <span key={sma.period} className="flex items-center gap-1 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sma.color }} />
            <span style={{ color: sma.color }}>{sma.period}</span>
            <span style={{ color: arrowColor }} className="font-bold">{arrow}</span>
          </span>
        );
      })}
    </div>
  );
}

function ChartCard({ entry, smas, height }: { entry: ChartEntry; smas: SMAConfig[]; height: number }) {
  const last = entry.bars[entry.bars.length - 1];
  const prev = entry.bars[entry.bars.length - 2];
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col transition-all duration-200 hover:border-slate-700 hover:shadow-lg hover:shadow-sky-500/5">
      {/* Symbol / price row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sky-400 text-sm">{entry.symbol}</span>
          <AddToTradeButton symbol={entry.symbol} />
          <span className="text-slate-500 text-xs hidden sm:inline truncate max-w-[120px]">{entry.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular-nums shrink-0">
          {last && <span className="text-slate-300">${last.close.toFixed(2)}</span>}
          {change !== null && (
            <span className={change >= 0 ? "text-green-400" : "text-red-400"}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* SMA trend strip */}
      <SmaTrendStrip bars={entry.bars} smas={smas} />

      {/* Chart */}
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
  const [lookbackDays, setLookbackDays] = useState(90);
  const [sector, setSector] = useState("All");
  // Per-SMA trend filter: period → Set of selected trends (empty Set = no filter for that SMA)
  // Within one SMA: OR logic. Across SMAs: AND logic.
  const [smaFilters, setSmaFilters] = useState<Record<number, Set<Trend>>>({});
  const [cols, setCols] = useState(1);
  const [chartHeight, setChartHeight] = useState(400);
  const [smas, setSmas] = useState<SMAConfig[]>(DEFAULT_SMAS);
  const [candidateSmas, setCandidateSmas] = useState<Set<number>>(new Set());
  const [candidateProximity, setCandidateProximity] = useState(1);
  const [screeners, setScreeners] = useState<Screener[]>([]);
  const [activeScreenerId, setActiveScreenerId] = useState<string | null>(null);
  const [dataTimestamp, setDataTimestamp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ display: false, overlays: false, filters: false });
  const abortRef = useRef<AbortController | null>(null);

  const toggleSection = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Load screeners + restore last active screener's full settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("multi-chart-screeners");
      if (!raw) return;
      const parsed: Screener[] = JSON.parse(raw);
      setScreeners(parsed);
      const lastId = localStorage.getItem("multi-chart-screeners-active");
      if (lastId) {
        const active = parsed.find((s) => s.id === lastId);
        if (active) loadScreener(active);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist active screener selection
  useEffect(() => {
    if (activeScreenerId) localStorage.setItem("multi-chart-screeners-active", activeScreenerId);
    else localStorage.removeItem("multi-chart-screeners-active");
  }, [activeScreenerId]);

  const saveScreener = () => {
    const name = savingName.trim();
    if (!name) return;
    const screener: Screener = {
      id: Date.now().toString(),
      name,
      timeframe,
      lookbackDays,
      sector,
      smas,
      smaFilters: Object.fromEntries(
        Object.entries(smaFilters).map(([k, v]) => [k, Array.from(v)])
      ),
      cols,
      chartHeight,
      candidateSmas: Array.from(candidateSmas),
      candidateProximity,
    };
    const updated = [...screeners, screener];
    setScreeners(updated);
    localStorage.setItem("multi-chart-screeners", JSON.stringify(updated));
    setSavingName("");
    setShowSaveInput(false);
  };

  const loadScreener = (s: Screener) => {
    setTimeframe(s.timeframe);
    setLookbackDays(s.lookbackDays);
    setSector(s.sector);
    setSmas(s.smas);
    setSmaFilters(
      Object.fromEntries(
        Object.entries(s.smaFilters).map(([k, v]) => [k, new Set(v as Trend[])])
      )
    );
    setCols(s.cols);
    setChartHeight(s.chartHeight);
    setCandidateSmas(new Set(s.candidateSmas ?? []));
    if (s.candidateProximity != null) setCandidateProximity(s.candidateProximity);
    setActiveScreenerId(s.id);
  };

  const updateScreener = (id: string) => {
    const updated = screeners.map((s) => s.id !== id ? s : {
      ...s,
      timeframe, lookbackDays, sector, smas,
      smaFilters: Object.fromEntries(Object.entries(smaFilters).map(([k, v]) => [k, Array.from(v)])),
      cols, chartHeight,
      candidateSmas: Array.from(candidateSmas),
      candidateProximity,
    });
    setScreeners(updated);
    localStorage.setItem("multi-chart-screeners", JSON.stringify(updated));
  };

  const moveScreener = (id: string, dir: -1 | 1) => {
    const idx = screeners.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= screeners.length) return;
    const updated = [...screeners];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setScreeners(updated);
    localStorage.setItem("multi-chart-screeners", JSON.stringify(updated));
  };

  const deleteScreener = (id: string) => {
    const updated = screeners.filter((s) => s.id !== id);
    setScreeners(updated);
    if (activeScreenerId === id) setActiveScreenerId(null);
    localStorage.setItem("multi-chart-screeners", JSON.stringify(updated));
  };

  const fetchCharts = useCallback(async (tf: string, sec: string, days: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const symbols =
      sec === "All"
        ? undefined
        : BLUE_CHIPS.filter((c) => c.sector === sec).map((c) => c.symbol).join(",");

    const url = `/api/charts/batch?timeframe=${tf}&days=${days}${symbols ? `&symbols=${symbols}` : ""}`;

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
      const lastBarTime = entries.find(e => e.bars.length > 0)?.bars.slice(-1)[0]?.time;
      if (lastBarTime) {
        setDataTimestamp(new Date(lastBarTime * 1000).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", hour12: true,
          timeZone: "America/New_York",
        }));
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTimeframeChange = (tf: string) => {
    const def = TIMEFRAMES.find((t) => t.value === tf)?.defaultDays ?? 90;
    setTimeframe(tf);
    setLookbackDays(def);
  };

  useEffect(() => { fetchCharts(timeframe, sector, lookbackDays); }, [timeframe, sector, lookbackDays, fetchCharts]);

  useEffect(() => {
    setCountdown(60);
    const t = setInterval(() => {
      if (getMarketSession() === "closed") return;
      setCountdown((c) => {
        if (c <= 1) { fetchCharts(timeframe, sector, lookbackDays); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fetchCharts, timeframe, sector, lookbackDays]);

  // Memoize expensive filtering — detectTrend runs per-chart per-SMA, skip on unrelated re-renders
  const { candidates, visibleCharts } = useMemo(() => {
    if (charts.length === 0) return { candidates: [] as ChartEntry[], visibleCharts: [] as ChartEntry[] };
    const activeFilters = Object.entries(smaFilters)
      .filter(([, s]) => s.size > 0)
      .map(([p, s]) => ({ period: parseInt(p), trends: s }));
    const candidatePeriods = Array.from(candidateSmas);
    const passesTrendFilters = (e: ChartEntry) =>
      activeFilters.length === 0 ||
      (e.bars.length > 0 &&
        activeFilters.every(({ period, trends }) => trends.has(detectTrend(e.bars, period))));
    const [cands, nonCands] = candidatePeriods.length > 0
      ? charts.reduce<[ChartEntry[], ChartEntry[]]>(
          ([c, r], e) =>
            isSignalCandidate(e.bars, candidatePeriods, candidateProximity) && passesTrendFilters(e)
              ? [[...c, e], r]
              : [c, [...r, e]],
          [[], []]
        )
      : [[], charts];
    return { candidates: cands, visibleCharts: [...cands, ...nonCands.filter(passesTrendFilters)] };
  }, [charts, smaFilters, candidateSmas, candidateProximity]);

  const colClass: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Screeners</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            All stocks at a glance — shared timeframe and moving averages across every chart
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          {dataTimestamp && (
            <span className="text-[11px] text-slate-500 tabular-nums">Updated {dataTimestamp}</span>
          )}
          <RefreshRing countdown={countdown} total={60} loading={loading} onClick={() => { fetchCharts(timeframe, sector, lookbackDays); setCountdown(60); }} />
        </div>
      </div>

      {/* Control bar */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-0">

        {/* Screeners section (always open) */}
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider shrink-0">Screeners:</span>

          {screeners.map((s, idx) => {
            const isActive = activeScreenerId === s.id;
            return (
              <div key={s.id} className="flex items-center gap-0.5 group">
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveScreener(s.id, -1)}
                    disabled={idx === 0}
                    className="text-slate-600 hover:text-slate-300 disabled:opacity-20 text-[8px] leading-none px-0.5 transition-colors"
                    title="Move left"
                  >▲</button>
                  <button
                    onClick={() => moveScreener(s.id, 1)}
                    disabled={idx === screeners.length - 1}
                    className="text-slate-600 hover:text-slate-300 disabled:opacity-20 text-[8px] leading-none px-0.5 transition-colors"
                    title="Move right"
                  >▼</button>
                </div>
                <button
                  onClick={() => loadScreener(s)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    isActive
                      ? "bg-sky-900/50 border border-sky-700/60 text-sky-300"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {s.name}
                </button>
                <button
                  onClick={() => deleteScreener(s.id)}
                  className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-[10px] px-0.5"
                >✕</button>
              </div>
            );
          })}

          {showSaveInput ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                placeholder="Screener name…"
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveScreener(); if (e.key === "Escape") setShowSaveInput(false); }}
                className="w-36 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={saveScreener}
                disabled={!savingName.trim()}
                className="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-30 text-white text-xs font-semibold transition-colors"
              >Save</button>
              <button
                onClick={() => { setShowSaveInput(false); setSavingName(""); }}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {activeScreenerId && (
                <button
                  onClick={() => updateScreener(activeScreenerId)}
                  className="px-2.5 py-1 rounded-md border border-sky-700/50 hover:border-sky-600 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Update
                </button>
              )}
              <button
                onClick={() => setShowSaveInput(true)}
                className="px-2.5 py-1 rounded-md border border-slate-700 hover:border-slate-500 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                + Save current
              </button>
            </div>
          )}
        </div>

        {/* Display section — collapsible */}
        <button
          onClick={() => toggleSection("display")}
          className="w-full flex items-center gap-2 py-2 border-t border-slate-800 text-xs text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span className="transition-transform duration-200" style={{ transform: collapsed.display ? "rotate(-90deg)" : "rotate(0)" }}>&#9662;</span>
          Display
        </button>
        <div className={`flex flex-wrap items-center gap-3 overflow-hidden transition-all duration-200 ${collapsed.display ? "max-h-0 pb-0" : "max-h-40 pb-3"}`}>

          {/* Timeframe */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleTimeframeChange(tf.value)}
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

          {/* Lookback */}
          {(() => {
            const maxDays = TIMEFRAMES.find((t) => t.value === timeframe)?.maxDays ?? 1826;
            const visible = LOOKBACKS.filter((l) => l.days <= maxDays);
            return (
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                {visible.map((l) => (
                  <button
                    key={l.days}
                    onClick={() => setLookbackDays(l.days)}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      lookbackDays === l.days
                        ? "bg-slate-600 text-white"
                        : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            );
          })()}

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
            <span>{charts.length} charts</span>
          </div>
        </div>

        {/* Overlays section — collapsible */}
        <button
          onClick={() => toggleSection("overlays")}
          className="w-full flex items-center gap-2 py-2 border-t border-slate-800 text-xs text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span className="transition-transform duration-200" style={{ transform: collapsed.overlays ? "rotate(-90deg)" : "rotate(0)" }}>&#9662;</span>
          Overlays
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${collapsed.overlays ? "max-h-0 pb-0" : "max-h-40 pb-3"}`}>
          <SMAControls
            smas={smas}
            palette={PALETTE}
            onToggle={(i) => setSmas((prev) => prev.map((s, idx) => idx === i ? { ...s, visible: !s.visible } : s))}
            onRemove={(i) => {
              const removed = smas[i];
              setSmas((prev) => prev.filter((_, idx) => idx !== i));
              if (typeof removed?.period === "number") {
                setSmaFilters((prev) => { const n = { ...prev }; delete n[removed.period as number]; return n; });
              }
            }}
            onAdd={(p, c) => setSmas((prev) => [...prev, { period: p, color: c, visible: true }])}
          />
        </div>

        {/* Filters section — collapsible */}
        <button
          onClick={() => toggleSection("filters")}
          className="w-full flex items-center gap-2 py-2 border-t border-slate-800 text-xs text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span className="transition-transform duration-200" style={{ transform: collapsed.filters ? "rotate(-90deg)" : "rotate(0)" }}>&#9662;</span>
          Filters
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${collapsed.filters ? "max-h-0" : "max-h-[500px]"} space-y-3`}>
        {charts.length > 0 && (() => {
          const visibleSmas = smas.filter((s) => s.visible && typeof s.period === "number");
          if (visibleSmas.length === 0) return null;

          const TREND_OPTS: { trend: Trend; icon: string; activeColor: string }[] = [
            { trend: "up",       icon: "↑", activeColor: "#4ade80" },
            { trend: "sideways", icon: "→", activeColor: "#94a3b8" },
            { trend: "down",     icon: "↓", activeColor: "#f87171" },
          ];

          const hasAnyFilter = Object.values(smaFilters).some((s) => s.size > 0);

          const toggleTrend = (period: number, trend: Trend) => {
            setSmaFilters((prev) => {
              const cur = new Set(prev[period] ?? []);
              cur.has(trend) ? cur.delete(trend) : cur.add(trend);
              return { ...prev, [period]: cur };
            });
          };

          return (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider shrink-0">Trend:</span>
              {visibleSmas.map((sma) => {
                const period = sma.period as number;
                const selected = smaFilters[period] ?? new Set<Trend>();
                const counts: Record<Trend, number> = { up: 0, sideways: 0, down: 0 };
                for (const entry of charts) {
                  if (entry.bars.length > 0) counts[detectTrend(entry.bars, period)]++;
                }
                return (
                  <div key={period} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sma.color }} />
                    <span className="text-xs font-mono" style={{ color: sma.color }}>{period}</span>
                    <div className="flex rounded-md overflow-hidden border border-slate-700 ml-0.5">
                      {TREND_OPTS.map(({ trend, icon, activeColor }) => {
                        const isActive = selected.has(trend);
                        return (
                          <button
                            key={trend}
                            onClick={() => toggleTrend(period, trend)}
                            title={`${counts[trend]} stocks`}
                            className={`px-2 py-0.5 text-sm font-bold transition-colors ${
                              isActive ? "bg-slate-700" : "bg-slate-900 hover:bg-slate-800"
                            }`}
                            style={{ color: isActive ? activeColor : "#475569" }}
                          >
                            {icon}
                            <span className="text-[9px] font-normal ml-0.5 opacity-60">{counts[trend]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {hasAnyFilter && (
                <button
                  onClick={() => setSmaFilters({})}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          );
        })()}

        {/* Signal candidates row */}
        {(() => {
          const visibleSmas = smas.filter((s) => s.visible && typeof s.period === "number");
          if (visibleSmas.length === 0) return null;
          const toggleSignalSma = (period: number) => {
            setCandidateSmas((prev) => {
              const next = new Set(prev);
              next.has(period) ? next.delete(period) : next.add(period);
              return next;
            });
          };
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider shrink-0">Signal:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleSmas.map((sma) => {
                  const period = sma.period as number;
                  const active = candidateSmas.has(period);
                  return (
                    <button
                      key={period}
                      onClick={() => toggleSignalSma(period)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                        active ? "bg-green-900/50 border border-green-700/60 text-green-300" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sma.color }} />
                      SMA {period}
                    </button>
                  );
                })}
              </div>
              {candidateSmas.size > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-500">Within</span>
                  <input
                    type="number"
                    min={0.1} max={10} step={0.1}
                    value={candidateProximity}
                    onChange={(e) => setCandidateProximity(parseFloat(e.target.value) || 1)}
                    className="w-14 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-green-500"
                  />
                  <span className="text-slate-500">%</span>
                  <button
                    onClick={() => setCandidateSmas(new Set())}
                    className="text-slate-600 hover:text-slate-300 transition-colors ml-1"
                  >Clear</button>
                </div>
              )}
            </div>
          );
        })()}
        </div>{/* end collapsible filters */}
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
        <div className="space-y-4">
          {/* Signal candidates section */}
          {candidates.length > 0 && (
            <div className="rounded-xl border border-green-800/50 bg-green-950/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                  Signal Candidates
                </span>
                <span className="text-xs text-green-700 font-mono">
                  {candidates.length} stock{candidates.length !== 1 ? "s" : ""} — green candle on SMA {Array.from(candidateSmas).join(" & ")} ±{candidateProximity}%
                </span>
              </div>
              <div className={`grid ${colClass[cols] ?? "grid-cols-3"} gap-3`}>
                {candidates.map((entry) => (
                  <ChartCard key={entry.symbol} entry={entry} smas={smas} height={chartHeight} />
                ))}
              </div>
            </div>
          )}

          {/* Rest of charts */}
          {visibleCharts.filter(e => !candidates.includes(e)).length > 0 && (
            <div className={`grid ${colClass[cols] ?? "grid-cols-3"} gap-3`}>
              {visibleCharts.filter(e => !candidates.includes(e)).map((entry) => (
                <ChartCard key={entry.symbol} entry={entry} smas={smas} height={chartHeight} />
              ))}
            </div>
          )}

          {visibleCharts.length === 0 && (
            <div className="py-16 text-center text-slate-500 text-sm">
              No stocks match the selected trend filters
            </div>
          )}
        </div>
      )}
    </div>
  );
}
