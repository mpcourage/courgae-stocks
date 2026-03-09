import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getUniverseSymbols } from "@/lib/universe";

const yahooFinance = new YahooFinance();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();

  const universeSymbols = await getUniverseSymbols();
  if (!symbol || !universeSymbols.includes(symbol)) {
    return NextResponse.json({ error: "Valid blue chip symbol required" }, { status: 400 });
  }

  try {
    const [quote, summary] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, { modules: ["defaultKeyStatistics"] }).catch(() => null),
    ]);
    return NextResponse.json({
      symbol,
      marketState: quote.marketState,
      regularMarketPrice:         quote.regularMarketPrice,
      regularMarketChange:        quote.regularMarketChange,
      regularMarketChangePercent: quote.regularMarketChangePercent,
      regularMarketTime:          quote.regularMarketTime instanceof Date ? quote.regularMarketTime.getTime() : null,
      preMarketPrice:             quote.preMarketPrice,
      preMarketChange:            quote.preMarketChange,
      preMarketChangePercent:     quote.preMarketChangePercent,
      preMarketTime:              quote.preMarketTime instanceof Date ? quote.preMarketTime.getTime() : null,
      postMarketPrice:            quote.postMarketPrice,
      postMarketChange:           quote.postMarketChange,
      postMarketChangePercent:    quote.postMarketChangePercent,
      postMarketTime:             quote.postMarketTime instanceof Date ? quote.postMarketTime.getTime() : null,
      floatShares:                summary?.defaultKeyStatistics?.floatShares ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
