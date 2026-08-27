import { LineChart } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

export default function PriceIndex() {
  return (
    <PlaceholderPage
      title="Airfare Price Index"
      description="The transparent experimental weighted price-relative index, with base period, route basket and daily/weekly/monthly views."
      checkpoint="Checkpoint C"
      icon={LineChart}
    />
  );
}
