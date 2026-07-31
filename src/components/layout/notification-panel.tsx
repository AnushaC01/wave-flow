import { Bell, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { notifications as seed } from "@/data/mock-data";
import { cn } from "@/lib/utils";

const SEVERITY: Record<string, string> = {
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-danger-soft text-destructive",
};

export function NotificationPanel({
  open,
  onOpenChange,
  items,
  onMarkAllRead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: typeof seed;
  onMarkAllRead: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </SheetTitle>
          <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </SheetHeader>
        {/* TODO(integration): subscribe to the enterprise Notification Service (WebSocket / SSE). */}
        <ScrollArea className="h-[calc(100vh-3.75rem)]">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={cn("flex gap-3 px-4 py-3", !n.read && "bg-primary-soft/40")}>
                <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", SEVERITY[n.severity])}>
                  <Bell className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{n.time}</p>
                </div>
                {!n.read && <X className="ml-auto h-3 w-3 shrink-0 text-transparent" />}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
