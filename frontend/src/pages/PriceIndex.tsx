import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton, ChartSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { IndexMetricCard } from "@/components/dashboard/IndexMetricCard";
import { WhyChangedCard } from "@/components/dashboard/WhyChangedCard";
import { IndexTrendChart } from "@/components/charts/IndexTrendChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { useCurrentIndex, useIndexHistory, useRoutes } from "@/hooks/queries";
import { formatIndex, formatPercent } from "@/utils/format";
import type { Frequency } from "@/types/models";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, all: 9999 };

export default function PriceIndex() {
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [range, setRange] = useState<keyof typeof RANGE_DAYS>("30d");

  const current = useCurrentIndex();
  const history = useIndexHistory(frequency);
  const routes = useRoutes();

  const points = useMemo(() => {
    if (!history.data) return [];
    const n = RANGE_DAYS[range];
    return history.data.points.slice(-n);
  }, [history.data, range]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Airfare Price Index"
        description="A transparent experimental weighted price-relative index for domestic Indian airfares."
        actions={
          <Link
            to="/methodology"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <BookOpenText className="h-4 w-4" />
            Methodology
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <QueryBoundary
          query={current}
          skeleton={<CardSkeleton />}
          children={(idx) => <IndexMetricCard index={idx} />}
        />

        <Card className="lg:col-span-2">
          <CardHeader
            title="Index Trend"
            description="Base period = 100. Values above 100 mean airfares are higher than the base period."
            action={
              <div className="flex flex-wrap gap-2">
                <SegmentedControl
                  size="sm"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "7d", label: "7D" },
                    { value: "30d", label: "30D" },
                    { value: "90d", label: "90D" },
                    { value: "all", label: "All" },
                  ]}
                />
                <SegmentedControl
                  size="sm"
                  value={frequency}
                  onChange={setFrequency}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                />
              </div>
            }
          />
          <CardBody>
            <QueryBoundary
              query={history}
              skeleton={<ChartSkeleton height={320} />}
              isEmpty={() => points.length === 0}
              emptyState={<EmptyState title="No index history for this range" />}
            >
              {() => <IndexTrendChart points={points} height={320} />}
            </QueryBoundary>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Route contributions"
          description="Each route's sub-index (100 = base period) and its basket weight"
        />
        <CardBody className="pt-0">
          <QueryBoundary
            query={routes}
            skeleton={<div className="space-y-2 py-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-skeleton-pulse rounded bg-muted" />)}</div>}
            isEmpty={(d) => d.routes.length === 0}
            emptyState={<EmptyState title="No routes configured" />}
          >
            {(d) => (
              <div className="divide-y divide-border">
                {d.routes.map((r) => (
                  <div key={r.route_id} className="flex items-center gap-4 py-3">
                    <div className="w-28 shrink-0">
                      <p className="font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">
                        weight {formatPercent(r.weight * 100, { sign: false })}
                      </p>
                    </div>
                    <div className="hidden flex-1 sm:block">
                      <Sparkline data={r.sparkline} width={220} height={30} className="w-full" />
                    </div>
                    <div className="w-20 shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{formatIndex(r.current_index)}</p>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <ChangeIndicator value={r.change_30d} size="xs" suffix="30d" />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">Composite index</span>
                  <span className="flex items-center gap-3">
                    <Badge tone="accent">weights sum {d.weights_sum.toFixed(2)}</Badge>
                    <span className="font-bold tabular-nums">
                      {formatIndex(current.data?.index_value)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </QueryBoundary>
        </CardBody>
      </Card>

      <WhyChangedCard limit={6} />
    </div>
  );
}
