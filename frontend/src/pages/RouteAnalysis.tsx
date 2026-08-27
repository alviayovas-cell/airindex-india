import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Select } from "@/components/common/Select";
import { Tabs } from "@/components/common/Tabs";
import { Badge } from "@/components/common/Badge";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton, ChartSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { MiniAreaChart } from "@/components/charts/MiniAreaChart";
import { LeadTimeChart } from "@/components/charts/LeadTimeChart";
import { AirlineBarChart } from "@/components/charts/AirlineBarChart";
import { useRouteDetail, useRoutes } from "@/hooks/queries";
import { formatCurrency, formatIndex, formatNumber } from "@/utils/format";

type Tab = "trend" | "airlines" | "leadtime";

export default function RouteAnalysis() {
  const [params, setParams] = useSearchParams();
  const routes = useRoutes();
  const [tab, setTab] = useState<Tab>("trend");

  const selected =
    params.get("route") || routes.data?.routes[0]?.route_id || undefined;

  useEffect(() => {
    if (!params.get("route") && routes.data?.routes[0]) {
      setParams({ route: routes.data.routes[0].route_id }, { replace: true });
    }
  }, [routes.data, params, setParams]);

  const detail = useRouteDetail(selected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Analysis"
        description="Fare, index and booking-window behaviour for a selected city-pair."
        actions={
          <div className="w-56">
            <Select
              options={
                routes.data?.routes.map((r) => ({
                  value: r.route_id,
                  label: r.label,
                })) ?? []
              }
              value={selected ?? ""}
              onChange={(e) => setParams({ route: e.target.value })}
            />
          </div>
        }
      />

      <QueryBoundary
        query={detail}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        }
      >
        {(d) => (
          <>
            {/* Hero stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route</p>
                <p className="mt-2 text-2xl font-bold">{d.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.route.origin_city} → {d.route.destination_city}
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average fare</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(d.stats?.average_fare)}</p>
                <p className="mt-1 text-xs text-muted-foreground">across valid observations</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route index</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{formatIndex(d.stats?.current_index)}</p>
                <p className="mt-1"><ChangeIndicator value={d.stats?.change_30d} size="xs" suffix="30d" /></p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observations</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(d.stats?.observation_count)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  basket weight {((d.route.weight ?? 0) * 100).toFixed(0)}%
                </p>
              </Card>
            </div>

            <Card>
              <CardBody className="pb-0">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    { value: "trend", label: "Price trend" },
                    { value: "airlines", label: "Airline comparison" },
                    { value: "leadtime", label: "Lead-time curve" },
                  ]}
                />
              </CardBody>
              <CardBody>
                {tab === "trend" &&
                  (d.index_history.length ? (
                    <MiniAreaChart
                      data={d.index_history as unknown as Record<string, unknown>[]}
                      xKey="date"
                      yKey="index_value"
                      height={300}
                      baseline={100}
                    />
                  ) : (
                    <EmptyState title="No index history for this route" />
                  ))}

                {tab === "airlines" &&
                  (d.airlines.length ? (
                    <AirlineBarChart
                      data={d.airlines.map((a) => ({
                        name: a.airline,
                        average_fare: a.average_fare,
                        observation_count: a.observation_count,
                      }))}
                      height={280}
                    />
                  ) : (
                    <EmptyState title="No airline data for this route" />
                  ))}

                {tab === "leadtime" &&
                  (d.lead_time.windows.some((w) => w.average_fare) ? (
                    <LeadTimeChart windows={d.lead_time.windows} height={300} />
                  ) : (
                    <EmptyState title="No lead-time data for this route" />
                  ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Airline breakdown" description="Average fare on this route by carrier" />
              <CardBody className="pt-0">
                <div className="divide-y divide-border">
                  {d.airlines.map((a) => (
                    <div key={a.airline} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium">{a.airline}</span>
                      <span className="flex items-center gap-4">
                        <Badge>{formatNumber(a.observation_count)} obs</Badge>
                        <span className="w-20 text-right font-semibold tabular-nums">
                          {formatCurrency(a.average_fare)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </QueryBoundary>

      {routes.isLoading && <ChartSkeleton height={120} />}
    </div>
  );
}
