import { FileBarChart } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

export default function Reports() {
  return (
    <PlaceholderPage
      title="Reports"
      description="Build a report by date range, route and frequency, preview the summary and export CSV."
      checkpoint="Checkpoint E"
      icon={FileBarChart}
    />
  );
}
