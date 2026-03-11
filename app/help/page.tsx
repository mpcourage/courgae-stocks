import Link from "next/link";
import ChartTimeframeGuide from "@/components/ChartTimeframeGuide";

const PAGES = [
  {
    href: "/trade",
    icon: "⊡",
    label: "Trade",
    color: "sky",
    summary: "Position sizing and OCO trade planner.",
    description:
      "Plan limit-buy OCO trades with automatic position sizing. Entry auto-sets to S2 pivot, stop loss at −0.5%, and target at +1%. Qty is calculated as floor(daily limit ÷ entry), where daily limit is a % of your account cash. Cash, Risk, Gain and R:R appear on hover over the Qty field.",
    features: [
      "Classic and Fibonacci pivot levels (S3–R3)",
      "Qty = floor(account × daily limit% ÷ entry price)",
      "Cash used, max loss, max gain, R:R — visible on hover",
      "RVOL, Streak, RSI per symbol — sorted by momentum score",
      "Auto-populated at market close from saved screeners + Rising 90+",
      "⇅ Momentum button sorts by RVOL › Streak › RSI",
    ],
  },
  {
    href: "/bluechips",
    icon: "↗",
    label: "Watch List",
    color: "emerald",
    summary: "Live quotes and price history for 50 top US stocks.",
    description:
      "Browse the full universe of 50 stocks tracked by this app. Each row shows the latest price, day change, open/high/low, and volume. Click any row to open a detailed price history chart (area chart) with date range selection. Symbols are clickable links to the Equity page.",
    features: [
      "60-day sparkline per stock",
      "Sort by price, % change, or volume",
      "Detail panel with area chart and OHLCV history",
      "Sector grouping visible on hover",
    ],
  },
  {
    href: "/equity",
    icon: "▦",
    label: "Equity",
    color: "sky",
    summary: "Interactive candlestick chart with technical overlays.",
    description:
      "Deep-dive into any stock with a full candlestick chart. Switch timeframes from 1-minute to Monthly, adjust how many bars to show, and toggle SMA overlays on/off. Above the chart, three speedometer gauges instantly summarise sentiment across all signals.",
    features: [
      "9 timeframes: 1m · 3m · 5m · 15m · 30m · 1H · 1D · 1W · 1Mo",
      "SMA overlays: 22, 33, 44 by default; add any custom period",
      "Trend arrows (↑ ↓ →) per SMA based on recent slope",
      "Combined speedometer — blended MA + TF score",
      "MA speedometer — score across SMA20, SMA50, GX, EMA12, EMA26, EMA200",
      "TF speedometer — aggregated signal across all 9 timeframes",
      "Per-component and per-timeframe letter tiles (B / N / S)",
    ],
  },
  {
    href: "/screeners",
    icon: "⊞",
    label: "Screeners",
    color: "violet",
    summary: "Save and reuse custom multi-chart stock grids.",
    description:
      "Build named screeners that filter the 50 blue chips down to the stocks you care about. Each screener renders a compact chart grid so you can scan many tickers at once. Filters are stacked with AND logic — a stock must pass every rule to appear.",
    features: [
      "Trend filters: require SMA to slope Up / Sideways / Down over any period",
      "Signal Candidates: surface stocks whose price is within X% of one or more SMAs (AND across all selected SMAs)",
      "Signal candidates always appear first, bypassing trend filters",
      "Save, rename, update, and reorder screeners; delete with ✕",
      "Active screener highlighted; ↑ ↓ buttons to reorder the list",
    ],
  },
  {
    href: "/rising",
    icon: "↑",
    label: "Rising",
    color: "green",
    summary: "Momentum ranking across all 50 blue chips.",
    description:
      "Ranks every stock by a composite momentum score calculated from multiple factors. Use this page to quickly find stocks with strong recent price action, high relative volume, and healthy RSI — without having to open each chart individually.",
    features: [
      "Composite score: weighted blend of RSI, RVOL, streak, and returns",
      "Returns shown for 1-day, 5-day, and 20-day windows",
      "Consecutive up-day streak counter",
      "Above SMA5 / SMA20 indicators",
      "Relative Volume (RVOL): today's volume vs. recent average",
      "Sort by any column; symbols link to the Chart page",
    ],
  },
  {
    href: "/technicals",
    icon: "◈",
    label: "Technicals",
    color: "amber",
    summary: "Multi-timeframe signal table across every stock.",
    description:
      "The broadest technical view in the app. Every row is one stock; every column is a signal. Scan across all 50 stocks and 15+ indicators at a glance without opening a single chart. Hover a symbol to see the stock's full name and sector.",
    features: [
      "9 timeframe signals: 1m through Monthly",
      "6 MA component signals: SMA20, SMA50, GX (golden-cross), EMA12, EMA26, EMA200",
      "Letter indicators: B (Buy) · N (Neutral) · S (Sell) — color-coded by strength",
      "MA score bar showing net bullish/bearish MA count",
      "Overall score column for quick ranking",
      "Filter by signal strength; hover symbol for name + sector tooltip",
    ],
  },
  {
    href: "/strategies",
    icon: "⚡",
    label: "Strategies",
    color: "orange",
    summary: "Real-time strategy scanners for specific trading styles.",
    description:
      "Pre-built scanners tailored to different trading approaches. Currently the Scalping scanner is live; Swing Trading and Day Trading strategies are in development. Each scanner applies a specific combination of indicators to highlight the best setups right now.",
    features: [
      "Scalping: combines VWAP, RSI(14), EMA crossover, and RVOL",
      "Buy signals fire when RSI < 45, price near VWAP, EMA12 > EMA26, RVOL > 1",
      "Sell signals fire on the inverse conditions",
      "Swing Trading — coming soon",
      "Day Trading — coming soon",
    ],
  },
];

const COLOR_MAP: Record<string, { badge: string; ring: string; icon: string; dot: string }> = {
  sky:    { badge: "bg-sky-500/10 border-sky-500/20 text-sky-400",    ring: "hover:border-sky-500/30",    icon: "text-sky-400",    dot: "bg-sky-400"    },
  emerald:{ badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", ring: "hover:border-emerald-500/30", icon: "text-emerald-400", dot: "bg-emerald-400" },
  violet: { badge: "bg-violet-500/10 border-violet-500/20 text-violet-400",    ring: "hover:border-violet-500/30",  icon: "text-violet-400",  dot: "bg-violet-400"  },
  green:  { badge: "bg-green-500/10 border-green-500/20 text-green-400",       ring: "hover:border-green-500/30",   icon: "text-green-400",   dot: "bg-green-400"   },
  amber:  { badge: "bg-amber-500/10 border-amber-500/20 text-amber-400",       ring: "hover:border-amber-500/30",   icon: "text-amber-400",   dot: "bg-amber-400"   },
  orange: { badge: "bg-orange-500/10 border-orange-500/20 text-orange-400",    ring: "hover:border-orange-500/30",  icon: "text-orange-400",  dot: "bg-orange-400"  },
};

export default function HelpPage() {
  return (
    <div className="max-w-5xl mx-auto p-3 md:p-6 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold text-white">Help &amp; Reference</h1>
        <p className="text-sm text-slate-400">What each section does and how to use it.</p>
      </div>

      {/* Page cards */}
      <div className="space-y-3 md:space-y-4">
        {PAGES.map((page) => {
          const c = COLOR_MAP[page.color] ?? COLOR_MAP.sky;
          return (
            <div
              key={page.href}
              className={`rounded-xl bg-slate-900 border border-slate-800 p-4 md:p-6 transition-colors duration-200 ${c.ring}`}
            >
              <div className="flex items-start gap-3 md:gap-5">
                {/* Icon + label */}
                <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <span className={`text-lg leading-none ${c.icon}`}>{page.icon}</span>
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Title row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href={page.href}
                      className={`text-base font-semibold text-white hover:underline`}
                    >
                      {page.label}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.badge}`}>
                      {page.summary}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-400 leading-relaxed">{page.description}</p>

                  {/* Feature list */}
                  {page.features.length > 0 && (
                    <ul className="space-y-1.5">
                      {page.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-500">
                          <span className={`mt-0.5 w-1 h-1 rounded-full shrink-0 ${c.dot}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Open link */}
                <Link
                  href={page.href}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                >
                  Open →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Concepts & Calculations */}
      <div className="space-y-3 md:space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Concepts &amp; Calculations</h2>

        {/* Momentum indicators */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 md:p-6 space-y-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Momentum Indicators — importance order for day trading</h3>

          {/* RVOL */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">1 · RVOL</span>
              <span className="text-xs text-slate-400">Relative Volume — most important</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Today&apos;s volume divided by average volume over recent sessions. Volume is the fuel — without above-average volume, price moves are weak and easily reversed. A breakout on 2×+ RVOL has conviction; the same move on 0.5× is a trap.
            </p>
            <div className="flex gap-4 text-[11px] font-mono mt-1">
              <span className="text-emerald-400">≥ 2× — unusually high, strong conviction</span>
              <span className="text-sky-400">≥ 1× — normal</span>
              <span className="text-slate-500">&lt; 1× — weak participation</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Streak */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-green-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">2 · Streak</span>
              <span className="text-xs text-slate-400">Consecutive up/down days — second most important</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Number of consecutive green (positive) or red (negative) closing days. A +3d or longer streak shows sustained institutional buying, not just a single-day spike — buyers keep showing up, meaning there&apos;s a trend in motion to trade with.
            </p>
            <div className="flex gap-4 text-[11px] font-mono mt-1">
              <span className="text-green-400">+3d or more — strong sustained momentum</span>
              <span className="text-red-400">negative — selling pressure</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* ATR% */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">3 · ATR%</span>
              <span className="text-xs text-slate-400">Average True Range % — volatility opportunity</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              ATR(14) measures the average daily price range (high to low, accounting for gaps) over the last 14 days, expressed as a percentage of the current price. It tells you how much the stock <em>typically</em> moves each day — directly setting realistic stop and target distances. A stock with 0.5% ATR can&apos;t reliably hit a 2% target without an unusual catalyst.
            </p>
            <code className="block text-[11px] text-slate-400 bg-slate-800/60 rounded px-3 py-2 font-mono">
              True Range = max(High−Low, |High−Prev Close|, |Low−Prev Close|)<br />
              ATR = Wilder&apos;s smoothing of True Range over 14 days<br />
              ATR% = ATR ÷ price × 100
            </code>
            <div className="flex gap-3 text-[11px] font-mono mt-1 flex-wrap">
              <span className="text-emerald-400">2–5% — sweet spot for day trading</span>
              <span className="text-sky-400">1.5–2% — slow, tight stops needed</span>
              <span className="text-yellow-400">5–8% — volatile, size down</span>
              <span className="text-red-400">&gt; 8% — too wild for most setups</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* RSI */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-700/50 border border-slate-700">4 · RSI</span>
              <span className="text-xs text-slate-400">Relative Strength Index — momentum zone check</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Momentum oscillator (0–100) measuring the speed and magnitude of recent price changes. Computed using Wilder&apos;s smoothing over 14 periods. For day trading, a stock can stay overbought (RSI 80+) all session on strong momentum — fading it because &quot;RSI is high&quot; is a common mistake. Most useful as an exhaustion warning.
            </p>
            <code className="block text-[11px] text-slate-400 bg-slate-800/60 rounded px-3 py-2 font-mono">
              RS = avg gain (14 periods) / avg loss (14 periods)<br />
              RSI = 100 − (100 / (1 + RS))
            </code>
            <div className="flex gap-4 text-[11px] font-mono mt-1 flex-wrap">
              <span className="text-emerald-400">55–75 — ideal momentum zone</span>
              <span className="text-red-400">≥ 85 — exhaustion warning</span>
              <span className="text-sky-400">≤ 30 — oversold / potential bounce</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Float */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">5 · Float</span>
              <span className="text-xs text-slate-400">Shares available to trade — amplification factor</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Float is the number of shares available for public trading (total shares minus insider and restricted holdings). The same buying pressure on a low-float stock moves the price far more than on a high-float stock — think of it as the amplifier. A stock with 5M float can move 10–20% on a catalyst that would barely move a 500M float stock 1%.
            </p>
            <div className="flex gap-3 text-[11px] font-mono mt-1 flex-wrap">
              <span className="text-emerald-400">&lt; 5M — micro float, explosive moves</span>
              <span className="text-sky-400">5–20M — low float, strong amplification</span>
              <span className="text-yellow-400">20–100M — mid float, moderate</span>
              <span className="text-slate-500">&gt; 100M — large float, slower moves</span>
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Ideal candidate */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ideal day trade candidate</p>
            <code className="block text-xs text-emerald-300 bg-slate-800/60 rounded px-3 py-2 font-mono">
              RVOL ≥ 2×  +  Streak +3d or more  +  ATR% 2–5%  +  RSI 55–75  +  Float &lt; 20M
            </code>
            <p className="text-xs text-slate-500">
              RSI below 50 with high RVOL and a positive streak is also tradeable — it means the stock is recovering from a dip. ATR% sets the bar: a stock needs enough daily range to reach your target before your stop is hit. Float below 20M amplifies every catalyst.
            </p>
          </div>

          <div className="border-t border-slate-800" />

          {/* Momentum score weights */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Momentum Score — automatic row ordering</p>
            <p className="text-xs text-slate-500">Trade rows are always sorted by a weighted momentum score (0–100):</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono mt-1">
              <span className="text-emerald-400">RVOL · · · · · · 35%</span>
              <span className="text-slate-400">fuel / participation</span>
              <span className="text-green-400">Streak · · · · · 25%</span>
              <span className="text-slate-400">trend confirmation</span>
              <span className="text-yellow-400">ATR% · · · · · · 20%</span>
              <span className="text-slate-400">opportunity size (sweet spot 2–5%)</span>
              <span className="text-slate-300">RSI · · · · · · · 10%</span>
              <span className="text-slate-400">momentum zone check</span>
              <span className="text-purple-400">Float · · · · · · 10%</span>
              <span className="text-slate-400">amplification (&lt; 20M scores highest)</span>
            </div>
          </div>
        </div>

        {/* Chart Timeframe Guide */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 md:p-6 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chart Timeframes — When to Watch What</h3>
          <ChartTimeframeGuide />
        </div>

        {/* Trade calculations */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 md:p-6 space-y-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trade Page — Position Sizing</h3>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Quantity</p>
              <code className="block text-xs text-slate-300 bg-slate-800/60 rounded px-3 py-2 font-mono leading-relaxed">
                daily limit ($) = account cash × daily limit %<br />
                qty = floor(daily limit ÷ entry price)
              </code>
              <p className="text-xs text-slate-500 mt-1">How many shares can you buy if you spend your entire daily limit on this one trade. Default daily limit is 20% of account cash.</p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Cash Used</p>
              <code className="block text-xs text-slate-300 bg-slate-800/60 rounded px-3 py-2 font-mono">
                cash used = qty × entry price<br />
                cash % = cash used ÷ account cash × 100
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Max Loss / Max Gain</p>
              <code className="block text-xs text-slate-300 bg-slate-800/60 rounded px-3 py-2 font-mono">
                max loss = qty × (entry − stop)<br />
                max gain = qty × (target − entry)
              </code>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">R:R — Risk-to-Reward Ratio</p>
              <code className="block text-xs text-slate-300 bg-slate-800/60 rounded px-3 py-2 font-mono">
                R:R = (target − entry) / (entry − stop)
              </code>
              <p className="text-xs text-slate-500 mt-1">
                How much you stand to gain vs. lose. Most traders only take trades with R:R ≥ 2× — at a 40% win rate you&apos;re still profitable. Shown in green ≥ 2×, yellow 1–2×, red &lt; 1×.
              </p>
              <div className="flex gap-4 text-[11px] font-mono mt-1">
                <span className="text-emerald-400">≥ 2× — good trade</span>
                <span className="text-yellow-400">1–2× — acceptable</span>
                <span className="text-red-400">&lt; 1× — avoid</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal legend */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 md:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Signal Legend</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-2">
            <p className="text-slate-500 font-medium">Letter indicators</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><span className="font-bold text-green-700">B</span><span className="text-slate-400">Strong Buy</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold text-green-200">B</span><span className="text-slate-400">Buy</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-500">N</span><span className="text-slate-400">Neutral</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold text-orange-400">S</span><span className="text-slate-400">Sell</span></div>
              <div className="flex items-center gap-2"><span className="font-bold text-red-500">S</span><span className="text-slate-400">Strong Sell</span></div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 font-medium">Speedometer zones</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-sm bg-green-700 inline-block" /><span className="text-slate-400">Strong Buy</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-sm bg-green-300 inline-block" /><span className="text-slate-400">Buy</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-sm bg-slate-600 inline-block" /><span className="text-slate-400">Neutral</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-sm bg-orange-500 inline-block" /><span className="text-slate-400">Sell</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-sm bg-red-500 inline-block" /><span className="text-slate-400">Strong Sell</span></div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 font-medium">MA components</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><span className="text-slate-300 font-mono">20</span><span className="text-slate-400">SMA 20</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-300 font-mono">50</span><span className="text-slate-400">SMA 50</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-300 font-mono">GX</span><span className="text-slate-400">Golden / Death cross (SMA20 vs SMA50)</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-300 font-mono">E12</span><span className="text-slate-400">EMA 12</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-300 font-mono">E26</span><span className="text-slate-400">EMA 26</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-300 font-mono">E200</span><span className="text-slate-400">EMA 200</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
