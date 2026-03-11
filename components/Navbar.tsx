"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/trade",      label: "Trade" },
  { href: "/bluechips",  label: "Watch List" },
  { href: "/equity",     label: "Equity" },
  { href: "/screeners",  label: "Screeners" },
  { href: "/rising",     label: "Rising" },
  { href: "/technicals", label: "Technicals" },
  { href: "/strategies", label: "Strategies" },
  { href: "/help",       label: "Help" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeLabel = links.find(l => l.href === pathname)?.label ?? "Menu";

  return (
    <nav className="sticky top-0 z-50 px-4 pt-3 pb-0">
      <div className="max-w-7xl mx-auto bg-slate-900/70 backdrop-blur-xl border border-slate-800/50 rounded-xl">

        {/* ── Desktop nav ── */}
        <div className="hidden md:flex items-center gap-8 h-12 px-5">
          <Link href="/" className="font-bold text-white text-base tracking-tight shrink-0 flex items-center gap-2">
            <span className="text-sky-400">&#9670;</span>
            Courgae<span className="text-sky-400">Stocks</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Mobile nav ── */}
        <div className="md:hidden flex items-center justify-between h-12 px-4">
          <Link href="/" className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5" onClick={() => setOpen(false)}>
            <span className="text-sky-400">&#9670;</span>
            Courgae<span className="text-sky-400">Stocks</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Current page label */}
            <span className="text-sky-400 text-sm font-medium">{activeLabel}</span>

            {/* Burger button */}
            <button
              onClick={() => setOpen(o => !o)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              aria-label="Toggle menu"
            >
              {open ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 3L15 15M15 3L3 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 4.5H16M2 9H16M2 13.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown menu ── */}
        {open && (
          <div className="md:hidden border-t border-slate-800/60 px-3 pb-3 pt-2 flex flex-col gap-1">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </nav>
  );
}
