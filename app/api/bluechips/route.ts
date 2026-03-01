import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIPS } from "@/lib/bluechips";
import { prisma } from "@/lib/prisma";
import { isMarketOpen } from "@/lib/marketHours";

const yahooFinance = new YahooFinance();

export async function GET() {
  const marketOpen = isMarketOpen();

  try {
  // Outside market hours — serve cached snapshots from DB
  if (!marketOpen) {
    const cached = await prisma.stockSnapshot.findMany();
    const bySymbol = Object.fromEntries(cached.map((s) => [s.symbol, s]));
    const stocks = BLUE_CHIPS.map((chip) => {
      const s = bySymbol[chip.symbol];
      return s
        ? { symbol: s.symbol, name: s.name, sector: s.sector, price: s.price, prevClose: s.prevClose, change: s.change, changePct: s.changePct, dayOpen: s.dayOpen, dayHigh: s.dayHigh, dayLow: s.dayLow, volume: s.volume }
        : { symbol: chip.symbol, name: chip.name, sector: chip.sector, price: 0, prevClose: 0, change: 0, changePct: 0, dayOpen: 0, dayHigh: 0, dayLow: 0, volume: 0 };
    });
    const updatedAt = cached[0]?.updatedAt?.toISOString() ?? null;
    return NextResponse.json({ stocks, updatedAt, marketOpen: false });
  }

  // Market is open — fetch live from Yahoo Finance
  {
    const results = await Promise.allSettled(
      BLUE_CHIPS.map((chip) =>
        yahooFinance.quote(chip.symbol, {
          fields: ["symbol", "regularMarketPrice", "regularMarketPreviousClose",
            "regularMarketChange", "regularMarketChangePercent",
            "regularMarketOpen", "regularMarketDayHigh", "regularMarketDayLow",
            "regularMarketVolume"],
        })
      )
    );

    const stocks = BLUE_CHIPS.map((chip, i) => {
      const result = results[i];
      if (result.status === "rejected" || !result.value) {
        return { symbol: chip.symbol, name: chip.name, sector: chip.sector, price: 0, prevClose: 0, change: 0, changePct: 0, dayOpen: 0, dayHigh: 0, dayLow: 0, volume: 0 };
      }
      const q = result.value;
      return {
        symbol: chip.symbol,
        name: chip.name,
        sector: chip.sector,
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

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString(), marketOpen: true });
  }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
