import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chartTheme";
import { formatDateShort, formatIndex } from "@/utils/format";
import { ChartTooltip } from "./ChartTooltip";

export function MiniAreaChart({
  data,
  xKey,
  yKey,
  height = 220,
  baseline,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  baseline?: number;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="miniFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.series[0]} stopOpacity={0.2} />
            <stop offset="100%" stopColor={theme.series[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey={xKey}
          tick={{ fill: theme.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          minTickGap={32}
          tickFormatter={formatDateShort}
        />
        <YAxis
          tick={{ fill: theme.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={["dataMin - 2", "dataMax + 2"]}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        {baseline != null && (
          <ReferenceLine y={baseline} stroke={theme.axis} strokeDasharray="4 4" strokeOpacity={0.5} />
        )}
        <Tooltip
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as Record<string, unknown> | undefined;
            return (
              <ChartTooltip
                active={active && !!row}
                title={String(row?.[xKey] ?? "")}
                rows={[
                  {
                    label: "Index",
                    value: formatIndex(Number(row?.[yKey])),
                    color: theme.series[0],
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={theme.series[0]}
          strokeWidth={2}
          fill="url(#miniFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
