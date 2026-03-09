const KEY      = "trade-symbols";
const META_KEY = "trade-metadata";   // Record<symbol, string[]>  — screener names per symbol
const DATE_KEY = "trade-screener-date"; // "YYYY-MM-DD" in ET for dedup

// ── Symbol list ───────────────────────────────────────────────────────────────

export function getTradeSymbols(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function setTradeSymbols(symbols: string[]) {
  localStorage.setItem(KEY, JSON.stringify(symbols));
  window.dispatchEvent(new Event("trade-list-change"));
}

export function addToTrade(symbol: string) {
  const list = getTradeSymbols();
  if (!list.includes(symbol)) setTradeSymbols([...list, symbol]);
}

export function removeFromTrade(symbol: string) {
  setTradeSymbols(getTradeSymbols().filter((s) => s !== symbol));
}

// ── Per-symbol metadata (screener labels) ─────────────────────────────────────

export function getTradeMetadata(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? "{}"); } catch { return {}; }
}

export function setTradeMetadata(meta: Record<string, string[]>) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

// ── Screener run date (ET) ────────────────────────────────────────────────────

export function getScreenerRunDate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DATE_KEY);
}

export function setScreenerRunDate(date: string) {
  localStorage.setItem(DATE_KEY, date);
}

// ── Bulk operations ───────────────────────────────────────────────────────────

/** Wipe symbols + metadata and notify listeners. */
export function resetTradeList() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify([]));
  localStorage.setItem(META_KEY, JSON.stringify({}));
  window.dispatchEvent(new Event("trade-list-change"));
}
