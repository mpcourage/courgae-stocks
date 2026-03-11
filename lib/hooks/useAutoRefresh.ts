"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMarketSession } from "@/lib/marketSession";

/**
 * Auto-refresh hook used across pages.
 * - Calls `fetchFn` on mount.
 * - Counts down every second; when it hits 0, calls `fetchFn` again and resets.
 * - Pauses the countdown when the market session is "closed".
 *
 * Returns `{ countdown, refresh }` so the page can display a RefreshRing
 * and allow manual refreshes.
 */
export function useAutoRefresh(
  fetchFn: () => void | Promise<void>,
  intervalSeconds = 60
) {
  const [countdown, setCountdown] = useState(intervalSeconds);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  // Initial fetch
  useEffect(() => {
    fetchRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer
  useEffect(() => {
    setCountdown(intervalSeconds);
    const t = setInterval(() => {
      if (getMarketSession() === "closed") return;
      setCountdown((c) => {
        if (c <= 1) {
          fetchRef.current();
          return intervalSeconds;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [intervalSeconds]);

  const refresh = useCallback(() => {
    fetchRef.current();
    setCountdown(intervalSeconds);
  }, [intervalSeconds]);

  return { countdown, refresh };
}
