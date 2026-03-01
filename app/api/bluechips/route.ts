import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIPS } from "@/lib/bluechips";

const yahooFinance = new YahooFinance();

export async function GET() {
  try {
    const symbols = BLUE_CHIPS.map((c) => c.symbol);

    const results = await Promise.allSettled(
      symbols.map((symbol) =>
        yahooFinance.quote(symbol, {
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
        return {
          symbol: chip.symbol,
          name: chip.name,
          sector: chip.sector,
          price: 0,
          prevClose: 0,
          change: 0,
          changePct: 0,
          dayOpen: 0,
          dayHigh: 0,
          dayLow: 0,
          volume: 0,
        };
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

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
