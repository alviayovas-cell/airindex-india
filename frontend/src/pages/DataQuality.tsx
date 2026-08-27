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
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { Badge } from "@/components/common/Badge";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton, ChartSkeleton } from "@/components/common/Skeleton";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartTheme } from "@/lib/chartTheme";
import { useDataQuality } from "@/hooks/queries";
import { formatDate, formatDateShort, formatNumber, formatTime } from "@/utils/format";
import type { DataQualityBreakdown } from "@/types/models";

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
  const quality = useDataQuality();
  const theme = useChartTheme();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality"
        description="How complete and reliable the collected airfare observations are."
      />

      <QueryBoundary
        query={quality}
        skeleton={
          <div className="grid gap-6 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
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
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
