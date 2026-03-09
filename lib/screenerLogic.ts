import type { OHLCBar } from "@/components/CandlestickChart";

export type Trend = "up" | "sideways" | "down";

/** Screener config as stored in localStorage ("multi-chart-screeners"). */
export interface StoredScreener {
  id: string;
  name: string;
  timeframe: string;
  lookbackDays: number;
  sector: string;
  smaFilters: Record<string, string[]>; // serialised from Set<Trend>
  candidateSmas: number[];
  candidateProximity: number;
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

export function detectTrend(bars: OHLCBar[], period: number): Trend {
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

function isSignalCandidate(bars: OHLCBar[], periods: number[], proximityPct: number): boolean {
  if (bars.length === 0 || periods.length === 0) return false;
  const last = bars[bars.length - 1];
  if (last.close < last.open) return false; // must be green
  return periods.every((period) => {
    if (bars.length < period) return false;
    let sum = 0;
    for (let i = bars.length - period; i < bars.length; i++) sum += bars[i].close;
    const smaVal = sum / period;
    return Math.abs(last.close - smaVal) / smaVal * 100 <= proximityPct;
  });
}

/**
 * Returns true if `bars` pass the screener's filter criteria.
 * Screeners with no criteria at all are skipped (return false).
 */
export function passesScreener(bars: OHLCBar[], s: StoredScreener): boolean {
  const activeFilters = Object.entries(s.smaFilters).filter(([, arr]) => arr.length > 0);
  if (activeFilters.length === 0 && s.candidateSmas.length === 0) return false;

  const passesTrend =
    activeFilters.length === 0 ||
    (bars.length > 0 &&
      activeFilters.every(([p, arr]) =>
        (new Set(arr) as Set<Trend>).has(detectTrend(bars, parseInt(p)))
      ));

  if (!passesTrend) return false;
  if (s.candidateSmas.length > 0) {
    return isSignalCandidate(bars, s.candidateSmas, s.candidateProximity);
  }
  return true;
}

/** Load saved screeners from localStorage. Safe to call client-side only. */
export function getSavedScreeners(): StoredScreener[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("multi-chart-screeners") ?? "[]");
  } catch {
    return [];
  }
}
