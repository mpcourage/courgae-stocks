"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SMAConfig {
  period: number | "close";
  color: string;
  visible: boolean;
}

interface Props {
  bars: OHLCBar[];
  smas: SMAConfig[];
}

function computeSMA(bars: OHLCBar[], period: number) {
  return bars.map((bar, i) => {
    if (i < period - 1) return null;
    const slice = bars.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, b) => s + b.close, 0) / period;
    return { time: bar.time, value: avg };
  }).filter(Boolean) as { time: number; value: number }[];
}

function computeCloseLine(bars: OHLCBar[]) {
  return bars.map((b) => ({ time: b.time, value: b.close }));
}

export default function CandlestickChart({ bars, smas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#64748b",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    });
    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         "#4ade80",
      downColor:       "#f87171",
      borderUpColor:   "#4ade80",
      borderDownColor: "#f87171",
      wickUpColor:     "#4ade80",
      wickDownColor:   "#f87171",
    });
    candleSeries.setData(bars as never);

    // Volume histogram
    const volSeries = chart.addSeries(HistogramSeries, {
      color: "#334155",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volSeries.setData(
      bars.map((b) => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? "#4ade8030" : "#f8717130",
      })) as never
    );

    // MA / Close lines
    for (const sma of smas) {
      if (!sma.visible) continue;

      if (sma.period === "close") {
        const line = chart.addSeries(LineSeries, {
          color: sma.color,
          lineWidth: 1,
          lineStyle: 1, // dashed
          priceLineVisible: false,
          lastValueVisible: true,
          title: "Close",
        });
        line.setData(computeCloseLine(bars) as never);
      } else {
        const line = chart.addSeries(LineSeries, {
          color: sma.color,
          lineWidth: 1.5,
          priceLineVisible: false,
          lastValueVisible: true,
          title: `SMA${sma.period}`,
        });
        line.setData(computeSMA(bars, sma.period) as never);
      }
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, smas]);

  return <div ref={containerRef} className="w-full h-full" />;
}
