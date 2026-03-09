"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import RefreshRing from "@/components/RefreshRing";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { BLUE_CHIPS } from "@/lib/bluechips";
import type { OHLCBar, SMAConfig } from "@/components/CandlestickChart";
import { calcTechSignal, computeMASignals, computeTechIndicators, computeEMA, type SignalLabel, type MAComponent, type MAResult, type TechIndicator } from "@/lib/indicators";
import AddToTradeButton from "@/components/AddToTradeButton";

const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });

const TIMEFRAMES = [
  { label: "1m",  value: "1m",  defaultDays: 2,   maxDays: 7    },
  { label: "3m",  value: "3m",  defaultDays: 3,   maxDays: 7    }, // synthetic from 1m
  { label: "5m",  value: "5m",  defaultDays: 5,   maxDays: 60   },
  { label: "15m", value: "15m", defaultDays: 14,  maxDays: 60   },
  { label: "30m", value: "30m", defaultDays: 20,  maxDays: 60   },
  { label: "1H",  value: "1h",  defaultDays: 30,  maxDays: 730  },
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

const SMA_PRESETS: SMAConfig[] = [
  { period: 22, color: "#38bdf8", visible: true }, // light blue
  { period: 33, color: "#ef4444", visible: true }, // red
  { period: 44, color: "#1d4ed8", visible: true }, // dark blue
];

const TECH_TIMEFRAMES = [
  { label: "1 Min",   api: "1m",  days: 2,    is5H: false },
  { label: "5 Min",   api: "5m",  days: 5,    is5H: false },
  { label: "15 Min",  api: "15m", days: 14,   is5H: false },
  { label: "30 Min",  api: "30m", days: 20,   is5H: false },
  { label: "Hourly",  api: "1h",  days: 30,   is5H: false },
  { label: "5 Hours", api: "1h",  days: 30,   is5H: true  },
  { label: "Daily",   api: "1d",  days: 100,  is5H: false },
  { label: "Weekly",  api: "1wk", days: 730,  is5H: false },
  { label: "Monthly", api: "1mo", days: 1826, is5H: false },
] as const;

import { getMarketSession } from "@/lib/marketSession";

function aggregateBarsTo5H(hourlyBars: OHLCBar[]): OHLCBar[] {
  const groups = new Map<number, OHLCBar[]>();
  for (const bar of hourlyBars) {
    const key = Math.floor(bar.time / (5 * 3600));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bar);
  }
  return Array.from(groups.values()).map(slice => ({
    time: slice[0].time,
    open: slice[0].open,
    high: Math.max(...slice.map(b => b.high)),
    low: Math.min(...slice.map(b => b.low)),
    close: slice[slice.length - 1].close,
    volume: slice.reduce((s, b) => s + b.volume, 0),
  }));
}

function tileClass(signal: SignalLabel | null | undefined): string {
  switch (signal) {
    case "Strong Buy": return "border-green-700/50 bg-green-900/30";
    case "Buy":        return "border-green-700/40 bg-green-900/20";
    case "Neutral":    return "border-slate-600/60 bg-slate-800/30";
    case "Sell":       return "border-orange-600/40 bg-orange-900/20";
    case "Strong Sell":return "border-red-600/50 bg-red-900/30";
    default:           return "border-slate-700/60 bg-slate-800/30";
  }
}

const MA_COMPONENTS: MAComponent[] = ["SMA20", "SMA50", "GX", "EMA12", "EMA26", "EMA200"];
const MA_ABBR: Record<string, string> = {
  SMA20: "20", SMA50: "50", GX: "GX", EMA12: "E12", EMA26: "E26", EMA200: "E200",
};
const TF_ABBR: Record<string, string> = {
  "1 Min": "1m", "5 Min": "5m", "15 Min": "15m", "30 Min": "30m",
  "Hourly": "1H", "5 Hours": "5H", "Daily": "1D", "Weekly": "1W", "Monthly": "1Mo",
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
  return <span className={`text-sm leading-none select-none ${s.cls}`} title={signal ?? "—"}>{s.letter}</span>;
}
const SIGNAL_VAL: Record<string, number> = {
  "Strong Buy": 2, "Buy": 1, "Neutral": 0, "Sell": -1, "Strong Sell": -2,
};

function Speedometer({ normalized, label }: { normalized: number; label: string }) {
  const size = 40;
  const cx = size / 2;
  const cy = Math.round(size * 0.64);
  const r  = Math.round(size * 0.44);
  const rn = Math.round(size * 0.35);

  const t = Math.max(0, Math.min(1, (normalized + 1) / 2));
  const angleRad = (1 - t) * Math.PI;
  const nx = (cx + rn * Math.cos(angleRad)).toFixed(2);
  const ny = (cy - rn * Math.sin(angleRad)).toFixed(2);

  const arc = (from: number, to: number) => {
    const a1 = (1 - from) * Math.PI;
    const a2 = (1 - to)   * Math.PI;
    const x1 = (cx + r * Math.cos(a1)).toFixed(2);
    const y1 = (cy - r * Math.sin(a1)).toFixed(2);
    const x2 = (cx + r * Math.cos(a2)).toFixed(2);
    const y2 = (cy - r * Math.sin(a2)).toFixed(2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  const zones = [
    { from: 0,   to: 0.2,  color: "#ef4444" },
    { from: 0.21, to: 0.39, color: "#f97316" },
    { from: 0.4, to: 0.6,  color: "#475569" },
    { from: 0.61, to: 0.79, color: "#86efac" },
    { from: 0.8, to: 1.0,  color: "#15803d" },
  ];

  const h = cy + 6;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <path d={arc(0, 1)} fill="none" stroke="#1e293b" strokeWidth={5} strokeLinecap="butt" />
        {zones.map((z, i) => (
          <path key={i} d={arc(z.from, z.to)} fill="none" stroke={z.color} strokeWidth={4} strokeLinecap="butt" />
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e2e8f0" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={2.5} fill="#475569" />
      </svg>
      <span className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Empty response (${res.status})`);
  try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
}

function smaSlice(bars: OHLCBar[], period: number, windowSize: number): number[] {
  if (bars.length < period) return [];
  const out: number[] = [];
  const start = Math.max(period - 1, bars.length - windowSize);
  for (let i = start; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    out.push(sum / period);
  }
  return out;
}

function detectTrend(bars: OHLCBar[], period: number): "up" | "sideways" | "down" {
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

function ChartsContent() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get("symbol") ?? "AAPL");
  const [timeframe, setTimeframe] = useState("1d");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [bars, setBars] = useState<OHLCBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smas, setSmas] = useState<SMAConfig[]>(SMA_PRESETS);
  const [customPeriod, setCustomPeriod] = useState("");
  const [customColor, setCustomColor] = useState("#ff6b6b");
  const [techSignals, setTechSignals] = useState<Record<string, SignalLabel | null>>({});
  const [techLoading, setTechLoading] = useState(false);
  const [maResult, setMaResult] = useState<MAResult | null>(null);
  const [showSMAPopup, setShowSMAPopup] = useState(false);
  const [rangeBars, setRangeBars] = useState<OHLCBar[]>([]);
  const [minuteBars, setMinuteBars] = useState<OHLCBar[]>([]);
  const [minuteBarsLoading, setMinuteBarsLoading] = useState(true);
  const [quoteData, setQuoteData] = useState<{
    marketState?: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    regularMarketTime?: number;
    preMarketPrice?: number;
    preMarketChange?: number;
    preMarketChangePercent?: number;
    preMarketTime?: number;
    postMarketPrice?: number;
    postMarketChange?: number;
    postMarketChangePercent?: number;
    postMarketTime?: number;
  } | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchChart = useCallback(async (sym: string, tf: string, days: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/charts?symbol=${sym}&timeframe=${tf}&days=${days}`);
      const data = await safeJson(res);
      if (data.error) throw new Error(data.error);
      setBars(data.bars ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTechAnalysis = useCallback(async (sym: string) => {
    setTechLoading(true);
    setTechSignals({});
    setMaResult(null);
    const results = await Promise.allSettled(
      TECH_TIMEFRAMES.map(async ({ label, api, days, is5H }) => {
        const res = await fetch(`/api/charts?symbol=${sym}&timeframe=${api}&days=${days}`);
        const data = await safeJson(res);
        if (data.error) throw new Error(data.error);
        let fetchedBars: OHLCBar[] = data.bars ?? [];
        if (is5H) fetchedBars = aggregateBarsTo5H(fetchedBars);
        return { label, api, is5H, bars: fetchedBars, signal: calcTechSignal(fetchedBars) };
      })
    );
    // Single setState for all signals at once — avoids 9 separate re-renders
    const nextSignals: Record<string, SignalLabel | null> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        nextSignals[r.value.label] = r.value.signal;
        if (r.value.api === "1d" && !r.value.is5H) setMaResult(computeMASignals(r.value.bars));
      } else {
        // find which label failed via index
      }
    }
    // Fill nulls for any that rejected
    TECH_TIMEFRAMES.forEach(({ label }, i) => {
      if (results[i].status === "rejected") nextSignals[label] = null;
    });
    setTechSignals(nextSignals);
    setTechLoading(false);
  }, []);

  // When timeframe changes, reset lookback to its default
  const handleTimeframeChange = (tf: string) => {
    const def = TIMEFRAMES.find((t) => t.value === tf)?.defaultDays ?? 90;
    setTimeframe(tf);
    setLookbackDays(def);
  };

  useEffect(() => { fetchChart(symbol, timeframe, lookbackDays); }, [symbol, timeframe, lookbackDays, fetchChart]);

  // Fire all symbol-dependent fetches in parallel in a single effect
  useEffect(() => {
    setQuoteData(null);
    setMinuteBarsLoading(true);
    fetchTechAnalysis(symbol);
    fetch(`/api/charts?symbol=${symbol}&timeframe=1d&days=365`)
      .then(r => r.json()).then(d => setRangeBars(d.bars ?? [])).catch(() => setRangeBars([]));
    fetch(`/api/quote?symbol=${symbol}`)
      .then(r => r.json()).then(d => { setQuoteData(d); setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" })); }).catch(() => setQuoteData(null));
    fetch(`/api/charts?symbol=${symbol}&timeframe=1m&days=2`)
      .then(r => r.json())
      .then(d => { setMinuteBars(d.bars ?? []); setMinuteBarsLoading(false); })
      .catch(() => { setMinuteBars([]); setMinuteBarsLoading(false); });
  }, [symbol, fetchTechAnalysis]);

  const refreshAll = useCallback(() => {
    fetchChart(symbol, timeframe, lookbackDays);
    fetchTechAnalysis(symbol);
    fetch(`/api/charts?symbol=${symbol}&timeframe=1d&days=365`)
      .then(r => r.json()).then(d => setRangeBars(d.bars ?? [])).catch(() => setRangeBars([]));
    setQuoteData(null);
    fetch(`/api/quote?symbol=${symbol}`)
      .then(r => r.json()).then(d => { setQuoteData(d); setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/New_York" })); }).catch(() => setQuoteData(null));
    setMinuteBarsLoading(true);
    fetch(`/api/charts?symbol=${symbol}&timeframe=1m&days=2`)
      .then(r => r.json())
      .then(d => { setMinuteBars(d.bars ?? []); setMinuteBarsLoading(false); })
      .catch(() => { setMinuteBars([]); setMinuteBarsLoading(false); });
  }, [symbol, timeframe, lookbackDays, fetchChart, fetchTechAnalysis]);

  useEffect(() => {
    setCountdown(60);
    const t = setInterval(() => {
      if (getMarketSession() === "closed") return;
      setCountdown((c) => {
        if (c <= 1) { refreshAll(); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [refreshAll]);

  const toggleSMA = (i: number) =>
    setSmas((prev) => prev.map((s, idx) => idx === i ? { ...s, visible: !s.visible } : s));

  const addCustomSMA = () => {
    const p = parseInt(customPeriod);
    if (!p || p < 2 || p > 500) return;
    if (smas.some((s) => s.period === p)) return;
    setSmas((prev) => [...prev, { period: p, color: customColor, visible: true }]);
    setCustomPeriod("");
  };

  const removeSMA = (i: number) =>
    setSmas((prev) => prev.filter((_, idx) => idx !== i));

  const selectedChip = BLUE_CHIPS.find((c) => c.symbol === symbol);
  const lastBar = bars[bars.length - 1];
  const firstBar = bars[0];
  const totalChange = lastBar && firstBar ? ((lastBar.close - firstBar.close) / firstBar.close) * 100 : null;

  const currentClose = rangeBars[rangeBars.length - 1]?.close ?? null;
  const rangeOf = (bars: OHLCBar[], n: number) => {
    const slice = bars.slice(-n);
    if (!slice.length) return null;
    return {
      open:  slice[0].open,
      high:  Math.max(...slice.map(b => b.high)),
      low:   Math.min(...slice.map(b => b.low)),
      close: slice[slice.length - 1].close,
    };
  };
  const ranges = [
    { label: "1Mi",  data: rangeOf(minuteBars, 1)   },
    { label: "3Mi",  data: rangeOf(minuteBars, 3)   },
    { label: "5Mi",  data: rangeOf(minuteBars, 5)   },
    { label: "15Mi", data: rangeOf(minuteBars, 15)  },
    { label: "1Hr",  data: rangeOf(minuteBars, 60)  },
    { label: "4Hr",  data: rangeOf(minuteBars, 240) },
    { label: "1D",   data: rangeOf(rangeBars,  1)   },
    { label: "1Wk",  data: rangeOf(rangeBars,  5)   },
    { label: "1Mo",  data: rangeOf(rangeBars,  21)  },
    { label: "3Mo",  data: rangeOf(rangeBars,  63)  },
    { label: "6Mo",  data: rangeOf(rangeBars,  126) },
    { label: "1Yr",  data: rangeOf(rangeBars,  252) },
  ];

  const techIndicators: TechIndicator[] = useMemo(
    () => rangeBars.length >= 30 ? computeTechIndicators(rangeBars) : [],
    [rangeBars]
  );

  const pivotPoints = (() => {
    const bar = rangeBars[rangeBars.length - 1];
    if (!bar) return null;
    const { high: H, low: L, close: C, open: O } = bar;
    const r = (v: number | null) => v;

    const classicPP = (H + L + C) / 3;
    const fibPP     = classicPP;
    const woodiePP  = (H + L + 2 * C) / 4;
    const camarPP   = classicPP;
    const range     = H - L;

    let demarkX: number;
    if (C < O)      demarkX = H + 2 * L + C;
    else if (C > O) demarkX = 2 * H + L + C;
    else            demarkX = H + L + 2 * C;
    const demarkPP  = demarkX / 4;

    return [
      {
        name: "Classic",
        s3: r(L - 2 * (H - classicPP)),
        s2: r(classicPP - range),
        s1: r(2 * classicPP - H),
        pp: classicPP,
        r1: r(2 * classicPP - L),
        r2: r(classicPP + range),
        r3: r(H + 2 * (classicPP - L)),
      },
      {
        name: "Fibonacci",
        s3: r(fibPP - range),
        s2: r(fibPP - 0.618 * range),
        s1: r(fibPP - 0.382 * range),
        pp: fibPP,
        r1: r(fibPP + 0.382 * range),
        r2: r(fibPP + 0.618 * range),
        r3: r(fibPP + range),
      },
      {
        name: "Camarilla",
        s3: r(C - (range * 1.1) / 4),
        s2: r(C - (range * 1.1) / 6),
        s1: r(C - (range * 1.1) / 12),
        pp: camarPP,
        r1: r(C + (range * 1.1) / 12),
        r2: r(C + (range * 1.1) / 6),
        r3: r(C + (range * 1.1) / 4),
      },
      {
        name: "Woodie's",
        s3: r(L - 2 * (H - woodiePP)),
        s2: r(woodiePP - range),
        s1: r(2 * woodiePP - H),
        pp: woodiePP,
        r1: r(2 * woodiePP - L),
        r2: r(woodiePP + range),
        r3: r(H + 2 * (woodiePP - L)),
      },
      {
        name: "DeMark's",
        s3: null,
        s2: null,
        s1: r(demarkX / 2 - H),
        pp: demarkPP,
        r1: r(demarkX / 2 - L),
        r2: null,
        r3: null,
      },
    ];
  })();

  const MA_PERIODS = [5, 10, 20, 50, 100, 200];
  const maRows = (() => {
    if (!rangeBars.length) return [];
    const closes = rangeBars.map(b => b.close);
    const close = closes[closes.length - 1];
    return MA_PERIODS.map(period => {
      const smaVal = closes.length >= period ? closes.slice(-period).reduce((s, v) => s + v, 0) / period : null;
      const emaArr = computeEMA(closes, period).filter((v): v is number => v !== null);
      const emaVal = emaArr.length > 0 ? emaArr[emaArr.length - 1] : null;
      return {
        period,
        sma: smaVal,
        smaSignal: smaVal !== null ? (close > smaVal ? "Buy" : "Sell") : null,
        ema: emaVal,
        emaSignal: emaVal !== null ? (close > emaVal ? "Buy" : "Sell") : null,
      };
    });
  })();

  const fmtEST = (ts: number) =>
    new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });

  const analysisTimestamp = (() => {
    const lastBar = rangeBars[rangeBars.length - 1];
    return lastBar ? fmtEST(lastBar.time * 1000) : null;
  })();

  const tfSummary = (() => {
    const signals = TECH_TIMEFRAMES.map(({ label }) => techSignals[label]).filter(Boolean) as string[];
    const buy     = signals.filter(s => s === "Strong Buy"  || s === "Buy").length;
    const sell    = signals.filter(s => s === "Strong Sell" || s === "Sell").length;
    const neutral = signals.length - buy - sell;
    const ratio   = signals.length > 0 ? (buy - sell) / signals.length : 0;
    const label   = ratio >= 0.6 ? "Strong Buy" : ratio >= 0.2 ? "Buy" : ratio <= -0.6 ? "Strong Sell" : ratio <= -0.2 ? "Sell" : "Neutral";
    return { label, buy, neutral, sell, norm: ratio };
  })();

  const indSummary = (() => {
    const buy     = techIndicators.filter(i => i.signal === "Strong Buy" || i.signal === "Buy").length;
    const sell    = techIndicators.filter(i => i.signal === "Strong Sell" || i.signal === "Sell").length;
    const neutral = techIndicators.length - buy - sell;
    const ratio   = techIndicators.length > 0 ? (buy - sell) / techIndicators.length : 0;
    const label   = ratio >= 0.6 ? "Strong Buy" : ratio >= 0.2 ? "Buy" : ratio <= -0.6 ? "Strong Sell" : ratio <= -0.2 ? "Sell" : "Neutral";
    return { label, buy, neutral, sell, norm: ratio };
  })();

  const maSummary = (() => {
    const signals = maRows.flatMap(r => [r.smaSignal, r.emaSignal]).filter(Boolean) as string[];
    const buy     = signals.filter(s => s === "Buy").length;
    const sell    = signals.filter(s => s === "Sell").length;
    const neutral = signals.length - buy - sell;
    const ratio   = signals.length > 0 ? (buy - sell) / signals.length : 0;
    const label   = ratio >= 0.6 ? "Strong Buy" : ratio >= 0.2 ? "Buy" : ratio <= -0.6 ? "Strong Sell" : ratio <= -0.2 ? "Sell" : "Neutral";
    return { label, buy, neutral, sell, norm: ratio };
  })();

  const summaryLabelColor = (label: string) =>
    label === "Strong Buy"  ? "text-green-400" :
    label === "Buy"         ? "text-green-300" :
    label === "Strong Sell" ? "text-red-500"   :
    label === "Sell"        ? "text-orange-400": "text-slate-400";

  const maNorm = (maResult?.score ?? 0) / 6;
  const tfScore = TECH_TIMEFRAMES.reduce((s, { label }) => s + (SIGNAL_VAL[techSignals[label] ?? ""] ?? 0), 0);
  const tfNorm = tfScore / 18;
  const combinedNorm = (maNorm + tfNorm) / 2;

  return (
    <div className="max-w-7xl mx-auto px-6 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Equity</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Interactive candlestick chart with multi-timeframe technical analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-slate-500 tabular-nums">Updated {lastUpdated}</span>
          )}
          <RefreshRing countdown={countdown} total={60} loading={loading} onClick={() => { refreshAll(); setCountdown(60); }} />
        </div>
      </div>

      {/* Row 1: Symbol + info + price tiles + Fair Value */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 flex items-center gap-4 flex-wrap">
        {/* Symbol + info */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500 min-w-[100px]"
          >
            {BLUE_CHIPS.map((c) => (
              <option key={c.symbol} value={c.symbol}>
                {c.symbol}
              </option>
            ))}
          </select>
          {selectedChip && (
            <>
            <AddToTradeButton symbol={symbol} />
            <div className="relative group">
              <button className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-500 hover:text-slate-300 text-xs flex items-center justify-center transition-colors">
                i
              </button>
              <div className="absolute left-0 top-8 z-30 hidden group-hover:block w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 space-y-1.5 text-xs text-slate-400">
                <p className="font-semibold text-slate-200 text-sm">{selectedChip.symbol}</p>
                <p>{selectedChip.name}</p>
                <p className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 inline-block">
                  {selectedChip.sector}
                </p>
                <p className="text-slate-500 pt-1">{bars.length} bars loaded</p>
              </div>
            </div>
            </>
          )}
        </div>

        {/* Price tiles */}
        {quoteData && (() => {
          const ms = quoteData.marketState ?? "";
          const isRegular = ms === "REGULAR";
          const isPre     = ms === "PRE" || ms === "PREPRE";
          const isPost    = ms === "POST" || ms === "POSTPOST";

          const fmt  = (v?: number) => v != null ? `$${v.toFixed(2)}` : "—";
          const fmtC = (v?: number, p?: number) =>
            v != null && p != null
              ? `${v >= 0 ? "+" : ""}${v.toFixed(2)} (${p >= 0 ? "+" : ""}${p.toFixed(2)}%)`
              : null;
          const fmtT = (ms?: number | null) => {
            if (!ms) return null;
            return fmtEST(ms);
          };

          const marketTile = {
            label:  isRegular ? "MARKET" : "CLOSED",
            price:  fmt(quoteData.regularMarketPrice),
            change: fmtC(quoteData.regularMarketChange, quoteData.regularMarketChangePercent),
            up:     (quoteData.regularMarketChange ?? 0) >= 0,
            active: isRegular,
            dot:    isRegular ? "bg-green-400 animate-pulse" : "bg-slate-600",
            time:   fmtT(quoteData.regularMarketTime),
          };

          const secondTile = isPre ? {
            label:  "PRE-MKT",
            price:  fmt(quoteData.preMarketPrice),
            change: fmtC(quoteData.preMarketChange, quoteData.preMarketChangePercent),
            up:     (quoteData.preMarketChange ?? 0) >= 0,
            active: true,
            dot:    "bg-yellow-400 animate-pulse",
            time:   fmtT(quoteData.preMarketTime),
          } : isPost ? {
            label:  "AFTER-HRS",
            price:  fmt(quoteData.postMarketPrice),
            change: fmtC(quoteData.postMarketChange, quoteData.postMarketChangePercent),
            up:     (quoteData.postMarketChange ?? 0) >= 0,
            active: true,
            dot:    "bg-blue-400 animate-pulse",
            time:   fmtT(quoteData.postMarketTime),
          } : null;

          const tiles = secondTile ? [marketTile, secondTile] : [marketTile];

          return (
            <>
              <span className="text-slate-700 shrink-0">|</span>
              {tiles.map(tile => (
                <div
                  key={tile.label}
                  className={`flex flex-col px-2.5 py-1 rounded-lg border shrink-0 min-w-[90px] ${
                    tile.active
                      ? "border-slate-600 bg-slate-800"
                      : "border-slate-800 bg-slate-800/30 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tile.dot}`} />
                    <span className="text-[8px] text-slate-500 uppercase tracking-wider leading-none">{tile.label}</span>
                  </div>
                  <span className="font-mono text-sm text-white font-semibold leading-none">{tile.price}</span>
                  {tile.change && (
                    <span className={`font-mono text-[9px] font-semibold mt-0.5 leading-none ${tile.up ? "text-green-400" : "text-red-400"}`}>
                      {tile.change}
                    </span>
                  )}
                  {tile.time && (
                    <span className="text-[8px] text-slate-600 mt-0.5 leading-none">{tile.time}</span>
                  )}
                </div>
              ))}
            </>
          );
        })()}

        {/* Fair Value */}
        {pivotPoints && currentClose !== null && (() => {
          const fv = pivotPoints[0].pp;
          const diff = currentClose - fv;
          const diffPct = fv > 0 ? (diff / fv) * 100 : 0;
          const isAbove = diff >= 0;
          const isNeutral = Math.abs(diffPct) < 0.5;
          const fvSignal = isNeutral ? "Neutral" : isAbove ? "Above FV" : "Below FV";
          const fvColor  = isNeutral ? "text-slate-400" : isAbove ? "text-green-400" : "text-red-400";
          const lastBar  = rangeBars[rangeBars.length - 1];
          const barDate  = lastBar ? fmtEST(lastBar.time * 1000) : null;
          return (
            <>
              <span className="text-slate-700 shrink-0">|</span>
              <div className="flex flex-col items-start px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-800/30 shrink-0 min-w-[80px]">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider leading-none mb-0.5">Fair Value</span>
                <span className="font-mono text-sm text-white font-semibold leading-none">${fv.toFixed(2)}</span>
                <span className={`text-[9px] font-semibold mt-0.5 leading-none ${fvColor}`}>
                  {isAbove ? "+" : ""}{diffPct.toFixed(2)}% · {fvSignal}
                </span>
                {barDate && <span className="text-[8px] text-slate-600 mt-0.5 leading-none">{barDate}</span>}
              </div>
            </>
          );
        })()}
      </div>

      {/* Price ranges row — OHLC mini bars */}
      {currentClose !== null && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 flex items-center gap-4 flex-wrap">
          {ranges.map(({ label, data }) => {
            const isIntraday = ["1Mi","3Mi","5Mi","15Mi","1Hr","4Hr"].includes(label);
            if (!data) {
              if (isIntraday && minuteBarsLoading) {
                return (
                  <div key={label} className="flex items-center gap-2 shrink-0 animate-pulse">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider w-8 shrink-0">{label}</span>
                    <div className="h-3 w-40 bg-slate-800 rounded" />
                  </div>
                );
              }
              return null;
            }
            const { open, high, low, close } = data;
            const range = high - low;
            const bullish = close >= open;
            const W = 80;
            const toX = range > 0
              ? (v: number) => ((v - low) / range) * W
              : () => W / 2;
            const bodyL = range > 0 ? toX(Math.min(open, close)) : W / 4;
            const bodyR = range > 0 ? toX(Math.max(open, close)) : W * 3 / 4;
            const bodyW = Math.max(bodyR - bodyL, 1);
            const bodyColor = bullish ? "#4ade80" : "#f87171";
            return (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider w-8 shrink-0">{label}</span>
                <span className="font-mono text-[10px] text-red-400 tabular-nums">${low.toFixed(2)}</span>
                <svg width={W} height={20} className="shrink-0">
                  <line x1={0} y1={10} x2={W} y2={10} stroke="#334155" strokeWidth={2} strokeLinecap="round" />
                  <rect x={bodyL} y={5} width={bodyW} height={10} fill={bodyColor} opacity={0.85} rx={1} />
                  <line x1={toX(close)} y1={3} x2={toX(close)} y2={17} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                <span className="font-mono text-[10px] text-green-400 tabular-nums">${high.toFixed(2)}</span>
                <span className={`font-mono text-[9px] font-semibold tabular-nums ${bullish ? "text-green-400" : "text-red-400"}`}>
                  {open > 0 ? `${bullish ? "+" : ""}${(((close - open) / open) * 100).toFixed(2)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Combined analysis panel: TF | Oscillators | MAs */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 flex items-stretch divide-x divide-slate-800">

        {/* Section 1: TF */}
        <div className="flex flex-col px-3 py-2 shrink-0">
          <div className="mb-1.5 pb-1.5 border-b border-slate-800 shrink-0">
            <p className="flex items-center gap-2">
              <span className={`text-xs font-bold ${summaryLabelColor(tfSummary.label)}`}>● {tfSummary.label.toUpperCase()}</span>
              <span className="text-[9px] text-slate-600">{analysisTimestamp}</span>
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              Buy: <span className="text-green-300 font-semibold">{tfSummary.buy}</span>
              <span className="mx-1 text-slate-700">·</span>
              Neutral: <span className="text-slate-400 font-semibold">{tfSummary.neutral}</span>
              <span className="mx-1 text-slate-700">·</span>
              Sell: <span className="text-orange-400 font-semibold">{tfSummary.sell}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1 flex-1 auto-rows-fr">
            {TECH_TIMEFRAMES.map(({ label }) => {
              const signal = techSignals[label] ?? null;
              const isItemLoading = techLoading && !(label in techSignals);
              return (
                <div key={label} className={`rounded px-2 py-0 text-center border flex flex-col items-center justify-center ${tileClass(signal)}`}>
                  <p className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">{TF_ABBR[label] ?? label}</p>
                  {isItemLoading
                    ? <div className="h-2.5 w-2.5 bg-slate-700/60 rounded animate-pulse" />
                    : <span className={`text-[8px] font-semibold leading-none ${
                        signal === "Strong Buy"  ? "text-green-400"  :
                        signal === "Buy"         ? "text-green-300"  :
                        signal === "Strong Sell" ? "text-red-500"    :
                        signal === "Sell"        ? "text-orange-400" :
                        "text-slate-500"
                      }`}>{signal ?? "—"}</span>
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: 12 oscillators in 4×3 grid */}
        <div className="flex-1 flex flex-col px-3 py-2">
          <div className="mb-1.5 pb-1.5 border-b border-slate-800 shrink-0">
            <p className="flex items-center gap-2">
              <span className={`text-xs font-bold ${summaryLabelColor(indSummary.label)}`}>● {indSummary.label.toUpperCase()}</span>
              <span className="text-[9px] text-slate-600">{analysisTimestamp}</span>
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              Buy: <span className="text-green-300 font-semibold">{indSummary.buy}</span>
              <span className="mx-1 text-slate-700">·</span>
              Neutral: <span className="text-slate-400 font-semibold">{indSummary.neutral}</span>
              <span className="mx-1 text-slate-700">·</span>
              Sell: <span className="text-orange-400 font-semibold">{indSummary.sell}</span>
            </p>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-1 flex-1 auto-rows-fr">
            {techIndicators.map(ind => {
              const sigColor =
                ind.signal === "Strong Buy"      ? "text-green-400"  :
                ind.signal === "Buy"             ? "text-green-300"  :
                ind.signal === "Strong Sell"     ? "text-red-500"    :
                ind.signal === "Sell"            ? "text-orange-400" :
                ind.signal === "Less Volatility" ? "text-sky-400"    :
                ind.signal === "High Volatility" ? "text-yellow-400" :
                "text-slate-500";
              const val = Math.abs(ind.value) >= 1000
                ? ind.value.toFixed(0)
                : Math.abs(ind.value) >= 10
                ? ind.value.toFixed(2)
                : ind.value.toFixed(3);
              return (
                <div key={ind.name} className="flex flex-col items-center justify-center px-1 py-1 rounded bg-slate-800/40 text-center">
                  <span className="text-[9px] text-slate-500 font-medium leading-tight w-full text-center">{ind.name}</span>
                  <span className="font-mono text-[10px] text-slate-300 tabular-nums leading-none mt-0.5">{val}</span>
                  <span className={`text-[8px] font-semibold leading-tight mt-0.5 w-full text-center ${sigColor}`}>{ind.signal}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: MA5–MA200 in 3×2 grid */}
        <div className="flex flex-col px-3 py-2 shrink-0">
          <div className="mb-1.5 pb-1.5 border-b border-slate-800 shrink-0">
            <p className="flex items-center gap-2">
              <span className={`text-xs font-bold ${summaryLabelColor(maSummary.label)}`}>● {maSummary.label.toUpperCase()}</span>
              <span className="text-[9px] text-slate-600">{analysisTimestamp}</span>
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              Buy: <span className="text-green-300 font-semibold">{maSummary.buy}</span>
              <span className="mx-1 text-slate-700">·</span>
              Neutral: <span className="text-slate-400 font-semibold">{maSummary.neutral}</span>
              <span className="mx-1 text-slate-700">·</span>
              Sell: <span className="text-orange-400 font-semibold">{maSummary.sell}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 flex-1 auto-rows-fr">
            {maRows.map(row => {
              const smaColor = row.smaSignal === "Buy" ? "text-green-300" : "text-orange-400";
              const emaColor = row.emaSignal === "Buy" ? "text-green-300" : "text-orange-400";
              return (
                <div key={row.period} className="flex flex-col items-center justify-center px-2 rounded bg-slate-800/40">
                  <span className="text-[9px] text-slate-500 font-medium mb-0.5">MA{row.period}</span>
                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-slate-600">S</span>
                    <span className="font-mono text-slate-300 tabular-nums">{row.sma?.toFixed(2) ?? "—"}</span>
                    <span className={`font-semibold ${smaColor}`}>{row.smaSignal ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-slate-600">E</span>
                    <span className="font-mono text-slate-300 tabular-nums">{row.ema?.toFixed(2) ?? "—"}</span>
                    <span className={`font-semibold ${emaColor}`}>{row.emaSignal ?? "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Pivot Points table */}
      {pivotPoints && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-8 border-b border-slate-800">
            <div className="px-3 py-1.5">
              {rangeBars[rangeBars.length - 1] && (
                <span className="text-[9px] text-slate-500">
                  {fmtEST(rangeBars[rangeBars.length - 1].time * 1000)}
                </span>
              )}
            </div>
            {["S3","S2","S1","Pivot Point","R1","R2","R3"].map((col, i) => (
              <div key={col} className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center ${
                i < 3 ? "text-red-400/70" : i === 3 ? "text-slate-400" : "text-green-400/70"
              }`}>{col}</div>
            ))}
          </div>
          {/* Rows */}
          {pivotPoints.map((row, ri) => {
            const fmt = (v: number | null) => v === null ? "—" : v.toFixed(2);
            return (
              <div key={row.name} className={`grid grid-cols-8 ${ri % 2 === 1 ? "bg-slate-800/30" : ""} border-b border-slate-800/50 last:border-0`}>
                <div className="px-3 py-1.5 text-[11px] text-slate-300 font-medium">{row.name}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-red-400">{fmt(row.s3)}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-red-400/80">{fmt(row.s2)}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-red-400/60">{fmt(row.s1)}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-white font-semibold">{fmt(row.pp)}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-green-400/60">{fmt(row.r1)}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-green-400/80">{fmt(row.r2)}</div>
                <div className="px-3 py-1.5 text-[11px] font-mono text-center text-green-400">{fmt(row.r3)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart controls row — MA + timeframe + lookback */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* MA dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSMAPopup(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
              showSMAPopup
                ? "bg-sky-600 border-sky-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            MA
            {smas.filter(s => s.visible).length > 0 && (
              <span className="opacity-60">{smas.filter(s => s.visible).length}</span>
            )}
            <span className="opacity-40">▾</span>
          </button>
          {showSMAPopup && (
            <div className="absolute left-0 bottom-9 z-30 w-52 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Moving Averages</p>
                <button onClick={() => setShowSMAPopup(false)} className="text-slate-600 hover:text-slate-300 text-xs px-1">✕</button>
              </div>
              {smas.map((sma, i) => {
                const trend = typeof sma.period === "number" && bars.length > 0
                  ? detectTrend(bars, sma.period)
                  : "sideways";
                const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
                const arrowColor = trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : "#64748b";
                return (
                  <div key={`${sma.period}-${sma.color}`} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSMA(i)}
                      className={`flex items-center gap-2 flex-1 text-left rounded-md px-2 py-1.5 transition-colors text-sm ${
                        sma.visible ? "bg-slate-800" : "bg-transparent opacity-40"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: sma.color }} />
                      <span className="text-slate-200 flex-1">SMA {sma.period}</span>
                      {sma.visible && (
                        <span className="font-bold text-sm" style={{ color: arrowColor }}>{arrow}</span>
                      )}
                    </button>
                    <button
                      onClick={() => removeSMA(i)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-xs px-1"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <div className="border-t border-slate-800 pt-2 space-y-2">
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
          )}
        </div>

        {/* Timeframe selector */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => handleTimeframeChange(tf.value)}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                timeframe === tf.value
                  ? "bg-sky-500 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <span className="text-slate-700">|</span>

        {/* Lookback selector */}
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
      </div>

      {/* Chart */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden relative" style={{ height: "430px" }}>
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

    </div>
  );
}

export default function ChartsPage() {
  return (
    <Suspense fallback={null}>
      <ChartsContent />
    </Suspense>
  );
}
