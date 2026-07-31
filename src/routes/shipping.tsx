import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { carriers, shipments, type Shipment } from "@/data/mock-data";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "Shipping & Tracking | NEXUS WMS" },
      { name: "description", content: "Track dispatched shipments, carrier tracking numbers, destinations and delivery status." },
      { property: "og:title", content: "Shipping & Tracking | NEXUS WMS" },
      { property: "og:description", content: "Live outbound shipment tracking across carriers and destinations." },
    ],
  }),
  component: ShippingPage,
});

const TIMELINE = ["Staged", "Loading", "Ready for Shipment", "In Transit", "Delivered"] as const;

function ShippingPage() {
  const columns: Column<Shipment>[] = [
    { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "trackingNo", header: "Tracking Number", value: (r) => r.trackingNo, className: "num" },
    { key: "carrier", header: "Carrier", value: (r) => r.carrier },
    { key: "orders", header: "Orders", value: (r) => r.orders.join(", ") },
    { key: "destination", header: "Destination", value: (r) => r.destination },
    { key: "driver", header: "Driver", value: (r) => r.driver },
    { key: "scheduledAt", header: "Scheduled", value: (r) => r.scheduledAt, className: "num" },
    { key: "dispatch", header: "Dispatch", value: (r) => r.dispatch, render: (r) => <StatusBadge value={r.dispatch} /> },
    { key: "status", header: "Shipment Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Shipping & Tracking"
        description="Outbound shipment tracking across all carriers, from staging through delivery."
        breadcrumbs={[{ label: "Outbound Logistics" }, { label: "Shipping & Tracking" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In Transit" value={shipments.filter((s) => s.status === "In Transit").length} tone="primary" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Ready for Shipment" value={shipments.filter((s) => s.status === "Ready for Shipment").length} tone="success" />
        <StatCard label="Staged" value={shipments.filter((s) => s.status === "Staged").length} tone="warning" />
        <StatCard label="Destinations" value={new Set(shipments.map((s) => s.destination)).size} />
      </div>

      <Card className="mb-4 border-border shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Shipment Timelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {shipments.map((s) => {
            const idx = TIMELINE.indexOf(s.status);
            return (
              <div key={s.id} className="grid gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[200px_1fr]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.id}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {s.destination}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {TIMELINE.map((t, i) => (
                    <span
                      key={t}
                      className={
                        i <= idx
                          ? "rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary"
                          : "rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                      }
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DataTable
        data={shipments}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.trackingNo} ${r.carrier} ${r.destination} ${r.orders.join(" ")}`}
        onExport={() => toast.success("Shipping report exported")}
        filters={[
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
          { key: "status", label: "Status", options: [...TIMELINE], match: (r, v) => r.status === v },
        ]}
      />
    </div>
  );
}
