import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Copy, HelpCircle, MinusCircle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Select } from "@/components/common/Select";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { Badge } from "@/components/common/Badge";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton, ChartSkeleton } from "@/components/common/Skeleton";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartTheme } from "@/lib/chartTheme";
import { useDataQuality } from "@/hooks/queries";
import { formatDate, formatDateShort, formatNumber, formatTime } from "@/utils/format";
import type { DataQualityBreakdown, QualityGroupRow } from "@/types/models";

const CATS: {
  key: keyof DataQualityBreakdown;
  label: string;
  icon: typeof CheckCircle2;
  tone: "success" | "warning" | "danger" | "neutral";
}[] = [
  { key: "valid", label: "Valid", icon: CheckCircle2, tone: "success" },
  { key: "outlier", label: "Outliers", icon: HelpCircle, tone: "warning" },
  { key: "missing", label: "Missing", icon: MinusCircle, tone: "neutral" },
  { key: "duplicate", label: "Duplicates", icon: Copy, tone: "neutral" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, tone: "danger" },
  { key: "sold_out", label: "Sold out", icon: XCircle, tone: "danger" },
];

export default function DataQuality() {
  const [filters, setFilters] = useState({
    route_id: "",
    airline: "",
    source: "",
    date_from: "",
    date_to: "",
  });
  const quality = useDataQuality({
    route_id: filters.route_id || undefined,
    airline: filters.airline || undefined,
    source: filters.source || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  });
  const theme = useChartTheme();
  const opts = quality.data?.filter_options;
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality"
        description="How complete and reliable the collected airfare observations are."
      />

      <Card>
        <CardHeader title="Filters" description="Slice the cleaning-pipeline outcome." />
        <CardBody className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Route"
            value={filters.route_id}
            onChange={set("route_id")}
            options={[
              { value: "", label: "All routes" },
              ...(opts?.routes.map((r) => ({ value: r, label: r })) ?? []),
            ]}
          />
          <Select
            label="Airline"
            value={filters.airline}
            onChange={set("airline")}
            options={[
              { value: "", label: "All airlines" },
              ...(opts?.airlines.map((a) => ({ value: a, label: a })) ?? []),
            ]}
          />
          <Select
            label="Source"
            value={filters.source}
            onChange={set("source")}
            options={[
              { value: "", label: "All sources" },
              ...(opts?.sources.map((s) => ({ value: s, label: s })) ?? []),
            ]}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={set("date_from")}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={set("date_to")}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </CardBody>
      </Card>

      <QueryBoundary
        query={quality}
        skeleton={
          <div className="grid gap-6 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        }
        isEmpty={(d) => d.breakdown.total === 0}
        emptyState={
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No observations match these filters.
          </Card>
        }
      >
        {(d) => {
          const total = d.breakdown.total || 1;
          return (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Overall data quality
                  </p>
                  <p className="mt-2 text-[40px] font-bold leading-none tabular-nums">
                    {d.overall_quality_pct ?? "—"}
                    {d.overall_quality_pct != null && (
                      <span className="text-2xl text-muted-foreground">%</span>
                    )}
                  </p>
                  <ProgressBar
                    className="mt-4"
                    value={d.overall_quality_pct ?? 0}
                    tone={
                      (d.overall_quality_pct ?? 0) >= 90
                        ? "success"
                        : (d.overall_quality_pct ?? 0) >= 75
                          ? "warning"
                          : "danger"
                    }
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatNumber(d.breakdown.valid)} of {formatNumber(d.breakdown.total)}{" "}
                    observations are index-eligible.
                  </p>
                </Card>

                <Card className="p-6 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status breakdown
                  </p>
                  <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    {CATS.map((c) => {
                      const n = d.breakdown[c.key];
                      const pct = (n / total) * 100;
                      return (
                        <div key={c.key}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <c.icon className="h-4 w-4 text-muted-foreground" />
                              {c.label}
                            </span>
                            <span className="tabular-nums">
                              {formatNumber(n)}
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {pct.toFixed(1)}%
                              </span>
                            </span>
                          </div>
                          <ProgressBar className="mt-1.5" value={pct} tone={c.tone} />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Quality over time" description="Daily valid-observation share" />
                <CardBody>
                  {d.daily.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={d.daily} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dqFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={theme.positive} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={theme.positive} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tick={{ fill: theme.axis, fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: theme.grid }}
                          minTickGap={28}
                          tickFormatter={formatDateShort}
                        />
                        <YAxis
                          domain={[60, 100]}
                          ticks={[60, 70, 80, 90, 100]}
                          tick={{ fill: theme.axis, fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={38}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            const r = payload?.[0]?.payload;
                            return (
                              <ChartTooltip
                                active={active && !!r}
                                title={r?.date ?? ""}
                                rows={[
                                  { label: "Quality", value: `${r?.quality_pct ?? "—"}%`, color: theme.positive },
                                  { label: "Valid", value: r?.valid_count ?? "—" },
                                  { label: "Total", value: r?.total ?? "—" },
                                ]}
                              />
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="quality_pct"
                          stroke={theme.positive}
                          strokeWidth={2}
                          fill="url(#dqFill)"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartSkeleton height={200} />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Source health" description="Status of each connected data source" />
                <CardBody className="space-y-3 pt-0">
                  {d.sources.length === 0 && (
                    <p className="py-4 text-sm text-muted-foreground">No collection runs recorded yet.</p>
                  )}
                  {d.sources.map((s) => (
                    <div
                      key={s.name}
                      className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{s.name}</span>
                          {s.is_synthetic && <Badge tone="warning">synthetic</Badge>}
                        </div>
                        <StatusIndicator status={s.status} className="mt-1" />
                      </div>
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                        <div>
                          <dt>Last collection</dt>
                          <dd className="font-medium text-foreground">
                            {s.last_collection
                              ? `${formatDate(s.last_collection)} ${formatTime(s.last_collection)}`
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Records</dt>
                          <dd className="font-medium text-foreground">{formatNumber(s.records_collected)}</dd>
                        </div>
                        <div>
                          <dt>Errors</dt>
                          <dd className="font-medium text-foreground">{s.errors.length}</dd>
                        </div>
                        <div>
                          <dt>Duration</dt>
                          <dd className="font-medium text-foreground">
                            {s.duration_seconds != null ? `${s.duration_seconds}s` : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </CardBody>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <QualityGroupTable title="Quality by route" rows={d.by_route} />
                <QualityGroupTable title="Quality by airline" rows={d.by_airline} />
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function QualityGroupTable({
  title,
  rows,
}: {
  title: string;
  rows: QualityGroupRow[];
}) {
  return (
    <Card>
      <CardHeader title={title} description="Valid share and issue counts" />
      <CardBody className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 text-left font-semibold">
                  {title.includes("route") ? "Route" : "Airline"}
                </th>
                <th className="px-3 text-right font-semibold">Total</th>
                <th className="px-3 text-right font-semibold">Outliers</th>
                <th className="px-3 text-right font-semibold">Missing</th>
                <th className="pl-3 text-right font-semibold">Quality</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 font-medium">{r.label ?? r.key}</td>
                  <td className="px-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(r.total)}
                  </td>
                  <td className="px-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(r.outlier)}
                  </td>
                  <td className="px-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(r.missing)}
                  </td>
                  <td className="pl-3 text-right">
                    <span
                      className={
                        r.quality_pct >= 90
                          ? "font-semibold text-success"
                          : r.quality_pct >= 75
                            ? "font-semibold text-warning"
                            : "font-semibold text-danger"
                      }
                    >
                      {r.quality_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
