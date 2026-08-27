import { ShieldCheck } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

export default function DataQuality() {
  return (
    <PlaceholderPage
      title="Data Quality"
      description="Valid, missing, duplicate and outlier counts, overall quality score and per-source collection health."
      checkpoint="Checkpoint D"
      icon={ShieldCheck}
    />
  );
}
