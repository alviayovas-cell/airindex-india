import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Select } from "@/components/common/Select";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { ChartSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { LeadTimeChart } from "@/components/charts/LeadTimeChart";
import { useLeadTime, useRoutes } from "@/hooks/queries";
import { formatCurrency, formatNumber } from "@/utils/format";

export default function LeadTimeAnalysis() {
  const [route, setRoute] = useState("");
  const [airline, setAirline] = useState("");
  const [fareType, setFareType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [metric, setMetric] = useState<"average_fare" | "median_fare">("average_fare");

  const routes = useRoutes();
  const leadTime = useLeadTime({
    route: route || undefined,
    airline: airline || undefined,
    fare_type: fareType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const opts = leadTime.data?.filter_options;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking Window Analysis"
        description="Understand how airfare changes with advance-purchase timing across T+1 to T+45."
      />

      <Card>
        <CardHeader title="Filters" description="Narrow the observations feeding the curve." />
        <CardBody className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Route"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            options={[
              { value: "", label: "All routes" },
              ...(routes.data?.routes.map((r) => ({ value: r.route_id, label: r.label })) ?? []),
            ]}
          />
          <Select
            label="Airline"
            value={airline}
            onChange={(e) => setAirline(e.target.value)}
            options={[
              { value: "", label: "All airlines" },
              ...(opts?.airlines.map((a) => ({ value: a, label: a })) ?? []),
            ]}
          />
          <Select
            label="Fare type"
            value={fareType}
            onChange={(e) => setFareType(e.target.value)}
            options={[
              { value: "", label: "All fare types" },
              ...(opts?.fare_types.map((f) => ({ value: f, label: f })) ?? []),
            ]}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Average fare by advance-purchase window${route ? ` — ${route}` : ""}`}
          description="Lower bars on the right mean booking earlier is cheaper."
          action={
            <SegmentedControl
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "average_fare", label: "Average" },
                { value: "median_fare", label: "Median" },
              ]}
            />
          }
        />
        <CardBody>
          <QueryBoundary
            query={leadTime}
            skeleton={<ChartSkeleton height={320} />}
            isEmpty={(d) => d.windows.every((w) => !w.average_fare)}
            emptyState={<EmptyState icon={CalendarClock} title="No observations for this selection" />}
          >
            {(d) => <LeadTimeChart windows={d.windows} metric={metric} height={340} />}
          </QueryBoundary>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Detail" description="Average, median and sample size per window" />
        <CardBody className="pt-0">
          <QueryBoundary query={leadTime} skeleton={<ChartSkeleton height={200} />}>
            {(d) => {
              const first = d.windows.find((w) => w.average_fare)?.average_fare;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 text-left font-semibold">Window</th>
                        <th className="px-4 text-right font-semibold">Average fare</th>
                        <th className="px-4 text-right font-semibold">Median fare</th>
                        <th className="px-4 text-right font-semibold">vs T+1</th>
                        <th className="pl-4 text-right font-semibold">Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.windows.map((w) => {
                        const vsFirst =
                          first && w.average_fare
                            ? ((w.average_fare - first) / first) * 100
                            : null;
                        return (
                          <tr key={w.window} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-4 font-medium">
                              {w.window}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {w.advance_days}d ahead
                              </span>
                            </td>
                            <td className="px-4 text-right tabular-nums">{formatCurrency(w.average_fare)}</td>
                            <td className="px-4 text-right tabular-nums">{formatCurrency(w.median_fare)}</td>
                            <td className="px-4 text-right tabular-nums text-muted-foreground">
                              {vsFirst == null ? "—" : `${vsFirst > 0 ? "+" : ""}${vsFirst.toFixed(1)}%`}
                            </td>
                            <td className="pl-4 text-right tabular-nums text-muted-foreground">
                              {formatNumber(w.observation_count)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }}
          </QueryBoundary>
        </CardBody>
      </Card>

      <p className="text-xs text-muted-foreground">
        Fares are standardized domestic economy quotes. Windows snap each observed
        advance-purchase gap to the nearest of T+1, T+7, T+15, T+30, T+45.
      </p>
    </div>
  );
}
