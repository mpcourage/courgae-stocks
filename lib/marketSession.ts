export type MarketSession = "premarket" | "open" | "afterhours" | "closed";

/** Returns the current US equity market session based on ET clock. */
export function getMarketSession(): MarketSession {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0 || day === 6) return "closed";
  const m = et.getHours() * 60 + et.getMinutes();
  if (m >= 240 && m < 570)  return "premarket";   // 4:00–9:30 AM ET
  if (m >= 570 && m < 960)  return "open";         // 9:30 AM–4:00 PM ET
  if (m >= 960 && m < 1200) return "afterhours";   // 4:00–8:00 PM ET
  return "closed";
}
