import Link from "next/link";

const features = [
  {
    icon: "⊡",
    title: "Trade",
    desc: "Position sizing calculator with pivot levels, OCO setup, entry/stop/target, and risk-to-reward",
    href: "/trade",
    tag: "Calculator",
  },
  {
    icon: "◈",
    title: "Watch List",
    desc: "Top US stocks with 60-day sparklines, live quotes, and detailed price history",
    href: "/bluechips",
    tag: "Watchlist",
  },
  {
    icon: "◎",
    title: "Equity",
    desc: "Candlestick charts with SMA overlays, price ranges, fair value, pivot points, and real-time quote tiles",
    href: "/equity",
    tag: "Charts",
  },
  {
    icon: "▦",
    title: "Screeners",
    desc: "Multi-chart screener across all stocks — filter by sector, SMA trend, and signal proximity",
    href: "/screeners",
    tag: "Screener",
  },
  {
    icon: "↑",
    title: "Rising Stocks",
    desc: "Momentum ranking scored by trend strength, RSI, win streak, and relative volume",
    href: "/rising",
    tag: "Momentum",
  },
  {
    icon: "⬡",
    title: "Technicals",
    desc: "Multi-timeframe signals and MA breakdown for every stock across 9 timeframes",
    href: "/technicals",
    tag: "Signals",
  },
  {
    icon: "⚡",
    title: "Strategies",
    desc: "Live 30-second signals using VWAP bias, RSI, EMA crossover, ATR, and relative volume",
    href: "/strategies",
    tag: "Live · 30s",
  },
];

const stats = [
  { label: "Stocks", value: "50+" },
  { label: "Timeframes", value: "9" },
  { label: "MA Signals", value: "6" },
  { label: "Refresh", value: "30s" },
];

export default function WelcomePage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* Hero */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-sky-400 text-sm font-medium tracking-wide uppercase mb-2">
            <span>&#9670;</span> Courgae Stocks
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-sky-400 bg-clip-text text-transparent bg-[length:200%_auto] hero-gradient">
            Smart Trading Intelligence
          </h1>
          <div className="w-16 h-0.5 bg-gradient-to-r from-sky-500 to-indigo-500 mx-auto rounded-full" />
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg mx-auto">
            AI-powered signals for the modern trader.
            <br />
            Real-time analysis across 50 blue chip stocks.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/trade"
            className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold rounded-lg text-sm hover:from-sky-400 hover:to-indigo-400 transition-all duration-200 shadow-lg shadow-sky-500/20"
          >
            Get Started
          </Link>
          <Link
            href="/equity"
            className="px-6 py-2.5 border border-slate-700 text-slate-300 font-medium rounded-lg text-sm hover:border-slate-500 hover:text-white transition-all duration-200"
          >
            View Charts
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-8">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800/60 p-5 text-left hover:border-sky-500/30 hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl text-sky-400">{f.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
                  {f.tag}
                </span>
              </div>
              <div className="font-semibold text-white text-sm mb-1.5">{f.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
              <div className="mt-4 text-xs font-medium text-sky-400 group-hover:text-sky-300 transition-colors">
                Open &rarr;
              </div>
            </Link>
          ))}
        </div>

        {/* Quick stats strip */}
        <div className="flex items-center justify-center gap-6 pt-4 flex-wrap">
          {stats.map((s, i) => (
            <span key={s.label} className="flex items-center gap-6 text-sm">
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-white font-bold text-lg leading-none">{s.value}</span>
                <span className="text-slate-500 text-xs">{s.label}</span>
              </span>
              {i < stats.length - 1 && <span className="text-slate-800 text-lg">&middot;</span>}
            </span>
          ))}
        </div>
      </div>

    </main>
  );
}
