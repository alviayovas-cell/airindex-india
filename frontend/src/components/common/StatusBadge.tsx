import { Badge } from "./Badge";
import type { QuoteStatus } from "@/types/models";

const MAP: Record<QuoteStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  valid: { label: "Valid", tone: "success" },
  outlier: { label: "Outlier", tone: "warning" },
  missing: { label: "Missing", tone: "neutral" },
  duplicate: { label: "Duplicate", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  sold_out: { label: "Sold out", tone: "danger" },
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = MAP[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
