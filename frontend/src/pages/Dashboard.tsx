import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Building2,
  Database,
  Gauge,
  LineChart,
  Plane,
  ShieldCheck,
} from "lucide-react";
import { fetchHealth } from "@/api/meta";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatTime } from "@/utils/format";

const KPIS = [
  { label: "Airfare Price Index", icon: LineChart },
  { label: "Daily Change", icon: Activity },
  { label: "Routes Tracked", icon: BarChart3 },
  { label: "Airlines Covered", icon: Building2 },
  { label: "Observations", icon: Plane },
  { label: "Data Quality", icon: ShieldCheck },
] as const;

export default function Dashboard() {
  const { data: health, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
  });

  const dbOk = health?.database_connected;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="accent">Experimental Prototype Index</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Airfare Price Intelligence for India
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Track, analyze and visualize airfare trends across India&apos;s major
              routes using high-frequency flight data and transparent statistical
              analytics.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="accent">View Analytics</Button>
              <Button variant="secondary">Explore Data</Button>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-border bg-muted/40 p-4 text-sm lg:w-64">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              System status
            </p>
            <div className="mt-2.5 space-y-2">
              <StatusIndicator
                status={dbOk ? "healthy" : "failed"}
                label={dbOk ? "Database connected" : "Database offline"}
              />
              <StatusIndicator
                status={health?.amadeus_configured ? "healthy" : "partial"}
                label={
                  health?.amadeus_configured
                    ? "Amadeus API configured"
                    : "Running on seed data"
                }
              />
            </div>
            <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
              Last checked {formatTime(health?.time)}
            </p>
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            icon={kpi.icon}
            value="—"
            caption="Awaiting index data"
            loading={isLoading}
          />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Airfare Price Index Trend"
            description="Daily · weekly · monthly index movement"
          />
          <CardBody>
            <EmptyState
              icon={LineChart}
              title="Index engine not yet wired"
              description="The index calculation engine and its API endpoints are scheduled for the next build checkpoint. Seed the database to preview route reference data."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Current Index Summary" />
          <CardBody>
            <EmptyState
              icon={Gauge}
              title="No index computed"
              description="Once flight observations are collected and cleaned, the weighted index will appear here with its base period."
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Data pipeline"
          description="FLIGHT DATA → CLEAN DATA → STANDARDIZED DATA → WEIGHTED INDEX → ANALYTICS → API"
          action={<Badge tone={dbOk ? "success" : "warning"}>
            <Database className="h-3 w-3" />
            {dbOk ? "MongoDB ready" : "MongoDB offline"}
          </Badge>}
        />
        <CardBody>
          <p className="text-sm text-muted-foreground">
            Checkpoint A complete: application shell, design system, authentication
            and database connectivity. Upcoming checkpoints add the Amadeus
            collector, cleaning pipeline, index engine, and the full analytics
            dashboard.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
