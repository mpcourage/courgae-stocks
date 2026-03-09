import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverseSymbols } from "@/lib/universe";
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();

  const universeSymbols = await getUniverseSymbols();
  if (!symbol || !universeSymbols.includes(symbol)) {
    return NextResponse.json(
      { error: "Valid blue chip symbol required" },
      { status: 400 }
    );
  }

  try {
    // Outside market hours — serve directly from DB, skip Yahoo fetch
    if (!isMarketOpen()) {
      const bars = await prisma.historyBar.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
      });
      return NextResponse.json({
        symbol,
        marketOpen: false,
        bars: bars.map((b) => ({
          date: b.date.toISOString(),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
        })),
      });
    }

    // 1. Fetch fresh bars from Yahoo Finance
    const end = new Date();
    const start = cutoffDate();

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: "1d",
    });

    // 2. Upsert bars into DB
    const upserts = (result.quotes ?? []).map((q) => {
      const date = q.date instanceof Date ? q.date : new Date(q.date);
      date.setHours(0, 0, 0, 0);
      return prisma.historyBar.upsert({
        where: { symbol_date: { symbol, date } },
        create: {
          symbol,
          date,
          open: q.open ?? 0,
          high: q.high ?? 0,
          low: q.low ?? 0,
          close: q.close ?? 0,
          volume: q.volume ?? 0,
        },
        update: {
          open: q.open ?? 0,
          high: q.high ?? 0,
          low: q.low ?? 0,
          close: q.close ?? 0,
          volume: q.volume ?? 0,
        },
      });
    });
    await Promise.all(upserts);

    // 3. Prune records older than 60 days
    await prisma.historyBar.deleteMany({
      where: { symbol, date: { lt: cutoffDate() } },
    });

    // 4. Return all stored bars for this symbol
    const bars = await prisma.historyBar.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      symbol,
      marketOpen: true,
      bars: bars.map((b) => ({
        date: b.date.toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
