import { AlertTriangle, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton, ChartSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { BacktestChart } from "@/components/charts/BacktestChart";
import { useBacktest } from "@/hooks/queries";
import { downloadCsv } from "@/utils/csv";
import { formatDate, formatIndex, formatPercent } from "@/utils/format";
import type { Backtest } from "@/types/models";

function metricCards(m: Backtest["metrics"]) {
  return [
    { label: "Correlation", value: m.correlation != null ? m.correlation.toFixed(3) : "—", hint: "Pearson, our index vs reference" },
    { label: "MAE", value: m.mae.toFixed(2), hint: "Mean absolute error (index points)" },
    { label: "RMSE", value: m.rmse.toFixed(2), hint: "Root mean squared error (index points)" },
    { label: "MAPE", value: `${m.mape_pct.toFixed(2)}%`, hint: "Mean absolute % deviation" },
  ];
}

export default function Validation() {
  const backtest = useBacktest();

  function handleExport(d: Backtest) {
    downloadCsv(
      `airindex-backtest-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "date", header: "date" },
        { key: "our_index", header: "airindex" },
        { key: "reference_index", header: "reference_index" },
        { key: "difference", header: "difference" },
        { key: "pct_deviation", header: "pct_deviation" },
      ],
      d.series as unknown as Record<string, unknown>[],
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="30-Day Validation"
        description="How closely the prototype index tracks the underlying price signal over a frozen 30-day window."
      />

      <QueryBoundary
        query={backtest}
        skeleton={
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
            <ChartSkeleton height={320} />
          </div>
        }
        isEmpty={(d) => !d.available}
        emptyState={
          <EmptyState
            title="No data to validate yet"
            description="Seed the database to generate the 30-day dataset and computed index."
          />
        }
      >
        {(d) => (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{d.data_status_label}. The reference series is the noise-free price signal implied by the synthetic model — not an external index.</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metricCards(d.metrics).map((c) => (
                <Card key={c.label} className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-2 text-[28px] font-bold leading-none tabular-nums">{c.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{c.hint}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader
                title="AIRINDEX vs reference index"
                description={`${d.days} days · base period ${formatDate(d.base_period)} · methodology ${d.methodology_version}`}
                action={
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-0.5 w-4 rounded bg-[rgb(var(--chart-1))]" /> AIRINDEX
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-0.5 w-4 rounded border-b-2 border-dashed border-[rgb(var(--chart-4))]" /> Reference
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => handleExport(d)}>
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                  </div>
                }
              />
              <CardBody>
                <BacktestChart series={d.series} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Daily comparison" />
              <CardBody className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 text-left font-semibold">Date</th>
                        <th className="px-4 text-right font-semibold">AIRINDEX</th>
                        <th className="px-4 text-right font-semibold">Reference</th>
                        <th className="px-4 text-right font-semibold">Difference</th>
                        <th className="pl-4 text-right font-semibold">Deviation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.series.map((p) => (
                        <tr key={p.date} className="border-b border-border last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{formatDate(p.date)}</td>
                          <td className="px-4 text-right tabular-nums">{formatIndex(p.our_index)}</td>
                          <td className="px-4 text-right tabular-nums">{formatIndex(p.reference_index)}</td>
                          <td className="px-4 text-right tabular-nums">{p.difference > 0 ? "+" : ""}{p.difference.toFixed(2)}</td>
                          <td className="pl-4 text-right tabular-nums text-muted-foreground">
                            {p.pct_deviation != null ? formatPercent(p.pct_deviation) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="How to read this" />
              <CardBody className="pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {d.notes.map((n) => (
                    <li key={n} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {n}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
