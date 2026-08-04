import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { referenceQuery, shipmentsQuery, useWmsMutation } from "@/lib/wms-queries";
import { updateShipmentFn } from "@/lib/wms.functions";
import { SHIPMENT_STATUSES, type Shipment } from "@/lib/wms-types";

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
  const { data: shipmentsResult } = useQuery(shipmentsQuery());
  const { data: reference } = useQuery(referenceQuery());
  const rows: Shipment[] = shipmentsResult?.rows ?? [];
  const carriers = reference?.carriers ?? [];
  const docks = reference?.docks ?? [];
  const vehicles = reference?.vehicles ?? [];

  const [shipmentId, setShipmentId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [carrier, setCarrier] = useState("");
  const [dock, setDock] = useState("");
  const [container, setContainer] = useState("");
  const [seal, setSeal] = useState("");

  const updateFn = useServerFn(updateShipmentFn);
  const completeLoading = useWmsMutation(
    (args: { id: string; data: Record<string, unknown> }) => updateFn({ data: args as never }),
    { success: () => ({ title: "Loading complete", description: "Awaiting load verification." }) },
  );
  const assignMutation = useWmsMutation(
    (args: { id: string; data: Record<string, unknown> }) => updateFn({ data: args as never }),
    { success: (_r, args) => ({ title: `${args.id} load details assigned` }) },
  );

  const assign = () => {
    if (!shipmentId) {
      toast.error("Select a shipment to assign");
      return;
    }
    assignMutation.mutate({
      id: shipmentId,
      data: { vehicle: vehicle || undefined, driver, carrier: carrier || undefined, dock, container, seal, status: "Loading" },
    });
  };

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
          disabled={r.status !== "Loading" || !can("load.execute") || completeLoading.isPending}
          onClick={() => completeLoading.mutate({ id: r.id, data: { status: "Ready for Shipment" } })}
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
          <Field label="Shipment">
            <Picker options={rows.map((r) => r.id)} value={shipmentId} onChange={setShipmentId} placeholder="Select shipment" />
          </Field>
          <Field label="Vehicle">
            <Picker options={vehicles.map((v) => `${v.id} · ${v.plate}`)} value={vehicle} onChange={(v) => setVehicle(v.split(" · ")[0] ?? v)} placeholder="Select vehicle" />
          </Field>
          <Field label="Driver">
            <Picker options={[...new Set(vehicles.map((v) => v.driver))]} value={driver} onChange={setDriver} placeholder="Select driver" />
          </Field>
          <Field label="Carrier">
            <Picker options={carriers} value={carrier} onChange={setCarrier} placeholder="Select carrier" />
          </Field>
          <Field label="Dock">
            <Picker options={docks} value={dock} onChange={setDock} placeholder="Select dock" />
          </Field>
          <Field label="Container Number">
            <Input placeholder="CNT-88125" value={container} onChange={(e) => setContainer(e.target.value)} />
          </Field>
          <Field label="Seal Number">
            <Input placeholder="SEAL-441214" value={seal} onChange={(e) => setSeal(e.target.value)} />
          </Field>
          <div className="flex items-end xl:col-span-6">
            <Button disabled={assignMutation.isPending} onClick={assign}>
              <Truck className="h-4 w-4" />
              Assign Load
            </Button>
          </div>
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
          { key: "status", label: "Status", options: [...SHIPMENT_STATUSES], match: (r, v) => r.status === v },
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

function Picker({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
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
