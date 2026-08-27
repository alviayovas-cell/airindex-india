import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chartTheme";
import { formatCurrency } from "@/utils/format";
import { ChartTooltip } from "./ChartTooltip";
import type { LeadTimeWindow } from "@/types/models";

export function LeadTimeChart({
  windows,
  metric = "average_fare",
  height = 300,
}: {
  windows: LeadTimeWindow[];
  metric?: "average_fare" | "median_fare";
  height?: number;
}) {
  const theme = useChartTheme();
  const data = windows.map((w) => ({ ...w, value: w[metric] ?? 0 }));
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="window"
          tick={{ fill: theme.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
        />
        <YAxis
          tick={{ fill: theme.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          domain={[0, Math.ceil(max * 1.15)]}
        />
        <Tooltip
          cursor={{ fill: theme.grid, fillOpacity: 0.3 }}
          content={({ active, payload }) => {
            const w = payload?.[0]?.payload as (LeadTimeWindow & { value: number }) | undefined;
            return (
              <ChartTooltip
                active={active && !!w}
                title={`Booked ${w?.window} (${w?.advance_days} days ahead)`}
                rows={[
                  { label: "Average fare", value: formatCurrency(w?.average_fare) },
                  { label: "Median fare", value: formatCurrency(w?.median_fare) },
                  { label: "Observations", value: w?.observation_count ?? "—" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={64}>
          {data.map((_, i) => (
            <Cell key={i} fill={theme.series[0]} fillOpacity={0.55 + (i / data.length) * 0.45} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => formatCurrency(v)}
            style={{ fill: theme.axis, fontSize: 11, fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
