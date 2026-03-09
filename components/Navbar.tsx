"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/trade", label: "Trade" },
  { href: "/bluechips", label: "Watch List" },
  { href: "/equity", label: "Equity" },
  { href: "/screeners", label: "Screeners" },
  { href: "/rising", label: "Rising" },
  { href: "/technicals", label: "Technicals" },
  { href: "/strategies", label: "Strategies" },
  { href: "/help", label: "Help" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 px-4 pt-3 pb-0">
      <div className="max-w-7xl mx-auto bg-slate-900/70 backdrop-blur-xl border border-slate-800/50 rounded-xl">
        <div className="flex items-center gap-8 h-12 px-5">
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
      </div>
    </nav>
  );
}
