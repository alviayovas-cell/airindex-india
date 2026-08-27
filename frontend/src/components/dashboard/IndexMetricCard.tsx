import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ChangeIndicator } from "@/components/common/ChangeIndicator";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatDate, formatIndex } from "@/utils/format";
import type { CurrentIndex } from "@/types/models";

export function IndexMetricCard({ index }: { index: CurrentIndex }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Airfare Price Index
        </span>
        {index.is_experimental && <Badge tone="accent">Experimental</Badge>}
      </div>

      <div className="mt-3 flex items-end gap-3">
        <span className="text-[40px] font-bold leading-none tracking-tight text-foreground">
          {formatIndex(index.index_value)}
        </span>
        <ChangeIndicator value={index.change_1d} size="md" suffix="today" className="pb-1" />
      </div>

      <div className="mt-4">
        <Sparkline data={index.sparkline} width={260} height={44} className="w-full" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Base period</dt>
          <dd className="font-medium">{formatDate(index.base_period)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Current period</dt>
          <dd className="font-medium">{formatDate(index.current_period)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">7-day change</dt>
          <dd><ChangeIndicator value={index.change_7d} size="sm" /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">30-day change</dt>
          <dd><ChangeIndicator value={index.change_30d} size="sm" /></dd>
        </div>
      </dl>

      <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {index.status_label} · {index.routes_covered} routes · methodology{" "}
        {index.methodology_version}
      </p>
    </Card>
  );
}
