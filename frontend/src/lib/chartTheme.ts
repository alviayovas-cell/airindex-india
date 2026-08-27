import { useMemo } from "react";
import { useTheme } from "./theme";

/** Read a "R G B" CSS custom property and return a usable rgb() string. */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  return `rgb(${raw.replace(/\s+/g, " ")})`;
}

export interface ChartTheme {
  series: string[];
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  positive: string;
  negative: string;
  neutral: string;
}

export function useChartTheme(): ChartTheme {
  const { resolved } = useTheme();
  return useMemo<ChartTheme>(() => {
    // resolved is a dependency so colours re-read on theme switch.
    void resolved;
    return {
      series: [
        readVar("--chart-1", "rgb(79 70 229)"),
        readVar("--chart-2", "rgb(14 165 233)"),
        readVar("--chart-3", "rgb(22 163 74)"),
        readVar("--chart-4", "rgb(217 119 6)"),
        readVar("--chart-5", "rgb(219 39 119)"),
      ],
      grid: readVar("--chart-grid", "rgb(226 232 240)"),
      axis: readVar("--muted-foreground", "rgb(100 108 124)"),
      tooltipBg: readVar("--card", "rgb(255 255 255)"),
      tooltipBorder: readVar("--border", "rgb(229 232 238)"),
      positive: readVar("--success", "rgb(22 163 74)"),
      negative: readVar("--danger", "rgb(220 38 38)"),
      neutral: readVar("--muted-foreground", "rgb(100 108 124)"),
    };
  }, [resolved]);
}
