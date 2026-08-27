import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, RefreshCw } from "lucide-react";
import { fetchHealth } from "@/api/meta";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { Badge } from "@/components/common/Badge";
import { useCollectionStatus, useRunCollection } from "@/hooks/queries";
import { formatDate, formatNumber, formatTime } from "@/utils/format";

export default function DataSources() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth });
  const status = useCollectionStatus();
  const run = useRunCollection();
  const [feedback, setFeedback] = useState<string | null>(null);

  const latest = status.data?.latest_run;
  const amadeus = health.data?.amadeus_configured;

  async function trigger() {
    setFeedback(null);
    try {
      const result = await run.mutateAsync("auto");
      setFeedback(
        `Collection ${result.status}: ${result.records_stored} observations stored from ${result.source}.`,
      );
    } catch {
      setFeedback("Collection could not be started. Check the API connection.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sources"
        description="Authorized flight-data providers connected to AIRINDEX."
        actions={
          <Button onClick={trigger} loading={run.isPending} variant="accent">
            <Play className="h-4 w-4" />
            Run collection now
          </Button>
        }
      />

      {feedback && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          {feedback}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Amadeus — Flight Offers Search"
            action={
              <StatusIndicator
                status={amadeus ? "healthy" : "partial"}
                label={amadeus ? "Connected" : "Not configured"}
              />
            }
          />
          <CardBody className="space-y-3 text-sm text-muted-foreground">
            <p>
              Authorized REST API. The backend performs the OAuth2 client-credentials
              exchange; the client secret never reaches the browser.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Flight offers", "Fare", "Airline", "Route", "Travel date"].map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            {!amadeus && (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
                Set <code>AMADEUS_CLIENT_ID</code> / <code>AMADEUS_CLIENT_SECRET</code> in{" "}
                <code>backend/.env</code> to enable live collection. Until then the
                synthetic dataset is used.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Synthetic demonstration dataset"
            action={<StatusIndicator status="healthy" label="Available" />}
          />
          <CardBody className="space-y-3 text-sm text-muted-foreground">
            <p>
              A clearly labelled synthetic 30-day dataset that keeps every module
              functional when the live API is unavailable. Values are illustrative,
              not actual airline prices.
            </p>
            <Badge tone="warning">Synthetic — not real observations</Badge>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Last collection run"
          action={
            <button
              onClick={() => status.refetch()}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          }
        />
        <CardBody className="pt-0">
          {latest ? (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd className="font-medium capitalize">
                  {latest.source}
                  {latest.is_synthetic && <span className="ml-1 text-warning">(synthetic)</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>
                  <StatusIndicator
                    status={
                      latest.status === "success"
                        ? "healthy"
                        : latest.status === "partial"
                          ? "partial"
                          : "failed"
                    }
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Completed</dt>
                <dd className="font-medium">
                  {formatDate(latest.completed_at)} {formatTime(latest.completed_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Records stored</dt>
                <dd className="font-medium tabular-nums">{formatNumber(latest.records_stored)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Records found</dt>
                <dd className="font-medium tabular-nums">{formatNumber(latest.records_found)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="font-medium tabular-nums">{latest.duration_seconds}s</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Errors</dt>
                <dd className="font-medium tabular-nums">{latest.errors.length}</dd>
              </div>
            </dl>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No collection runs recorded yet.</p>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-muted-foreground">
        Availability and coverage depend on the selected API provider. AIRINDEX never
        bypasses CAPTCHA, authentication, rate limits or other access controls.
      </p>
    </div>
  );
}
