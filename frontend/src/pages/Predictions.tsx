import { useState } from "react";
import { Brain, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFarePrediction, useModelInfo, useRoutes } from "@/hooks/queries";
import { formatCurrency, formatDate, formatNumber } from "@/utils/format";

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

      <QueryBoundary
        query={model}
        skeleton={<CardSkeleton />}
        isEmpty={(d) => !d.available}
        emptyState={
          <EmptyState
            icon={Brain}
            title="Prediction unavailable"
            description={
              model.data?.reason ??
              "Prediction unavailable until sufficient historical observations are collected."
            }
          />
        }
      >
        {(m) => (
          <>
            <Card>
              <CardHeader
                title="Predict a fare range"
                description={m.basis_label}
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
                  <Card className="p-6">
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
                      Central estimate {formatCurrency(p.predicted_point_inr)}
                    </p>

                    <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Meta label="Prediction horizon" value={`T+${p.prediction_horizon_days}`} />
                      <Meta label="Travel date" value={formatDate(p.travel_date)} />
                      <Meta label="Model" value={p.model_label ?? "—"} />
                      <Meta
                        label="Training observations"
                        value={formatNumber(p.training_observations)}
                      />
                    </dl>

                    <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                      {p.note}
                    </p>
                  </Card>
                )}
              </QueryBoundary>
            )}

            <Card>
              <CardHeader title="Model information" />
              <CardBody className="pt-0">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Meta label="Model" value={m.algorithm_label ?? m.algorithm ?? "—"} />
                  <Meta label="Version" value={m.version ?? "—"} />
                  <Meta label="Last trained" value={formatDate(m.trained_at)} />
                  <Meta
                    label="Training observations"
                    value={formatNumber(m.n_observations)}
                  />
                  <Meta
                    label="Training period"
                    value={
                      m.training_period
                        ? `${formatDate(m.training_period.from)} → ${formatDate(m.training_period.to)}`
                        : "—"
                    }
                  />
                  <Meta
                    label="Evaluation"
                    value={
                      m.metrics
                        ? `MAE ${formatCurrency(m.metrics.mae)} · ${m.metrics.interval_coverage_pct}% interval coverage`
                        : "—"
                    }
                  />
                </dl>
                {m.basis_label && (
                  <p className="mt-4 text-xs text-muted-foreground">{m.basis_label}</p>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
