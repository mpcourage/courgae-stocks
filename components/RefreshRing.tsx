"use client";

import { useEffect, useState } from "react";
import { getMarketSession, type MarketSession } from "@/lib/marketSession";

const SESSION_COLOR: Record<MarketSession, string> = {
  premarket:  "#f59e0b", // amber
  open:       "#4ade80", // green
  afterhours: "#818cf8", // indigo
  closed:     "#475569", // slate
};

const SESSION_LABEL: Record<MarketSession, string> = {
  premarket:  "Pre-market",
  open:       "Market open",
  afterhours: "After-hours",
  closed:     "Market closed",
};

interface RefreshRingProps {
  countdown: number;
  total: number;
  loading: boolean;
  onClick: () => void;
}

export default function RefreshRing({ countdown, total, loading, onClick }: RefreshRingProps) {
  const [session, setSession] = useState<MarketSession>(getMarketSession);

  useEffect(() => {
    const t = setInterval(() => setSession(getMarketSession()), 30_000);
    return () => clearInterval(t);
  }, []);

  const size = 44;
  const r = 17;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = countdown / total;
  const offset = circumference * (1 - progress);
  const isClosed = session === "closed";
  const arcColor = loading ? "#38bdf8" : SESSION_COLOR[session];

  return (
    <button
      onClick={() => { if (!isClosed) onClick(); }}
      disabled={loading || isClosed}
      title={`${SESSION_LABEL[session]}${isClosed ? "" : ` · Refresh in ${countdown}s`}`}
      className="relative flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={3} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isClosed ? circumference : offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <span
        className="relative z-10 text-[11px] font-mono font-semibold select-none"
        style={{ color: loading ? "#38bdf8" : arcColor, transition: "color 0.5s" }}
      >
        {loading ? "↻" : isClosed ? "—" : countdown}
      </span>
    </button>
  );
}
