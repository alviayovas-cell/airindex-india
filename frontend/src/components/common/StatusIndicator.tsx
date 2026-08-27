import { cn } from "@/lib/cn";

export type HealthStatus = "healthy" | "partial" | "failed" | "unknown";

const config: Record<HealthStatus, { dot: string; label: string; text: string }> = {
  healthy: { dot: "bg-success", label: "Healthy", text: "text-success" },
  partial: { dot: "bg-warning", label: "Partial", text: "text-warning" },
  failed: { dot: "bg-danger", label: "Failed", text: "text-danger" },
  unknown: { dot: "bg-muted-foreground", label: "Unknown", text: "text-muted-foreground" },
};

export function StatusIndicator({
  status,
  label,
  className,
}: {
  status: HealthStatus;
  label?: string;
  className?: string;
}) {
  const c = config[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", c.text, className)}>
      <span className="relative flex h-2 w-2">
        {status === "healthy" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.dot)} />
      </span>
      {label ?? c.label}
    </span>
  );
}
