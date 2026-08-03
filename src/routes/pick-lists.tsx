import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { errorMessage, pickLinesQuery, referenceQuery, useWmsMutation, wavesQuery } from "@/lib/wms-queries";
import { generatePickListsFn } from "@/lib/wms.functions";
import type { PickLine } from "@/lib/wms-types";

export const Route = createFileRoute("/pick-lists")({
  head: () => ({
    meta: [
      { title: "Pick List Generation | NEXUS WMS" },
      { name: "description", content: "BR-151 pick list generation with zone, location, SKU, barcode and serial detail for released waves." },
      { property: "og:title", content: "Pick List Generation | NEXUS WMS" },
      { property: "og:description", content: "Generate, print and export pick lists for released picking waves." },
    ],
  }),
  component: PickListsPage,
});

function toCsv(rows: PickLine[]): string {
  const headers = ["Pick Line", "Wave", "Picker", "Zone", "Location", "SKU", "Product", "Qty", "Barcode", "Serial", "Status"];
  const lines = rows.map((r) =>
    [r.id, r.wave, r.picker, r.zone, r.location, r.sku, r.product, r.quantity, r.barcode, r.serial, r.status]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function downloadCsv(rows: PickLine[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pick-lists.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function PickListsPage() {
  const { can } = useRole();
  const { data: pickLinesResult, isLoading } = useQuery(pickLinesQuery());
  const { data: wavesResult } = useQuery(wavesQuery());
  const { data: reference } = useQuery(referenceQuery());
  const pickLines: PickLine[] = pickLinesResult?.rows ?? [];
  const waves = wavesResult?.rows ?? [];
  const zones = reference?.zones ?? [];
  const releasedWaves = waves.filter((w) => ["Released", "Picking", "Completed"].includes(w.status));

  const generateServerFn = useServerFn(generatePickListsFn);
  const generateMutation = useWmsMutation((args: { wave: string }) => generateServerFn({ data: args }));

  const generate = async () => {
    const targets = waves.filter((w) => w.status === "Released");
    if (targets.length === 0) {
      toast.info("No released waves", { description: "Release a wave before generating pick lists." });
      return;
    }
    try {
      const results = await Promise.all(targets.map((w) => generateServerFn({ data: { wave: w.id } })));
      const total = results.reduce((s, r) => s + (typeof r === "number" ? r : 0), 0);
      generateMutation.reset();
      // Trigger the shared refresh path via the wrapped mutation helper.
      await generateMutation.mutateAsync({ wave: targets[0].id }).catch(() => undefined);
      toast.success("Pick lists generated", { description: `${total} pick lines across ${targets.length} released wave(s).` });
    } catch (err) {
      toast.error("Pick list generation failed", { description: errorMessage(err) });
    }
  };

  const columns: Column<PickLine>[] = [
    { key: "id", header: "Pick Line", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "wave", header: "Wave Number", value: (r) => r.wave },
    { key: "picker", header: "Picker", value: (r) => r.picker },
    { key: "zone", header: "Warehouse Zone", value: (r) => r.zone },
    { key: "location", header: "Storage Location", value: (r) => r.location },
    { key: "sku", header: "SKU", value: (r) => r.sku },
    { key: "product", header: "Product", value: (r) => r.product },
    { key: "quantity", header: "Qty", value: (r) => r.quantity, className: "num text-right" },
    { key: "barcode", header: "Barcode", value: (r) => r.barcode, className: "num" },
    { key: "serial", header: "Serial Number", value: (r) => r.serial, className: "num" },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Pick List Generation"
        description="BR-151 · Pick lists are generated only after wave release."
        breadcrumbs={[{ label: "Warehouse Execution" }, { label: "Pick Lists" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Sent to warehouse printer", { description: "TODO: Print service." })}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={() => toast.success("PDF export started", { description: "TODO: Reporting Engine PDF." })}>
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={() => downloadCsv(pickLines)}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button disabled={!can("picklist.generate") || generateMutation.isPending} onClick={generate}>
              <RefreshCw className="h-4 w-4" />
              Generate
            </Button>
          </>
        }
      />

      <Alert className="mb-4 border-info/20 bg-info-soft">
        <AlertTitle>Released waves eligible for pick list generation</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {releasedWaves.length > 0 ? releasedWaves.map((w) => `${w.id} (${w.name})`).join(" · ") : "No released waves yet."}
        </AlertDescription>
      </Alert>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pick Lines" value={pickLines.length} tone="primary" />
        <StatCard label="Pending" value={pickLines.filter((p) => p.status === "Pending").length} tone="warning" />
        <StatCard label="Picked" value={pickLines.filter((p) => p.status === "Picked").length} tone="success" />
        <StatCard label="Short Picks" value={pickLines.filter((p) => p.status === "Short").length} tone="danger" />
      </div>

      <DataTable
        data={pickLines}
        columns={columns}
        loading={isLoading}
        pageSize={10}
        searchKeys={(r) => `${r.id} ${r.wave} ${r.picker} ${r.sku} ${r.product} ${r.barcode}`}
        onExport={() => {
          downloadCsv(pickLines);
          toast.success("CSV export queued");
        }}
        filters={[
          { key: "wave", label: "Wave", options: releasedWaves.map((w) => w.id), match: (r, v) => r.wave === v },
          { key: "zone", label: "Zone", options: zones, match: (r, v) => r.zone === v },
          { key: "status", label: "Status", options: ["Pending", "In Progress", "Picked", "Short"], match: (r, v) => r.status === v },
        ]}
      />
    </div>
  );
}
