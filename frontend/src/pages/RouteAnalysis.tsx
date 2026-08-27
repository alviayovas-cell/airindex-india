import { Route } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

export default function RouteAnalysis() {
  return (
    <PlaceholderPage
      title="Route Analysis"
      description="Fare, index and history for a selected city-pair, with airline comparison and lead-time curves."
      checkpoint="Checkpoint D"
      icon={Route}
    />
  );
}
