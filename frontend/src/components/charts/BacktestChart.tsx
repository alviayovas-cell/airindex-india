import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chartTheme";
import { formatDateShort, formatIndex, formatPercent } from "@/utils/format";
import { ChartTooltip } from "./ChartTooltip";
import type { BacktestPoint } from "@/types/models";

export function BacktestChart({
  series,
  height = 320,
}: {
  series: BacktestPoint[];
  height?: number;
}) {
  const theme = useChartTheme();
  const vals = series.flatMap((p) => [p.our_index, p.reference_index]);
  const lo = Math.floor(Math.min(...vals, 100) - 1);
  const hi = Math.ceil(Math.max(...vals, 100) + 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: theme.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          minTickGap={28}
          tickFormatter={formatDateShort}
        />
        <YAxis
          domain={[lo, hi]}
          tick={{ fill: theme.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={38}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <ReferenceLine y={100} stroke={theme.axis} strokeDasharray="4 4" strokeOpacity={0.5} />
        <Tooltip
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as BacktestPoint | undefined;
            return (
              <ChartTooltip
                active={active && !!p}
                title={p?.date ?? ""}
                rows={[
                  { label: "AIRINDEX", value: formatIndex(p?.our_index), color: theme.series[0] },
                  { label: "Reference", value: formatIndex(p?.reference_index), color: theme.series[3] },
                  {
                    label: "Deviation",
                    value: p?.pct_deviation != null ? formatPercent(p.pct_deviation) : "—",
                  },
                ]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="reference_index"
          name="Reference"
          stroke={theme.series[3]}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="our_index"
          name="AIRINDEX"
          stroke={theme.series[0]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
