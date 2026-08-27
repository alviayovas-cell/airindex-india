import type { ReactNode } from "react";

interface Row {
  label: string;
  value: ReactNode;
  color?: string;
}

export function ChartTooltip({
  title,
  rows,
  active,
}: {
  title: string;
  rows: Row[];
  active?: boolean;
}) {
  if (!active) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-popover">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
              )}
              {r.label}
            </span>
            <span className="font-medium text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
