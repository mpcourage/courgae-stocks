import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIPS, BLUE_CHIP_SYMBOLS } from "@/lib/bluechips";

const yahooFinance = new YahooFinance();

const TIMEFRAME_MAP: Record<string, { interval: string; days: number }> = {
  "1m":  { interval: "1m",  days: 2    },
  "5m":  { interval: "5m",  days: 5    },
  "15m": { interval: "15m", days: 14   },
  "30m": { interval: "30m", days: 20   },
  "1h":  { interval: "1h",  days: 30   },
  "1d":  { interval: "1d",  days: 90   },
  "1wk": { interval: "1wk", days: 730  },
  "1mo": { interval: "1mo", days: 1826 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeframe = searchParams.get("timeframe") ?? "1d";
  const symbolsParam = searchParams.get("symbols");

  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter((s) => BLUE_CHIP_SYMBOLS.includes(s))
    : BLUE_CHIP_SYMBOLS;

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
  }

  const daysParam = searchParams.get("days");
  const { interval, days: defaultDays } = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP["1d"];
  const days = daysParam ? Math.max(1, Math.min(1826, parseInt(daysParam) || defaultDays)) : defaultDays;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  try {
    const settled = await Promise.allSettled(
      symbols.map((symbol) =>
        yahooFinance.chart(symbol, {
          period1: start,
          period2: end,
          interval: interval as never,
        })
      )
    );

    const data: Record<string, { bars: object[]; name: string; sector: string }> = {};

    settled.forEach((result, i) => {
      const symbol = symbols[i];
      const chip = BLUE_CHIPS.find((c) => c.symbol === symbol);
      if (result.status === "rejected" || !result.value) {
        data[symbol] = { bars: [], name: chip?.name ?? symbol, sector: chip?.sector ?? "" };
        return;
      }
      const bars = (result.value.quotes ?? [])
        .filter((q) => q.open != null && q.close != null)
        .map((q) => ({
          time: Math.floor((q.date instanceof Date ? q.date : new Date(q.date)).getTime() / 1000),
          open:   q.open!,
          high:   q.high!,
          low:    q.low!,
          close:  q.close!,
          volume: q.volume ?? 0,
        }));
      data[symbol] = { bars, name: chip?.name ?? symbol, sector: chip?.sector ?? "" };
    });

    return NextResponse.json({ data, timeframe, count: symbols.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
