interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export default function Sparkline({ data, width = 120, height = 36, positive }: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const isUp = positive ?? data[data.length - 1] >= data[0];
  const color = isUp ? "#4ade80" : "#f87171";
  const fillColor = isUp ? "#4ade8020" : "#f8717120";

  // Build SVG area path (close under the line)
  const first = points[0].split(",");
  const last = points[points.length - 1].split(",");
  const areaPath = `M${first[0]},${height} L${points.join(" L")} L${last[0]},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={areaPath} fill={fillColor} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
