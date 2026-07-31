import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { shipments, type Shipment } from "@/data/mock-data";

export const Route = createFileRoute("/load-verification")({
  head: () => ({
    meta: [
      { title: "Load Verification | NEXUS WMS" },
      { name: "description", content: "BR-156 load verification checklist — shipments cannot dispatch until loading is verified." },
      { property: "og:title", content: "Load Verification | NEXUS WMS" },
      { property: "og:description", content: "Verify order count, seal integrity, documents and vehicle readiness before dispatch." },
    ],
  }),
  component: LoadVerificationPage,
});

const CHECKS = [
  "Order count matches loading manifest",
  "Carton / pallet condition inspected",
  "Container seal number matches record",
  "Shipping documents attached",
  "Vehicle inspection completed",
  "Driver identity confirmed",
];

function LoadVerificationPage() {
  const { can } = useRole();
  const [rows, setRows] = useState<Shipment[]>(shipments);
  const [selected, setSelected] = useState<Shipment>(shipments[2]!);
  const [checked, setChecked] = useState<string[]>([]);

  const allChecked = CHECKS.every((c) => checked.includes(c));

  const toggle = (c: string) =>
    setChecked((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const verify = () => {
    if (!allChecked) {
      toast.error("Verification incomplete", { description: "All checklist items must be confirmed before verification." });
      return;
    }
    // TODO(integration): persist verification via the Shipment Verification API.
    setRows((s) => s.map((r) => (r.id === selected.id ? { ...r, loadVerified: true } : r)));
    toast.success(`${selected.id} load verified`, { description: "Shipment can now be sent for dispatch approval." });
  };

  const columns: Column<Shipment>[] = [
    { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "orders", header: "Orders", value: (r) => r.orders.join(", ") },
    { key: "vehicle", header: "Vehicle", value: (r) => r.vehicle },
    { key: "seal", header: "Seal No.", value: (r) => r.seal, className: "num" },
    { key: "dock", header: "Dock", value: (r) => r.dock },
    {
      key: "loadVerified",
      header: "Verification",
      value: (r) => String(r.loadVerified),
      render: (r) => <StatusBadge value={r.loadVerified ? "Passed" : "Pending"} />,
    },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <Button size="sm" variant={selected.id === r.id ? "default" : "outline"} onClick={() => { setSelected(r); setChecked([]); }}>
          Open Checklist
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Load Verification"
        description="BR-156 · A shipment cannot be dispatched without successful load verification."
        breadcrumbs={[{ label: "Outbound Logistics" }, { label: "Load Verification" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting Verification" value={rows.filter((r) => !r.loadVerified).length} tone="warning" />
        <StatCard label="Verified" value={rows.filter((r) => r.loadVerified).length} tone="success" />
        <StatCard label="Checklist Items" value={CHECKS.length} tone="primary" />
        <StatCard label="Shipments" value={rows.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <DataTable
          data={rows}
          columns={columns}
          searchKeys={(r) => `${r.id} ${r.vehicle} ${r.seal} ${r.orders.join(" ")}`}
          filters={[
            { key: "verified", label: "Verification", options: ["Verified", "Pending"], match: (r, v) => (v === "Verified" ? r.loadVerified : !r.loadVerified) },
          ]}
        />

        <Card className="h-fit border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist · {selected.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CHECKS.map((c) => (
              <div key={c} className="flex items-start gap-2">
                <Checkbox id={c} checked={checked.includes(c)} onCheckedChange={() => toggle(c)} />
                <Label htmlFor={c} className="text-xs leading-snug text-muted-foreground">
                  {c}
                </Label>
              </div>
            ))}
            {!allChecked && (
              <Alert className="border-warning/30 bg-warning-soft">
                <AlertTitle className="text-sm">Verification pending</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  {CHECKS.length - checked.length} item(s) remaining before this load can be verified.
                </AlertDescription>
              </Alert>
            )}
            <Button className="w-full" disabled={!can("load.verify")} onClick={verify}>
              <ShieldCheck className="h-4 w-4" />
              Confirm Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
