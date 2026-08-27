import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/utils/format";
import type { HeatmapRow } from "@/types/models";

/** Map a % change to a background tint. Rising airfare = warm, falling = cool. */
function tint(change: number | null, max: number): string {
  if (change == null) return "bg-muted";
  const intensity = Math.min(Math.abs(change) / (max || 1), 1);
  const step = intensity < 0.25 ? 1 : intensity < 0.6 ? 2 : 3;
  if (Math.abs(change) < 0.1) return "bg-muted";
  if (change > 0)
    return { 1: "bg-danger/10", 2: "bg-danger/20", 3: "bg-danger/30" }[step]!;
  return { 1: "bg-success/10", 2: "bg-success/20", 3: "bg-success/30" }[step]!;
}

export function RouteHeatmap({
  rows,
  metric = "change_7d",
  onSelect,
}: {
  rows: HeatmapRow[];
  metric?: "change_7d" | "change_30d";
  onSelect?: (routeId: string) => void;
}) {
  const max = Math.max(
    ...rows.map((r) => Math.abs(r[metric] ?? 0)),
    1,
  );

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const change = r[metric];
        const tone =
          change == null || Math.abs(change) < 0.1
            ? "flat"
            : change > 0
              ? "up"
              : "down";
        const Icon = tone === "flat" ? Minus : tone === "up" ? ArrowUpRight : ArrowDownRight;
        return (
          <button
            key={r.route_id}
            onClick={onSelect ? () => onSelect(r.route_id) : undefined}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
              tint(change, max),
              onSelect && "hover:ring-1 hover:ring-border",
            )}
          >
            <span className="font-medium text-foreground">{r.label}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold tabular-nums",
                tone === "flat"
                  ? "text-muted-foreground"
                  : tone === "up"
                    ? "text-danger"
                    : "text-success",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {formatPercent(change)}
            </span>
          </button>
        );
      })}
      <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-success/40" /> Falling
        </span>
        <span>Airfare change ({metric === "change_7d" ? "7 days" : "30 days"})</span>
        <span className="flex items-center gap-1">
          Rising <span className="h-2 w-2 rounded-sm bg-danger/40" />
        </span>
      </div>
    </div>
  );
}
