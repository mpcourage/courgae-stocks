export function computeEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values (matches TradingView / investing.com)
  const seed = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const ema: number[] = new Array(period - 1).fill(null);
  ema.push(seed);
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

export function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  // Seed: simple average of gains/losses over first `period` changes
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for all subsequent bars
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeVWAP(
  bars: { high: number; low: number; close: number; volume: number }[]
): number {
  let cumPV = 0, cumV = 0;
  for (const b of bars) {
    const typical = (b.high + b.low + b.close) / 3;
    cumPV += typical * b.volume;
    cumV += b.volume;
  }
  return cumV > 0 ? cumPV / cumV : 0;
}

export function computeATRPct(
  bars: { high: number; low: number; close: number }[],
  period = 14
): number {
  if (bars.length < period + 1) return 0;

  // Seed: simple average of first `period` true ranges (Wilder's method)
  let atr = 0;
  for (let i = 1; i <= period; i++) {
    atr += Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
  }
  atr /= period;

  // Wilder's smoothing for all subsequent bars
  for (let i = period + 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    atr = (atr * (period - 1) + tr) / period;
  }

  const price = bars[bars.length - 1].close;
  return price > 0 ? (atr / price) * 100 : 0;
}

export function computeRVOL(volumes: number[]): number {
  if (volumes.length < 2) return 1;
  const avg = volumes.slice(0, -1).reduce((s, v) => s + v, 0) / (volumes.length - 1);
  return avg > 0 ? volumes[volumes.length - 1] / avg : 1;
}

export type SignalLabel = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";

export function calcTechSignal(
  bars: { open: number; high: number; low: number; close: number; volume: number }[]
): SignalLabel {
  if (bars.length < 15) return "Neutral";
  const closes = bars.map(b => b.close);
  const last = closes[closes.length - 1];
  let score = 0, maxScore = 0;

  // RSI(14) — weight 2
  const rsiVal = computeRSI(closes, 14);
  maxScore += 2;
  if (rsiVal < 30) score += 2;
  else if (rsiVal < 45) score += 1;
  else if (rsiVal > 70) score -= 2;
  else if (rsiVal > 55) score -= 1;

  // Price vs SMA20 — weight 1
  if (closes.length >= 20) {
    const sma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    maxScore += 1;
    score += last > sma20 ? 1 : -1;

    if (closes.length >= 50) {
      const sma50 = closes.slice(-50).reduce((s, v) => s + v, 0) / 50;
      // Price vs SMA50 — weight 1
      maxScore += 1;
      score += last > sma50 ? 1 : -1;
      // SMA20 vs SMA50 (golden/death cross) — weight 1
      maxScore += 1;
      score += sma20 > sma50 ? 1 : -1;
    }
  }

  // EMA12 vs EMA26 (MACD direction) — weight 1
  const emas12 = computeEMA(closes, 12).filter((v) => v !== null) as number[];
  const emas26 = computeEMA(closes, 26).filter((v) => v !== null) as number[];
  if (emas12.length > 0 && emas26.length > 0) {
    maxScore += 1;
    score += emas12[emas12.length - 1] > emas26[emas26.length - 1] ? 1 : -1;
  }

  if (maxScore === 0) return "Neutral";
  const ratio = score / maxScore;
  if (ratio >= 0.65) return "Strong Buy";
  if (ratio >= 0.25) return "Buy";
  if (ratio <= -0.65) return "Strong Sell";
  if (ratio <= -0.25) return "Sell";
  return "Neutral";
}
