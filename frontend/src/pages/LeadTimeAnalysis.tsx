import { CalendarClock } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

export default function LeadTimeAnalysis() {
  return (
    <PlaceholderPage
      title="Booking Window Analysis"
      description="Understand how airfare changes with advance purchase timing across T+1, T+7, T+15, T+30 and T+45."
      checkpoint="Checkpoint D"
      icon={CalendarClock}
    />
  );
}
