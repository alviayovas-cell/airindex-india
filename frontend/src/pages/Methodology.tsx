import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { useMethodology } from "@/hooks/queries";
import { formatDate } from "@/utils/format";

export default function Methodology() {
  const methodology = useMethodology();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Methodology"
        description="How the experimental Airfare Price Index is constructed. Everything here is versioned and reproducible."
      />

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Prototype methodology — not an official CPI methodology and not an NSO/RBI system.</span>
      </div>

      <QueryBoundary
        query={methodology}
        skeleton={<div className="grid gap-6 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>}
      >
        {(m) => (
          <>
            <Card>
              <CardHeader title="Index formula" />
              <CardBody className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/50 px-5 py-6 text-center">
                  <p className="font-mono text-lg tracking-tight text-foreground">
                    I(t) = 100 &times; &Sigma;<sub>i</sub> [ w<sub>i</sub> &times; ( P<sub>i</sub>(t) / P<sub>i</sub>(0) ) ]
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">I(t)</strong> is the index on day t.{" "}
                  <strong className="text-foreground">P<sub>i</sub>(t)</strong> is the standardized price of
                  route i on day t, <strong className="text-foreground">P<sub>i</sub>(0)</strong> its price in
                  the base period, and <strong className="text-foreground">w<sub>i</sub></strong> the route
                  weight (weights sum to 1).
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Price standardization:</strong> {m.price_standardization}.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge tone="accent">Base period {formatDate(m.base_period)} = 100</Badge>
                  <Badge>Methodology {m.methodology_version}</Badge>
                  <Badge>Windows {m.advance_windows.map((w) => `T+${w}`).join(", ")}</Badge>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Route basket & weights"
                description={`${m.route_basket.length} city-pairs · weights sum to ${m.weights_sum.toFixed(2)}`}
              />
              <CardBody className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 text-left font-semibold">Route</th>
                        <th className="px-4 text-left font-semibold">Cities</th>
                        <th className="pl-4 text-right font-semibold">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.route_basket.map((r) => (
                        <tr key={r.route_id} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-4 font-medium">{r.label}</td>
                          <td className="px-4 text-muted-foreground">
                            {r.origin_city} – {r.destination_city}
                          </td>
                          <td className="pl-4 text-right tabular-nums">
                            {((r.weight ?? 0) * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Data quality rules" />
                <CardBody className="pt-0">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {m.data_quality_rules.map((rule) => (
                      <li key={rule} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Missing data & outliers" />
                <CardBody className="space-y-3 pt-0 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Missing observations</p>
                    <p>{m.missing_data_rule}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Outliers</p>
                    <p>{m.outlier_rule}</p>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Data sources" />
              <CardBody className="pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {m.data_sources.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  {m.disclaimer}
                </p>
              </CardBody>
            </Card>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
