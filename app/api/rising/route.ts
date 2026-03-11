import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BLUE_CHIPS } from "@/lib/bluechips";
import { computeRSI, computeRVOL } from "@/lib/indicators";

function sma(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function risingScore(params: {
  ret1d: number;
  ret5d: number;
  ret20d: number;
  rsi: number;
  rvol: number;
  aboveSma5: boolean;
  aboveSma20: boolean;
}): number {
  const { ret1d, ret5d, ret20d, rsi, rvol, aboveSma5, aboveSma20 } = params;

  let score = 50;

  // 20-day momentum drives long-term trend (max ±25)
  score += Math.min(25, Math.max(-25, ret20d * 1.25));

  // 5-day momentum (max ±15)
  score += Math.min(15, Math.max(-15, ret5d * 3));

  // 1-day (max ±10)
  score += Math.min(10, Math.max(-10, ret1d * 5));

  // SMA position
  if (aboveSma20) score += 6;
  if (aboveSma5) score += 4;

  // RSI: 50–68 sweet spot for healthy uptrend
  if (rsi >= 50 && rsi <= 68) score += 6;
  else if (rsi > 68 && rsi <= 80) score += 2;
  else if (rsi < 40) score -= 8;
  else if (rsi < 50) score -= 4;

  // Relative volume (extra conviction)
  score += Math.min(4, Math.max(-4, (rvol - 1) * 2));

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── 60-second server-side cache ──────────────────────────────────────────────
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const rows = await prisma.historyBar.findMany({
      where: { date: { gte: cutoff } },
      select: { symbol: true, date: true, close: true, volume: true },
      orderBy: { date: "asc" },
    });

    // Group by symbol
    const bySymbol: Record<string, { close: number; volume: number }[]> = {};
    for (const r of rows) {
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
      bySymbol[r.symbol].push({ close: r.close, volume: r.volume });
    }

    const results = BLUE_CHIPS.flatMap((chip) => {
      const history = bySymbol[chip.symbol] ?? [];
      if (history.length < 6) return [];

      const closes = history.map((b) => b.close);
      const volumes = history.map((b) => b.volume);

      const price = closes[closes.length - 1];
      const prev1d = closes[closes.length - 2];
      const prev5d = closes[Math.max(0, closes.length - 6)];
      const prev20d = closes[Math.max(0, closes.length - 21)];

      const ret1d = ((price - prev1d) / prev1d) * 100;
      const ret5d = ((price - prev5d) / prev5d) * 100;
      const ret20d = ((price - prev20d) / prev20d) * 100;

      const sma5 = sma(closes, 5);
      const sma20 = sma(closes, 20);
      const aboveSma5 = price > sma5;
      const aboveSma20 = price > sma20;

      const rsi = computeRSI(closes, 14);
      // Use up to last 11 bars: 10-bar avg vs latest
      const rvol = computeRVOL(volumes.slice(-11));

      // Consecutive up days (close-to-close)
      let streak = 0;
      for (let i = closes.length - 1; i > 0; i--) {
        if (closes[i] > closes[i - 1]) streak++;
        else break;
      }

      const score = risingScore({ ret1d, ret5d, ret20d, rsi, rvol, aboveSma5, aboveSma20 });

      return [{
        symbol: chip.symbol,
        name: chip.name,
        sector: chip.sector,
        price: +price.toFixed(2),
        ret1d: +ret1d.toFixed(2),
        ret5d: +ret5d.toFixed(2),
        ret20d: +ret20d.toFixed(2),
        rsi: +rsi.toFixed(1),
        rvol: +rvol.toFixed(2),
        streak,
        aboveSma5,
        aboveSma20,
        sma5: +sma5.toFixed(2),
        sma20: +sma20.toFixed(2),
        score,
        bars: closes.length,
      }];
    });

    results.sort((a, b) => b.score - a.score);

    const rising = results.filter((r) => r.score >= 60).length;
    const aboveSma20Count = results.filter((r) => r.aboveSma20).length;

    const body = {
      stocks: results,
      summary: { total: results.length, rising, aboveSma20: aboveSma20Count },
      generatedAt: new Date().toISOString(),
    };
    cache = { data: body, ts: Date.now() };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
