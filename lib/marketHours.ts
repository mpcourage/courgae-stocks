// US market window in Eastern Time:
//   Pre-market open : 4:00 AM ET
//   After-hours close: 8:00 PM ET
//   Trading days    : Monday – Friday

const ET_OFFSET_STANDARD = -5; // UTC-5 (EST)
const ET_OFFSET_DAYLIGHT = -4; // UTC-4 (EDT)

function isDST(date: Date): boolean {
  // DST in the US: second Sunday in March → first Sunday in November
  const year = date.getUTCFullYear();

  const dstStart = nthSundayOfMonth(year, 2, 2); // March (month 2), 2nd Sunday, 2 AM
  const dstEnd = nthSundayOfMonth(year, 10, 1);  // November (month 10), 1st Sunday, 2 AM

  return date >= dstStart && date < dstEnd;
}

function nthSundayOfMonth(year: number, month: number, n: number): Date {
  // Find the nth Sunday of `month` (0-indexed) at 7 AM UTC (2 AM ET)
  const first = new Date(Date.UTC(year, month, 1));
  const day = first.getUTCDay(); // 0 = Sunday
  const firstSunday = day === 0 ? 1 : 8 - day;
  const date = new Date(Date.UTC(year, month, firstSunday + (n - 1) * 7, 7, 0, 0));
  return date;
}

export function isMarketOpen(now = new Date()): boolean {
  const offset = isDST(now) ? ET_OFFSET_DAYLIGHT : ET_OFFSET_STANDARD;
  const etMs = now.getTime() + offset * 60 * 60 * 1000;
  const et = new Date(etMs);

  const dayOfWeek = et.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const hour = et.getUTCHours();
  const minute = et.getUTCMinutes();
  const minutesFromMidnight = hour * 60 + minute;

  const open = 4 * 60;   // 4:00 AM ET
  const close = 20 * 60; // 8:00 PM ET

  return minutesFromMidnight >= open && minutesFromMidnight < close;
}

export function marketStatus(now = new Date()): string {
  if (isMarketOpen(now)) return "open";
  return "closed";
}
