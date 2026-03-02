import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIPS } from "@/lib/bluechips";
import { calcTechSignal, type SignalLabel } from "@/lib/indicators";

const yahooFinance = new YahooFinance();

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type TfLabel = "1m" | "5m" | "15m" | "30m" | "1H" | "5H" | "1D" | "1W" | "1M";
export type TechRow = { symbol: string; name: string; sector: string; signals: Record<TfLabel, SignalLabel> };

const TIMEFRAMES: { label: TfLabel; interval: string; days: number; is5H: boolean }[] = [
  { label: "1m",  interval: "1m",  days: 2,    is5H: false },
  { label: "5m",  interval: "5m",  days: 5,    is5H: false },
  { label: "15m", interval: "15m", days: 14,   is5H: false },
  { label: "30m", interval: "30m", days: 20,   is5H: false },
  { label: "1H",  interval: "1h",  days: 30,   is5H: false },
  { label: "5H",  interval: "1h",  days: 30,   is5H: true  },
  { label: "1D",  interval: "1d",  days: 100,  is5H: false },
  { label: "1W",  interval: "1wk", days: 730,  is5H: false },
  { label: "1M",  interval: "1mo", days: 1826, is5H: false },
];

function aggregateTo5H(bars: Bar[]): Bar[] {
  const buckets = new Map<number, Bar[]>();
  for (const bar of bars) {
    const key = Math.floor(bar.time / (5 * 3600)) * (5 * 3600);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(bar);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, chunk]) => ({
      time:   key,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map((b) => b.high)),
      low:    Math.min(...chunk.map((b) => b.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + b.volume, 0),
    }));
}

function toBars(quotes: { date: Date | string; open?: number | null; high?: number | null; low?: number | null; close?: number | null; volume?: number | null }[]): Bar[] {
  return quotes
    .filter((q) => q.open != null && q.close != null)
    .map((q) => ({
      time:   Math.floor((q.date instanceof Date ? q.date : new Date(q.date)).getTime() / 1000),
      open:   q.open!,
      high:   q.high ?? q.open!,
      low:    q.low  ?? q.open!,
      close:  q.close!,
      volume: q.volume ?? 0,
    }));
}

// 5-minute in-memory cache
let cache: { rows: TechRow[]; at: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json({ rows: cache.rows, fetchedAt: new Date(cache.at).toISOString(), cached: true });
  }

  const now = new Date();

  // Initialise signal store
  const signals: Record<string, Partial<Record<TfLabel, SignalLabel>>> = {};
  for (const chip of BLUE_CHIPS) signals[chip.symbol] = {};

  // Group timeframes by unique fetch key to avoid duplicate Yahoo requests
  // (1H and 5H share the same raw data)
  const groups = new Map<string, typeof TIMEFRAMES>();
  for (const tf of TIMEFRAMES) {
    const key = `${tf.interval}-${tf.days}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tf);
  }

  // Sequential per unique fetch key; parallel across all 50 symbols within each key
  for (const tfs of groups.values()) {
    const { interval, days } = tfs[0];
    const start = new Date(now);
    start.setDate(start.getDate() - days);

    const results = await Promise.allSettled(
      BLUE_CHIPS.map((chip) =>
        yahooFinance.chart(chip.symbol, { period1: start, period2: now, interval: interval as never })
      )
    );

    results.forEach((res, i) => {
      if (res.status === "rejected" || !res.value) return;
      const bars = toBars(res.value.quotes ?? []);
      const symbol = BLUE_CHIPS[i].symbol;
      for (const tf of tfs) {
        const finalBars = tf.is5H ? aggregateTo5H(bars) : bars;
        signals[symbol][tf.label] = calcTechSignal(finalBars);
      }
    });
  }

  const rows: TechRow[] = BLUE_CHIPS.map((chip) => ({
    symbol: chip.symbol,
    name:   chip.name,
    sector: chip.sector,
    signals: signals[chip.symbol] as Record<TfLabel, SignalLabel>,
  }));

  cache = { rows, at: Date.now() };
  return NextResponse.json({ rows, fetchedAt: new Date(cache.at).toISOString(), cached: false });
}
