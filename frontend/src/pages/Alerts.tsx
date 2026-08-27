import { useState } from "react";
import { BellRing, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Select } from "@/components/common/Select";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useFareSpikes, useRoutes } from "@/hooks/queries";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import type { SpikeSeverity } from "@/types/models";

const SEV_TONE: Record<SpikeSeverity, "neutral" | "warning" | "danger"> = {
  Normal: "neutral",
  "Moderate Increase": "warning",
  "High Increase": "warning",
  "Critical Increase": "danger",
};
const SEV_BORDER: Record<SpikeSeverity, string> = {
  Normal: "border-border",
  "Moderate Increase": "border-warning/40",
  "High Increase": "border-warning/60",
  "Critical Increase": "border-danger/60",
};

export default function Alerts() {
  const [windowDays, setWindowDays] = useState(7);
  const [route, setRoute] = useState("");
  const [severity, setSeverity] = useState("");
  const routes = useRoutes();
  const spikes = useFareSpikes({
    window_days: windowDays,
    route_id: route || undefined,
    severity: severity || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fare Spike Alerts"
        description="Routes and booking windows where the average fare rose meaningfully versus the preceding period."
        actions={
          <SegmentedControl
            size="sm"
            value={String(windowDays)}
            onChange={(v) => setWindowDays(Number(v))}
            options={[
              { value: "3", label: "3D" },
              { value: "7", label: "7D" },
              { value: "14", label: "14D" },
            ]}
          />
        }
      />

      <QueryBoundary
        query={spikes}
        skeleton={<CardSkeleton />}
        isEmpty={(d) => !d.available}
        emptyState={
          <EmptyState
            icon={BellRing}
            title="No index history yet"
            description="Seed the database or run a collection first."
          />
        }
      >
        {(d) => {
          const visible = d.alerts.filter((a) => a.severity !== "Normal");
          const filtered = severity
            ? d.alerts.filter((a) => a.severity === severity)
            : visible;
          return (
            <>
              <Card>
                <CardHeader
                  title="Detection window"
                  description={`Current ${d.current_period.from} → ${d.current_period.to} vs baseline ${d.baseline_period.from} → ${d.baseline_period.to}`}
                />
                <CardBody className="flex flex-wrap items-center gap-2 pt-0">
                  {(["Moderate Increase", "High Increase", "Critical Increase"] as SpikeSeverity[]).map(
                    (s) => (
                      <Badge key={s} tone={SEV_TONE[s]}>
                        {s}: {d.summary[s] ?? 0}
                      </Badge>
                    ),
                  )}
                  <span className="text-xs text-muted-foreground">
                    thresholds +{d.thresholds.moderate}% / +{d.thresholds.high}% / +
                    {d.thresholds.critical}%
                  </span>
                </CardBody>
              </Card>

              <div className="flex flex-wrap gap-3">
                <div className="w-52">
                  <Select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    options={[
                      { value: "", label: "All routes" },
                      ...(routes.data?.routes.map((r) => ({
                        value: r.route_id,
                        label: r.label,
                      })) ?? []),
                    ]}
                  />
                </div>
                <div className="w-52">
                  <Select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    options={[
                      { value: "", label: "All increases" },
                      { value: "Moderate Increase", label: "Moderate" },
                      { value: "High Increase", label: "High" },
                      { value: "Critical Increase", label: "Critical" },
                    ]}
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={TriangleAlert}
                  title="No fare spikes in this window"
                  description="Average fares are stable versus the preceding period for the current filters."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((a, i) => (
                    <div
                      key={`${a.route_id}-${a.advance_window}-${a.airline ?? ""}-${i}`}
                      className={`rounded-xl border bg-card p-4 ${SEV_BORDER[a.severity]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{a.route_label}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.advance_window}
                            {a.airline ? ` · ${a.airline}` : ""}
                          </p>
                        </div>
                        <Badge tone={SEV_TONE[a.severity]}>{a.severity}</Badge>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            {formatCurrency(a.baseline_avg_fare)}
                          </span>{" "}
                          →{" "}
                          <span className="font-semibold">
                            {formatCurrency(a.current_avg_fare)}
                          </span>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-danger">
                          +{a.pct_change.toFixed(1)}%
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {a.current_observations} vs {a.baseline_observations} obs · detected{" "}
                        {formatDate(a.detected_at)} {formatTime(a.detected_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">{d.note}</p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
