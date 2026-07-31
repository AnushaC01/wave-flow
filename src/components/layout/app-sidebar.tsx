import { Link, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Layers,
  PackageCheck,
  PackageSearch,
  Rocket,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Warehouse,
} from "lucide-react";
import { useRole } from "@/context/role-context";
import { cn } from "@/lib/utils";

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard, group: "Overview" },
  { key: "sales-orders", label: "Sales Orders", to: "/sales-orders", icon: ShoppingCart, group: "Order Management" },
  { key: "allocation", label: "Inventory Allocation", to: "/allocation", icon: Boxes, group: "Order Management" },
  { key: "backorders", label: "Backorders", to: "/backorders", icon: PackageSearch, group: "Order Management" },
  { key: "wave-planning", label: "Wave Planning", to: "/wave-planning", icon: Layers, group: "Wave Management" },
  { key: "wave-release", label: "Wave Release", to: "/wave-release", icon: Rocket, group: "Wave Management" },
  { key: "pick-lists", label: "Pick Lists", to: "/pick-lists", icon: ClipboardList, group: "Warehouse Execution" },
  { key: "picking", label: "Picking", to: "/picking", icon: Warehouse, group: "Warehouse Execution" },
  { key: "packing", label: "Packing", to: "/packing", icon: PackageCheck, group: "Warehouse Execution" },
  { key: "shipping-labels", label: "Shipping Labels", to: "/shipping-labels", icon: Tags, group: "Warehouse Execution" },
  { key: "staging", label: "Staging", to: "/staging", icon: ClipboardCheck, group: "Outbound Logistics" },
  { key: "loading", label: "Loading & Shipment", to: "/loading", icon: Truck, group: "Outbound Logistics" },
  { key: "load-verification", label: "Load Verification", to: "/load-verification", icon: ShieldCheck, group: "Outbound Logistics" },
  { key: "dispatch", label: "Dispatch Authorization", to: "/dispatch", icon: ShieldCheck, group: "Outbound Logistics" },
  { key: "shipping", label: "Shipping & Tracking", to: "/shipping", icon: Truck, group: "Outbound Logistics" },
  { key: "reports", label: "Reports", to: "/reports", icon: FileBarChart, group: "Insights" },
  { key: "settings", label: "Settings", to: "/settings", icon: Settings, group: "Insights" },
];

export function AppSidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const { allowedNav } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV_ITEMS.filter((i) => allowedNav(i.key));
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Warehouse className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">NEXUS WMS</p>
          <p className="truncate text-[11px] text-muted-foreground">Outbound Fulfillment</p>
        </div>
      </div>

      <nav className="h-[calc(100vh-3.5rem)] overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{group}</p>
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.group === group)
                .map((item) => {
                  const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <li key={item.key}>
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        <div className="rounded-md border border-dashed border-border p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Other WMS modules (Receiving, Inventory, Returns, Master Data) mount alongside this module in the enterprise shell.
          </p>
        </div>
      </nav>
    </aside>
  );
}
