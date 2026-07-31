import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { carriers, docks, shipments, vehicles, type Shipment } from "@/data/mock-data";

export const Route = createFileRoute("/loading")({
  head: () => ({
    meta: [
      { title: "Loading & Shipment | NEXUS WMS" },
      { name: "description", content: "BR-155 loading screen with vehicle, driver, dock, container and seal number assignment." },
      { property: "og:title", content: "Loading & Shipment | NEXUS WMS" },
      { property: "og:description", content: "Assign vehicles, drivers and docks, and record container and seal numbers." },
    ],
  }),
  component: LoadingPage,
});

function LoadingPage() {
  const { can } = useRole();
  const [rows, setRows] = useState<Shipment[]>(shipments);

  const columns: Column<Shipment>[] = [
    { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "orders", header: "Orders", value: (r) => r.orders.join(", ") },
    { key: "vehicle", header: "Vehicle", value: (r) => r.vehicle },
    { key: "driver", header: "Driver", value: (r) => r.driver },
    { key: "carrier", header: "Carrier", value: (r) => r.carrier },
    { key: "dock", header: "Dock", value: (r) => r.dock },
    { key: "container", header: "Container No.", value: (r) => r.container, className: "num" },
    { key: "seal", header: "Seal No.", value: (r) => r.seal, className: "num" },
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
          disabled={r.status !== "Loading" || !can("load.execute")}
          onClick={() => {
            setRows((s) => s.map((x) => (x.id === r.id ? { ...x, status: "Ready for Shipment" } : x)));
            toast.success(`${r.id} loading complete`, { description: "Awaiting load verification." });
          }}
        >
          <Truck className="h-4 w-4" />
          Complete Loading
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Loading & Shipment"
        description="BR-155 · Record vehicle, driver, dock, container and seal details for each outbound load."
        breadcrumbs={[{ label: "Outbound Logistics" }, { label: "Loading & Shipment" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Loads" value={rows.filter((r) => r.status === "Loading").length} tone="warning" />
        <StatCard label="Ready for Shipment" value={rows.filter((r) => r.status === "Ready for Shipment").length} tone="success" />
        <StatCard label="Vehicles Assigned" value={new Set(rows.map((r) => r.vehicle)).size} tone="primary" />
        <StatCard label="Docks In Use" value={new Set(rows.map((r) => r.dock)).size} />
      </div>

      <Card className="mb-4 border-border shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Assign Load Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Field label="Vehicle">
            <Picker options={vehicles.map((v) => `${v.id} · ${v.plate}`)} placeholder="Select vehicle" />
          </Field>
          <Field label="Driver">
            <Picker options={[...new Set(rows.map((r) => r.driver))]} placeholder="Select driver" />
          </Field>
          <Field label="Carrier">
            <Picker options={carriers} placeholder="Select carrier" />
          </Field>
          <Field label="Dock">
            <Picker options={docks} placeholder="Select dock" />
          </Field>
          <Field label="Container Number">
            <Input placeholder="CNT-88125" />
          </Field>
          <Field label="Seal Number">
            <Input placeholder="SEAL-441214" />
          </Field>
        </CardContent>
      </Card>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.vehicle} ${r.driver} ${r.carrier} ${r.container} ${r.seal}`}
        onExport={() => toast.success("Loading manifest exported")}
        filters={[
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
          { key: "dock", label: "Dock", options: docks, match: (r, v) => r.dock === v },
          { key: "status", label: "Status", options: ["Staged", "Loading", "Ready for Shipment", "In Transit", "Delivered"], match: (r, v) => r.status === v },
        ]}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Picker({ options, placeholder }: { options: string[]; placeholder: string }) {
  return (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
