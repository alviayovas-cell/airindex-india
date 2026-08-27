import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/lib/chartTheme";
import { formatCurrency } from "@/utils/format";
import { ChartTooltip } from "./ChartTooltip";

interface Row {
  name: string;
  average_fare: number;
  observation_count: number;
}

export function AirlineBarChart({ data, height = 260 }: { data: Row[]; height?: number }) {
  const theme = useChartTheme();
  const sorted = [...data].sort((a, b) => a.average_fare - b.average_fare);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: theme.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: theme.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          width={84}
        />
        <Tooltip
          cursor={{ fill: theme.grid, fillOpacity: 0.3 }}
          content={({ active, payload }) => {
            const r = payload?.[0]?.payload as Row | undefined;
            return (
              <ChartTooltip
                active={active && !!r}
                title={r?.name ?? ""}
                rows={[
                  { label: "Average fare", value: formatCurrency(r?.average_fare) },
                  { label: "Observations", value: r?.observation_count ?? "—" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="average_fare" radius={[0, 6, 6, 0]} isAnimationActive={false} maxBarSize={28} fill={theme.series[0]}>
          <LabelList
            dataKey="average_fare"
            position="right"
            formatter={(v: number) => formatCurrency(v)}
            style={{ fill: theme.axis, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
