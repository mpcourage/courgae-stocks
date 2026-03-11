import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverseSymbols } from "@/lib/universe";
import { TIMEFRAME_MAP } from "@/lib/timeframes";
import { aggregateBars, toBars } from "@/lib/barAggregation";

const yahooFinance = new YahooFinance();

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

    let bars = toBars(result.quotes ?? []);

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
