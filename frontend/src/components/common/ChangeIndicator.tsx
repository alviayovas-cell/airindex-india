import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { changeTone, formatPercent } from "@/utils/format";

/**
 * A signed percentage with a directional arrow.
 * For airfares a rise is shown in red (costlier) and a fall in green, unless
 * `positiveIsGood` is set.
 */
export function ChangeIndicator({
  value,
  positiveIsGood = false,
  size = "sm",
  suffix,
  className,
}: {
  value: number | null | undefined;
  positiveIsGood?: boolean;
  size?: "xs" | "sm" | "md";
  suffix?: string;
  className?: string;
}) {
  const tone = changeTone(value);
  const color =
    tone === "flat"
      ? "text-muted-foreground"
      : (tone === "up") === positiveIsGood
        ? "text-success"
        : "text-danger";
  const Icon = tone === "flat" ? Minus : tone === "up" ? ArrowUpRight : ArrowDownRight;
  const text = { xs: "text-[11px]", sm: "text-xs", md: "text-sm" }[size];
  const icon = { xs: "h-3 w-3", sm: "h-3.5 w-3.5", md: "h-4 w-4" }[size];

  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", color, text, className)}>
      <Icon className={icon} />
      {formatPercent(value)}
      {suffix && <span className="ml-1 font-normal text-muted-foreground">{suffix}</span>}
    </span>
  );
}
