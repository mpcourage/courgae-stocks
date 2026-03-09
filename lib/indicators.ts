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

// ── RSI series (incremental Wilder's smoothing) ────────────────────────────
function computeRSISeries(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const series: (number | null)[] = new Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  series.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    series.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return series.filter((v): v is number => v !== null);
}

// ── Raw ATR (Wilder's) ──────────────────────────────────────────────────────
function computeRawATR(
  bars: { high: number; low: number; close: number }[],
  period = 14
): number {
  if (bars.length < period + 1) return 0;
  let atr = 0;
  for (let i = 1; i <= period; i++) {
    atr += Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i-1].close), Math.abs(bars[i].low - bars[i-1].close));
  }
  atr /= period;
  for (let i = period + 1; i < bars.length; i++) {
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i-1].close), Math.abs(bars[i].low - bars[i-1].close));
    atr = (atr * (period - 1) + tr) / period;
  }
  return atr;
}

// ── ADX (Wilder's) ─────────────────────────────────────────────────────────
function computeADX(
  bars: { high: number; low: number; close: number }[],
  period = 14
): { adx: number; pdi: number; mdi: number } {
  if (bars.length < period * 2 + 1) return { adx: 0, pdi: 0, mdi: 0 };
  let plusDM = 0, minusDM = 0, tr = 0;
  for (let i = 1; i <= period; i++) {
    const up = bars[i].high - bars[i-1].high;
    const dn = bars[i-1].low - bars[i].low;
    plusDM  += (up > dn && up > 0) ? up : 0;
    minusDM += (dn > up && dn > 0) ? dn : 0;
    tr += Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i-1].close), Math.abs(bars[i].low - bars[i-1].close));
  }
  let pdi = tr > 0 ? 100 * plusDM / tr : 0;
  let mdi = tr > 0 ? 100 * minusDM / tr : 0;
  let dx  = (pdi + mdi > 0) ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
  let adx = 0, adxSeed = dx, adxCount = 1;
  for (let i = period + 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i-1].high;
    const dn = bars[i-1].low - bars[i].low;
    const pdm = (up > dn && up > 0) ? up : 0;
    const mdm = (dn > up && dn > 0) ? dn : 0;
    const ctr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i-1].close), Math.abs(bars[i].low - bars[i-1].close));
    plusDM  = plusDM  - plusDM  / period + pdm;
    minusDM = minusDM - minusDM / period + mdm;
    tr      = tr      - tr      / period + ctr;
    pdi = tr > 0 ? 100 * plusDM  / tr : 0;
    mdi = tr > 0 ? 100 * minusDM / tr : 0;
    dx  = (pdi + mdi > 0) ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
    if (adxCount < period) { adxSeed += dx; adxCount++; if (adxCount === period) adx = adxSeed / period; }
    else adx = (adx * (period - 1) + dx) / period;
  }
  return { adx, pdi, mdi };
}

// ── Public: compute all 12 oscillator indicators ───────────────────────────
export type TechIndicator = {
  name: string;
  value: number;
  signal: "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell" | "Less Volatility" | "High Volatility";
};

export function computeTechIndicators(
  bars: { open: number; high: number; low: number; close: number; volume: number }[]
): TechIndicator[] {
  if (bars.length < 30) return [];
  const closes = bars.map(b => b.close);
  const highs  = bars.map(b => b.high);
  const lows   = bars.map(b => b.low);
  const n = bars.length;
  const results: TechIndicator[] = [];

  // RSI(14)
  const rsi = computeRSI(closes, 14);
  results.push({ name: "RSI(14)", value: rsi,
    signal: rsi < 30 ? "Strong Buy" : rsi < 45 ? "Buy" : rsi > 70 ? "Strong Sell" : rsi > 55 ? "Sell" : "Neutral" });

  // STOCH(9,6) — %K raw, %D = SMA6 of %K
  const stochK: number[] = [];
  for (let i = 8; i < n; i++) {
    const ll = Math.min(...lows.slice(i - 8, i + 1));
    const hh = Math.max(...highs.slice(i - 8, i + 1));
    stochK.push(hh > ll ? (closes[i] - ll) / (hh - ll) * 100 : 50);
  }
  const stochD = stochK.length >= 6 ? stochK.slice(-6).reduce((s, v) => s + v, 0) / 6 : (stochK[stochK.length - 1] ?? 50);
  results.push({ name: "STOCH(9,6)", value: stochD,
    signal: stochD < 20 ? "Strong Buy" : stochD < 40 ? "Buy" : stochD > 80 ? "Strong Sell" : stochD > 60 ? "Sell" : "Neutral" });

  // STOCHRSI(14) — Stochastic of RSI series, then SMA3
  const rsiSeries = computeRSISeries(closes, 14);
  let stochRsiK = 50;
  if (rsiSeries.length >= 14) {
    const slice = rsiSeries.slice(-14);
    const minR = Math.min(...slice), maxR = Math.max(...slice);
    const rawK: number[] = [];
    for (let i = rsiSeries.length - 14; i < rsiSeries.length; i++) {
      const s = rsiSeries.slice(Math.max(0, i - 13), i + 1);
      const mn = Math.min(...s), mx = Math.max(...s);
      rawK.push(mx > mn ? (rsiSeries[i] - mn) / (mx - mn) * 100 : 50);
    }
    stochRsiK = rawK.length >= 3 ? rawK.slice(-3).reduce((s, v) => s + v, 0) / 3 : (rawK[rawK.length-1] ?? 50);
    void minR; void maxR;
  }
  results.push({ name: "STOCHRSI(14)", value: stochRsiK,
    signal: stochRsiK < 20 ? "Strong Buy" : stochRsiK < 40 ? "Buy" : stochRsiK > 80 ? "Strong Sell" : stochRsiK > 60 ? "Sell" : "Neutral" });

  // MACD(12,26) — MACD line vs signal line (EMA9)
  const ema12arr = computeEMA(closes, 12).filter((v): v is number => v !== null);
  const ema26arr = computeEMA(closes, 26).filter((v): v is number => v !== null);
  const macdLen  = Math.min(ema12arr.length, ema26arr.length);
  const macdLine = Array.from({ length: macdLen }, (_, i) =>
    ema12arr[ema12arr.length - macdLen + i] - ema26arr[ema26arr.length - macdLen + i]);
  const macdVal  = macdLine[macdLine.length - 1] ?? 0;
  const macdSig  = computeEMA(macdLine, 9).filter((v): v is number => v !== null);
  const macdSigV = macdSig[macdSig.length - 1] ?? 0;
  results.push({ name: "MACD(12,26)", value: macdVal,
    signal: macdVal > macdSigV ? "Buy" : macdVal < macdSigV ? "Sell" : "Neutral" });

  // ADX(14)
  const { adx, pdi, mdi } = computeADX(bars, 14);
  results.push({ name: "ADX(14)", value: adx,
    signal: adx < 20 ? "Neutral" : pdi > mdi ? "Buy" : "Sell" });

  // Williams %R(14)
  const wHH = Math.max(...highs.slice(-14));
  const wLL  = Math.min(...lows.slice(-14));
  const wR   = wHH > wLL ? (wHH - closes[n - 1]) / (wHH - wLL) * -100 : -50;
  results.push({ name: "Williams %R", value: wR,
    signal: wR < -80 ? "Strong Buy" : wR < -60 ? "Buy" : wR > -20 ? "Strong Sell" : wR > -40 ? "Sell" : "Neutral" });

  // CCI(14)
  const typicals = bars.map(b => (b.high + b.low + b.close) / 3);
  const cciSlice = typicals.slice(-14);
  const cciSMA   = cciSlice.reduce((s, v) => s + v, 0) / 14;
  const meanDev  = cciSlice.reduce((s, v) => s + Math.abs(v - cciSMA), 0) / 14;
  const cci      = meanDev > 0 ? (typicals[n - 1] - cciSMA) / (0.015 * meanDev) : 0;
  results.push({ name: "CCI(14)", value: cci,
    signal: cci > 100 ? "Buy" : cci < -100 ? "Sell" : "Neutral" });

  // ATR(14) — raw value, signal = volatility level
  const atr14 = computeRawATR(bars, 14);
  const atrPct = closes[n - 1] > 0 ? atr14 / closes[n - 1] * 100 : 0;
  results.push({ name: "ATR(14)", value: atr14,
    signal: atrPct > 3 ? "High Volatility" : "Less Volatility" });

  // Highs/Lows(14) — close at 14-period high/low
  const hhL = Math.max(...highs.slice(-14));
  const llL  = Math.min(...lows.slice(-14));
  const hlV  = closes[n - 1] >= hhL ? 1 : closes[n - 1] <= llL ? -1 : 0;
  results.push({ name: "Highs/Lows(14)", value: hlV,
    signal: hlV > 0 ? "Buy" : hlV < 0 ? "Sell" : "Neutral" });

  // Ultimate Oscillator (7,14,28)
  if (n >= 29) {
    const bps: number[] = [], trs: number[] = [];
    for (let i = 1; i < n; i++) {
      const pc = closes[i - 1];
      bps.push(closes[i] - Math.min(lows[i], pc));
      trs.push(Math.max(highs[i], pc) - Math.min(lows[i], pc));
    }
    const s = (arr: number[], cnt: number) => arr.slice(-cnt).reduce((a, v) => a + v, 0);
    const avg7  = s(trs, 7)  > 0 ? s(bps, 7)  / s(trs, 7)  : 0;
    const avg14 = s(trs, 14) > 0 ? s(bps, 14) / s(trs, 14) : 0;
    const avg28 = s(trs, 28) > 0 ? s(bps, 28) / s(trs, 28) : 0;
    const uo = 100 * (4 * avg7 + 2 * avg14 + avg28) / 7;
    results.push({ name: "Ultimate Oscillator", value: uo,
      signal: uo > 70 ? "Strong Buy" : uo > 60 ? "Buy" : uo < 30 ? "Strong Sell" : uo < 40 ? "Sell" : "Neutral" });
  }

  // ROC(12)
  if (n > 12) {
    const roc = closes[n - 13] > 0 ? (closes[n - 1] - closes[n - 13]) / closes[n - 13] * 100 : 0;
    results.push({ name: "ROC", value: roc,
      signal: roc > 0 ? "Buy" : roc < 0 ? "Sell" : "Neutral" });
  }

  // Bull/Bear Power(13) — Elder Ray, show Bull Power = High - EMA13
  const ema13arr = computeEMA(closes, 13).filter((v): v is number => v !== null);
  if (ema13arr.length > 0) {
    const ema13V = ema13arr[ema13arr.length - 1];
    const bullPower = highs[n - 1] - ema13V;
    results.push({ name: "Bull/Bear Power(13)", value: bullPower,
      signal: bullPower > 0 ? "Buy" : "Sell" });
  }

  return results;
}

export type SignalLabel = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";

export type MAComponent = "SMA20" | "SMA50" | "GX" | "EMA12" | "EMA26" | "EMA200";

export type MAResult = {
  components: Partial<Record<MAComponent, "Buy" | "Sell">>;
  score: number;
  signal: SignalLabel;
};

export function computeMASignals(bars: { close: number }[]): MAResult {
  const closes = bars.map(b => b.close);
  const last = closes[closes.length - 1];
  const components: Partial<Record<MAComponent, "Buy" | "Sell">> = {};

  if (closes.length >= 20) {
    const sma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    components.SMA20 = last > sma20 ? "Buy" : "Sell";

    if (closes.length >= 50) {
      const sma50 = closes.slice(-50).reduce((s, v) => s + v, 0) / 50;
      components.SMA50 = last > sma50 ? "Buy" : "Sell";
      components.GX    = sma20 > sma50 ? "Buy" : "Sell";
    }
  }

  const ema12arr = computeEMA(closes, 12).filter((v): v is number => v !== null);
  if (ema12arr.length >= 1) {
    components.EMA12 = last > ema12arr[ema12arr.length - 1] ? "Buy" : "Sell";

    const ema26arr = computeEMA(closes, 26).filter((v): v is number => v !== null);
    if (ema26arr.length >= 1) {
      components.EMA26 = ema12arr[ema12arr.length - 1] > ema26arr[ema26arr.length - 1] ? "Buy" : "Sell";
    }
  }

  const ema200arr = computeEMA(closes, 200).filter((v): v is number => v !== null);
  if (ema200arr.length >= 1) {
    components.EMA200 = last > ema200arr[ema200arr.length - 1] ? "Buy" : "Sell";
  }

  const vals = Object.values(components);
  const score = vals.reduce((s, v) => s + (v === "Buy" ? 1 : -1), 0);
  const ratio = vals.length > 0 ? score / vals.length : 0;

  let signal: SignalLabel;
  if (ratio >= 0.66)       signal = "Strong Buy";
  else if (ratio >= 0.33)  signal = "Buy";
  else if (ratio <= -0.66) signal = "Strong Sell";
  else if (ratio <= -0.33) signal = "Sell";
  else                     signal = "Neutral";

  return { components, score, signal };
}

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
