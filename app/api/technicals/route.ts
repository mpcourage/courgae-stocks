import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIPS } from "@/lib/bluechips";
import { calcTechSignal, computeMASignals, type SignalLabel, type MAResult } from "@/lib/indicators";
import { aggregateBars, toBars } from "@/lib/barAggregation";

const yahooFinance = new YahooFinance();

export type TfLabel = "1m" | "5m" | "15m" | "30m" | "1H" | "5H" | "1D" | "1W" | "1M";
export type TechRow = {
  symbol: string;
  name: string;
  sector: string;
  signals: Record<TfLabel, SignalLabel>;
  ma: MAResult;
};

const TIMEFRAMES: { label: TfLabel; interval: string; days: number; is5H: boolean }[] = [
  { label: "1m",  interval: "1m",  days: 2,    is5H: false },
  { label: "5m",  interval: "5m",  days: 5,    is5H: false },
  { label: "15m", interval: "15m", days: 14,   is5H: false },
  { label: "30m", interval: "30m", days: 20,   is5H: false },
  { label: "1H",  interval: "1h",  days: 30,   is5H: false },
  { label: "5H",  interval: "1h",  days: 30,   is5H: true  },
  { label: "1D",  interval: "1d",  days: 400,  is5H: false }, // 400 days for EMA200
  { label: "1W",  interval: "1wk", days: 730,  is5H: false },
  { label: "1M",  interval: "1mo", days: 1826, is5H: false },
];

// 5-minute in-memory cache
let cache: { rows: TechRow[]; at: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const DEFAULT_MA: MAResult = { components: {}, score: 0, signal: "Neutral" };

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json({ rows: cache.rows, fetchedAt: new Date(cache.at).toISOString(), cached: true });
  }

  const now = new Date();

  const signals: Record<string, Partial<Record<TfLabel, SignalLabel>>> = {};
  const maResults: Record<string, MAResult> = {};
  for (const chip of BLUE_CHIPS) {
    signals[chip.symbol] = {};
    maResults[chip.symbol] = DEFAULT_MA;
  }

  // Group timeframes by unique fetch key (1H and 5H share the same raw data)
  const groups = new Map<string, typeof TIMEFRAMES>();
  for (const tf of TIMEFRAMES) {
    const key = `${tf.interval}-${tf.days}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tf);
  }

  // All unique fetch groups in parallel; each group also fetches all 50 symbols in parallel
  await Promise.all(
    Array.from(groups.values()).map(async (tfs) => {
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
          const finalBars = tf.is5H ? aggregateBars(bars, 5 * 3600) : bars;
          signals[symbol][tf.label] = calcTechSignal(finalBars);
          if (tf.label === "1D") {
            maResults[symbol] = computeMASignals(bars);
          }
        }
      });
    })
  );

  const rows: TechRow[] = BLUE_CHIPS.map((chip) => ({
    symbol:  chip.symbol,
    name:    chip.name,
    sector:  chip.sector,
    signals: signals[chip.symbol] as Record<TfLabel, SignalLabel>,
    ma:      maResults[chip.symbol],
  }));

  cache = { rows, at: Date.now() };
  return NextResponse.json({ rows, fetchedAt: new Date(cache.at).toISOString(), cached: false });
}
