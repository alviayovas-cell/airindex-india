import { useId, useMemo } from "react";
import { cn } from "@/lib/cn";

/** Dependency-free inline sparkline (SVG path). */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  tone = "auto",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "auto" | "up" | "down" | "flat";
}) {
  const gid = `spark${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { path, area, resolvedTone } = useMemo(() => {
    if (data.length < 2) {
      return { path: "", area: "", resolvedTone: "flat" as const };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const stepX = width / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return [x, y] as const;
    });
    const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const a = `${d} L${width},${height} L0,${height} Z`;
    const delta = data[data.length - 1] - data[0];
    const rt =
      tone !== "auto"
        ? tone
        : Math.abs(delta) < 0.01
          ? "flat"
          : delta > 0
            ? "up"
            : "down";
    return { path: d, area: a, resolvedTone: rt };
  }, [data, width, height, tone]);

  const color =
    resolvedTone === "up"
      ? "rgb(var(--danger))" // rising airfare = red
      : resolvedTone === "down"
        ? "rgb(var(--success))"
        : "rgb(var(--muted-foreground))";

  if (!path) return <div style={{ width, height }} className={className} />;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
