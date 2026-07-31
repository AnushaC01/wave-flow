import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck, PackagePlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { backorders, customers, type Backorder } from "@/data/mock-data";

export const Route = createFileRoute("/backorders")({
  head: () => ({
    meta: [
      { title: "Backorders & Short Shipments | NEXUS WMS" },
      { name: "description", content: "BR-158 / BR-159: short shipment backorders, suggested allocation and fulfilment when stock returns." },
      { property: "og:title", content: "Backorders & Short Shipments | NEXUS WMS" },
      { property: "og:description", content: "Track missing quantities, expected dates and fulfil backorders when stock is available." },
    ],
  }),
  component: BackordersPage,
});

function BackordersPage() {
  const [rows, setRows] = useState<Backorder[]>(backorders);

  const update = (id: string, status: Backorder["status"], message: string) => {
    // TODO(integration): post allocation/fulfilment to the Inventory + Order APIs.
    setRows((s) => s.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success(message, { description: `${id} updated.` });
  };

  const columns: Column<Backorder>[] = [
    { key: "id", header: "Backorder", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "order", header: "Sales Order", value: (r) => r.order },
    { key: "customer", header: "Customer", value: (r) => r.customer },
    { key: "sku", header: "SKU", value: (r) => r.sku },
    { key: "product", header: "Product", value: (r) => r.product },
    { key: "missingQty", header: "Missing Qty", value: (r) => r.missingQty, className: "num text-right" },
    { key: "availableQty", header: "Available", value: (r) => r.availableQty, className: "num text-right" },
    { key: "suggested", header: "Suggested Allocation", value: (r) => r.suggested, className: "num text-right" },
    { key: "reason", header: "Reason", value: (r) => r.reason },
    { key: "expectedDate", header: "Expected Date", value: (r) => r.expectedDate },
    { key: "priority", header: "Priority", value: (r) => r.priority, render: (r) => <StatusBadge value={r.priority} /> },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={r.availableQty === 0} onClick={() => update(r.id, "Partially Allocated", "Inventory allocated")}>
            <PackagePlus className="h-4 w-4" />
            Allocate
          </Button>
          <Button size="sm" variant="outline" disabled={r.availableQty === 0} onClick={() => update(r.id, "Fulfilled", "Backorder fulfilled")}>
            <CheckCheck className="h-4 w-4" />
            Fulfil
          </Button>
          <Button size="sm" variant="ghost" onClick={() => update(r.id, "Closed", "Backorder closed")}>
            <XCircle className="h-4 w-4" />
            Close
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Backorders & Short Shipments"
        description="BR-158 / BR-159 · Automatic backorders on insufficient stock and fulfilment when inventory returns."
        breadcrumbs={[{ label: "Order Management" }, { label: "Backorders" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open Backorders" value={rows.filter((r) => r.status === "Open").length} tone="danger" />
        <StatCard label="Partially Allocated" value={rows.filter((r) => r.status === "Partially Allocated").length} tone="warning" />
        <StatCard label="Fulfilled" value={rows.filter((r) => r.status === "Fulfilled").length} tone="success" />
        <StatCard label="Total Missing Units" value={rows.reduce((s, r) => s + r.missingQty, 0)} tone="primary" />
      </div>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.order} ${r.customer} ${r.sku} ${r.product}`}
        onExport={() => toast.success("Backorder report queued")}
        filters={[
          { key: "priority", label: "Priority", options: ["Critical", "High", "Medium", "Low"], match: (r, v) => r.priority === v },
          { key: "status", label: "Status", options: ["Open", "Partially Allocated", "Fulfilled", "Closed"], match: (r, v) => r.status === v },
          { key: "customer", label: "Customer", options: customers.map((c) => c.name), match: (r, v) => r.customer === v },
        ]}
      />
    </div>
  );
}
