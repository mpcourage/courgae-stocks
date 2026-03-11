import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverse, getUniverseSymbols } from "@/lib/universe";
import { TIMEFRAME_MAP } from "@/lib/timeframes";
import { aggregateBars, toBars, type Bar } from "@/lib/barAggregation";

const yahooFinance = new YahooFinance();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeframe = searchParams.get("timeframe") ?? "1d";
  const symbolsParam = searchParams.get("symbols");

  const universeSymbols = await getUniverseSymbols();
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter((s) => universeSymbols.includes(s))
    : universeSymbols;

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

    const data: Record<string, { bars: Bar[]; name: string; sector: string }> = {};
    const universe = await getUniverse();
    const chipMap = Object.fromEntries(universe.map((c) => [c.symbol, c]));

    settled.forEach((result, i) => {
      const symbol = symbols[i];
      const chip = chipMap[symbol];
      if (result.status === "rejected" || !result.value) {
        data[symbol] = { bars: [], name: chip?.name ?? symbol, sector: chip?.sector ?? "" };
        return;
      }
      let bars = toBars(result.value.quotes ?? []);

      if (timeframe === "3m") {
        bars = aggregateBars(bars, 180);
      }

      data[symbol] = { bars, name: chip?.name ?? symbol, sector: chip?.sector ?? "" };
    });

    return NextResponse.json({ data, timeframe, count: symbols.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
