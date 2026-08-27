import { cn } from "@/lib/cn";

/** AIRINDEX mark: an upward flight-path trend inside a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label="AIRINDEX"
    >
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path
        d="M6 21 L13 14 L18 18 L26 9"
        className="stroke-accent-foreground"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="9" r="2" className="fill-accent-foreground" />
    </svg>
  );
}

export function Logo({
  className,
  showSubtitle = false,
}: {
  className?: string;
  showSubtitle?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-none">
        <span className="text-[17px] font-bold tracking-tight">
          AIR<span className="text-accent">INDEX</span>
        </span>
        {showSubtitle && (
          <p className="mt-1 text-[11px] font-medium opacity-70">
            Airfare Price Intelligence
          </p>
        )}
      </div>
    </div>
  );
}
