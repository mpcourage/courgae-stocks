"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BLUE_CHIPS } from "@/lib/bluechips";
import {
  getTradeSymbols, setTradeSymbols,
  getTradeMetadata, setTradeMetadata,
  getScreenerRunDate, setScreenerRunDate,
} from "@/lib/tradeList";
import { getSavedScreeners, passesScreener } from "@/lib/screenerLogic";
import { getMarketSession, type MarketSession } from "@/lib/marketSession";
import { computeATRPct } from "@/lib/indicators";

// ── Trading phase detection ────────────────────────────────────────────────
type TradingPhase = "afterhours" | "premarket" | "open" | "midday" | "powerhour";

function getTradingPhase(): TradingPhase {
  const now = new Date();
  const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const m   = et.getHours() * 60 + et.getMinutes();
  const day = et.getDay();
  if (day === 0 || day === 6) return "afterhours";  // weekend
  if (m >= 570 && m < 660)  return "open";          // 9:30–11:00 AM
  if (m >= 660 && m < 840)  return "midday";        // 11:00 AM–2:00 PM
  if (m >= 840 && m < 960)  return "powerhour";     // 2:00–4:00 PM
  if (m >= 240 && m < 570)  return "premarket";     // 4:00–9:30 AM
  return "afterhours";                               // 4:00 PM – 4:00 AM
}

const PHASE_META: Record<TradingPhase, {
  label: string; time: string;
  color: string; bg: string; border: string;
  recommended: "5m" | "15m" | "1d";
  charts: Record<"5m" | "15m" | "1d", { role: string; roleColor: string; tip: string }>;
}> = {
  afterhours: {
    label: "After Hours", time: "4 PM – 4 AM",
    color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30",
    recommended: "1d",
    charts: {
      "1d":  { role: "Review",  roleColor: "text-slate-300", tip: "Review today's daily candle. Did it close strong or weak? Where does it sit relative to SMA50/200? This sets the thesis for tomorrow's trade." },
      "15m": { role: "Debrief", roleColor: "text-slate-400", tip: "Review intraday structure: what worked, what didn't. Note the key 15m levels that held or broke today — they often become tomorrow's levels too." },
      "5m":  { role: "Skip",    roleColor: "text-slate-500", tip: "Market is closed. 5m data is stale and not actionable until tomorrow's pre-market." },
    },
  },
  premarket: {
    label: "Pre Market", time: "4 – 9:30 AM",
    color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30",
    recommended: "15m",
    charts: {
      "1d":  { role: "Confirm",   roleColor: "text-violet-300", tip: "Final check on the daily trend. Has anything changed overnight (news, earnings, gap)? Confirm the trade thesis still holds before the open." },
      "15m": { role: "Start here", roleColor: "text-violet-400", tip: "Primary pre-market chart. Map the overnight range, spot the gap from yesterday's close, and mark key 15m S/R levels you'll watch at 9:30 AM." },
      "5m":  { role: "Skip",       roleColor: "text-slate-500",  tip: "Too noisy pre-market — thin volume and wide spreads create false signals. Switch to 5m at 9:30 AM when volume arrives." },
    },
  },
  open: {
    label: "Market Open", time: "9:30 – 11 AM",
    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
    recommended: "5m",
    charts: {
      "1d":  { role: "Confirm",  roleColor: "text-slate-400",   tip: "Confirm the daily trend before entering. If the daily is in a downtrend, be extra selective — only the strongest 5m setups qualify." },
      "15m": { role: "Context",  roleColor: "text-sky-400",     tip: "Setup timeframe: the 15m shows whether the opening move has structure behind it. If 15m and 5m both agree, conviction is higher." },
      "5m":  { role: "Primary",  roleColor: "text-emerald-400", tip: "Primary chart for the open. Breakout candles, VWAP relationship, and support tests are clearest here. Watch for volume-confirmed moves." },
    },
  },
  midday: {
    label: "Mid-Day", time: "11 AM – 2 PM",
    color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30",
    recommended: "1d",
    charts: {
      "1d":  { role: "Review",   roleColor: "text-amber-400",  tip: "Use this time to study the daily chart for Power Hour setups. Look for stocks at key daily S/R or near SMA levels that could trigger into the close." },
      "15m": { role: "Monitor",  roleColor: "text-slate-400",  tip: "Monitor mode: check if the morning trend is holding on the 15m. Plan Power Hour entries based on whether the 15m structure is still intact." },
      "5m":  { role: "Caution",  roleColor: "text-red-400",    tip: "Caution: volume dries up mid-day and the 5m generates many false breakouts. Avoid new entries unless volume + a fresh catalyst are exceptional." },
    },
  },
  powerhour: {
    label: "Power Hour", time: "2 – 4 PM",
    color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30",
    recommended: "5m",
    charts: {
      "1d":  { role: "Direction", roleColor: "text-slate-400",   tip: "Check the daily trend one last time. Stocks closing near daily highs on strong volume often continue — informs whether to hold through close or take profit." },
      "15m": { role: "Context",   roleColor: "text-sky-400",     tip: "Setup timeframe for Power Hour. Check if the 15m trend is up and structure is clean before taking 5m entries — filters out weak setups." },
      "5m":  { role: "Primary",   roleColor: "text-emerald-400", tip: "Primary chart for Power Hour. Institutional rebalancing drives volume — look for breakouts from afternoon consolidations with RVOL confirmation." },
    },
  },
};

const fmt = (n: number, dec = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

interface Pivots {
  r3: number; r2: number; r1: number;
  p: number;
  s1: number; s2: number; s3: number;
}

interface Bar { time: number; open: number; high: number; low: number; close: number; }

function computePivots(high: number, low: number, close: number): Pivots {
  const p = (high + low + close) / 3;
  return {
    r3: high + 2 * (p - low), r2: p + (high - low), r1: 2 * p - low, p,
    s1: 2 * p - high, s2: p - (high - low), s3: low - 2 * (high - p),
  };
}

function computeFibPivots(high: number, low: number, close: number): Pivots {
  const p = (high + low + close) / 3;
  const r = high - low;
  return {
    r3: p + 1.000 * r, r2: p + 0.618 * r, r1: p + 0.382 * r, p,
    s1: p - 0.382 * r, s2: p - 0.618 * r, s3: p - 1.000 * r,
  };
}

function fmtTime(unixSec: number, showDate = false) {
  const d = new Date(unixSec * 1000);
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return showDate ? `${d.getMonth() + 1}/${d.getDate()} ${time}` : time;
}

// ── Mini chart ────────────────────────────────────────────────────────────────
function MiniChart({ bars, pivots, entry, target, stop, defaultVisible = 96, showDate = false }: {
  bars: Bar[];
  pivots: Pivots | null;
  entry: number;
  target: number;
  stop: number;
  defaultVisible?: number;
  showDate?: boolean;
}) {
  const W = 480; const H = 192;
  const PAD = { t: 6, b: 16, l: 4, r: 38 };

  const [visibleCount, setVisibleCount] = useState(defaultVisible);
  const [panOffset, setPanOffset]       = useState(0);
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const svgRef  = useRef<SVGSVGElement>(null);

  if (!bars.length) return <div className="w-full h-full bg-slate-800/40 rounded-lg animate-pulse" />;

  // Clamp helpers
  const clampVisible = (v: number) => Math.min(bars.length, Math.max(5, v));
  const clampPan     = (p: number, vc: number) => Math.min(bars.length - vc, Math.max(0, p));

  const vc  = clampVisible(visibleCount);
  const pan = clampPan(panOffset, vc);
  const start = bars.length - vc - pan;
  const displayBars = bars.slice(Math.max(0, start), bars.length - pan || undefined);

  const chartH = H - PAD.t - PAD.b;
  const chartW = W - PAD.l - PAD.r;

  const allPrices = [
    ...displayBars.flatMap(b => [b.high, b.low]),
    ...(pivots ? [pivots.s3, pivots.r3] : []),
    ...[entry, target, stop].filter(v => v > 0),
  ];
  const lo = Math.min(...allPrices);
  const hi = Math.max(...allPrices);
  const range = hi - lo || 1;

  const toY = (v: number) => PAD.t + ((hi - v) / range) * chartH;
  const barW = Math.max(1, (chartW / displayBars.length) - 1);
  const toX = (i: number) => PAD.l + i * (chartW / displayBars.length);

  // Pixel-per-bar for drag conversion
  const pxPerBar = chartW / displayBars.length;

  const pivotLines = pivots ? [
    { v: pivots.r3, c: "#6ee7b7", d: "4,3", lbl: "R3" },
    { v: pivots.r2, c: "#34d399", d: "4,3", lbl: "R2" },
    { v: pivots.r1, c: "#4ade80", d: "4,3", lbl: "R1" },
    { v: pivots.p,  c: "#38bdf8", d: "2,2", lbl: "P"  },
    { v: pivots.s1, c: "#facc15", d: "4,3", lbl: "S1" },
    { v: pivots.s2, c: "#f97316", d: "4,3", lbl: "S2" },
    { v: pivots.s3, c: "#ef4444", d: "4,3", lbl: "S3" },
  ] : [];

  const tradeLines = [
    ...(target > 0 ? [{ v: target, c: "#4ade80", lbl: "TGT" }] : []),
    ...(entry  > 0 ? [{ v: entry,  c: "#38bdf8", lbl: "ENT" }] : []),
    ...(stop   > 0 ? [{ v: stop,   c: "#f87171", lbl: "SL"  }] : []),
  ];

  const yTicks = Array.from({ length: 5 }, (_, i) => lo + (range * i) / 4);
  const xTickStep = Math.max(1, Math.floor(displayBars.length / 5));
  const xTicks = displayBars
    .map((b, i) => ({ i, time: b.time }))
    .filter((_, i) => i % xTickStep === 0);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      // Cmd+Scroll (Mac) / Ctrl+Scroll (Win) → zoom
      const delta = e.deltaY > 0 ? 1 : -1;
      setVisibleCount(prev => clampVisible(prev + delta * Math.max(1, Math.round(vc * 0.08))));
    } else {
      // Plain scroll → pan left/right
      const delta = e.deltaY > 0 ? 1 : -1;
      setPanOffset(prev => clampPan(prev + delta * Math.max(1, Math.round(vc * 0.05)), vc));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startOffset: pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const barsDelta = Math.round(dx / pxPerBar);
    setPanOffset(clampPan(dragRef.current.startOffset - barsDelta, vc));
  };

  const handleMouseUp = () => { dragRef.current = null; };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ display: "block", cursor: dragRef.current ? "grabbing" : "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Y-axis line */}
      <line x1={W - PAD.r} y1={PAD.t} x2={W - PAD.r} y2={H - PAD.b}
        stroke="#334155" strokeWidth={0.5} />

      {/* X-axis line */}
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b}
        stroke="#334155" strokeWidth={0.5} />

      {/* Y-axis ticks + labels */}
      {yTicks.map((v, i) => {
        const y = toY(v);
        return (
          <g key={i}>
            <line x1={W - PAD.r - 2} y1={y} x2={W - PAD.r} y2={y}
              stroke="#475569" strokeWidth={0.5} />
            <text x={W - PAD.r + 2} y={y + 2} fontSize={5.5} fill="#64748b" textAnchor="start">
              {v >= 1000 ? fmt(v, 0) : v.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* X-axis ticks + labels */}
      {xTicks.map(({ i, time }) => {
        const x = toX(i) + barW / 2;
        return (
          <g key={i}>
            <line x1={x} y1={H - PAD.b} x2={x} y2={H - PAD.b + 2}
              stroke="#475569" strokeWidth={0.5} />
            <text x={x} y={H - 2} fontSize={5.5} fill="#64748b" textAnchor="middle">
              {fmtTime(time, showDate)}
            </text>
          </g>
        );
      })}

      {/* Pivot lines */}
      {pivotLines.map(({ v, c, d, lbl }) => {
        const y = toY(v);
        return (
          <g key={lbl}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
              stroke={c} strokeWidth={0.5} strokeDasharray={d} opacity={0.5} />
            <text x={W - PAD.r - 1} y={y - 1.5} textAnchor="end"
              fontSize={6} fill={c} opacity={0.7}>{lbl}</text>
          </g>
        );
      })}

      {/* Candlesticks */}
      {displayBars.map((b, i) => {
        const x = toX(i);
        const isUp = b.close >= b.open;
        const color = isUp ? "#4ade80" : "#f87171";
        const top = toY(Math.max(b.open, b.close));
        const bot = toY(Math.min(b.open, b.close));
        const bodyH = Math.max(1, bot - top);
        return (
          <g key={b.time}>
            <line x1={x + barW / 2} y1={toY(b.high)} x2={x + barW / 2} y2={toY(b.low)}
              stroke={color} strokeWidth={0.8} opacity={0.7} />
            <rect x={x} y={top} width={barW} height={bodyH} fill={color} opacity={0.85} />
          </g>
        );
      })}

      {/* Trade lines (on top) */}
      {tradeLines.map(({ v, c, lbl }) => {
        const y = toY(v);
        return (
          <g key={lbl}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
              stroke={c} strokeWidth={1.2} opacity={0.9} />
            <rect x={PAD.l} y={y - 5} width={16} height={7} rx={1} fill={c} opacity={0.2} />
            <text x={PAD.l + 2} y={y + 1} fontSize={5.5} fill={c} fontWeight="bold">{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface Row {
  id: number;
  symbol: string;
  screenerNames: string[]; // which screeners flagged this symbol
  ltp: number | null;
  pivots: Pivots | null;
  fibPivots: Pivots | null;
  bars5m: Bar[];
  bars15m: Bar[];
  bars1d: Bar[];
  buyPrice: string;
  stopLoss: string;
  limitSell: string;
  rsi: number | null;
  rvol: number | null;
  streak: number | null;
  atrPct: number | null; // ATR(14) as % of price on daily bars
  float: number | null;  // float shares
}

let nextId = 1;
function makeRow(symbol = BLUE_CHIPS[0].symbol, screenerNames: string[] = []): Row {
  return { id: nextId++, symbol, screenerNames, ltp: null, pivots: null, fibPivots: null, bars5m: [], bars15m: [], bars1d: [], buyPrice: "", stopLoss: "", limitSell: "", rsi: null, rvol: null, streak: null, atrPct: null, float: null };
}

/**
 * Score 0–100: RVOL 35% › Streak 25% › ATR% 20% › RSI 10% › Float 10%
 * Ordered by day-trading importance: fuel › trend › volatility opportunity › momentum › amplification
 */
function momentumScore(r: Row): number {
  // RVOL 35% — participation/fuel
  const rvolScore = r.rvol !== null ? Math.min(r.rvol / 2, 1) * 35 : 0;

  // Streak 25% — trend confirmation (cap at 5 days)
  const streakScore = r.streak !== null ? (Math.max(0, Math.min(r.streak, 5)) / 5) * 25 : 0;

  // ATR% 20% — opportunity size; sweet spot 2–5%, penalise <1.5% (too slow) or >8% (too wild)
  const atr = r.atrPct ?? 0;
  const atrScore = atr >= 2 && atr <= 5 ? 20 : atr >= 1.5 && atr < 2 ? 14 : atr > 5 && atr <= 8 ? 10 : atr > 0 ? 4 : 0;

  // RSI 10% — momentum zone check
  const rsi = r.rsi ?? 50;
  const rsiScore = rsi >= 55 && rsi <= 75 ? 10 : rsi >= 45 && rsi < 55 ? 6 : rsi > 75 && rsi <= 85 ? 5 : 2;

  // Float 10% — low float amplifies moves
  const fl = r.float;
  const floatScore = fl === null ? 0 : fl < 5e6 ? 10 : fl < 20e6 ? 8 : fl < 50e6 ? 5 : fl < 100e6 ? 2 : 0;

  return rvolScore + streakScore + atrScore + rsiScore + floatScore;
}

const BADGE_PALETTE = [
  "#38bdf8", "#4ade80", "#f59e0b", "#a78bfa",
  "#f87171", "#fb923c", "#34d399", "#e879f9",
];
const USER_SELECTED_BADGE = "#94a3b8"; // slate-400 — distinct from screener palette

// ── Pivot chip row ────────────────────────────────────────────────────────────
function PivotChips({ label, levels, activeEntry, onSelect }: {
  label: string;
  levels: { label: string; value: number; color: string }[];
  activeEntry: number;
  onSelect: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-slate-500 uppercase tracking-wider w-6 shrink-0">{label}</span>
      {levels.map(({ label: lbl, value, color }) => {
        const isActive = activeEntry > 0 && Math.abs(activeEntry - value) < 0.005;
        return (
          <button
            key={lbl}
            onClick={() => onSelect(value.toFixed(2))}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all hover:opacity-100"
            style={{
              borderColor: color + (isActive ? "80" : "25"),
              backgroundColor: color + (isActive ? "20" : "0a"),
              opacity: isActive ? 1 : 0.65,
            }}
          >
            <span className="text-[10px] font-semibold" style={{ color }}>{lbl}</span>
            <span className="text-[10px] font-mono text-slate-300">${fmt(value)}</span>
            {isActive && <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ backgroundColor: color }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Single symbol row ─────────────────────────────────────────────────────────
function SymbolRow({ row, accountSize, dailyLimit, slPct, tgtPct, screenerColorMap, onUpdate, onRemove }: {
  row: Row; accountSize: number; dailyLimit: number; slPct: number; tgtPct: number;
  screenerColorMap: Record<string, string>;
  onUpdate: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const [phase] = useState<TradingPhase>(getTradingPhase);
  const [chartMode, setChartMode] = useState<"5m" | "15m" | "1d">(PHASE_META[getTradingPhase()].recommended);
  const [hoveredBtn, setHoveredBtn] = useState<"5m" | "15m" | "1d" | null>(null);
  const fetchedRef = useRef<string>("");

  useEffect(() => {
    if (fetchedRef.current === row.symbol) return;
    fetchedRef.current = row.symbol;
    onUpdate({ ltp: null, pivots: null, fibPivots: null, bars5m: [], bars15m: [], bars1d: [], buyPrice: "", stopLoss: "", limitSell: "" });

    fetch(`/api/quote?symbol=${row.symbol}`)
      .then(r => r.json())
      .then(d => onUpdate({ ltp: d.regularMarketPrice ?? null, float: d.floatShares ?? null }));

    // Daily bars (90d) → pivot levels + ATR(14) + daily chart
    fetch(`/api/charts?symbol=${row.symbol}&timeframe=1d&days=90`)
      .then(r => r.json())
      .then(d => {
        const daily: Bar[] = d.bars ?? [];
        const prev = daily.length >= 2 ? daily[daily.length - 2] : daily[daily.length - 1];
        if (!prev) return;
        const pivots    = computePivots(prev.high, prev.low, prev.close);
        const fibPivots = computeFibPivots(prev.high, prev.low, prev.close);
        const s2 = pivots.s2;
        const atrPct = computeATRPct(daily, 14);
        onUpdate({
          pivots,
          fibPivots,
          bars1d: daily,
          atrPct: atrPct > 0 ? atrPct : null,
          buyPrice:  s2.toFixed(2),
          stopLoss:  (s2 * (1 - slPct / 100)).toFixed(2),
          limitSell: (s2 * (1 + tgtPct / 100)).toFixed(2),
        });
      });

    // 5-min bars → 2 full sessions (today + yesterday)
    fetch(`/api/charts?symbol=${row.symbol}&timeframe=5m&days=3`)
      .then(r => r.json())
      .then(d => onUpdate({ bars5m: d.bars ?? [] }));

    // 15-min bars → 3 days of intraday structure
    fetch(`/api/charts?symbol=${row.symbol}&timeframe=15m&days=3`)
      .then(r => r.json())
      .then(d => onUpdate({ bars15m: d.bars ?? [] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.symbol]);

  const handleBuyPrice = (val: string) => {
    const n = parseFloat(val);
    onUpdate({ buyPrice: val, ...(n > 0 ? { stopLoss: (n * (1 - slPct / 100)).toFixed(2), limitSell: (n * (1 + tgtPct / 100)).toFixed(2) } : {}) });
  };

  const buy    = parseFloat(row.buyPrice)  || 0;
  const stop   = parseFloat(row.stopLoss)  || 0;
  const target = parseFloat(row.limitSell) || 0;

  const riskPerShare   = buy > 0 && stop > 0 ? buy - stop : 0;
  const rewardPerShare = buy > 0 && target > 0 ? target - buy : 0;
  const qty            = buy > 0 && dailyLimit > 0 ? Math.floor(dailyLimit / buy) : 0;
  const cashUsed       = qty * buy;
  const cashPct        = accountSize > 0 ? (cashUsed / accountSize) * 100 : 0;
  const maxLoss        = qty * riskPerShare;
  const maxGain        = qty * rewardPerShare;
  const rrRatio        = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  const stopPct        = buy > 0 && stop > 0 ? ((stop - buy) / buy) * 100 : 0;
  const targetPct      = buy > 0 && target > 0 ? ((target - buy) / buy) * 100 : 0;
  const valid          = buy > 0 && stop > 0 && target > 0 && stop < buy && target > buy;
  const belowS2        = row.pivots && buy > 0 && buy < row.pivots.s2;

  const inputBase = "w-full bg-slate-800 border text-white rounded-md pl-5 pr-1 py-1 text-xs font-mono focus:outline-none focus:ring-1";

  const cppLevels = row.pivots ? [
    { label: "S3", value: row.pivots.s3, color: "#ef4444" },
    { label: "S2", value: row.pivots.s2, color: "#f97316" },
    { label: "S1", value: row.pivots.s1, color: "#facc15" },
    { label: "P",  value: row.pivots.p,  color: "#38bdf8" },
    { label: "R1", value: row.pivots.r1, color: "#4ade80" },
    { label: "R2", value: row.pivots.r2, color: "#34d399" },
    { label: "R3", value: row.pivots.r3, color: "#6ee7b7" },
  ] : [];

  const fibLevels = row.fibPivots ? [
    { label: "S3", value: row.fibPivots.s3, color: "#ef4444" },
    { label: "S2", value: row.fibPivots.s2, color: "#f97316" },
    { label: "S1", value: row.fibPivots.s1, color: "#facc15" },
    { label: "P",  value: row.fibPivots.p,  color: "#38bdf8" },
    { label: "R1", value: row.fibPivots.r1, color: "#4ade80" },
    { label: "R2", value: row.fibPivots.r2, color: "#34d399" },
    { label: "R3", value: row.fibPivots.r3, color: "#6ee7b7" },
  ] : [];

  // Symbol badge (shared across columns)
  const firstName = row.screenerNames[0];
  const symColor  = !firstName ? "#94a3b8"
    : firstName === "User Selected" ? USER_SELECTED_BADGE
    : (screenerColorMap[firstName] ?? "#94a3b8");

  const symbolBadge = (
    <div className="relative group/sym">
      <span
        className="inline-block rounded-lg px-2.5 py-1 text-sm font-bold tracking-wide cursor-default select-none"
        style={{ color: symColor, background: symColor + "15", border: `1px solid ${symColor}35` }}
      >
        {row.symbol}
      </span>
      {/* Hover popup: screener badges + metrics */}
      <div className="pointer-events-none absolute top-full left-0 mt-1.5 z-30 opacity-0 group-hover/sym:opacity-100 transition-opacity duration-150 whitespace-nowrap">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl px-3 py-2 flex flex-col gap-2">
          {row.screenerNames.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {row.screenerNames.map((name) => {
                const isUser = name === "User Selected";
                const color  = isUser ? USER_SELECTED_BADGE : (screenerColorMap[name] ?? "#64748b");
                return (
                  <span key={name} className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: color + "18", color, border: `1px solid ${color}50` }}>
                    {name}
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3">
            {row.rvol !== null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">RVOL</span>
                <span className={`text-xs font-mono font-semibold tabular-nums ${row.rvol >= 2 ? "text-emerald-400" : row.rvol >= 1 ? "text-sky-400" : "text-slate-500"}`}>{row.rvol.toFixed(1)}x</span>
              </div>
            )}
            {row.streak !== null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">Streak</span>
                <span className={`text-xs font-mono font-semibold tabular-nums ${row.streak > 0 ? "text-green-400" : row.streak < 0 ? "text-red-400" : "text-slate-500"}`}>{row.streak > 0 ? "+" : ""}{row.streak}d</span>
              </div>
            )}
            {row.atrPct !== null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">ATR%</span>
                <span className={`text-xs font-mono font-semibold tabular-nums ${row.atrPct >= 2 && row.atrPct <= 5 ? "text-emerald-400" : row.atrPct >= 1.5 && row.atrPct < 2 ? "text-sky-400" : row.atrPct > 5 && row.atrPct <= 8 ? "text-yellow-400" : row.atrPct > 8 ? "text-red-400" : "text-slate-500"}`}>{row.atrPct.toFixed(1)}%</span>
              </div>
            )}
            {row.rsi !== null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">RSI</span>
                <span className={`text-xs font-mono font-semibold tabular-nums ${row.rsi >= 85 ? "text-red-400" : row.rsi >= 55 && row.rsi <= 75 ? "text-emerald-400" : row.rsi <= 30 ? "text-sky-400" : "text-slate-400"}`}>{row.rsi.toFixed(0)}</span>
              </div>
            )}
            {row.float !== null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">Float</span>
                <span className={`text-xs font-mono font-semibold tabular-nums ${row.float < 5e6 ? "text-emerald-400" : row.float < 20e6 ? "text-sky-400" : row.float < 100e6 ? "text-yellow-400" : "text-slate-500"}`}>{row.float >= 1e9 ? (row.float / 1e9).toFixed(1) + "B" : row.float >= 1e6 ? (row.float / 1e6).toFixed(0) + "M" : (row.float / 1e3).toFixed(0) + "K"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 flex gap-3 ${belowS2 ? "border-orange-500/30" : "border-slate-800"}`}>

      {/* ── Left section: CPP + FIB + Trade inputs ── */}
      <div className="flex gap-2">

          {/* ── CPP column — Symbol header ── */}
          {cppLevels.length > 0 && (
            <div className="shrink-0">
              <div className="mb-1 flex items-center gap-1">
                {symbolBadge}
                {row.screenerNames.includes("User Selected") && (
                  <button onClick={onRemove} className="p-0.5 rounded text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Remove">
                    <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 3.5H11M4.5 3.5V2.5C4.5 2.22386 4.72386 2 5 2H8C8.27614 2 8.5 2.22386 8.5 2.5V3.5M5.5 6V10M7.5 6V10M3 3.5L3.5 11C3.5 11.2761 3.72386 11.5 4 11.5H9C9.27614 11.5 9.5 11.2761 9.5 11L10 3.5H3Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                )}
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-0.5 px-1">CPP</p>
              <div className="flex flex-col">
                {[...cppLevels].reverse().map(({ label, value, color }) => {
                  const isActive = buy > 0 && Math.abs(buy - value) < 0.005;
                  return (
                    <button
                      key={label}
                      onClick={() => handleBuyPrice(value.toFixed(2))}
                      className={`flex items-center gap-2 px-2 py-[3px] rounded transition-all hover:bg-slate-800/80 ${isActive ? "bg-slate-800" : ""}`}
                    >
                      <span className="text-[10px] font-bold w-4 text-right" style={{ color }}>{label}</span>
                      <span className={`font-mono text-[11px] tabular-nums ${isActive ? "text-white" : "text-slate-400"}`}>${fmt(value)}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── FIB column — LTP header ── */}
          {fibLevels.length > 0 && (
            <div className="shrink-0">
              <div className="mb-1 px-1 h-[30px] flex items-center">
                {row.ltp
                  ? <span className="text-sky-400 font-mono text-sm font-semibold">${fmt(row.ltp)}</span>
                  : <span className="text-slate-600 text-sm">—</span>
                }
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-0.5 px-1">FIB</p>
              <div className="flex flex-col">
                {[...fibLevels].reverse().map(({ label, value, color }) => {
                  const isActive = buy > 0 && Math.abs(buy - value) < 0.005;
                  return (
                    <button
                      key={label}
                      onClick={() => handleBuyPrice(value.toFixed(2))}
                      className={`flex items-center gap-2 px-2 py-[3px] rounded transition-all hover:bg-slate-800/80 ${isActive ? "bg-slate-800" : ""}`}
                    >
                      <span className="text-[10px] font-bold w-4 text-right" style={{ color }}>{label}</span>
                      <span className={`font-mono text-[11px] tabular-nums ${isActive ? "text-white" : "text-slate-400"}`}>${fmt(value)}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Divider ── */}
          {cppLevels.length > 0 && <div className="w-px bg-slate-800 mx-1 self-stretch" />}

          {/* ── Trade inputs column — QTY header ── */}
          <div className="flex gap-2 shrink-0">

            {/* Vertical connector line — offset past QTY header */}
            <div className="flex flex-col items-center shrink-0 pt-[30px]">
              <div className={`w-2 h-2 rounded-full border shrink-0 ${valid && target > buy ? "border-emerald-400 bg-emerald-400/20" : "border-slate-700"}`} />
              <div className={`w-px flex-1 min-h-[18px] ${valid ? "bg-gradient-to-b from-emerald-400/50 to-sky-400/50" : "bg-slate-800"}`} />
              <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${buy > 0 ? (belowS2 ? "border-orange-400 bg-orange-400/20" : "border-sky-400 bg-sky-400/20") : "border-slate-700"}`} />
              <div className={`w-px flex-1 min-h-[18px] ${valid ? "bg-gradient-to-b from-sky-400/50 to-red-400/50" : "bg-slate-800"}`} />
              <div className={`w-2 h-2 rounded-full border shrink-0 ${valid ? "border-red-400 bg-red-400/20" : "border-slate-700"}`} />
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-1.5 w-24">
              {/* QTY header */}
              <div className="relative group cursor-default h-[30px] flex items-center">
                {valid && qty > 0 ? (
                  <>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider mr-1.5">Qty</span>
                    <span className="text-white font-semibold text-sm underline decoration-dotted decoration-slate-600">{qty}</span>
                    <div className="pointer-events-none absolute top-full left-0 mt-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 flex gap-4 whitespace-nowrap">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Cash</p>
                          <p className="text-white font-mono text-sm">${cashUsed >= 1000 ? fmt(cashUsed / 1000, 1) + "k" : fmt(cashUsed)}</p>
                          <p className={`text-[10px] font-mono ${cashPct > 50 ? "text-orange-400" : cashPct > 25 ? "text-yellow-400" : "text-slate-400"}`}>{cashPct.toFixed(1)}%</p>
                        </div>
                        <div className="w-px bg-slate-700" />
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Risk</p>
                          <p className="text-red-400 font-mono text-sm">-${fmt(maxLoss)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Gain</p>
                          <p className="text-emerald-400 font-mono text-sm">+${fmt(maxGain)}</p>
                        </div>
                        <div className="w-px bg-slate-700" />
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">R:R</p>
                          <p className={`font-bold text-sm ${rrRatio >= 2 ? "text-emerald-400" : rrRatio >= 1 ? "text-yellow-400" : "text-red-400"}`}>{rrRatio.toFixed(1)}x</p>
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-slate-800 border-r border-b border-slate-600 rotate-45 ml-3 -mt-1" />
                    </div>
                  </>
                ) : (
                  <span className="text-slate-700 text-[10px]">{buy > 0 ? "set S/T" : "—"}</span>
                )}
              </div>
              {/* TARGET */}
              <div>
                <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
                  TGT {valid && target > buy ? fmtPct(targetPct) : ""}
                </p>
                <div className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="number" value={row.limitSell} onChange={(e) => onUpdate({ limitSell: e.target.value })} placeholder="0.00"
                    className={`${inputBase} focus:ring-emerald-500/40 ${valid && target > buy ? "border-emerald-500/40" : "border-slate-700"}`} />
                </div>
              </div>

              {/* ENTRY */}
              <div>
                <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${belowS2 ? "text-orange-400" : "text-sky-400"}`}>
                  ENT {belowS2 ? "⚠S2" : row.pivots && buy > 0 ? (buy >= row.pivots.p ? "↑P" : buy >= row.pivots.s1 ? "S1–P" : buy >= row.pivots.s2 ? "S1–S2" : "") : ""}
                </p>
                <div className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="number" value={row.buyPrice} onChange={(e) => handleBuyPrice(e.target.value)} placeholder="0.00"
                    className={`${inputBase} focus:ring-sky-500/40 ${belowS2 ? "border-orange-500/50" : buy > 0 ? "border-sky-500/40" : "border-slate-700"}`} />
                </div>
              </div>

              {/* STOP */}
              <div>
                <p className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mb-0.5">
                  SL {valid ? fmtPct(stopPct) : ""}
                </p>
                <div className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="number" value={row.stopLoss} onChange={(e) => onUpdate({ stopLoss: e.target.value })} placeholder="0.00"
                    className={`${inputBase} focus:ring-red-500/40 ${valid ? "border-red-500/40" : "border-slate-700"}`} />
                </div>
              </div>
            </div>{/* end inputs div */}
          </div>{/* end trade inputs outer */}
      </div>{/* end left section */}

      {/* ── Right column: chart ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 justify-end">
          {/* Phase badge */}
          {(() => {
            const pm = PHASE_META[phase];
            return (
              <span className={`px-2 py-0.5 rounded text-[9px] font-medium border ${pm.color} ${pm.bg} ${pm.border} mr-auto`}>
                {pm.label} <span className="opacity-60">{pm.time}</span>
              </span>
            );
          })()}

          {/* Chart mode buttons with hover tooltip */}
          {(["1d", "15m", "5m"] as const).map(mode => {
            const pm    = PHASE_META[phase];
            const meta  = pm.charts[mode];
            const isRec = pm.recommended === mode;
            const label = mode === "5m" ? "5m · 1D" : mode === "15m" ? "15m · 3D" : "1D · 3mo";
            return (
              <div key={mode} className="relative">
                <button
                  onClick={() => setChartMode(mode)}
                  onMouseEnter={() => setHoveredBtn(mode)}
                  onMouseLeave={() => setHoveredBtn(null)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    chartMode === mode
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                      : "text-slate-600 border border-slate-800 hover:text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {label}
                  {isRec && <span className="ml-1 text-[8px] text-emerald-400 opacity-80">▲</span>}
                </button>

                {hoveredBtn === mode && (
                  <div className="absolute bottom-full right-0 mb-2 z-20 w-64 rounded-lg bg-slate-800 border border-slate-700 p-2.5 shadow-xl pointer-events-none">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-semibold ${meta.roleColor}`}>{meta.role}</span>
                      <span className="text-[10px] text-slate-500">· {mode === "5m" ? "5-min" : mode === "15m" ? "15-min" : "daily"}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{meta.tip}</p>
                    <div className="absolute bottom-[-5px] right-4 w-2 h-2 bg-slate-800 border-r border-b border-slate-700 rotate-45" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex-1 h-44 rounded-lg overflow-hidden bg-slate-800/30">
          <MiniChart
            key={chartMode}
            bars={chartMode === "5m" ? row.bars5m : chartMode === "15m" ? row.bars15m : row.bars1d}
            pivots={row.pivots}
            entry={buy} target={target} stop={stop}
            defaultVisible={chartMode === "5m" ? 156 : chartMode === "15m" ? 78 : 60}
            showDate={chartMode !== "5m"}
          />
        </div>
      </div>

    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TradePage() {
  const [rows, setRows] = useState<Row[]>(() => {
    const saved = getTradeSymbols();
    const meta  = getTradeMetadata();
    return saved.length > 0 ? saved.map(s => makeRow(s, meta[s] ?? [])) : [makeRow()];
  });
  const [accountSize, setAccountSize] = useState(() => localStorage.getItem("trade-account-size") ?? "50000");
  const [dailyLimit, setDailyLimit]   = useState(() => localStorage.getItem("trade-daily-limit")  ?? "20");
  const [slPct, setSlPct]             = useState(() => localStorage.getItem("trade-sl-pct")   ?? "0.5");
  const [tgtPct, setTgtPct]           = useState(() => localStorage.getItem("trade-tgt-pct")  ?? "1");
  const [populating, setPopulating]   = useState(false);
  const [lastPopulated, setLastPopulated] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const prevSessionRef = useRef<MarketSession>(getMarketSession());

  // Fetch rising metrics once and patch into rows
  const fetchRisingMetrics = useCallback(async () => {
    try {
      const res  = await fetch("/api/rising");
      const json = await res.json();
      const map  = new Map<string, { rsi: number; rvol: number; streak: number }>();
      for (const s of (json.stocks ?? []) as { symbol: string; rsi: number; rvol: number; streak: number }[]) {
        map.set(s.symbol, { rsi: s.rsi, rvol: s.rvol, streak: s.streak });
      }
      setRows(prev => prev.map(r => {
        const m = map.get(r.symbol);
        return m ? { ...r, rsi: m.rsi, rvol: m.rvol, streak: m.streak } : r;
      }));
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" }));
    } catch { /* non-critical */ }
  }, []);

  // ── Screener population ──────────────────────────────────────────────────
  const runScreenerPopulation = useCallback(async () => {
    setPopulating(true);
    try {
      const screeners = getSavedScreeners();

      const symbolMap = new Map<string, Set<string>>(); // symbol → source labels

      // ── Screener candidates ──────────────────────────────────────────────
      if (screeners.length > 0) {
        // Deduplicate fetch by (timeframe, days) to minimise API calls
        const barsCache = new Map<string, Record<string, { bars: Bar[] }>>();
        for (const sc of screeners) {
          const key = `${sc.timeframe}:${sc.lookbackDays}`;
          if (!barsCache.has(key)) {
            const res  = await fetch(`/api/charts/batch?timeframe=${sc.timeframe}&days=${sc.lookbackDays}`);
            const json = await res.json();
            barsCache.set(key, json.data ?? {});
          }
        }

        for (const sc of screeners) {
          const key   = `${sc.timeframe}:${sc.lookbackDays}`;
          const data  = barsCache.get(key) ?? {};
          const chips = sc.sector === "All"
            ? BLUE_CHIPS
            : BLUE_CHIPS.filter(c => c.sector === sc.sector);

          for (const chip of chips) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bars = (data[chip.symbol]?.bars ?? []) as any[];
            if (passesScreener(bars, sc)) {
              if (!symbolMap.has(chip.symbol)) symbolMap.set(chip.symbol, new Set());
              symbolMap.get(chip.symbol)!.add(sc.name);
            }
          }
        }
      }

      // ── Rising stocks with score > 90 ────────────────────────────────────
      try {
        const risingRes  = await fetch("/api/rising");
        const risingJson = await risingRes.json();
        const risingStocks: { symbol: string; score: number }[] = risingJson.stocks ?? [];
        for (const s of risingStocks) {
          if (s.score > 90) {
            if (!symbolMap.has(s.symbol)) symbolMap.set(s.symbol, new Set());
            symbolMap.get(s.symbol)!.add("Rising 90+");
          }
        }
      } catch {
        // non-critical — continue without rising data
      }

      // Persist metadata + rebuild rows
      const meta: Record<string, string[]> = {};
      const symbols: string[] = [];
      for (const [sym, names] of symbolMap.entries()) {
        meta[sym] = Array.from(names);
        symbols.push(sym);
      }
      setTradeMetadata(meta);

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      setScreenerRunDate(today);

      // Replace rows (the rows→localStorage sync effect will persist symbols)
      setRows(symbols.length > 0 ? symbols.map(s => makeRow(s, meta[s])) : [makeRow()]);
      setLastPopulated(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }));
    } catch (e) {
      console.error("Screener population failed", e);
    } finally {
      setPopulating(false);
    }
  }, []);

  // Auto-trigger at market close (open → afterhours transition)
  useEffect(() => {
    const t = setInterval(() => {
      const curr = getMarketSession();
      if (prevSessionRef.current === "open" && curr === "afterhours") {
        runScreenerPopulation();
      }
      prevSessionRef.current = curr;
    }, 30_000);
    return () => clearInterval(t);
  }, [runScreenerPopulation]);

  // Re-fetch rising metrics whenever rows are repopulated
  useEffect(() => {
    if (lastPopulated) fetchRisingMetrics();
  }, [lastPopulated, fetchRisingMetrics]);

  // On mount: load rising metrics + auto-populate if market past close
  useEffect(() => {
    fetchRisingMetrics();
    const session = getMarketSession();
    const today   = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    if (getScreenerRunDate() !== today && (session === "afterhours" || session === "closed")) {
      runScreenerPopulation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync symbol order to localStorage whenever rows change ───────────────
  useEffect(() => { setTradeSymbols(rows.map(r => r.symbol)); }, [rows]);
  useEffect(() => { localStorage.setItem("trade-account-size", accountSize); }, [accountSize]);
  useEffect(() => { localStorage.setItem("trade-daily-limit",  dailyLimit);  }, [dailyLimit]);
  useEffect(() => { localStorage.setItem("trade-sl-pct",  slPct);  }, [slPct]);
  useEffect(() => { localStorage.setItem("trade-tgt-pct", tgtPct); }, [tgtPct]);

  // Listen for external adds (from other pages)
  useEffect(() => {
    const handler = () => {
      const saved = getTradeSymbols();
      const meta  = getTradeMetadata();
      setRows(prev => {
        const existing = prev.map(r => r.symbol);
        const toAdd = saved.filter(s => !existing.includes(s));
        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd.map(s => makeRow(s, meta[s]?.length ? meta[s] : ["User Selected"]))];
      });
      fetchRisingMetrics();
    };
    window.addEventListener("trade-list-change", handler);
    return () => window.removeEventListener("trade-list-change", handler);
  }, []);

  // ── Screener color map (stable per session) ──────────────────────────────
  const allScreenerNames = Array.from(new Set(rows.flatMap(r => r.screenerNames)));
  const screenerColorMap: Record<string, string> = {};
  let paletteIdx = 0;
  allScreenerNames.forEach((name) => {
    if (name === "User Selected") {
      screenerColorMap[name] = USER_SELECTED_BADGE;
    } else {
      screenerColorMap[name] = BADGE_PALETTE[paletteIdx++ % BADGE_PALETTE.length];
    }
  });

  const account = parseFloat(accountSize) || 0;
  const limit   = account * ((parseFloat(dailyLimit) || 0) / 100);
  const sl      = parseFloat(slPct)  || 0.5;
  const tgt     = parseFloat(tgtPct) || 1;

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const [pickerSymbol, setPickerSymbol] = useState(BLUE_CHIPS[0].symbol);

  const addRow = () => {
    const existing = rows.map(r => r.symbol);
    if (existing.includes(pickerSymbol)) return; // already in list
    // Persist metadata so "User Selected" survives reload
    const meta = getTradeMetadata();
    meta[pickerSymbol] = ["User Selected"];
    setTradeMetadata(meta);
    setRows(prev => [...prev, makeRow(pickerSymbol, ["User Selected"])]);
    fetchRisingMetrics();
  };

  const removeRow = (id: number) => {
    setRows(prev => {
      const row = prev.find(r => r.id === id);
      if (row) {
        // Clean up metadata for user-selected removal
        const meta = getTradeMetadata();
        delete meta[row.symbol];
        setTradeMetadata(meta);
      }
      return prev.filter(r => r.id !== id);
    });
  };


  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header + global controls */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Trade</h1>
            <p className="text-sm text-slate-400 mt-0.5">Position sizing and OCO trade planner — pivot levels, targets, and stops per symbol</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdated && (
              <span className="text-[11px] text-slate-500 tabular-nums">Updated {lastUpdated}</span>
            )}
            <label className="text-xs text-slate-400">Account</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={accountSize} onChange={e => setAccountSize(e.target.value)}
                className="w-32 bg-slate-800 border border-slate-700 text-white rounded-lg pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
            </div>
            <label className="text-xs text-red-400 font-semibold">SL</label>
            <div className="relative">
              <input type="number" value={slPct} min="0.1" max="20" step="0.1"
                onChange={e => setSlPct(e.target.value)}
                className="w-24 bg-slate-800 border border-red-500/40 text-white rounded-lg pl-3 pr-6 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-500/60" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
            </div>
            <label className="text-xs text-emerald-400 font-semibold">TGT</label>
            <div className="relative">
              <input type="number" value={tgtPct} min="0.1" max="50" step="0.1"
                onChange={e => setTgtPct(e.target.value)}
                className="w-24 bg-slate-800 border border-emerald-500/40 text-white rounded-lg pl-3 pr-6 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/60" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <label className="text-xs text-slate-400">Daily Limit</label>
            <div className="relative">
              <input type="number" value={dailyLimit} min="0" max="100" step="5"
                onChange={e => { const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); setDailyLimit(String(v)); }}
                className="w-20 bg-slate-800 border border-slate-700 text-white rounded-lg pl-3 pr-6 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            {account > 0 && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                = ${(limit).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            )}
            <div className="h-6 w-px bg-slate-800" />
            {lastPopulated && (
              <span className="text-[11px] text-slate-500 tabular-nums">Reset {lastPopulated}</span>
            )}
            <button
              onClick={runScreenerPopulation}
              disabled={populating}
              title="Reset trade list and re-run all screeners"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-xs text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={populating ? "animate-spin" : ""}>
                <path d="M11.5 6.5A5 5 0 1 1 9 2.07" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {populating ? "Running…" : "Run Screeners"}
            </button>
          </div>
        </div>

        {/* Screener legend */}
        {allScreenerNames.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">Screeners:</span>
            {allScreenerNames.map((name) => {
              const color = screenerColorMap[name];
              const count = rows.filter(r => r.screenerNames.includes(name)).length;
              return (
                <span
                  key={name}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ background: color + "18", color, border: `1px solid ${color}35` }}
                >
                  {name}
                  <span className="opacity-60 font-normal">{count}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Rows — always sorted by momentum score descending */}
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
              No symbols — add one below or bookmark a symbol from any page
            </div>
          ) : [...rows].sort((a, b) => momentumScore(b) - momentumScore(a)).map((row) => (
            <SymbolRow
              key={row.id} row={row}
              accountSize={account} dailyLimit={limit} slPct={sl} tgtPct={tgt}
              screenerColorMap={screenerColorMap}
              onUpdate={patch => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </div>

        {/* Symbol picker — select then add */}
        <div className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-800 rounded-xl">
          <span className="text-xs text-slate-500 shrink-0">Add symbol</span>
          <select
            value={pickerSymbol}
            onChange={e => setPickerSymbol(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {BLUE_CHIPS.filter(c => !rows.map(r => r.symbol).includes(c.symbol)).map(c => (
              <option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name}</option>
            ))}
          </select>
          <button
            onClick={addRow}
            className="px-3 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-semibold transition-all"
          >
            + Add
          </button>
        </div>

      </div>
    </main>
  );
}
