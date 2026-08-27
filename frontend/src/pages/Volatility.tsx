import { useState } from "react";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Sparkline } from "@/components/charts/Sparkline";
import { useVolatility } from "@/hooks/queries";
import type { RouteVolatility } from "@/types/models";

const CATEGORY_TONE: Record<
  RouteVolatility["category"],
  "success" | "neutral" | "warning" | "danger"
> = {
  Low: "success",
  Moderate: "neutral",
  High: "warning",
  "Very High": "danger",
};
const BAR_TONE: Record<
  RouteVolatility["category"],
  "success" | "accent" | "warning" | "danger"
> = { Low: "success", Moderate: "accent", High: "warning", "Very High": "danger" };

export default function Volatility() {
  const [windowDays, setWindowDays] = useState(14);
  const vol = useVolatility(windowDays);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Price Volatility"
        description="How much each route's fare level swings day to day."
        actions={
          <SegmentedControl
            size="sm"
            value={String(windowDays)}
            onChange={(v) => setWindowDays(Number(v))}
            options={[
              { value: "7", label: "7D" },
              { value: "14", label: "14D" },
              { value: "30", label: "30D" },
            ]}
          />
        }
      />

      <QueryBoundary
        query={vol}
        skeleton={<CardSkeleton />}
        isEmpty={(d) => d.routes.length === 0}
        emptyState={
          <EmptyState
            icon={Activity}
            title="No volatility data yet"
            description="Seed the database or run a collection to build the index history."
          />
        }
      >
        {(d) => (
          <>
            <Card>
              <CardHeader
                title="Volatility ranking"
                description={`Score 0–100 over the last ${d.window_days} days · ${d.method}`}
              />
              <CardBody className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 text-left font-semibold">Route</th>
                        <th className="px-4 text-left font-semibold">Volatility score</th>
                        <th className="px-4 text-left font-semibold">Category</th>
                        <th className="px-4 text-right font-semibold">CV</th>
                        <th className="px-4 text-right font-semibold">Trend</th>
                        <th className="pl-4 text-right font-semibold">History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.routes.map((r) => (
                        <tr key={r.route_id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4 font-medium">{r.label}</td>
                          <td className="px-4">
                            <div className="flex items-center gap-3">
                              <span className="w-9 text-right font-semibold tabular-nums">
                                {r.volatility_score.toFixed(0)}
                              </span>
                              <ProgressBar
                                className="w-32"
                                value={r.volatility_score}
                                tone={BAR_TONE[r.category]}
                              />
                            </div>
                          </td>
                          <td className="px-4">
                            <Badge tone={CATEGORY_TONE[r.category]}>{r.category}</Badge>
                          </td>
                          <td className="px-4 text-right tabular-nums text-muted-foreground">
                            {r.coefficient_of_variation_pct != null
                              ? `${r.coefficient_of_variation_pct.toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="px-4 text-right">
                            <ChangeIndicator value={r.trend_pct} size="xs" />
                          </td>
                          <td className="pl-4">
                            <div className="flex justify-end">
                              <Sparkline data={r.sparkline} width={84} height={24} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {d.disclaimer} Bands: Low {d.categories.Low}, Moderate{" "}
              {d.categories.Moderate}, High {d.categories.High}, Very High{" "}
              {d.categories["Very High"]}.
            </p>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
