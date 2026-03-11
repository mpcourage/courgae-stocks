export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Group bars into time-bucketed OHLCV bars.
 * Used for synthetic timeframes (e.g. 1m → 3m, 1h → 5h).
 */
export function aggregateBars(bars: Bar[], bucketSeconds: number): Bar[] {
  const buckets = new Map<number, Bar[]>();
  for (const bar of bars) {
    const key = Math.floor(bar.time / bucketSeconds) * bucketSeconds;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(bar);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, chunk]) => ({
      time:   key,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map((b) => b.high)),
      low:    Math.min(...chunk.map((b) => b.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + b.volume, 0),
    }));
}

/** Convert Yahoo Finance quote objects to our Bar format. */
export function toBars(
  quotes: { date: Date | string; open?: number | null; high?: number | null; low?: number | null; close?: number | null; volume?: number | null }[]
): Bar[] {
  return quotes
    .filter((q) => q.open != null && q.close != null)
    .map((q) => ({
      time:   Math.floor((q.date instanceof Date ? q.date : new Date(q.date)).getTime() / 1000),
      open:   q.open!,
      high:   q.high ?? q.open!,
      low:    q.low  ?? q.open!,
      close:  q.close!,
      volume: q.volume ?? 0,
    }));
}
