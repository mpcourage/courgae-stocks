import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverseSymbols } from "@/lib/universe";
import { prisma } from "@/lib/prisma";
const yahooFinance = new YahooFinance();

const DAYS = 60;

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const cutoff = cutoffDate();

    const cached = await prisma.historyBar.findMany({
      where: { date: { gte: cutoff } },
      select: { symbol: true, close: true },
      orderBy: { date: "asc" },
    });

    const dbBySymbol: Record<string, number[]> = {};
    for (const row of cached) {
      if (!dbBySymbol[row.symbol]) dbBySymbol[row.symbol] = [];
      dbBySymbol[row.symbol].push(row.close);
    }

    const universeSymbols = await getUniverseSymbols();
    const missing = universeSymbols.filter(
      (s) => !dbBySymbol[s] || dbBySymbol[s].length < 5
    );

    // Always fetch missing symbols — Yahoo returns data 24/7
    if (missing.length > 0) {
      const end = new Date();
      const results = await Promise.allSettled(
        missing.map((symbol) =>
          yahooFinance.chart(symbol, { period1: cutoff, period2: end, interval: "1d" })
        )
      );

      await Promise.all(
        results.map(async (result, i) => {
          if (result.status === "rejected" || !result.value) return;
          const symbol = missing[i];
          const quotes = result.value.quotes ?? [];
          const closes: number[] = [];

          await Promise.all(
            quotes.map((q) => {
              const date = q.date instanceof Date ? q.date : new Date(q.date);
              date.setHours(0, 0, 0, 0);
              closes.push(q.close ?? 0);
              return prisma.historyBar.upsert({
                where: { symbol_date: { symbol, date } },
                create: { symbol, date, open: q.open ?? 0, high: q.high ?? 0, low: q.low ?? 0, close: q.close ?? 0, volume: q.volume ?? 0 },
                update: { open: q.open ?? 0, high: q.high ?? 0, low: q.low ?? 0, close: q.close ?? 0, volume: q.volume ?? 0 },
              });
            })
          );

          dbBySymbol[symbol] = closes;
        })
      );
    }

    return NextResponse.json(dbBySymbol);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
