import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useIndexExplain } from "@/hooks/queries";
import { formatCurrency, formatDate, formatIndex } from "@/utils/format";

/** "Why did AIRINDEX change?" — largest observed contributors between two days. */
export function WhyChangedCard({ limit = 3 }: { limit?: number }) {
  const explain = useIndexExplain();

  return (
    <Card>
      <CardHeader
        title="Why did AIRINDEX change?"
        description="Largest observed contributors to the latest movement"
        action={
          <Link
            to="/index-explorer"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            View calculation <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <CardBody className="pt-0">
        <QueryBoundary
          query={explain}
          skeleton={<CardSkeleton />}
          isEmpty={(d) => !d.available}
          emptyState={
            <EmptyState
              icon={Sparkles}
              title="Not enough history yet"
              description="Two index days are needed to attribute a change."
            />
          }
        >
          {(d) => (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold tabular-nums">
                  {formatIndex(d.index_now)}
                </span>
                <ChangeIndicator value={d.index_change_pct} size="md" />
                <span className="text-xs text-muted-foreground">
                  {formatDate(d.compare_date)} → {formatDate(d.date)}
                </span>
              </div>

              <div className="divide-y divide-border">
                {(d.observed_contributors ?? []).slice(0, limit).map((c) => {
                  const idxPct = c.route_index_prev
                    ? (100 * (c.route_index_now - c.route_index_prev)) /
                      c.route_index_prev
                    : null;
                  return (
                    <div
                      key={c.route_id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="font-medium">{c.label}</span>
                      <span className="flex items-center gap-4">
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          fare {formatCurrency(c.avg_fare_prev)} →{" "}
                          {formatCurrency(c.avg_fare_now)}
                        </span>
                        <span className="w-20 text-right">
                          <ChangeIndicator value={idxPct} size="xs" suffix="idx" />
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {d.largest_observed_movement && (
                  <Badge tone="neutral">
                    Largest movement: {d.largest_observed_movement.label}
                  </Badge>
                )}
                {d.most_affected_window && (
                  <Badge tone="neutral">
                    Most affected window: {d.most_affected_window.window}
                  </Badge>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {d.disclaimer}
              </p>
            </div>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
