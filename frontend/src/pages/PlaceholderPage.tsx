import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export function PlaceholderPage({
  title,
  description,
  checkpoint,
  icon,
}: {
  title: string;
  description: string;
  checkpoint: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon ?? Hammer}
        title={`${title} arrives in ${checkpoint}`}
        description="The application shell, design system, routing and authentication are in place. This module is scheduled for an upcoming build checkpoint."
      />
    </div>
  );
}
