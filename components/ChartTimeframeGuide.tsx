"use client";

import { useState } from "react";

type Phase = "aftermarket" | "open" | "midday" | "powerhour";

const PHASES: { id: Phase; label: string; time: string; color: string; bg: string; border: string }[] = [
  { id: "aftermarket", label: "After Market", time: "4 PM – 9:30 AM", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
  { id: "open",        label: "Market Open",  time: "9:30 – 11 AM",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  { id: "midday",      label: "Mid-Day",       time: "11 AM – 2 PM",   color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30"  },
  { id: "powerhour",   label: "Power Hour",    time: "2 PM – 4 PM",    color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30"    },
];

type ChartEntry = { tf: string; purpose: string; role: "primary" | "context" | "prep" | "avoid" };

const PHASE_CHARTS: Record<Phase, { summary: string; charts: ChartEntry[] }> = {
  aftermarket: {
    summary: "Preparation time — use higher timeframes to map the landscape before the bell.",
    charts: [
      { tf: "1D",  purpose: "Overall trend direction — is the stock in an uptrend, downtrend, or consolidating? Check key S/R levels and where price closed relative to the 20/50 SMA.", role: "prep" },
      { tf: "1W",  purpose: "Bigger picture context — weekly trend, major structure, and where this stock sits in a multi-week cycle. Prevents trading against a long-term wall.", role: "prep" },
      { tf: "1H",  purpose: "Pre-market range and overnight gaps — identify the high and low from the previous session's extended hours to know your intraday levels before the open.", role: "prep" },
    ],
  },
  open: {
    summary: "Highest-volume, highest-volatility window — best entries happen here with the right setup.",
    charts: [
      { tf: "1m",  purpose: "Entry timing — watch the first 1-2 candles for direction bias. Use only for fine-tuning the exact entry tick once a setup is confirmed on higher TFs.", role: "context" },
      { tf: "5m",  purpose: "PRIMARY chart for the open. Structure is clearest here — breakout candles, VWAP relationship, support tests. If you only watch one chart, this is it.", role: "primary" },
      { tf: "15m", purpose: "Session context — confirms the 5m move is aligned with the broader trend. If 15m and 5m both agree, the trade has extra conviction.", role: "context" },
    ],
  },
  midday: {
    summary: "Low-conviction window — volume thins, spreads widen, and reversals are common. Most experienced traders avoid new entries here.",
    charts: [
      { tf: "15m", purpose: "If you must trade mid-day, 15m only. Shorter timeframes generate too many false signals when volume is thin. Better use this time to review morning trades and plan Power Hour.", role: "avoid" },
    ],
  },
  powerhour: {
    summary: "Second-highest volume window — institutional rebalancing and momentum continuation plays emerge.",
    charts: [
      { tf: "5m",  purpose: "PRIMARY chart for Power Hour. Same structure as the open but with afternoon volume patterns. Breakouts from afternoon consolidations with RVOL confirmation.", role: "primary" },
      { tf: "15m", purpose: "Direction for the hour — if the 15m trend is up and 5m gives an entry signal, that's a high-probability setup. Also shows any lingering morning trend resumption.", role: "context" },
    ],
  },
};

const ROLE_STYLE: Record<ChartEntry["role"], string> = {
  primary:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  context:  "text-sky-400    bg-sky-500/10     border-sky-500/30",
  prep:     "text-violet-400 bg-violet-500/10  border-violet-500/30",
  avoid:    "text-amber-400  bg-amber-500/10   border-amber-500/30",
};

const ROLE_LABEL: Record<ChartEntry["role"], string> = {
  primary: "Primary",
  context: "Context",
  prep:    "Prep",
  avoid:   "Caution",
};

export default function ChartTimeframeGuide() {
  const [active, setActive] = useState<Phase>("open");
  const [hoveredTf, setHoveredTf] = useState<string | null>(null);

  const phase = PHASES.find((p) => p.id === active)!;
  const { summary, charts } = PHASE_CHARTS[active];

  return (
    <div className="space-y-4">
      {/* Phase selector */}
      <div className="flex flex-wrap gap-2">
        {PHASES.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActive(p.id); setHoveredTf(null); }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              active === p.id
                ? `${p.color} ${p.bg} ${p.border}`
                : "text-slate-500 bg-transparent border-slate-800 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            <span>{p.label}</span>
            <span className={`ml-1.5 text-[10px] ${active === p.id ? "opacity-70" : "opacity-40"}`}>{p.time}</span>
          </button>
        ))}
      </div>

      {/* Active phase content */}
      <div className={`rounded-lg border p-4 space-y-3 ${phase.bg} ${phase.border}`}>
        <p className={`text-xs leading-relaxed ${phase.color}`}>{summary}</p>

        {/* Chart buttons with hover tooltip */}
        <div className="flex flex-wrap gap-2">
          {charts.map((c) => (
            <div key={c.tf} className="relative">
              <button
                onMouseEnter={() => setHoveredTf(c.tf)}
                onMouseLeave={() => setHoveredTf(null)}
                className={`px-3 py-1 rounded border text-[11px] font-mono font-semibold transition-all ${ROLE_STYLE[c.role]}`}
              >
                {c.tf}
                <span className="ml-1.5 text-[9px] font-sans opacity-70 uppercase tracking-wide">{ROLE_LABEL[c.role]}</span>
              </button>

              {/* Tooltip */}
              {hoveredTf === c.tf && (
                <div className="absolute bottom-full left-0 mb-2 z-10 w-72 rounded-lg bg-slate-800 border border-slate-700 p-3 shadow-xl">
                  <p className="text-[11px] font-mono font-semibold text-white mb-1">{c.tf} — {ROLE_LABEL[c.role]}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{c.purpose}</p>
                  <div className="absolute bottom-[-5px] left-4 w-2 h-2 bg-slate-800 border-r border-b border-slate-700 rotate-45" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rule of thumb */}
      <div className="rounded-lg bg-slate-800/40 border border-slate-800 px-4 py-3 space-y-2">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rule of thumb</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Higher timeframe sets the <span className="text-white">direction</span>. Lower timeframe sets the <span className="text-white">entry timing</span>. Never take a 1m entry without the 5m agreeing, and never take a 5m entry without the 15m agreeing.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">
          On the Trade page, the chart shows <span className="text-sky-400">5m (8h lookback)</span> and the equity page covers <span className="text-sky-400">1h (1W lookback)</span> — use both together for any open setup.
        </p>
      </div>
    </div>
  );
}
