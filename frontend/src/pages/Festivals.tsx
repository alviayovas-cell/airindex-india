import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Select } from "@/components/common/Select";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFestivals, useRoutes } from "@/hooks/queries";
import { formatCurrency, formatDate } from "@/utils/format";

export default function Festivals() {
  const routes = useRoutes();
  const [filters, setFilters] = useState({ route_id: "", airline: "" });
  const festivals = useFestivals({
    route_id: filters.route_id || undefined,
    airline: filters.airline || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Festival & Holiday Analysis"
        description="Observed airfare movement during Indian holiday and festival travel windows."
        actions={
          <div className="flex gap-2">
            <div className="w-44">
              <Select
                value={filters.route_id}
                onChange={(e) => setFilters((f) => ({ ...f, route_id: e.target.value }))}
                options={[
                  { value: "", label: "All routes" },
                  ...(routes.data?.routes.map((r) => ({ value: r.route_id, label: r.label })) ?? []),
                ]}
              />
            </div>
            <div className="w-40">
              <Select
                value={filters.airline}
                onChange={(e) => setFilters((f) => ({ ...f, airline: e.target.value }))}
                options={[
                  { value: "", label: "All airlines" },
                  ...["6E", "AI", "UK", "SG", "QP"].map((a) => ({ value: a, label: a })),
                ]}
              />
            </div>
          </div>
        }
      />

      <QueryBoundary
        query={festivals}
        skeleton={<CardSkeleton />}
        isEmpty={(d) => !d.available || d.events.length === 0}
        emptyState={
          <EmptyState
            icon={PartyPopper}
            title="No festival data"
            description="Seed the database or widen the filters."
          />
        }
      >
        {(d) => (
          <>
            <Card>
              <CardHeader
                title="Events"
                description={`Data covers travel dates ${d.data_range.from} → ${d.data_range.to}. Normal-period average fare ${formatCurrency(
                  d.normal_avg_fare,
                )} (±${d.window_days}-day windows).`}
              />
              <CardBody className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 text-left font-semibold">Event</th>
                        <th className="px-4 text-left font-semibold">Date</th>
                        <th className="px-4 text-right font-semibold">Event avg</th>
                        <th className="px-4 text-right font-semibold">Normal avg</th>
                        <th className="px-4 text-right font-semibold">Observed change</th>
                        <th className="pl-4 text-right font-semibold">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.events.map((e) => (
                        <tr key={e.name} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-4">
                            <span className="font-medium">{e.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {e.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 text-muted-foreground">{formatDate(e.date)}</td>
                          {e.in_data_range ? (
                            <>
                              <td className="px-4 text-right tabular-nums">
                                {formatCurrency(e.event_avg_fare)}
                              </td>
                              <td className="px-4 text-right tabular-nums text-muted-foreground">
                                {formatCurrency(e.normal_avg_fare)}
                              </td>
                              <td className="px-4 text-right">
                                <ChangeIndicator value={e.observed_change_pct} size="xs" />
                              </td>
                              <td className="pl-4 text-right tabular-nums text-muted-foreground">
                                {e.event_observations}
                              </td>
                            </>
                          ) : (
                            <td colSpan={4} className="px-4 text-right">
                              <Badge tone="neutral">outside collected data</Badge>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <p className="text-xs leading-relaxed text-muted-foreground">{d.disclaimer}</p>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
