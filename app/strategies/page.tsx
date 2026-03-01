"use client";

import { useState } from "react";
import ScalpingTab from "./ScalpingTab";

const TABS = [
  { id: "scalping", label: "Scalping" },
  { id: "swing", label: "Swing Trading", soon: true },
  { id: "daytrading", label: "Day Trading", soon: true },
];

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState("scalping");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Strategies</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Real-time strategy scanners across your blue chip universe
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            disabled={!!tab.soon}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px border-b-2 ${
              activeTab === tab.id
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed"
            }`}
          >
            {tab.label}
            {tab.soon && (
              <span className="ml-1.5 px-1 py-0.5 text-[10px] rounded bg-slate-800 text-slate-500">
                soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "scalping" && <ScalpingTab />}
    </div>
  );
}
