import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileText, Printer, Save } from "lucide-react";
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
import { ordersQuery, packingQuery, wavesQuery, useWmsMutation, errorMessage } from "@/lib/wms-queries";
import { savePackingFn, deletePackingFn } from "@/lib/wms.functions";
import { PACKAGE_TYPES, packingInput, type PackingRecord } from "@/lib/wms-types";

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

const emptyForm = {
  order: "",
  wave: "",
  packageType: "Carton" as (typeof PACKAGE_TYPES)[number],
  carton: "",
  weightKg: "",
  dimensions: "",
  material: "",
  labelNumber: `LBL-${Math.floor(90000 + Math.random() * 9000)}`,
  station: "",
  operator: "",
};

function PackingPage() {
  const { can } = useRole();
  const { data: packingResult } = useQuery(packingQuery());
  const { data: ordersResult } = useQuery(ordersQuery());
  const { data: wavesResult } = useQuery(wavesQuery());
  const rows: PackingRecord[] = packingResult?.rows ?? [];
  const orders = ordersResult?.rows ?? [];
  const waves = wavesResult?.rows ?? [];

  const [form, setForm] = useState(emptyForm);

  const saveFn = useServerFn(savePackingFn);
  const saveMutation = useWmsMutation((args: Record<string, unknown>) => saveFn({ data: args as never }), {
    success: () => ({ title: "Package saved" }),
  });

  const completeMutation = useWmsMutation((args: Record<string, unknown>) => saveFn({ data: args as never }), {
    success: (_r, args) => ({ title: "Packing completed", description: `${args['order']} ready for staging.` }),
  });

  const set = (k: keyof typeof emptyForm, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submitNewPackage = () => {
    const parsed = packingInput.safeParse({
      order: form.order,
      wave: form.wave && form.wave !== "__none__" ? form.wave : null,
      packageType: form.packageType,
      carton: form.carton,
      weightKg: Number(form.weightKg || 0),
      dimensions: form.dimensions,
      material: form.material,
      labelNumber: form.labelNumber,
      station: form.station,
      operator: form.operator,
      status: "Pending",
    });
    if (!parsed.success) {
      toast.error("Invalid package details", { description: parsed.error.issues[0]?.message });
      return;
    }
    saveMutation.mutate(parsed.data, {
      onSuccess: () => setForm({ ...emptyForm, labelNumber: `LBL-${Math.floor(90000 + Math.random() * 9000)}` }),
    });
  };

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
          disabled={r.status === "Completed" || !can("pack.execute") || completeMutation.isPending}
          onClick={() =>
            completeMutation.mutate({
              id: r.id,
              order: r.order,
              wave: r.wave || null,
              packageType: r.packageType,
              carton: r.carton,
              weightKg: r.weightKg,
              dimensions: r.dimensions,
              material: r.material,
              labelNumber: r.labelNumber,
              station: r.station,
              operator: r.operator,
              status: "Completed",
            })
          }
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
            <Field label="Sales Order">
              <Select value={form.order} onValueChange={(v) => set("order", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Wave">
              <Select value={form.wave} onValueChange={(v) => set("wave", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {waves.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Package Type">
              <Select value={form.packageType} onValueChange={(v) => set("packageType", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Carton Code">
              <Input placeholder="CTN-60x40x40" value={form.carton} onChange={(e) => set("carton", e.target.value)} />
            </Field>
            <Field label="Weight (kg)">
              <Input type="number" placeholder="18.4" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
            </Field>
            <Field label="Dimensions (cm)">
              <Input placeholder="60 x 40 x 40" value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} />
            </Field>
            <Field label="Packing Materials">
              <Input placeholder="Double-wall + bubble wrap" value={form.material} onChange={(e) => set("material", e.target.value)} />
            </Field>
            <Field label="Station">
              <Input placeholder="PACK-01" value={form.station} onChange={(e) => set("station", e.target.value)} />
            </Field>
            <Field label="Label Number">
              <Input value={form.labelNumber} readOnly />
            </Field>
            <div className="sm:col-span-3 flex justify-end">
              <Button disabled={!can("pack.execute") || saveMutation.isPending} onClick={submitNewPackage}>
                <Save className="h-4 w-4" />
                Save Package
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Package Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {PACKAGE_TYPES.map((t) => (
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
          { key: "packageType", label: "Package Type", options: [...PACKAGE_TYPES], match: (r, v) => r.packageType === v },
          { key: "station", label: "Station", options: [...new Set(rows.map((r) => r.station).filter(Boolean))], match: (r, v) => r.station === v },
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
