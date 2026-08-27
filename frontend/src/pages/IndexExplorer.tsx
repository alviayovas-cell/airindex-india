import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Select } from "@/components/common/Select";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { WhyChangedCard } from "@/components/dashboard/WhyChangedCard";
import { useIndexCalculation } from "@/hooks/queries";
import { formatDate, formatIndex, formatPercent } from "@/utils/format";

export default function IndexExplorer() {
  const [date, setDate] = useState<string | undefined>(undefined);
  const calc = useIndexCalculation(date);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Index Calculation Explorer"
        description="Every number below comes from the stored daily index — the contribution rows sum to the published AIRINDEX."
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

      <QueryBoundary
        query={calc}
        skeleton={<CardSkeleton />}
        isEmpty={(d) => d.rows.length === 0}
        emptyState={
          <EmptyState
            icon={Calculator}
            title="No index computed yet"
            description="Seed the database or run a collection first."
          />
        }
      >
        {(d) => (
          <>
            <Card>
              <CardHeader
                title="View calculation"
                description={d.formula}
                action={
                  <Select
                    value={d.date}
                    onChange={(e) => setDate(e.target.value)}
                    options={[...d.available_dates]
                      .reverse()
                      .map((x) => ({ value: x, label: formatDate(x) }))}
                  />
                }
              />
              <CardBody className="pt-0">
                <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Meta label="Period" value={formatDate(d.date)} />
                  <Meta label="Base period" value={formatDate(d.base_period)} />
                  <Meta label="Methodology" value={d.methodology_version ?? "—"} />
                  <Meta
                    label="Routes used"
                    value={`${d.rows.length}${
                      d.routes_missing.length
                        ? ` (+${d.routes_missing.length} missing)`
                        : ""
                    }`}
                  />
                </dl>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 text-left font-semibold">Route</th>
                        <th className="px-4 text-right font-semibold">Weight</th>
                        <th className="px-4 text-right font-semibold">Eff. weight</th>
                        <th className="px-4 text-right font-semibold">Route index</th>
                        <th className="pl-4 text-right font-semibold">Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r) => (
                        <tr key={r.route_id} className="border-b border-border">
                          <td className="py-2.5 pr-4 font-medium">{r.label}</td>
                          <td className="px-4 text-right tabular-nums text-muted-foreground">
                            {formatPercent(r.weight * 100, { sign: false })}
                          </td>
                          <td className="px-4 text-right tabular-nums">
                            {formatPercent(r.effective_weight * 100, { sign: false })}
                          </td>
                          <td className="px-4 text-right tabular-nums">
                            {formatIndex(r.route_index)}
                          </td>
                          <td className="pl-4 text-right font-semibold tabular-nums">
                            {formatIndex(r.contribution)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="py-3 pr-4 text-right font-semibold">
                          AIRINDEX ({formatDate(d.date)})
                        </td>
                        <td className="pl-4 text-right">
                          <span className="text-lg font-bold tabular-nums">
                            {formatIndex(d.index_value)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone="accent">
                    Σ contributions {formatIndex(d.recomputed_from_rows)}
                  </Badge>
                  <span>{d.note}</span>
                </div>
              </CardBody>
            </Card>

            <WhyChangedCard limit={6} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
