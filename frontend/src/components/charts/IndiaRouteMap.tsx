import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { ChartSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { LeadTimeChart } from "@/components/charts/LeadTimeChart";
import { useRouteDetail, useRouteHeatmap, useRoutes } from "@/hooks/queries";
import { CITIES, indiaOutlinePath, projectLatLng } from "@/lib/geo";
import {
  changeTone,
  formatCurrency,
  formatIndex,
  formatPercent,
} from "@/utils/format";

const W = 420;
const H = 460;

const TONE_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "rgb(var(--danger))", // rising airfare
  down: "rgb(var(--success))",
  flat: "rgb(var(--muted-foreground))",
};

export function IndiaRouteMap({
  metric = "change_7d",
}: {
  metric?: "change_7d" | "change_30d";
}) {
  const heatmap = useRouteHeatmap();
  const routes = useRoutes();
  const [selected, setSelected] = useState<string | null>(null);

  const outline = useMemo(() => indiaOutlinePath(W, H), []);
  const cityPts = useMemo(
    () =>
      Object.values(CITIES).map((c) => ({
        ...c,
        pt: projectLatLng(c.lat, c.lon, W, H),
      })),
    [],
  );

  return (
    <Card>
      <CardHeader
        title="India route map"
        description="City-pairs in the index basket, coloured by recent airfare change"
        action={
          <Link to="/routes" className="text-xs font-medium text-accent hover:underline">
            Route analysis
          </Link>
        }
      />
      <CardBody>
        <QueryBoundary
          query={heatmap}
          skeleton={<ChartSkeleton height={320} />}
          isEmpty={(d) => d.routes.length === 0}
          emptyState={<EmptyState title="No route data" />}
        >
          {(d) => {
            const byId = new Map(d.routes.map((r) => [r.route_id, r]));
            return (
              <div
                className={
                  selected
                    ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
                    : "grid gap-4"
                }
              >
                <div className="relative">
                  <svg
                    viewBox={`-10 -10 ${W + 20} ${H + 20}`}
                    className="h-auto w-full"
                    role="img"
                    aria-label="Map of India with basket routes"
                  >
                    <path
                      d={outline}
                      fill="rgb(var(--muted))"
                      fillOpacity={0.5}
                      stroke="rgb(var(--border))"
                      strokeWidth={1.5}
                    />
                    {d.routes.map((r) => {
                      const [o, dst] = r.route_id.split("-");
                      const a = CITIES[o];
                      const b = CITIES[dst];
                      if (!a || !b) return null;
                      const [x1, y1] = projectLatLng(a.lat, a.lon, W, H);
                      const [x2, y2] = projectLatLng(b.lat, b.lon, W, H);
                      const tone = changeTone(r[metric]);
                      const active = selected === r.route_id;
                      const toggle = () =>
                        setSelected((s) => (s === r.route_id ? null : r.route_id));
                      return (
                        <g
                          key={r.route_id}
                          onClick={toggle}
                          className="cursor-pointer"
                        >
                          <title>
                            {r.label} · index {formatIndex(r.current_index)} ·{" "}
                            {formatPercent(r[metric])}
                          </title>
                          {/* wide transparent hit target */}
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="transparent"
                            strokeWidth={14}
                          />
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={TONE_COLOR[tone]}
                            strokeWidth={active ? 4 : 2.25}
                            strokeOpacity={active || !selected ? 0.9 : 0.3}
                            strokeLinecap="round"
                            className="transition-[stroke-width,stroke-opacity] duration-150"
                          />
                        </g>
                      );
                    })}
                    {cityPts.map((c) => (
                      <g key={c.code} className="pointer-events-none">
                        <circle
                          cx={c.pt[0]}
                          cy={c.pt[1]}
                          r={4}
                          fill="rgb(var(--accent))"
                          stroke="rgb(var(--card))"
                          strokeWidth={1.5}
                        />
                        <text
                          x={c.pt[0] + 7}
                          y={c.pt[1] + 3}
                          className="fill-foreground text-[10px] font-semibold"
                        >
                          {c.code}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-4 rounded-full bg-success" /> Falling
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-4 rounded-full bg-danger" /> Rising
                    </span>
                    <span>airfare ({metric === "change_7d" ? "7d" : "30d"})</span>
                  </div>
                </div>

                <RouteDetailPanel
                  routeId={selected}
                  heatRow={selected ? byId.get(selected) : undefined}
                  routesQuery={routes}
                  onClear={() => setSelected(null)}
                />
              </div>
            );
          }}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}

function RouteDetailPanel({
  routeId,
  heatRow,
  routesQuery,
  onClear,
}: {
  routeId: string | null;
  heatRow: { current_index: number | null; change_7d: number | null } | undefined;
  routesQuery: ReturnType<typeof useRoutes>;
  onClear: () => void;
}) {
  const detail = useRouteDetail(routeId ?? undefined);

  if (!routeId) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
        Select a route on the map to see its index, fare, volatility and lead-time curve.
      </p>
    );
  }

  const stat = routesQuery.data?.routes.find((r) => r.route_id === routeId);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{detail.data?.label ?? routeId}</p>
          <p className="text-xs text-muted-foreground">Index basket route</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Index" value={formatIndex(heatRow?.current_index ?? stat?.current_index)} />
        <Stat label="Avg fare" value={formatCurrency(stat?.average_fare)} />
        <Stat
          label="7-day change"
          value={<ChangeIndicator value={heatRow?.change_7d ?? stat?.change_7d} size="xs" />}
        />
        <Stat
          label="Volatility"
          value={
            detail.data?.volatility
              ? `${detail.data.volatility.volatility_score.toFixed(0)} · ${detail.data.volatility.category}`
              : "—"
          }
        />
      </dl>

      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lead-time (avg fare)
        </p>
        <QueryBoundary
          query={detail}
          skeleton={<div className="h-40 animate-skeleton-pulse rounded bg-muted" />}
        >
          {(d) => <LeadTimeChart windows={d.lead_time.windows} height={160} />}
        </QueryBoundary>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
