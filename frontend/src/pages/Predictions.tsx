import { useState } from "react";
import { AlertTriangle, Brain, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFarePrediction, useModelInfo, useRoutes } from "@/hooks/queries";
import { formatCurrency, formatDate } from "@/utils/format";

const AIRLINES = ["6E", "AI", "UK", "SG", "QP"];
const FARE_TYPES = ["standard", "saver", "flexi"];
const WINDOWS = [1, 7, 15, 30, 45];

export default function Predictions() {
  const routes = useRoutes();
  const model = useModelInfo();
  const [form, setForm] = useState({
    route_id: "",
    airline: "6E",
    advance_days: 15,
    fare_type: "standard",
  });
  const [submitted, setSubmitted] = useState<typeof form | null>(null);
  const prediction = useFarePrediction(submitted ?? { route_id: "" }, !!submitted);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fare Prediction"
        description="A machine-learning estimate of the likely fare range for a future trip."
      />

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Trained on synthetic demonstration data.</strong> Predictions are
          illustrative only — not purchasing advice — and are never used in the
          AIRINDEX calculation.
        </span>
      </div>

      <QueryBoundary
        query={model}
        skeleton={<CardSkeleton />}
        isEmpty={(d) => !d.available}
        emptyState={
          <EmptyState
            icon={Brain}
            title="No model trained yet"
            description="Run `python -m app.ml.train` once the database has enough valid observations."
          />
        }
      >
        {(m) => (
          <>
            <Card>
              <CardHeader
                title="Predict a fare range"
                description={`Model ${m.version} · ${m.algorithm}`}
              />
              <CardBody>
                <form
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (form.route_id) setSubmitted({ ...form });
                  }}
                >
                  <Select
                    label="Route"
                    placeholder="Choose a route"
                    value={form.route_id}
                    onChange={(e) => setForm((f) => ({ ...f, route_id: e.target.value }))}
                    options={
                      routes.data?.routes.map((r) => ({ value: r.route_id, label: r.label })) ?? []
                    }
                  />
                  <Select
                    label="Airline"
                    value={form.airline}
                    onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                    options={AIRLINES.map((a) => ({ value: a, label: a }))}
                  />
                  <Select
                    label="Advance days"
                    value={String(form.advance_days)}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, advance_days: Number(e.target.value) }))
                    }
                    options={WINDOWS.map((w) => ({ value: String(w), label: `T+${w}` }))}
                  />
                  <Select
                    label="Fare type"
                    value={form.fare_type}
                    onChange={(e) => setForm((f) => ({ ...f, fare_type: e.target.value }))}
                    options={FARE_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                  <Button type="submit" disabled={!form.route_id} className="lg:w-full">
                    Predict
                  </Button>
                </form>
              </CardBody>
            </Card>

            {submitted && (
              <QueryBoundary
                query={prediction}
                skeleton={<CardSkeleton />}
                isEmpty={(d) => !d.available}
                emptyState={
                  <Card className="p-6 text-sm text-muted-foreground">
                    {prediction.data?.reason ?? "No prediction available for this input."}
                  </Card>
                }
              >
                {(p) => (
                  <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="p-6 lg:col-span-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <TrendingUp className="h-4 w-4" /> Predicted fare range · {p.interval}
                      </div>
                      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-3xl font-bold tabular-nums">
                          {formatCurrency(p.predicted_lower_inr)}
                        </span>
                        <span className="text-xl text-muted-foreground">–</span>
                        <span className="text-3xl font-bold tabular-nums">
                          {formatCurrency(p.predicted_upper_inr)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Central estimate {formatCurrency(p.predicted_point_inr)} · horizon{" "}
                        {p.prediction_horizon_days} days · travel {formatDate(p.travel_date)}
                      </p>
                      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                        {p.disclaimer}
                      </p>
                    </Card>

                    <Card className="p-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Model
                      </p>
                      <dl className="mt-3 space-y-1.5 text-sm">
                        <Row label="Version" value={p.model_version ?? "—"} />
                        <Row label="MAE" value={formatCurrency(m.metrics?.mae)} />
                        <Row label="RMSE" value={formatCurrency(m.metrics?.rmse)} />
                        <Row
                          label="Interval coverage"
                          value={`${m.metrics?.interval_coverage_pct ?? "—"}%`}
                        />
                        <Row label="Train / test rows" value={`${m.n_train} / ${m.n_test}`} />
                      </dl>
                      <Badge tone="warning" className="mt-3">
                        {m.data_basis}
                      </Badge>
                    </Card>
                  </div>
                )}
              </QueryBoundary>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
