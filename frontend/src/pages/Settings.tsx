import { useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { cn } from "@/lib/cn";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";
import { useCollectionStatus, useMethodology } from "@/hooks/queries";
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
  const methodology = useMethodology();
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

      {tab === "Index Configuration" && (
        <Card>
          <CardHeader
            title="Index configuration"
            description="The frozen parameters behind the current index (edit via app_config / seed)."
          />
          <CardBody className="space-y-3">
            <Field label="Methodology version" value={methodology.data?.methodology_version ?? "—"} />
            <Field label="Base period" value={formatDate(methodology.data?.base_period)} />
            <Field
              label="Advance windows"
              value={
                methodology.data?.advance_windows.map((w) => `T+${w}`).join(", ") ?? "—"
              }
            />
            <Field
              label="Weights sum"
              value={methodology.data ? methodology.data.weights_sum.toFixed(2) : "—"}
            />
          </CardBody>
        </Card>
      )}

      {tab === "Routes" && (
        <Card>
          <CardHeader title="Route basket" description="City-pairs and weights in the index." />
          <CardBody className="pt-0">
            <div className="divide-y divide-border">
              {(methodology.data?.route_basket ?? []).map((r) => (
                <div key={r.route_id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.origin_city} – {r.destination_city}
                    </span>
                  </span>
                  <Badge>{((r.weight ?? 0) * 100).toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
