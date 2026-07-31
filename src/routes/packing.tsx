import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, Printer } from "lucide-react";
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
import { packingRecords, type PackingRecord } from "@/data/mock-data";

export const Route = createFileRoute("/packing")({
  head: () => ({
    meta: [
      { title: "Packing Station | NEXUS WMS" },
      { name: "description", content: "BR-153 packing station: package type, carton, weight, dimensions, materials and label numbers." },
      { property: "og:title", content: "Packing Station | NEXUS WMS" },
      { property: "og:description", content: "Pack picked orders, record package details and print carton labels." },
    ],
  }),
  component: PackingPage,
});

function PackingPage() {
  const { can } = useRole();
  const [rows, setRows] = useState<PackingRecord[]>(packingRecords);

  const columns: Column<PackingRecord>[] = [
    { key: "id", header: "Packing ID", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "order", header: "Sales Order", value: (r) => r.order },
    { key: "wave", header: "Wave", value: (r) => r.wave },
    { key: "packageType", header: "Package Type", value: (r) => r.packageType },
    { key: "carton", header: "Carton", value: (r) => r.carton },
    { key: "weightKg", header: "Weight (kg)", value: (r) => r.weightKg, className: "num text-right" },
    { key: "dimensions", header: "Dimensions", value: (r) => r.dimensions },
    { key: "material", header: "Packing Materials", value: (r) => r.material },
    { key: "labelNumber", header: "Label Number", value: (r) => r.labelNumber },
    { key: "station", header: "Station", value: (r) => r.station },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          disabled={r.status === "Completed" || !can("pack.execute")}
          onClick={() => {
            setRows((s) => s.map((x) => (x.id === r.id ? { ...x, status: "Completed" } : x)));
            toast.success("Packing completed", { description: `${r.order} ready for staging.` });
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Complete
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Packing Station"
        description="BR-153 · Packing cannot begin until picking is completed for the order."
        breadcrumbs={[{ label: "Warehouse Execution" }, { label: "Packing" }]}
        actions={
          <>
            <Button variant="outline" disabled={!can("label.print")} onClick={() => toast.success("Packing list generated")}>
              <FileText className="h-4 w-4" />
              Generate Packing List
            </Button>
            <Button disabled={!can("label.print")} onClick={() => toast.success("Labels sent to printer", { description: "TODO: Label printing service." })}>
              <Printer className="h-4 w-4" />
              Print Labels
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Packages" value={rows.length} tone="primary" />
        <StatCard label="Completed" value={rows.filter((r) => r.status === "Completed").length} tone="success" />
        <StatCard label="In Progress" value={rows.filter((r) => r.status === "In Progress").length} tone="warning" />
        <StatCard label="Total Weight" value={`${rows.reduce((s, r) => s + r.weightKg, 0).toFixed(1)} kg`} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="border-border shadow-[var(--shadow-card)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Package</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Package Type">
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {["Carton", "Pallet", "Tote", "Crate"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Carton Code">
              <Input placeholder="CTN-60x40x40" />
            </Field>
            <Field label="Weight (kg)">
              <Input type="number" placeholder="18.4" />
            </Field>
            <Field label="Dimensions (cm)">
              <Input placeholder="60 x 40 x 40" />
            </Field>
            <Field label="Packing Materials">
              <Input placeholder="Double-wall + bubble wrap" />
            </Field>
            <Field label="Label Number">
              <Input value="LBL-99126" readOnly />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Package Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(["Carton", "Pallet", "Tote", "Crate"] as const).map((t) => (
              <div key={t} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-muted-foreground">{t}</span>
                <span className="num font-medium">{rows.filter((r) => r.packageType === t).length}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.order} ${r.wave} ${r.labelNumber} ${r.operator}`}
        onExport={() => toast.success("Packing report queued")}
        filters={[
          { key: "status", label: "Status", options: ["Pending", "In Progress", "Completed"], match: (r, v) => r.status === v },
          { key: "packageType", label: "Package Type", options: ["Carton", "Pallet", "Tote", "Crate"], match: (r, v) => r.packageType === v },
          { key: "station", label: "Station", options: [...new Set(rows.map((r) => r.station))], match: (r, v) => r.station === v },
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
