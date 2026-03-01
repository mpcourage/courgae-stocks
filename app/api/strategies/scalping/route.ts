import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { BLUE_CHIPS } from "@/lib/bluechips";
import { isMarketOpen } from "@/lib/marketHours";
import { computeEMA, computeRSI, computeVWAP, computeATRPct, computeRVOL } from "@/lib/indicators";

const yahooFinance = new YahooFinance();

export interface ScalpingCandidate {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  vwap: number;
  vwapDevPct: number;   // % deviation of price from VWAP
  rsi: number;
  rvol: number;
  atrPct: number;       // ATR as % of price (volatility measure)
  ema9: number;
  ema20: number;
  emaCross: "bullish" | "bearish" | "neutral";
  signal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  score: number;        // 0–100
  bars: number;         // how many 5-min bars fetched
}

function scoreSignal(c: Omit<ScalpingCandidate, "signal" | "score">): { signal: ScalpingCandidate["signal"]; score: number } {
  let score = 50;

  // VWAP bias (+/- 20 pts)
  if (c.vwapDevPct > 0) score += Math.min(c.vwapDevPct * 4, 20);
  else score += Math.max(c.vwapDevPct * 4, -20);

  // RSI (neutral zone 40–60 for scalping; penalise extremes)
  if (c.rsi > 70) score -= 15;
  else if (c.rsi > 60) score -= 5;
  else if (c.rsi < 30) score += 15;
  else if (c.rsi < 40) score += 5;

  // EMA cross
  if (c.emaCross === "bullish") score += 10;
  else if (c.emaCross === "bearish") score -= 10;

  // RVOL bonus (liquidity for scalping)
  if (c.rvol >= 2) score += 10;
  else if (c.rvol >= 1.5) score += 5;
  else if (c.rvol < 0.7) score -= 10;

  // ATR (volatility needed for scalping)
  if (c.atrPct >= 0.5) score += 5;
  else if (c.atrPct < 0.2) score -= 5;

  score = Math.max(0, Math.min(100, score));

  let signal: ScalpingCandidate["signal"];
  if (score >= 75) signal = "strong_buy";
  else if (score >= 60) signal = "buy";
  else if (score <= 25) signal = "strong_sell";
  else if (score <= 40) signal = "sell";
  else signal = "neutral";

  return { signal, score };
}

export async function GET() {
  const marketOpen = isMarketOpen();

  if (!marketOpen) {
    return NextResponse.json({
      marketOpen: false,
      candidates: [],
      fetchedAt: new Date().toISOString(),
    });
  }

  const now = new Date();
  // Fetch last 1 day of 5-min bars
  const start = new Date(now);
  start.setHours(start.getHours() - 8); // cover pre-market + full session

  const results = await Promise.allSettled(
    BLUE_CHIPS.map((chip) =>
      yahooFinance.chart(chip.symbol, {
        period1: start,
        period2: now,
        interval: "5m",
      })
    )
  );

  const candidates: ScalpingCandidate[] = [];

  for (let i = 0; i < BLUE_CHIPS.length; i++) {
    const chip = BLUE_CHIPS[i];
    const result = results[i];
    if (result.status === "rejected" || !result.value) continue;

    const quotes = (result.value.quotes ?? []).filter(
      (q) => q.close != null && q.volume != null && q.volume > 0
    );
    if (quotes.length < 5) continue;

    const closes = quotes.map((q) => q.close!);
    const volumes = quotes.map((q) => q.volume!);
    const price = closes[closes.length - 1];
    const prevClose = closes[0];

    const vwap = computeVWAP(quotes.map((q) => ({
      high: q.high ?? price,
      low: q.low ?? price,
      close: q.close ?? price,
      volume: q.volume ?? 0,
    })));

    const rsi = computeRSI(closes, 14);
    const rvol = computeRVOL(volumes);
    const atrPct = computeATRPct(quotes.map((q) => ({
      high: q.high ?? price,
      low: q.low ?? price,
      close: q.close ?? price,
    })), 14);

    const ema9Arr = computeEMA(closes, 9);
    const ema20Arr = computeEMA(closes, 20);
    const ema9 = ema9Arr[ema9Arr.length - 1];
    const ema20 = ema20Arr[ema20Arr.length - 1];

    const emaCross =
      ema9 > ema20 * 1.001 ? "bullish" :
      ema9 < ema20 * 0.999 ? "bearish" : "neutral";

    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const vwapDevPct = vwap > 0 ? ((price - vwap) / vwap) * 100 : 0;

    const base = { symbol: chip.symbol, name: chip.name, sector: chip.sector, price, change, changePct, vwap, vwapDevPct, rsi, rvol, atrPct, ema9, ema20, emaCross, bars: quotes.length };
    const { signal, score } = scoreSignal(base);

    candidates.push({ ...base, signal, score });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    marketOpen: true,
    candidates,
    fetchedAt: new Date().toISOString(),
  });
}
