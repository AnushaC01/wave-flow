import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Barcode, Printer, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { ordersQuery, packingQuery, referenceQuery, shipmentsQuery, useWmsMutation } from "@/lib/wms-queries";
import { updateShipmentFn } from "@/lib/wms.functions";
import type { PackingRecord } from "@/lib/wms-types";

export const Route = createFileRoute("/shipping-labels")({
  head: () => ({
    meta: [
      { title: "Shipping Label Generation | NEXUS WMS" },
      { name: "description", content: "BR-154 shipping labels with customer address, carrier, tracking number and barcode preview." },
      { property: "og:title", content: "Shipping Label Generation | NEXUS WMS" },
      { property: "og:description", content: "Generate and print carrier shipping labels for packed orders." },
    ],
  }),
  component: ShippingLabelsPage,
});

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ShippingLabelsPage() {
  const { can } = useRole();
  const { data: packingResult } = useQuery(packingQuery());
  const { data: ordersResult } = useQuery(ordersQuery());
  const { data: shipmentsResult } = useQuery(shipmentsQuery());
  const { data: reference } = useQuery(referenceQuery());

  const packingRecords = packingResult?.rows ?? [];
  const salesOrders = ordersResult?.rows ?? [];
  const shipments = shipmentsResult?.rows ?? [];
  const carriers = reference?.carriers ?? [];

  const [selected, setSelected] = useState<PackingRecord | null>(packingRecords[0] ?? null);
  const current = selected ?? packingRecords[0] ?? null;
  const order = current ? salesOrders.find((o) => o.id === current.order) : undefined;
  const shipment = current ? shipments.find((s) => s.orders.includes(current.order)) : undefined;

  const updateFn = useServerFn(updateShipmentFn);
  const generateLabel = useWmsMutation((args: { id: string; data: Record<string, unknown> }) => updateFn({ data: args as never }), {
    success: () => ({ title: "Label regenerated" }),
  });

  const handleGenerate = () => {
    if (!shipment) {
      toast.error("No shipment linked", { description: "Assign this order to a shipment before generating a label." });
      return;
    }
    const trackingNo = `TRK-${Math.floor(100000000 + Math.random() * 899999999)}`;
    generateLabel.mutate({ id: shipment.id, data: { trackingNo } });
  };

  const columns: Column<PackingRecord>[] = [
    { key: "labelNumber", header: "Label Number", value: (r) => r.labelNumber, render: (r) => <span className="font-medium text-primary">{r.labelNumber}</span> },
    { key: "order", header: "Sales Order", value: (r) => r.order },
    { key: "id", header: "Package", value: (r) => r.id },
    { key: "carrier", header: "Carrier", value: (r) => shipments.find((s) => s.orders.includes(r.order))?.carrier ?? "Unassigned" },
    { key: "tracking", header: "Tracking Number", value: (r) => shipments.find((s) => s.orders.includes(r.order))?.trackingNo ?? "—", className: "num" },
    { key: "weightKg", header: "Weight (kg)", value: (r) => r.weightKg, className: "num text-right" },
    { key: "status", header: "Pack Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
          Preview
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shipping Label Generation"
        description="BR-154 · Labels include customer address, carrier details, tracking number and barcode."
        breadcrumbs={[{ label: "Warehouse Execution" }, { label: "Shipping Labels" }]}
        actions={
          <>
            <Button variant="outline" disabled={!can("label.print") || generateLabel.isPending} onClick={handleGenerate}>
              <Tags className="h-4 w-4" />
              Generate Label
            </Button>
            <Button disabled={!can("label.print")} onClick={() => toast.success("Label sent to label printer")}>
              <Printer className="h-4 w-4" />
              Print Label
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Labels Ready" value={packingRecords.filter((p) => p.status === "Completed").length} tone="success" />
        <StatCard label="Awaiting Packing" value={packingRecords.filter((p) => p.status !== "Completed").length} tone="warning" />
        <StatCard label="Carriers" value={carriers.length} tone="primary" />
        <StatCard label="Total Labels" value={packingRecords.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <DataTable
          data={packingRecords}
          columns={columns}
          searchKeys={(r) => `${r.labelNumber} ${r.order} ${r.id}`}
          onExport={() => {
            const csv = toCsv(
              packingRecords.map((r) => ({
                labelNumber: r.labelNumber,
                order: r.order,
                package: r.id,
                carrier: shipments.find((s) => s.orders.includes(r.order))?.carrier ?? "Unassigned",
                tracking: shipments.find((s) => s.orders.includes(r.order))?.trackingNo ?? "",
                weightKg: r.weightKg,
                status: r.status,
              })),
            );
            downloadCsv("shipping-labels.csv", csv);
            toast.success("Label manifest exported");
          }}
          filters={[{ key: "status", label: "Pack Status", options: ["Pending", "In Progress", "Completed"], match: (r, v) => r.status === v }]}
        />

        <Card className="h-fit border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {current ? (
              <>
                <div className="rounded-md border-2 border-dashed border-border p-4">
                  <div className="flex items-start justify-between border-b border-border pb-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Carrier</p>
                      <p className="text-sm font-semibold">{shipment?.carrier ?? "Unassigned"}</p>
                    </div>
                    <p className="num text-xs text-muted-foreground">{current.labelNumber}</p>
                  </div>
                  <div className="py-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ship To</p>
                    <p className="text-sm font-medium">{order?.customer ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{shipment?.destination ?? "Address on file"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                    <LabelField k="Order" v={current.order} />
                    <LabelField k="Package" v={current.id} />
                    <LabelField k="Weight" v={`${current.weightKg} kg`} />
                    <LabelField k="Dimensions" v={current.dimensions} />
                    <LabelField k="Tracking" v={shipment?.trackingNo || "Pending"} />
                    <LabelField k="Service" v="Ground Freight" />
                  </div>
                  <div className="mt-3 flex flex-col items-center gap-1 border-t border-border pt-3">
                    <Barcode className="h-10 w-40 text-foreground" strokeWidth={1} />
                    <p className="num text-[11px] tracking-[0.2em]">{shipment?.trackingNo || "XXXXXXXXXXX"}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Preview only — final artwork is rendered by the carrier label service.</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No packages available yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LabelField({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className="truncate font-medium">{v}</p>
    </div>
  );
}
