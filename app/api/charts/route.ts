import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIP_SYMBOLS } from "@/lib/bluechips";

const yahooFinance = new YahooFinance();

const PERIOD_MAP: Record<string, number> = {
  "1m":  30,
  "3m":  90,
  "6m":  180,
  "1y":  365,
  "2y":  730,
  "5y":  1826,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const period = searchParams.get("period") ?? "3m";

  if (!symbol || !BLUE_CHIP_SYMBOLS.includes(symbol)) {
    return NextResponse.json({ error: "Valid blue chip symbol required" }, { status: 400 });
  }

  const days = PERIOD_MAP[period] ?? 90;

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: "1d",
    });

    const bars = (result.quotes ?? [])
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        time: Math.floor((q.date instanceof Date ? q.date : new Date(q.date)).getTime() / 1000),
        open:   q.open!,
        high:   q.high!,
        low:    q.low!,
        close:  q.close!,
        volume: q.volume ?? 0,
      }));

    return NextResponse.json({ symbol, period, bars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
