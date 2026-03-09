import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverse } from "@/lib/universe";
import { prisma } from "@/lib/prisma";
import { isMarketOpen } from "@/lib/marketHours";

const yahooFinance = new YahooFinance();

async function fetchFromYahoo() {
  const universe = await getUniverse();
  const results = await Promise.allSettled(
    universe.map((chip) =>
      yahooFinance.quote(chip.symbol, {
        fields: ["symbol", "regularMarketPrice", "regularMarketPreviousClose",
          "regularMarketChange", "regularMarketChangePercent",
          "regularMarketOpen", "regularMarketDayHigh", "regularMarketDayLow",
          "regularMarketVolume"],
      })
    )
  );

  return universe.map((chip, i) => {
    const result = results[i];
    if (result.status === "rejected" || !result.value) {
      return { symbol: chip.symbol, name: chip.name, sector: chip.sector, price: 0, prevClose: 0, change: 0, changePct: 0, dayOpen: 0, dayHigh: 0, dayLow: 0, volume: 0 };
    }
    const q = result.value;
    return {
      symbol: chip.symbol, name: chip.name, sector: chip.sector,
      price: q.regularMarketPrice ?? 0,
      prevClose: q.regularMarketPreviousClose ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      dayOpen: q.regularMarketOpen ?? 0,
      dayHigh: q.regularMarketDayHigh ?? 0,
      dayLow: q.regularMarketDayLow ?? 0,
      volume: q.regularMarketVolume ?? 0,
    };
  });
}

// Cache is considered fresh if updated within the last 8 hours
function isCacheFresh(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() < 8 * 60 * 60 * 1000;
}

export async function GET() {
  const marketOpen = isMarketOpen();

  try {
    // Outside market hours — serve cached snapshots if recent enough
    if (!marketOpen) {
      const cached = await prisma.stockSnapshot.findMany();

      if (cached.length > 0 && cached[0]?.updatedAt && isCacheFresh(cached[0].updatedAt)) {
        const universe = await getUniverse();
        const bySymbol = Object.fromEntries(cached.map((s) => [s.symbol, s]));
        const stocks = universe.map((chip) => {
          const s = bySymbol[chip.symbol];
          return s
            ? { symbol: s.symbol, name: s.name, sector: s.sector, price: s.price, prevClose: s.prevClose, change: s.change, changePct: s.changePct, dayOpen: s.dayOpen, dayHigh: s.dayHigh, dayLow: s.dayLow, volume: s.volume }
            : { symbol: chip.symbol, name: chip.name, sector: chip.sector, price: 0, prevClose: 0, change: 0, changePct: 0, dayOpen: 0, dayHigh: 0, dayLow: 0, volume: 0 };
        });
        const updatedAt = cached[0].updatedAt.toISOString();
        return NextResponse.json({ stocks, updatedAt, marketOpen: false });
      }
      // Cache is stale or empty — fall through to fetch latest close from Yahoo
    }

    // Fetch from Yahoo Finance (live during market hours, or latest close when cache is stale)
    const stocks = await fetchFromYahoo();

    // Persist snapshots to DB
    await Promise.all(
      stocks.map((s) =>
        prisma.stockSnapshot.upsert({
          where: { symbol: s.symbol },
          create: s,
          update: s,
        })
      )
    );

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString(), marketOpen });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
