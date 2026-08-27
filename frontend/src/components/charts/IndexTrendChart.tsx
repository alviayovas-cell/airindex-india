import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chartTheme";
import { formatDateShort, formatIndex, formatPercent } from "@/utils/format";
import { ChartTooltip } from "./ChartTooltip";
import type { IndexHistoryPoint } from "@/types/models";

export function IndexTrendChart({
  points,
  height = 300,
  showBaseline = true,
}: {
  points: IndexHistoryPoint[];
  height?: number;
  showBaseline?: boolean;
}) {
  const theme = useChartTheme();
  const data = useMemo(
    () => points.map((p) => ({ ...p, label: p.date })),
    [points],
  );
  const domain = useMemo(() => {
    if (!points.length) return [90, 110] as [number, number];
    const vals = points.map((p) => p.index_value);
    const lo = Math.min(...vals, showBaseline ? 100 : Infinity);
    const hi = Math.max(...vals, showBaseline ? 100 : -Infinity);
    const pad = Math.max((hi - lo) * 0.15, 1);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)] as [number, number];
  }, [points, showBaseline]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.series[0]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={theme.series[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: theme.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          minTickGap={28}
          tickFormatter={formatDateShort}
        />
        <YAxis
          domain={domain}
          tick={{ fill: theme.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={38}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        {showBaseline && (
          <ReferenceLine
            y={100}
            stroke={theme.axis}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
        )}
        <Tooltip
          cursor={{ stroke: theme.grid }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as IndexHistoryPoint | undefined;
            return (
              <ChartTooltip
                active={active && !!p}
                title={p?.date ?? ""}
                rows={[
                  { label: "Index", value: formatIndex(p?.index_value), color: theme.series[0] },
                  {
                    label: "Change",
                    value: p?.change_pct != null ? formatPercent(p.change_pct) : "—",
                  },
                  { label: "Observations", value: p?.observation_count ?? "—" },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="index_value"
          stroke={theme.series[0]}
          strokeWidth={2}
          fill="url(#indexFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
