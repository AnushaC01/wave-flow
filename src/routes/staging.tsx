import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { docks, shipments, type Shipment } from "@/data/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staging")({
  head: () => ({
    meta: [
      { title: "Staging Area | NEXUS WMS" },
      { name: "description", content: "Track packed shipments moved to staging lanes and dock assignments before loading." },
      { property: "og:title", content: "Staging Area | NEXUS WMS" },
      { property: "og:description", content: "Monitor staging lanes, dock readiness and shipments waiting to load." },
    ],
  }),
  component: StagingPage,
});

function StagingPage() {
  const { can } = useRole();
  const [rows, setRows] = useState<Shipment[]>(shipments);

  const columns: Column<Shipment>[] = [
    { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "orders", header: "Orders", value: (r) => r.orders.join(", ") },
    { key: "carrier", header: "Carrier", value: (r) => r.carrier },
    { key: "dock", header: "Staging Lane / Dock", value: (r) => r.dock },
    { key: "destination", header: "Destination", value: (r) => r.destination },
    { key: "scheduledAt", header: "Scheduled", value: (r) => r.scheduledAt, className: "num" },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          disabled={r.status !== "Staged" || !can("load.execute")}
          onClick={() => {
            setRows((s) => s.map((x) => (x.id === r.id ? { ...x, status: "Loading" } : x)));
            toast.success(`${r.id} moved to loading`, { description: `${r.dock} assigned.` });
          }}
        >
          <ClipboardCheck className="h-4 w-4" />
          Move to Loading
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Staging Area"
        description="Packed shipments held in staging lanes awaiting dock assignment and loading."
        breadcrumbs={[{ label: "Outbound Logistics" }, { label: "Staging" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staged Shipments" value={rows.filter((r) => r.status === "Staged").length} tone="warning" />
        <StatCard label="Loading" value={rows.filter((r) => r.status === "Loading").length} tone="primary" />
        <StatCard label="Ready for Shipment" value={rows.filter((r) => r.status === "Ready for Shipment").length} tone="success" />
        <StatCard label="Docks Active" value={`${new Set(rows.map((r) => r.dock)).size} / ${docks.length}`} />
      </div>

      <Card className="mb-4 border-border shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dock Occupancy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {docks.map((d) => {
            const occ = rows.find((r) => r.dock === d);
            return (
              <div
                key={d}
                className={cn(
                  "rounded-md border p-3 text-xs",
                  occ ? "border-primary/30 bg-primary-soft" : "border-border bg-muted",
                )}
              >
                <p className="flex items-center gap-1 font-medium text-foreground">
                  <MapPin className="h-3 w-3" />
                  {d}
                </p>
                <p className="mt-1 text-muted-foreground">{occ ? `${occ.id} · ${occ.carrier}` : "Available"}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.carrier} ${r.dock} ${r.destination} ${r.orders.join(" ")}`}
        onExport={() => toast.success("Staging report exported")}
        filters={[
          { key: "dock", label: "Dock", options: docks, match: (r, v) => r.dock === v },
          { key: "status", label: "Status", options: ["Staged", "Loading", "Ready for Shipment", "In Transit", "Delivered"], match: (r, v) => r.status === v },
        ]}
      />
    </div>
  );
}
