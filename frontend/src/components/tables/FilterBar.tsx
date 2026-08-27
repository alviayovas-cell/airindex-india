import { X } from "lucide-react";

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 py-1 pl-2.5 pr-1 text-xs font-medium text-accent">
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-accent/20"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
