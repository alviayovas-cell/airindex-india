import { useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/cn";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";

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
              tab === t
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
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
                    mode === opt.value
                      ? "border-accent bg-accent/5"
                      : "border-border hover:bg-muted/50",
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

      {(tab === "Index Configuration" || tab === "Routes" || tab === "Collection") && (
        <EmptyState
          title={`${tab} settings arrive in a later checkpoint`}
          description="Index weights, route basket and collection schedule become editable once the index engine and scheduler are wired up. API secrets are never displayed here."
        />
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
