import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIP_SYMBOLS } from "@/lib/bluechips";

const yahooFinance = new YahooFinance();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();

  if (!symbol || !BLUE_CHIP_SYMBOLS.includes(symbol)) {
    return NextResponse.json(
      { error: "Valid blue chip symbol required" },
      { status: 400 }
    );
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 60);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: "1d",
    });

    const bars = (result.quotes ?? []).map((q) => ({
      date: q.date instanceof Date ? q.date.toISOString() : String(q.date),
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close ?? 0,
      volume: q.volume ?? 0,
    }));

    return NextResponse.json({ symbol, bars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
