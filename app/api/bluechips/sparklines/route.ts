import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIP_SYMBOLS } from "@/lib/bluechips";
import { prisma } from "@/lib/prisma";
import { isMarketOpen } from "@/lib/marketHours";

const yahooFinance = new YahooFinance();

const DAYS = 60;

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const cutoff = cutoffDate();

  // Check which symbols already have bars cached in DB
  const cached = await prisma.historyBar.findMany({
    where: { date: { gte: cutoff } },
    select: { symbol: true, date: true, close: true },
    orderBy: { date: "asc" },
  });

  const dbBySymbol: Record<string, number[]> = {};
  for (const row of cached) {
    if (!dbBySymbol[row.symbol]) dbBySymbol[row.symbol] = [];
    dbBySymbol[row.symbol].push(row.close);
  }

  // Symbols missing from DB need to be fetched from Yahoo
  const missing = BLUE_CHIP_SYMBOLS.filter(
    (s) => !dbBySymbol[s] || dbBySymbol[s].length < 5
  );

  if (missing.length > 0 && isMarketOpen()) {
    const end = new Date();
    const results = await Promise.allSettled(
      missing.map((symbol) =>
        yahooFinance.chart(symbol, { period1: cutoff, period2: end, interval: "1d" })
      )
    );

    // Upsert fetched bars into DB and collect close prices
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
  } else if (missing.length > 0) {
    // Market closed and no DB data — fill with empty
    for (const s of missing) dbBySymbol[s] = [];
  }

  return NextResponse.json(dbBySymbol);
}
