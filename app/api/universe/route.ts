import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/prisma";
import { getUniverse, invalidateUniverseCache } from "@/lib/universe";

const yahooFinance = new YahooFinance();

// GET — list full universe
export async function GET() {
  try {
    const universe = await getUniverse();
    return NextResponse.json(universe);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — add a symbol { symbol, sector? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol = (body.symbol ?? "").toString().toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

    // Check not already active
    const existing = await prisma.universe.findUnique({ where: { symbol } });
    if (existing?.active) return NextResponse.json({ error: `${symbol} already in universe` }, { status: 409 });

    // Validate & fetch name from Yahoo
    let name = body.name ?? symbol;
    let sector = body.sector ?? "Other";
    try {
      const quote = await yahooFinance.quote(symbol);
      if (quote.longName || quote.shortName) name = quote.longName ?? quote.shortName ?? symbol;
      if ((quote as { sector?: string }).sector) sector = (quote as { sector?: string }).sector!;
    } catch {
      // Yahoo failed — allow with provided/default name
    }

    await prisma.universe.upsert({
      where: { symbol },
      create: { symbol, name, sector, active: true },
      update: { name, sector, active: true },
    });
    invalidateUniverseCache();
    return NextResponse.json({ symbol, name, sector });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a symbol ?symbol=AAPL
export async function DELETE(req: NextRequest) {
  try {
    const symbol = (new URL(req.url).searchParams.get("symbol") ?? "").toUpperCase();
    if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

    await prisma.universe.update({ where: { symbol }, data: { active: false } });
    invalidateUniverseCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
