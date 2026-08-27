import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/common/Card";
import { Skeleton } from "@/components/common/Skeleton";
import { changeTone, formatPercent } from "@/utils/format";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Percentage change vs previous period. */
  change?: number | null;
  /** Optional caption under the value (overrides the change row when no change given). */
  caption?: string;
  /** Treat an increase as good (green). For airfare prices, false is usual. */
  positiveIsGood?: boolean;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  caption,
  positiveIsGood = false,
  loading,
}: MetricCardProps) {
  const tone = changeTone(change);
  const toneColor =
    tone === "flat"
      ? "text-muted-foreground"
      : (tone === "up") === positiveIsGood
        ? "text-success"
        : "text-danger";
  const ToneIcon =
    tone === "flat" ? Minus : tone === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card hoverable className="p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />}
      </div>

      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-28" />
          <Skeleton className="mt-2.5 h-3 w-20" />
        </>
      ) : (
        <>
          <p className="mt-2 text-[30px] font-bold leading-none tracking-tight text-foreground">
            {value}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
            {change != null ? (
              <>
                <span className={cn("inline-flex items-center gap-0.5 font-medium", toneColor)}>
                  <ToneIcon className="h-3.5 w-3.5" />
                  {formatPercent(change)}
                </span>
                <span className="text-muted-foreground">from previous period</span>
              </>
            ) : (
              <span className="text-muted-foreground">{caption ?? "—"}</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
