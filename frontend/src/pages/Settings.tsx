import { useEffect, useMemo, useState } from "react";
import { Check, Monitor, Moon, RotateCcw, Save, Sun } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { cn } from "@/lib/cn";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  useCollectionStatus,
  useConfig,
  useUpdateIndexConfig,
  useUpdateWeights,
} from "@/hooks/queries";
import { formatDate, formatTime } from "@/utils/format";

const TABS = ["Profile", "Appearance", "Index Configuration", "Routes", "Collection"] as const;
type Tab = (typeof TABS)[number];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("Appearance");
  const { mode, setMode } = useTheme();
  const { user } = useAuth();
  const config = useConfig();
  const collection = useCollectionStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace preferences and prototype configuration."
      />

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && (
        <Card>
          <CardHeader title="Profile" description="Your AIRINDEX account." />
          <CardBody className="space-y-3">
            <Field label="Name" value={user?.name ?? "—"} />
            <Field label="Email" value={user?.email ?? "—"} />
            <Field label="Role" value={user?.role ?? "—"} />
          </CardBody>
        </Card>
      )}

      {tab === "Appearance" && (
        <Card>
          <CardHeader
            title="Appearance"
            description="Choose how AIRINDEX looks. Your choice is saved on this device."
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 text-left transition-colors",
                    mode === opt.value ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-2.5 text-sm font-medium">
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </span>
                  {mode === opt.value && <Check className="h-4 w-4 text-accent" />}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "Index Configuration" && <IndexConfigTab config={config} />}
      {tab === "Routes" && <RouteWeightsTab config={config} />}

      {tab === "Collection" && (
        <Card>
          <CardHeader title="Collection" description="Scheduled data acquisition status." />
          <CardBody className="space-y-3">
            {collection.data?.latest_run ? (
              <>
                <Field label="Last source" value={collection.data.latest_run.source} />
                <div className="flex items-center justify-between border-b border-border py-2">
                  <span className="text-sm text-muted-foreground">Last status</span>
                  <StatusIndicator
                    status={
                      collection.data.latest_run.status === "success"
                        ? "healthy"
                        : collection.data.latest_run.status === "partial"
                          ? "partial"
                          : "failed"
                    }
                  />
                </div>
                <Field
                  label="Last completed"
                  value={`${formatDate(collection.data.latest_run.completed_at)} ${formatTime(
                    collection.data.latest_run.completed_at,
                  )}`}
                />
                <Field
                  label="Records stored"
                  value={String(collection.data.latest_run.records_stored)}
                />
              </>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">No collection runs recorded yet.</p>
            )}
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              The scheduler is controlled by <code>COLLECTION_ENABLED</code> /
              <code>COLLECTION_INTERVAL_MINUTES</code> in <code>backend/.env</code>. Run a
              collection now from the Data Sources page. API secrets are never shown here.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

type ConfigQuery = ReturnType<typeof useConfig>;

function IndexConfigTab({ config }: { config: ConfigQuery }) {
  const update = useUpdateIndexConfig();
  const [basePeriod, setBasePeriod] = useState("");
  const [version, setVersion] = useState("");
  const [method, setMethod] = useState("mad");

  useEffect(() => {
    if (config.data) {
      setBasePeriod(config.data.base_period);
      setVersion(config.data.methodology_version);
      setMethod(config.data.outlier_method);
    }
  }, [config.data]);

  if (!config.data) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading configuration…</Card>;
  }

  const d = config.data;
  const dirty =
    basePeriod !== d.base_period ||
    version !== d.methodology_version ||
    method !== d.outlier_method;

  return (
    <Card>
      <CardHeader
        title="Index configuration"
        description="Parameters behind the current index. Saving recomputes the whole series."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Base period (index = 100)"
            type="date"
            value={basePeriod}
            onChange={(e) => setBasePeriod(e.target.value)}
          />
          <Input
            label="Methodology version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <Select
            label="Outlier detection method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            options={d.outlier_methods.map((m) => ({
              value: m,
              label: m === "mad" ? "Modified z-score (median + MAD)" : "IQR / Tukey fence",
            }))}
          />
          <Field
            label="Advance windows"
            value={d.advance_windows.map((w) => `T+${w}`).join(", ")}
          />
        </div>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          The outlier method applies to the <strong>next</strong> collection run; base period
          and version take effect immediately on save.
        </p>
        {update.isError && (
          <p className="text-xs text-danger">{(update.error as Error).message}</p>
        )}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            loading={update.isPending}
            disabled={!dirty}
            onClick={() =>
              update.mutate({
                base_period: basePeriod,
                methodology_version: version,
                outlier_method: method,
              })
            }
          >
            <Save className="h-4 w-4" /> Save
          </Button>
          {update.isSuccess && !dirty && (
            <span className="text-xs text-success">Saved · index recomputed</span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function RouteWeightsTab({ config }: { config: ConfigQuery }) {
  const update = useUpdateWeights();
  const [weights, setWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    if (config.data) setWeights({ ...config.data.weights_raw });
  }, [config.data]);

  const sum = useMemo(
    () => Object.values(weights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [weights],
  );
  const normalized = (rid: string) => (sum > 0 ? (weights[rid] ?? 0) / sum : 0);

  if (!config.data) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading configuration…</Card>;
  }

  const d = config.data;
  const dirty = d.routes.some(
    (r) => (weights[r.route_id] ?? 0) !== (d.weights_raw[r.route_id] ?? 0),
  );
  const invalid = sum <= 0 || Object.values(weights).some((v) => v < 0 || !Number.isFinite(v));

  return (
    <Card>
      <CardHeader
        title="Route basket weights"
        description="Relative weights are renormalized to sum to 1.0. Saving recomputes the index."
      />
      <CardBody className="space-y-1 pt-0">
        <div className="divide-y divide-border">
          {d.routes.map((r) => (
            <div key={r.route_id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{r.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.origin_city} – {r.destination_city}
                </span>
              </span>
              <div className="flex items-center gap-3">
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {(normalized(r.route_id) * 100).toFixed(1)}%
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={weights[r.route_id] ?? 0}
                  onChange={(e) =>
                    setWeights((w) => ({
                      ...w,
                      [r.route_id]: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="h-9 w-24 rounded-lg border border-input bg-card px-2 text-right text-sm tabular-nums focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 text-sm">
          <span className="text-muted-foreground">Raw sum</span>
          <Badge tone={invalid ? "danger" : "accent"}>{sum.toFixed(2)} → normalized 1.00</Badge>
        </div>

        {update.isError && (
          <p className="text-xs text-danger">{(update.error as Error).message}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            size="sm"
            loading={update.isPending}
            disabled={!dirty || invalid}
            onClick={() => update.mutate(weights)}
          >
            <Save className="h-4 w-4" /> Save weights
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!dirty}
            onClick={() => setWeights({ ...d.weights_raw })}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          {update.isSuccess && !dirty && (
            <span className="text-xs text-success">Saved · index recomputed</span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
