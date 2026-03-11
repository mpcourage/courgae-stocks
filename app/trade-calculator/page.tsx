"use client";

import { useEffect, useRef } from "react";
import { useState } from "react";
import { BLUE_CHIPS } from "@/lib/bluechips";

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

// ── Mini chart ────────────────────────────────────────────────────────────────
function MiniChart({ bars, pivots, entry, target, stop }: {
  bars: Bar[];
  pivots: Pivots | null;
  entry: number;
  target: number;
  stop: number;
}) {
  const W = 480; const H = 192; const PAD = { t: 6, b: 6, l: 4, r: 4 };
  const displayBars = bars.slice(-40);
  if (!displayBars.length) return <div className="w-full h-full bg-slate-800/40 rounded-lg animate-pulse" />;

  const allPrices = [
    ...displayBars.flatMap(b => [b.high, b.low]),
    ...(pivots ? [pivots.s3, pivots.r3] : []),
    ...[entry, target, stop].filter(v => v > 0),
  ];
  const lo = Math.min(...allPrices);
  const hi = Math.max(...allPrices);
  const range = hi - lo || 1;

  const toY = (v: number) => PAD.t + ((hi - v) / range) * (H - PAD.t - PAD.b);
  const barW = Math.max(1, ((W - PAD.l - PAD.r) / displayBars.length) - 1);
  const toX = (i: number) => PAD.l + i * ((W - PAD.l - PAD.r) / displayBars.length);

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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ display: "block" }}>
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
  ltp: number | null;
  pivots: Pivots | null;
  fibPivots: Pivots | null;
  bars: Bar[];
  buyPrice: string;
  stopLoss: string;
  limitSell: string;
}

let nextId = 1;
function makeRow(symbol = BLUE_CHIPS[0].symbol): Row {
  return { id: nextId++, symbol, ltp: null, pivots: null, fibPivots: null, bars: [], buyPrice: "", stopLoss: "", limitSell: "" };
}

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
function SymbolRow({ row, accountSize, riskPct, onUpdate, onRemove, canRemove }: {
  row: Row; accountSize: number; riskPct: number;
  onUpdate: (patch: Partial<Row>) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  const fetchedRef = useRef<string>("");

  useEffect(() => {
    if (fetchedRef.current === row.symbol) return;
    fetchedRef.current = row.symbol;
    onUpdate({ ltp: null, pivots: null, fibPivots: null, bars: [], buyPrice: "", stopLoss: "", limitSell: "" });

    fetch(`/api/quote?symbol=${row.symbol}`)
      .then(r => r.json())
      .then(d => onUpdate({ ltp: d.regularMarketPrice ?? null }));

    fetch(`/api/charts?symbol=${row.symbol}&timeframe=1d&days=60`)
      .then(r => r.json())
      .then(d => {
        const bars: Bar[] = d.bars ?? [];
        const prev = bars.length >= 2 ? bars[bars.length - 2] : bars[bars.length - 1];
        if (!prev) return;
        const pivots    = computePivots(prev.high, prev.low, prev.close);
        const fibPivots = computeFibPivots(prev.high, prev.low, prev.close);
        const s2 = pivots.s2;
        onUpdate({
          bars,
          pivots,
          fibPivots,
          buyPrice:  s2.toFixed(2),
          stopLoss:  (s2 * 0.995).toFixed(2),
          limitSell: (s2 * 1.01).toFixed(2),
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.symbol]);

  const handleBuyPrice = (val: string) => {
    const n = parseFloat(val);
    onUpdate({ buyPrice: val, ...(n > 0 ? { stopLoss: (n * 0.995).toFixed(2), limitSell: (n * 1.01).toFixed(2) } : {}) });
  };

  const buy    = parseFloat(row.buyPrice)  || 0;
  const stop   = parseFloat(row.stopLoss)  || 0;
  const target = parseFloat(row.limitSell) || 0;

  const riskPerShare   = buy > 0 && stop > 0 ? buy - stop : 0;
  const rewardPerShare = buy > 0 && target > 0 ? target - buy : 0;
  const riskAmount     = accountSize * (riskPct / 100);
  const qty            = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
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

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 flex gap-4 ${belowS2 ? "border-orange-500/30" : "border-slate-800"}`}>

      {/* ── Left column ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">

        {/* Symbol + LTP + remove */}
        <div className="flex items-center gap-2">
          <select
            value={row.symbol}
            onChange={(e) => onUpdate({ symbol: e.target.value })}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {BLUE_CHIPS.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
            ))}
          </select>
          <div>
            {row.ltp
              ? <span className="text-sky-400 font-mono text-sm">${fmt(row.ltp)}</span>
              : <span className="text-slate-600 text-sm">—</span>
            }
            {row.pivots && (
              <span className="text-slate-500 text-[10px] ml-2">S2 ${fmt(row.pivots.s2)}</span>
            )}
          </div>
          {canRemove && (
            <button onClick={onRemove} className="ml-auto text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
          )}
        </div>

        {/* Pivot chips */}
        {cppLevels.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <PivotChips label="CPP" levels={cppLevels} activeEntry={buy} onSelect={handleBuyPrice} />
            <PivotChips label="FIB" levels={fibLevels} activeEntry={buy} onSelect={handleBuyPrice} />
          </div>
        )}

        {/* Price inputs */}
        <div className="flex items-center gap-2">
          {/* TARGET */}
          <div className="w-24 shrink-0">
            <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
              Target {valid && target > buy ? fmtPct(targetPct) : ""}
            </p>
            <div className="relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={row.limitSell} onChange={(e) => onUpdate({ limitSell: e.target.value })} placeholder="0.00"
                className={`${inputBase} focus:ring-emerald-500/40 ${valid && target > buy ? "border-emerald-500/40" : "border-slate-700"}`} />
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center gap-0.5 shrink-0 pt-4">
            <div className={`w-6 h-px ${valid ? "bg-emerald-400/30" : "bg-slate-700"}`} />
            <div className={`w-2 h-2 rounded-full border ${valid && target > buy ? "border-emerald-400 bg-emerald-400/20" : "border-slate-600"}`} />
            <div className={`w-2 h-2 rounded-full border-2 ${buy > 0 ? (belowS2 ? "border-orange-400 bg-orange-400/20" : "border-sky-400 bg-sky-400/20") : "border-slate-600"}`} />
            <div className={`w-2 h-2 rounded-full border ${valid ? "border-red-400 bg-red-400/20" : "border-slate-600"}`} />
            <div className={`w-6 h-px ${valid ? "bg-red-400/30" : "bg-slate-700"}`} />
          </div>

          {/* ENTRY */}
          <div className="w-24 shrink-0">
            <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${belowS2 ? "text-orange-400" : "text-sky-400"}`}>
              Entry {belowS2 ? "⚠ S2" : row.pivots && buy > 0 ? (buy >= row.pivots.p ? "↑P" : buy >= row.pivots.s1 ? "S1–P" : buy >= row.pivots.s2 ? "S1–S2" : "") : ""}
            </p>
            <div className="relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={row.buyPrice} onChange={(e) => handleBuyPrice(e.target.value)} placeholder="0.00"
                className={`${inputBase} focus:ring-sky-500/40 ${belowS2 ? "border-orange-500/50" : buy > 0 ? "border-sky-500/40" : "border-slate-700"}`} />
            </div>
          </div>

          <div className={`w-6 h-px shrink-0 mt-4 ${valid ? "bg-red-400/30" : "bg-slate-700"}`} />

          {/* STOP */}
          <div className="w-24 shrink-0">
            <p className="text-[9px] font-semibold text-red-400 uppercase tracking-wider mb-0.5">
              Stop {valid ? fmtPct(stopPct) : ""}
            </p>
            <div className="relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={row.stopLoss} onChange={(e) => onUpdate({ stopLoss: e.target.value })} placeholder="0.00"
                className={`${inputBase} focus:ring-red-500/40 ${valid ? "border-red-500/40" : "border-slate-700"}`} />
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-800 shrink-0 mt-4" />

          {/* Results */}
          {valid && qty > 0 ? (
            <div className="flex items-end gap-3 mt-4">
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Qty</p>
                <p className="text-white font-semibold text-sm">{qty}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Cash</p>
                <p className="text-white font-mono text-sm">${cashUsed >= 1000 ? fmt(cashUsed / 1000, 1) + "k" : fmt(cashUsed)}</p>
                <p className={`text-[10px] font-mono ${cashPct > 50 ? "text-orange-400" : cashPct > 25 ? "text-yellow-400" : "text-slate-400"}`}>{cashPct.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Risk</p>
                <p className="text-red-400 font-mono text-sm">-${fmt(maxLoss)}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Gain</p>
                <p className="text-emerald-400 font-mono text-sm">+${fmt(maxGain)}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">R:R</p>
                <p className={`font-bold text-sm ${rrRatio >= 2 ? "text-emerald-400" : rrRatio >= 1 ? "text-yellow-400" : "text-red-400"}`}>{rrRatio.toFixed(1)}x</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 text-xs mt-4">{buy > 0 ? "set stop & target" : "loading…"}</p>
          )}
        </div>
      </div>

      {/* ── Right column: chart ── */}
      <div className="shrink-0 w-[480px] h-48 rounded-lg overflow-hidden bg-slate-800/30">
        <MiniChart bars={row.bars} pivots={row.pivots} entry={buy} target={target} stop={stop} />
      </div>

    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TradeCalculatorPage() {
  const [rows, setRows]               = useState<Row[]>([makeRow()]);
  const [accountSize, setAccountSize] = useState("50000");
  const [riskPct, setRiskPct]         = useState("1");

  const account = parseFloat(accountSize) || 0;
  const risk    = parseFloat(riskPct)     || 1;

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const addRow = () =>
    setRows(prev => [...prev, makeRow(BLUE_CHIPS[prev.length % BLUE_CHIPS.length].symbol)]);

  const removeRow = (id: number) =>
    setRows(prev => prev.filter(r => r.id !== id));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header + global controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-white">Trade Calculator</h1>
            <p className="text-xs text-slate-500 mt-0.5">Limit buy → OCO · entry auto-set to S2 · SL −0.5% · TGT +1%</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Account</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" value={accountSize} onChange={e => setAccountSize(e.target.value)}
                className="w-32 bg-slate-800 border border-slate-700 text-white rounded-lg pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
            </div>
            <label className="text-xs text-slate-400">Risk</label>
            <div className="relative">
              <input type="number" value={riskPct} onChange={e => setRiskPct(e.target.value)} step="0.1"
                className="w-20 bg-slate-800 border border-slate-700 text-white rounded-lg pl-3 pr-6 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-3">
          {rows.map(row => (
            <SymbolRow
              key={row.id} row={row}
              accountSize={account} riskPct={risk}
              onUpdate={patch => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
              canRemove={rows.length > 1}
            />
          ))}
        </div>

        <button onClick={addRow}
          className="w-full py-2.5 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-sky-400 hover:border-sky-500/40 text-sm transition-colors">
          + Add Symbol
        </button>

      </div>
    </main>
  );
}
