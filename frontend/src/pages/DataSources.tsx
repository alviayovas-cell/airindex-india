import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/api/meta";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { StatusIndicator } from "@/components/common/StatusIndicator";
import { Badge } from "@/components/common/Badge";

export default function DataSources() {
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: fetchHealth });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sources"
        description="Authorized flight-data providers connected to AIRINDEX."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader
            title="Amadeus — Flight Offers Search"
            action={
              <StatusIndicator
                status={health?.amadeus_configured ? "healthy" : "partial"}
                label={health?.amadeus_configured ? "Connected" : "Not configured"}
              />
            }
          />
          <CardBody className="space-y-3 text-sm text-muted-foreground">
            <p>
              Authorized REST API. The backend performs the OAuth2 client-credentials
              exchange; credentials never reach the browser.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Flight offers", "Fare", "Airline", "Route", "Travel date"].map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
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

      <p className="text-xs text-muted-foreground">
        Availability and coverage depend on the selected API provider. AIRINDEX never
        bypasses CAPTCHA, authentication, rate limits or other access controls.
      </p>
    </div>
  );
}
