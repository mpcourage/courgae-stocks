import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverseSymbols } from "@/lib/universe";

const yahooFinance = new YahooFinance();

// Maps UI timeframe value → Yahoo Finance interval + lookback days
// "3m" is a synthetic timeframe: fetch 1m and aggregate
const TIMEFRAME_MAP: Record<string, { interval: string; days: number; synthetic?: true }> = {
  "1m":  { interval: "1m",  days: 2    },
  "3m":  { interval: "1m",  days: 3,   synthetic: true }, // built from 1m bars
  "5m":  { interval: "5m",  days: 5    },
  "15m": { interval: "15m", days: 14   },
  "30m": { interval: "30m", days: 20   },
  "1h":  { interval: "1h",  days: 30   },
  "1d":  { interval: "1d",  days: 90   },
  "1wk": { interval: "1wk", days: 730  },
  "1mo": { interval: "1mo", days: 1826 },
};

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

// Group 1-minute bars into N-minute bars using time bucketing
function aggregateBars(bars: Bar[], bucketSeconds: number): Bar[] {
  const buckets = new Map<number, Bar[]>();
  for (const bar of bars) {
    const key = Math.floor(bar.time / bucketSeconds) * bucketSeconds;
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const timeframe = searchParams.get("timeframe") ?? "1d";
  const daysParam = searchParams.get("days");

  const universeSymbols = await getUniverseSymbols();
  if (!symbol || !universeSymbols.includes(symbol)) {
    return NextResponse.json({ error: "Valid blue chip symbol required" }, { status: 400 });
  }

  const { interval, days: defaultDays } = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP["1d"];
  const days = daysParam ? Math.max(1, Math.min(1826, parseInt(daysParam) || defaultDays)) : defaultDays;

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: interval as never,
    });

    let bars: Bar[] = (result.quotes ?? [])
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        time:   Math.floor((q.date instanceof Date ? q.date : new Date(q.date)).getTime() / 1000),
        open:   q.open!,
        high:   q.high!,
        low:    q.low!,
        close:  q.close!,
        volume: q.volume ?? 0,
      }));

    // Aggregate 1m → 3m
    if (timeframe === "3m") {
      bars = aggregateBars(bars, 180); // 3 * 60 seconds
    }

    return NextResponse.json({ symbol, timeframe, bars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
