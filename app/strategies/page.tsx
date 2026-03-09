"use client";

import { useState } from "react";
import ScalpingTab from "./ScalpingTab";

const TABS = [
  { id: "scalping", label: "Scalping", active: true },
  { id: "swing", label: "Swing Trading", soon: true },
  { id: "daytrading", label: "Day Trading", soon: true },
];

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState("scalping");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Strategies</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time strategy scanners across your blue chip universe
          </p>
        </div>
      </div>

      {/* Card-style tab bar */}
      <div className="flex gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            disabled={!!tab.soon}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
              activeTab === tab.id
                ? "bg-sky-500/10 border-sky-500/30 text-sky-400 ring-1 ring-sky-500/20"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:text-slate-600 disabled:cursor-not-allowed disabled:hover:border-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {tab.label}
              {tab.active && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              )}
              {tab.soon && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-500">
                  soon
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "scalping" && <ScalpingTab />}
    </div>
  );
}
