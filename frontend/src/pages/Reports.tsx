import { useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { EmptyState } from "@/components/common/EmptyState";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { useReport, useRoutes } from "@/hooks/queries";
import { downloadCsv } from "@/utils/csv";
import { formatCurrency, formatDate, formatIndex, formatNumber } from "@/utils/format";
import type { Frequency, Report } from "@/types/models";

export default function Reports() {
  const routes = useRoutes();
  const [form, setForm] = useState({
    date_from: "",
    date_to: "",
    route_id: "",
    frequency: "weekly" as Frequency,
  });
  const [submitted, setSubmitted] = useState<typeof form | null>(null);

  const report = useReport(
    {
      date_from: submitted?.date_from || undefined,
      date_to: submitted?.date_to || undefined,
      route_id: submitted?.route_id || undefined,
      frequency: submitted?.frequency,
    },
    !!submitted,
  );

  function exportCsv(d: Report) {
    downloadCsv(
      `airindex-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "period", header: "period" },
        { key: "average_fare", header: "average_fare" },
        { key: "index_value", header: "index_value" },
        { key: "observations", header: "observations" },
        { key: "valid_observations", header: "valid_observations" },
        { key: "quality_pct", header: "quality_pct" },
      ],
      d.rows as unknown as Record<string, unknown>[],
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Build a summary over a date range, route and frequency, then export it."
      />

      <Card>
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted({ ...form });
            }}
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={form.date_from}
                onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value }))}
                className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={form.date_to}
                onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))}
                className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <Select
              label="Route"
              placeholder="All routes"
              options={routes.data?.routes.map((r) => ({ value: r.route_id, label: r.label })) ?? []}
              value={form.route_id}
              onChange={(e) => setForm((f) => ({ ...f, route_id: e.target.value }))}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Frequency</label>
              <SegmentedControl
                size="sm"
                value={form.frequency}
                onChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            </div>
            <Button type="submit" className="lg:w-full">Generate report</Button>
          </form>
        </CardBody>
      </Card>

      {!submitted ? (
        <EmptyState
          icon={FileBarChart}
          title="No report generated yet"
          description="Choose a date range and frequency, then generate a report. Leave dates blank to include everything."
        />
      ) : (
        <QueryBoundary
          query={report}
          skeleton={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-skeleton-pulse rounded-2xl bg-muted" />)}</div>}
          isEmpty={(d) => d.rows.length === 0}
          emptyState={<EmptyState title="No data for this selection" description="Widen the date range or clear the route filter." />}
        >
          {(d) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average fare</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(d.summary.average_fare)}</p>
                </Card>
                <Card className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Index change</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {formatIndex(d.summary.index_start)} → {formatIndex(d.summary.index_end)}
                  </p>
                  <p className="mt-1"><ChangeIndicator value={d.summary.index_change_pct} size="xs" /></p>
                </Card>
                <Card className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observations</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(d.summary.observations)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatNumber(d.summary.valid_observations)} valid</p>
                </Card>
                <Card className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data quality</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {d.summary.quality_pct != null ? `${d.summary.quality_pct}%` : "—"}
                  </p>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Report preview"
                  description={`${d.summary.period_count} ${d.summary.frequency} periods${d.summary.route_id ? ` · ${d.summary.route_id}` : ""}`}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => exportCsv(d)}>
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </Button>
                  }
                />
                <CardBody className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-4 text-left font-semibold">Period</th>
                          <th className="px-4 text-right font-semibold">Average fare</th>
                          <th className="px-4 text-right font-semibold">Index</th>
                          <th className="px-4 text-right font-semibold">Observations</th>
                          <th className="pl-4 text-right font-semibold">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.rows.map((r) => (
                          <tr key={r.period} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-4 font-medium">{formatDate(r.period)}</td>
                            <td className="px-4 text-right tabular-nums">{formatCurrency(r.average_fare)}</td>
                            <td className="px-4 text-right tabular-nums">{formatIndex(r.index_value)}</td>
                            <td className="px-4 text-right tabular-nums text-muted-foreground">{formatNumber(r.observations)}</td>
                            <td className="pl-4 text-right tabular-nums text-muted-foreground">{r.quality_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
