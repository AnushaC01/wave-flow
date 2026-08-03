import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, PackageMinus, PackagePlus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { inventoryActionFn } from "@/lib/wms.functions";
import { inventoryQuery, referenceQuery, useWmsMutation } from "@/lib/wms-queries";
import type { InventoryRecord } from "@/lib/wms-types";

export const Route = createFileRoute("/allocation")({
  head: () => ({
    meta: [
      { title: "Inventory Allocation & Reservation | NEXUS WMS" },
      { name: "description", content: "BR-149 inventory allocation: reserve, release and reallocate stock before wave release." },
      { property: "og:title", content: "Inventory Allocation & Reservation | NEXUS WMS" },
      { property: "og:description", content: "Reserve, release and reallocate warehouse inventory for outbound orders." },
    ],
  }),
  component: AllocationPage,
});

function AllocationPage() {
  const { can } = useRole();
  const inventoryQ = useQuery(inventoryQuery());
  const referenceQ = useQuery(referenceQuery());
  const records = inventoryQ.data?.rows ?? [];
  const warehouses = referenceQ.data?.warehouses ?? [];
  const zones = referenceQ.data?.zones ?? [];

  const [selected, setSelected] = useState<string[]>([]);

  const outOfStock = records.filter((r) => r.status === "Out of Stock");

  const inventoryActionServerFn = useServerFn(inventoryActionFn);
  const actionMutation = useWmsMutation(
    (args: { ids: string[]; kind: "reserve" | "release" | "reallocate"; qty: number }) => inventoryActionServerFn({ data: args }),
    {
      success: (_r, args) => ({
        title:
          args.kind === "reserve" ? "Inventory reserved" : args.kind === "release" ? "Reservation released" : "Inventory reallocated",
        description: `${args.ids.length} record(s) updated.`,
      }),
    },
  );

  const act = (kind: "reserve" | "release" | "reallocate") => {
    if (selected.length === 0) {
      toast.warning("Select at least one inventory record");
      return;
    }
    actionMutation.mutate(
      { ids: selected, kind, qty: 10 },
      { onSuccess: () => setSelected([]) },
    );
  };

  const columns: Column<InventoryRecord>[] = [
    {
      key: "select",
      header: "",
      sortable: false,
      render: (r) => (
        <Checkbox
          checked={selected.includes(r.id)}
          onCheckedChange={(v) => setSelected((s) => (v ? [...s, r.id] : s.filter((x) => x !== r.id)))}
          aria-label={`Select ${r.sku}`}
        />
      ),
    },
    { key: "sku", header: "SKU", value: (r) => r.sku, render: (r) => <span className="font-medium text-primary">{r.sku}</span> },
    { key: "product", header: "Product", value: (r) => r.product },
    { key: "warehouse", header: "Warehouse", value: (r) => r.warehouse },
    { key: "zone", header: "Zone", value: (r) => r.zone },
    { key: "location", header: "Location", value: (r) => r.location },
    { key: "available", header: "Available", value: (r) => r.available, className: "num text-right" },
    { key: "reserved", header: "Reserved", value: (r) => r.reserved, className: "num text-right" },
    { key: "allocated", header: "Allocated", value: (r) => r.allocated, className: "num text-right" },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Allocation & Reservation"
        description="BR-149 · Allocate and reserve stock. Reservation is mandatory before wave release."
        breadcrumbs={[{ label: "Order Management" }, { label: "Inventory Allocation" }]}
        actions={
          <>
            <Button variant="outline" disabled={!can("inventory.reserve") || actionMutation.isPending} onClick={() => act("release")}>
              <PackageMinus className="h-4 w-4" />
              Release Reservation
            </Button>
            <Button variant="outline" disabled={!can("inventory.reserve") || actionMutation.isPending} onClick={() => act("reallocate")}>
              <Repeat className="h-4 w-4" />
              Reallocate
            </Button>
            <Button disabled={!can("inventory.reserve") || actionMutation.isPending} onClick={() => act("reserve")}>
              <PackagePlus className="h-4 w-4" />
              Reserve Inventory
            </Button>
          </>
        }
      />

      {outOfStock.length > 0 && (
        <Alert className="mb-4 border-destructive/20 bg-danger-soft">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Stock unavailable for {outOfStock.length} location(s)</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            A backorder is automatically raised (BR-158) when allocation cannot be fulfilled: {outOfStock.map((r) => r.sku).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available Units" value={records.reduce((s, r) => s + r.available, 0).toLocaleString()} tone="primary" />
        <StatCard label="Reserved Units" value={records.reduce((s, r) => s + r.reserved, 0).toLocaleString()} tone="success" />
        <StatCard label="Allocated Units" value={records.reduce((s, r) => s + r.allocated, 0).toLocaleString()} />
        <StatCard label="Out of Stock Lines" value={outOfStock.length} tone="danger" />
      </div>

      <DataTable
        data={records}
        columns={columns}
        loading={inventoryQ.isLoading}
        pageSize={10}
        searchKeys={(r) => `${r.sku} ${r.product} ${r.warehouse} ${r.location}`}
        onExport={() => toast.success("Export queued", { description: "TODO: connect Reporting Engine." })}
        filters={[
          { key: "warehouse", label: "Warehouse", options: warehouses.map((w) => w.code), match: (r, v) => r.warehouse === v },
          { key: "zone", label: "Zone", options: zones, match: (r, v) => r.zone === v },
          { key: "status", label: "Status", options: ["In Stock", "Low Stock", "Out of Stock"], match: (r, v) => r.status === v },
        ]}
        toolbar={<span className="num text-xs text-muted-foreground">{selected.length} selected</span>}
      />
    </div>
  );
}
