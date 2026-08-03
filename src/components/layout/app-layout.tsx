import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { NotificationPanel } from "./notification-panel";
import { notificationsQuery, useWmsMutation } from "@/lib/wms-queries";
import { markNotificationsReadFn } from "@/lib/wms.functions";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const { data: items = [] } = useQuery(notificationsQuery());
  const unread = items.filter((n) => !n.read).length;
  const markAllRead = useWmsMutation(() => markNotificationsReadFn(), {
    success: () => ({ title: "All notifications marked as read" }),
  });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onMenu={() => setSidebarOpen((s) => !s)} onBell={() => setPanelOpen(true)} unread={unread} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
        <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground lg:px-6">
          NEXUS WMS · Outbound Order Fulfillment &amp; Wave Management (BR-148 – BR-159) · Prototype build with mock data
        </footer>
      </div>
      <NotificationPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        items={items}
        onMarkAllRead={() => markAllRead.mutate(undefined)}
      />
    </div>
  );
}
