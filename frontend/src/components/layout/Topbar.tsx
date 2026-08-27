import { Bell, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { UserMenu } from "./UserMenu";

export function Topbar({
  title,
  onOpenMobileNav,
}: {
  title: string;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-base font-semibold text-foreground sm:text-lg">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search routes, airlines…"
            className="h-9 w-56 rounded-lg border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>

        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
