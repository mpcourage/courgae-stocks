import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIP_SYMBOLS } from "@/lib/bluechips";

const yahooFinance = new YahooFinance();

// Maps UI timeframe value → Yahoo Finance interval + lookback days
const TIMEFRAME_MAP: Record<string, { interval: string; days: number }> = {
  "1m":  { interval: "1m",  days: 2   },
  "5m":  { interval: "5m",  days: 5   },
  "15m": { interval: "15m", days: 14  },
  "30m": { interval: "30m", days: 20  },
  "1h":  { interval: "1h",  days: 30  },
  "1d":  { interval: "1d",  days: 90  },
  "1wk": { interval: "1wk", days: 730 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const timeframe = searchParams.get("timeframe") ?? "1d";

  if (!symbol || !BLUE_CHIP_SYMBOLS.includes(symbol)) {
    return NextResponse.json({ error: "Valid blue chip symbol required" }, { status: 400 });
  }

  const { interval, days } = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP["1d"];

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: interval as never,
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

    return NextResponse.json({ symbol, timeframe, bars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
