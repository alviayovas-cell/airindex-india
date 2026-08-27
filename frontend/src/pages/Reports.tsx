import { useState } from "react";
import { FileBarChart, FileDown, FileJson, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { EmptyState } from "@/components/common/EmptyState";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { useReport, useRoutes } from "@/hooks/queries";
import { downloadReportFile, type ReportQuery } from "@/api/validation";
import { formatCurrency, formatDate, formatIndex, formatNumber, formatPercent } from "@/utils/format";
import type { Frequency } from "@/types/models";

export default function Reports() {
  const routes = useRoutes();
  const [form, setForm] = useState({
    date_from: "",
    date_to: "",
    route_id: "",
    frequency: "weekly" as Frequency,
  });
  const [submitted, setSubmitted] = useState<typeof form | null>(null);

  const query: ReportQuery = {
    date_from: submitted?.date_from || undefined,
    date_to: submitted?.date_to || undefined,
    route_id: submitted?.route_id || undefined,
    frequency: submitted?.frequency,
  };
  const report = useReport(query, !!submitted);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(format: "csv" | "pdf" | "json") {
    setDownloading(format);
    try {
      await downloadReportFile(query, format);
    } finally {
      setDownloading(null);
    }
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
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" loading={downloading === "pdf"} onClick={() => download("pdf")}>
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </Button>
                      <Button variant="secondary" size="sm" loading={downloading === "csv"} onClick={() => download("csv")}>
                        <FileDown className="h-3.5 w-3.5" /> CSV
                      </Button>
                      <Button variant="secondary" size="sm" loading={downloading === "json"} onClick={() => download("json")}>
                        <FileJson className="h-3.5 w-3.5" /> JSON
                      </Button>
                    </div>
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

              {d.route_indexes && d.route_indexes.length > 0 && (
                <Card>
                  <CardHeader title="Route-level indexes" description="Latest sub-index and change per basket route" />
                  <CardBody className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-2 pr-4 text-left font-semibold">Route</th>
                            <th className="px-4 text-right font-semibold">Index</th>
                            <th className="px-4 text-right font-semibold">7d</th>
                            <th className="px-4 text-right font-semibold">30d</th>
                            <th className="pl-4 text-right font-semibold">Avg fare</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.route_indexes.map((r) => (
                            <tr key={r.route_id} className="border-b border-border last:border-0">
                              <td className="py-2.5 pr-4 font-medium">{r.label}</td>
                              <td className="px-4 text-right tabular-nums">{formatIndex(r.current_index)}</td>
                              <td className="px-4 text-right"><ChangeIndicator value={r.change_7d} size="xs" /></td>
                              <td className="px-4 text-right"><ChangeIndicator value={r.change_30d} size="xs" /></td>
                              <td className="pl-4 text-right tabular-nums text-muted-foreground">{formatCurrency(r.average_fare)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              )}

              {d.observed_contributors && d.observed_contributors.length > 0 && (
                <Card>
                  <CardHeader
                    title="Observed contributors to the latest index change"
                    description="Largest measured movements — not a causal explanation"
                  />
                  <CardBody className="pt-0">
                    <div className="divide-y divide-border">
                      {d.observed_contributors.map((c) => (
                        <div key={c.route_id} className="flex items-center justify-between py-2 text-sm">
                          <span className="font-medium">{c.label}</span>
                          <span className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground">
                              route index {c.route_index_change > 0 ? "+" : ""}{c.route_index_change.toFixed(2)}
                            </span>
                            <ChangeIndicator value={c.avg_fare_change_pct} size="xs" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {d.volatility && d.volatility.length > 0 && (
                  <Card>
                    <CardHeader title="Route volatility" description="Experimental 0–100 score" />
                    <CardBody className="pt-0">
                      <div className="divide-y divide-border">
                        {d.volatility.slice(0, 6).map((v) => (
                          <div key={v.route_id} className="flex items-center justify-between py-2 text-sm">
                            <span className="font-medium">{v.label}</span>
                            <span className="text-muted-foreground">
                              {v.volatility_score.toFixed(0)} · {v.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {d.fare_spikes && (
                  <Card>
                    <CardHeader
                      title="Fare spikes"
                      description={`Last ${d.fare_spikes.window_days} days vs the preceding period`}
                    />
                    <CardBody className="pt-0 text-sm">
                      <p className="mb-3 text-muted-foreground">
                        Moderate {d.fare_spikes.summary["Moderate Increase"] ?? 0} · High{" "}
                        {d.fare_spikes.summary["High Increase"] ?? 0} · Critical{" "}
                        {d.fare_spikes.summary["Critical Increase"] ?? 0}
                      </p>
                      {d.fare_spikes.top.length === 0 ? (
                        <p className="text-muted-foreground">No fare spikes in this window.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {d.fare_spikes.top.map((a, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                              <span>
                                <span className="font-medium">{a.route_label}</span>{" "}
                                <span className="text-xs text-muted-foreground">{a.advance_window}</span>
                              </span>
                              <span className="font-semibold text-danger">
                                {formatPercent(a.pct_change)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )}
              </div>

              {d.methodology && (
                <Card>
                  <CardHeader title="Methodology & disclaimer" />
                  <CardBody className="space-y-2 pt-0 text-sm text-muted-foreground">
                    <p>
                      Version {d.methodology.version} · base period{" "}
                      {formatDate(d.methodology.base_period)} · windows{" "}
                      {d.methodology.advance_windows.map((w) => `T+${w}`).join(", ")}
                    </p>
                    <p className="font-mono text-xs text-foreground">{d.methodology.formula}</p>
                    <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      {d.disclaimer ?? d.methodology.disclaimer}
                    </p>
                    {d.data_source && (
                      <p className="text-xs">
                        Data source: {d.data_source.source}
                        {d.data_source.is_synthetic ? " (synthetic demonstration data)" : ""} ·
                        generated {d.generated_at ? formatDate(d.generated_at) : "—"}
                      </p>
                    )}
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
