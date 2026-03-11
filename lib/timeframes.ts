import { BLUE_CHIPS } from "@/lib/bluechips";

/** UI timeframe config used by page-level selectors. */
export interface TimeframeOption {
  label: string;
  value: string;
  defaultDays: number;
  maxDays: number;
}

export const TIMEFRAMES: TimeframeOption[] = [
  { label: "1m",  value: "1m",  defaultDays: 2,    maxDays: 7    },
  { label: "3m",  value: "3m",  defaultDays: 3,    maxDays: 7    },
  { label: "5m",  value: "5m",  defaultDays: 5,    maxDays: 60   },
  { label: "15m", value: "15m", defaultDays: 14,   maxDays: 60   },
  { label: "30m", value: "30m", defaultDays: 20,   maxDays: 60   },
  { label: "1H",  value: "1h",  defaultDays: 30,   maxDays: 730  },
  { label: "1D",  value: "1d",  defaultDays: 90,   maxDays: 1826 },
  { label: "1W",  value: "1wk", defaultDays: 730,  maxDays: 1826 },
  { label: "1Mo", value: "1mo", defaultDays: 1826, maxDays: 1826 },
];

export const LOOKBACKS = [
  { label: "1D",  days: 1    },
  { label: "2D",  days: 2    },
  { label: "5D",  days: 5    },
  { label: "2W",  days: 14   },
  { label: "1M",  days: 30   },
  { label: "3M",  days: 90   },
  { label: "6M",  days: 180  },
  { label: "1Y",  days: 365  },
  { label: "2Y",  days: 730  },
  { label: "5Y",  days: 1826 },
];

/** Yahoo Finance interval mapping used by API routes. */
export const TIMEFRAME_MAP: Record<string, { interval: string; days: number; synthetic?: true }> = {
  "1m":  { interval: "1m",  days: 2    },
  "3m":  { interval: "1m",  days: 3,   synthetic: true },
  "5m":  { interval: "5m",  days: 5    },
  "15m": { interval: "15m", days: 14   },
  "30m": { interval: "30m", days: 20   },
  "1h":  { interval: "1h",  days: 30   },
  "1d":  { interval: "1d",  days: 90   },
  "1wk": { interval: "1wk", days: 730  },
  "1mo": { interval: "1mo", days: 1826 },
};

export const SECTORS = ["All", ...Array.from(new Set(BLUE_CHIPS.map((c) => c.sector)))];
