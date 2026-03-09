"use client";

import { useEffect, useState } from "react";
import { addToTrade, getTradeSymbols } from "@/lib/tradeList";

// Bookmark icon — outline when not added, filled when added
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      {filled ? (
        <path d="M1 1.5C1 1.22386 1.22386 1 1.5 1H9.5C9.77614 1 10 1.22386 10 1.5V12L5.5 9L1 12V1.5Z"
          fill="currentColor" />
      ) : (
        <path d="M1 1.5C1 1.22386 1.22386 1 1.5 1H9.5C9.77614 1 10 1.22386 10 1.5V12L5.5 9L1 12V1.5Z"
          stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export default function AddToTradeButton({ symbol }: { symbol: string }) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(getTradeSymbols().includes(symbol));
    const handler = () => setInList(getTradeSymbols().includes(symbol));
    window.addEventListener("trade-list-change", handler);
    return () => window.removeEventListener("trade-list-change", handler);
  }, [symbol]);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    addToTrade(symbol);
  };

  if (inList) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 text-sky-400 select-none"
        title={`${symbol} is in Trade list`}
      >
        <BookmarkIcon filled />
      </span>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className="inline-flex items-center justify-center w-5 h-5 text-slate-600 hover:text-sky-400 transition-colors"
      title={`Add ${symbol} to Trade`}
    >
      <BookmarkIcon filled={false} />
    </button>
  );
}
