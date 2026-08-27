import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Clock,
  Brain,
  LineChart as LineChartIcon,
  PartyPopper,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { buttonClasses } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { CardSkeleton, ChartSkeleton } from "@/components/common/Skeleton";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { IndexMetricCard } from "@/components/dashboard/IndexMetricCard";
import { WhyChangedCard } from "@/components/dashboard/WhyChangedCard";
import { IndexTrendChart } from "@/components/charts/IndexTrendChart";
import { IndiaRouteMap } from "@/components/charts/IndiaRouteMap";
import { LeadTimeChart } from "@/components/charts/LeadTimeChart";
import { RouteHeatmap } from "@/components/charts/RouteHeatmap";
import { Sparkline } from "@/components/charts/Sparkline";
import {
  useFareSpikes,
  useIndexHistory,
  useLeadTime,
  useOverview,
  useRouteHeatmap,
  useRoutes,
  useVolatility,
} from "@/hooks/queries";
import {
  formatCurrency,
  formatDate,
  formatIndex,
  formatNumber,
  formatPercent,
  formatTime,
} from "@/utils/format";
import type { Frequency } from "@/types/models";

export default function Dashboard() {
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const overview = useOverview();
  const history = useIndexHistory(frequency);
  const heatmap = useRouteHeatmap();
  const routes = useRoutes();
  const leadTime = useLeadTime();
  const volatility = useVolatility(14);
  const spikes = useFareSpikes({ window_days: 7 });

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
              <Link to="/index" className={buttonClasses({ variant: "accent" })}>
                View Analytics <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/airfares" className={buttonClasses({ variant: "secondary" })}>
                Explore Data
              </Link>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-border bg-muted/40 p-4 text-sm lg:w-72">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Data collection
            </p>
            {overview.data ? (
              <>
                <div className="mt-2.5">
                  <StatusIndicator
                    status={overview.data.observations > 0 ? "healthy" : "partial"}
                    label={
                      overview.data.observations > 0
                        ? "Pipeline healthy"
                        : "Awaiting first collection"
                    }
                  />
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Source</dt>
                    <dd className="font-medium capitalize text-foreground">
                      {overview.data.source ?? "—"}
                      {overview.data.is_synthetic &&
                        overview.data.source !== "synthetic" && (
                          <span className="ml-1 text-warning">(synthetic)</span>
                        )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Last updated</dt>
                    <dd className="font-medium text-foreground">
                      {formatDate(overview.data.last_updated)}{" "}
                      {formatTime(overview.data.last_updated)}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="mt-2.5 h-16 animate-skeleton-pulse rounded-md bg-muted" />
            )}
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <QueryBoundary
        query={overview}
        skeleton={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        }
        isEmpty={(d) => !d.index}
        emptyState={
          <EmptyState
            icon={LineChartIcon}
            title="No index computed yet"
            description="Seed the database or run a collection to populate the dashboard."
          />
        }
      >
        {(d) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Airfare Price Index"
              icon={LineChartIcon}
              value={formatIndex(d.index?.index_value)}
              change={d.index?.change_1d ?? null}
            />
            <MetricCard
              label="Daily Change"
              icon={Activity}
              value={formatPercent(d.index?.change_1d)}
              caption="vs previous day"
            />
            <MetricCard
              label="Routes Tracked"
              icon={BarChart3}
              value={formatNumber(d.routes_tracked)}
              caption="in the index basket"
            />
            <MetricCard
              label="Airlines Covered"
              icon={Building2}
              value={formatNumber(d.airlines_covered)}
              caption="major carriers"
            />
            <MetricCard
              label="Observations"
              icon={Plane}
              value={formatNumber(d.observations)}
              caption="cleaned & stored"
            />
            <MetricCard
              label="Data Quality"
              icon={ShieldCheck}
              value={d.data_quality_pct != null ? `${d.data_quality_pct}%` : "—"}
              caption="valid share"
              positiveIsGood
            />
          </div>
        )}
      </QueryBoundary>

      {/* Trend + index summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Airfare Price Index Trend"
            description="Index level over time (base period = 100)"
            action={
              <SegmentedControl
                size="sm"
                value={frequency}
                onChange={setFrequency}
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
              />
            }
          />
          <CardBody>
            <QueryBoundary
              query={history}
              skeleton={<ChartSkeleton height={300} />}
              isEmpty={(d) => d.points.length === 0}
              emptyState={
                <EmptyState title="No index history" description="Run a collection to build the series." />
              }
            >
              {(d) => <IndexTrendChart points={d.points} />}
            </QueryBoundary>
          </CardBody>
        </Card>

        <QueryBoundary
          query={overview}
          skeleton={<CardSkeleton />}
          isEmpty={(d) => !d.index}
          emptyState={<Card className="p-5"><EmptyState title="No index yet" /></Card>}
        >
          {(d) => (d.index ? <IndexMetricCard index={d.index} /> : <span />)}
        </QueryBoundary>
      </div>

      {/* Why did the index change? */}
      <WhyChangedCard />

      {/* Interactive India route map */}
      <IndiaRouteMap />

      {/* Route performance + lead time */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Route Performance"
            description="7-day airfare change by route"
            action={
              <Link to="/routes" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <CardBody>
            <QueryBoundary
              query={heatmap}
              skeleton={<ChartSkeleton height={280} />}
              isEmpty={(d) => d.routes.length === 0}
              emptyState={<EmptyState title="No route data" />}
            >
              {(d) => <RouteHeatmap rows={d.routes} metric="change_7d" />}
            </QueryBoundary>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Lead-time Analysis"
            description="Average fare by advance-purchase window (all routes)"
            action={
              <Link to="/lead-time" className="text-xs font-medium text-accent hover:underline">
                Details
              </Link>
            }
          />
          <CardBody>
            <QueryBoundary
              query={leadTime}
              skeleton={<ChartSkeleton height={280} />}
              isEmpty={(d) => d.windows.every((w) => !w.average_fare)}
              emptyState={<EmptyState title="No lead-time data" />}
            >
              {(d) => <LeadTimeChart windows={d.windows} height={280} />}
            </QueryBoundary>
          </CardBody>
        </Card>
      </div>

      {/* Volatility + fare-spike alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Most volatile routes"
            description="14-day fare-swing score (experimental)"
            action={
              <Link to="/volatility" className="text-xs font-medium text-accent hover:underline">
                All routes
              </Link>
            }
          />
          <CardBody className="pt-0">
            <QueryBoundary
              query={volatility}
              skeleton={<div className="space-y-2 py-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 animate-skeleton-pulse rounded bg-muted" />)}</div>}
              isEmpty={(d) => d.routes.length === 0}
              emptyState={<EmptyState title="No volatility data" />}
            >
              {(d) => (
                <div className="divide-y divide-border">
                  {d.routes.slice(0, 4).map((r) => (
                    <div key={r.route_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="font-medium">{r.label}</span>
                      <span className="flex items-center gap-3">
                        <Badge
                          tone={
                            r.category === "Very High"
                              ? "danger"
                              : r.category === "High"
                                ? "warning"
                                : r.category === "Low"
                                  ? "success"
                                  : "neutral"
                          }
                        >
                          {r.category}
                        </Badge>
                        <span className="w-8 text-right font-semibold tabular-nums">
                          {r.volatility_score.toFixed(0)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </QueryBoundary>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Fare spike alerts"
            description="Average fare rises vs the preceding week"
            action={
              <Link to="/alerts" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <CardBody className="pt-0">
            <QueryBoundary
              query={spikes}
              skeleton={<div className="space-y-2 py-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-skeleton-pulse rounded bg-muted" />)}</div>}
              isEmpty={(d) => !d.available}
              emptyState={<EmptyState title="No index history" />}
            >
              {(d) => {
                const top = d.alerts.filter((a) => a.severity !== "Normal").slice(0, 4);
                return top.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No fare spikes this week — average fares are stable.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {top.map((a, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span>
                          <span className="font-medium">{a.route_label}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">{a.advance_window}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <Badge tone={a.severity === "Critical Increase" ? "danger" : "warning"}>
                            {a.severity.replace(" Increase", "")}
                          </Badge>
                          <span className="w-14 text-right font-semibold tabular-nums text-danger">
                            +{a.pct_change.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            </QueryBoundary>
          </CardBody>
        </Card>
      </div>

      {/* AI assistant CTA */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">AIRINDEX Assistant</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ask why the index moved, which route is most volatile, or how a
                city-pair is trending — answered from the computed data.
              </p>
            </div>
          </div>
          <Link to="/assistant" className={buttonClasses({ variant: "accent" })}>
            Open assistant <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      {/* Prediction + festival entry points */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[
          {
            to: "/predictions",
            icon: Brain,
            title: "Fare Prediction",
            desc: "ML fare-range estimate for a future trip (synthetic-trained, experimental).",
          },
          {
            to: "/festivals",
            icon: PartyPopper,
            title: "Festival Analysis",
            desc: "Observed fare movement during Indian holiday and festival travel windows.",
          },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{c.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Route table preview */}
      <Card>
        <CardHeader
          title="Routes in the basket"
          description="Weighted city-pairs driving the composite index"
          action={
            <Link to="/routes" className="text-xs font-medium text-accent hover:underline">
              Route analysis
            </Link>
          }
        />
        <CardBody className="pt-0">
          <QueryBoundary
            query={routes}
            skeleton={<div className="space-y-2 py-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-skeleton-pulse rounded bg-muted" />)}</div>}
            isEmpty={(d) => d.routes.length === 0}
            emptyState={<EmptyState title="No routes configured" />}
          >
            {(d) => (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 text-left font-semibold">Route</th>
                      <th className="px-4 text-right font-semibold">Avg fare</th>
                      <th className="px-4 text-right font-semibold">Index</th>
                      <th className="px-4 text-right font-semibold">7-day</th>
                      <th className="px-4 text-right font-semibold">Obs.</th>
                      <th className="pl-4 text-right font-semibold">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.routes.map((r) => (
                      <tr key={r.route_id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-4">
                          <Link
                            to={`/routes?route=${r.route_id}`}
                            className="font-medium text-foreground hover:text-accent"
                          >
                            {r.label}
                          </Link>
                        </td>
                        <td className="px-4 text-right tabular-nums">{formatCurrency(r.average_fare)}</td>
                        <td className="px-4 text-right tabular-nums">{formatIndex(r.current_index)}</td>
                        <td className="px-4 text-right"><ChangeIndicator value={r.change_7d} size="xs" /></td>
                        <td className="px-4 text-right tabular-nums text-muted-foreground">{formatNumber(r.observation_count)}</td>
                        <td className="pl-4">
                          <div className="flex justify-end">
                            <Sparkline data={r.sparkline} width={72} height={22} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        </CardBody>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Experimental prototype index — not an official CPI methodology or an NSO/RBI system.
      </p>
    </div>
  );
}
