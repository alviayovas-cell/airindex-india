import {
  LayoutDashboard,
  Table2,
  Route,
  LineChart,
  CalendarClock,
  ShieldCheck,
  Plug,
  FileBarChart,
  BookOpenText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Airfare Data", to: "/airfares", icon: Table2 },
  { label: "Route Analysis", to: "/routes", icon: Route },
  { label: "Price Index", to: "/index", icon: LineChart },
  { label: "Lead-time Analysis", to: "/lead-time", icon: CalendarClock },
  { label: "Data Quality", to: "/data-quality", icon: ShieldCheck },
  { label: "Data Sources", to: "/sources", icon: Plug },
  { label: "Reports", to: "/reports", icon: FileBarChart },
  { label: "Methodology", to: "/methodology", icon: BookOpenText },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function titleForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
  );
  return match?.label ?? "AIRINDEX";
}
