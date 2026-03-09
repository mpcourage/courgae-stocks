import { prisma } from "@/lib/prisma";
import { BLUE_CHIPS, type BlueChip } from "@/lib/bluechips";

// In-process cache: valid for 60 seconds to avoid repeated DB hits per request burst
let _cache: BlueChip[] | null = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000;

export function invalidateUniverseCache() {
  _cache = null;
  _cacheAt = 0;
}

// Returns the active universe from DB, seeding from static list on first run.
export async function getUniverse(): Promise<BlueChip[]> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  const rows = await prisma.universe.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });

  if (rows.length === 0) {
    // First run — seed with static list
    await Promise.all(
      BLUE_CHIPS.map((c) =>
        prisma.universe.upsert({
          where: { symbol: c.symbol },
          create: { symbol: c.symbol, name: c.name, sector: c.sector },
          update: {},
        })
      )
    );
    _cache = BLUE_CHIPS;
    _cacheAt = Date.now();
    return BLUE_CHIPS;
  }

  _cache = rows.map((r) => ({ symbol: r.symbol, name: r.name, sector: r.sector }));
  _cacheAt = Date.now();
  return _cache;
}

export async function getUniverseSymbols(): Promise<string[]> {
  const universe = await getUniverse();
  return universe.map((c) => c.symbol);
}
