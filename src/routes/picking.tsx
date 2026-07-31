import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Pause, Play, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { pickLines, waves, zones, type PickLine } from "@/data/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/picking")({
  head: () => ({
    meta: [
      { title: "Picking Execution | NEXUS WMS" },
      { name: "description", content: "BR-152 picking screen with picker assignment, warehouse map, barcode verification and pick progress." },
      { property: "og:title", content: "Picking Execution | NEXUS WMS" },
      { property: "og:description", content: "Execute pick lists with mandatory barcode verification for every picked item." },
    ],
  }),
  component: PickingPage,
});

const MAP_ZONES = ["Zone A", "Zone B", "Zone C", "Zone D", "Bulk Zone", "Cold Zone", "High Bay", "Staging"];

function PickingPage() {
  const { can } = useRole();
  const [rows, setRows] = useState<PickLine[]>(pickLines);
  const [session, setSession] = useState<"idle" | "active" | "paused">("active");
  const [scan, setScan] = useState("");
  const [active, setActive] = useState<PickLine | null>(pickLines[0] ?? null);

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const pickedQty = rows.reduce((s, r) => s + r.pickedQty, 0);

  const verifyScan = () => {
    if (!active) return;
    if (scan.trim() !== active.barcode) {
      toast.error("Barcode mismatch", { description: "Scanned barcode does not match the pick line. Item cannot be confirmed." });
      return;
    }
    // TODO(integration): send verification event to the Barcode Scanner / device gateway.
    setRows((s) => s.map((r) => (r.id === active.id ? { ...r, verified: true, pickedQty: r.quantity, status: "Picked" } : r)));
    toast.success("Item verified & picked", { description: `${active.sku} confirmed at ${active.location}.` });
    setScan("");
  };

  const columns: Column<PickLine>[] = [
    { key: "id", header: "Pick Line", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "picker", header: "Assigned Picker", value: (r) => r.picker },
    { key: "sku", header: "SKU", value: (r) => r.sku },
    { key: "product", header: "Product", value: (r) => r.product },
    { key: "location", header: "Location", value: (r) => r.location },
    { key: "quantity", header: "Required", value: (r) => r.quantity, className: "num text-right" },
    { key: "pickedQty", header: "Picked", value: (r) => r.pickedQty, className: "num text-right" },
    { key: "remaining", header: "Remaining", value: (r) => r.quantity - r.pickedQty, className: "num text-right" },
    {
      key: "verified",
      header: "Barcode",
      value: (r) => String(r.verified),
      render: (r) => <StatusBadge value={r.verified ? "Passed" : "Pending"} />,
    },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <Button size="sm" variant={active?.id === r.id ? "default" : "outline"} onClick={() => setActive(r)}>
          <ScanBarcode className="h-4 w-4" />
          Scan
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Picking"
        description="BR-152 · Every picked item must be barcode verified before confirmation."
        breadcrumbs={[{ label: "Warehouse Execution" }, { label: "Picking" }]}
        badge={<StatusBadge value={session === "active" ? "In Progress" : session === "paused" ? "Pending" : "Draft"} />}
        actions={
          <>
            <Button variant="outline" disabled={!can("pick.execute") || session !== "active"} onClick={() => { setSession("paused"); toast.info("Picking paused"); }}>
              <Pause className="h-4 w-4" />
              Pause
            </Button>
            <Button variant="outline" disabled={!can("pick.execute") || session !== "paused"} onClick={() => { setSession("active"); toast.success("Picking resumed"); }}>
              <Play className="h-4 w-4" />
              Resume
            </Button>
            <Button variant="outline" disabled={!can("pick.execute")} onClick={() => { setSession("idle"); toast.success("Picking completed", { description: "Orders released to packing." }); }}>
              <CheckCircle2 className="h-4 w-4" />
              Complete Picking
            </Button>
            <Button disabled={!can("pick.execute")} onClick={() => { setSession("active"); toast.success("Picking started"); }}>
              <Play className="h-4 w-4" />
              Start Picking
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pick Lines" value={rows.length} tone="primary" />
        <StatCard label="Units Picked" value={`${pickedQty} / ${totalQty}`} tone="success" />
        <StatCard label="Barcode Verified" value={rows.filter((r) => r.verified).length} />
        <StatCard label="Short Picks" value={rows.filter((r) => r.status === "Short").length} tone="danger" />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Barcode Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* TODO(integration): bind to the physical barcode scanner / warehouse device SDK. */}
            <p className="text-xs text-muted-foreground">
              Active line: <span className="font-medium text-foreground">{active?.id ?? "—"}</span> · {active?.sku} @ {active?.location}
            </p>
            <div className="flex gap-2">
              <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder={active ? `Scan ${active.barcode}` : "Select a pick line"} />
              <Button onClick={verifyScan} disabled={!active || !can("pick.execute")}>
                Verify
              </Button>
            </div>
            <Alert className="border-warning/30 bg-warning-soft">
              <AlertTitle className="text-sm">Scanner placeholder</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Hardware scanner input will auto-populate this field once the device gateway is connected.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Warehouse Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {MAP_ZONES.map((z) => {
                const linesHere = rows.filter((r) => r.zone === z).length;
                return (
                  <div
                    key={z}
                    className={cn(
                      "rounded-md border p-2 text-center text-[11px]",
                      active?.zone === z ? "border-primary bg-primary-soft text-primary" : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    <p className="font-medium">{z}</p>
                    <p className="num">{linesHere} lines</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Aisle-level map renders from the Warehouse Master Data module.</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wave Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {waves
              .filter((w) => ["Released", "Picking"].includes(w.status))
              .map((w) => {
                const wl = rows.filter((r) => r.wave === w.id);
                const pct = wl.length ? Math.round((wl.filter((r) => r.status === "Picked").length / wl.length) * 100) : 0;
                return (
                  <div key={w.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{w.id}</span>
                      <span className="num text-muted-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        pageSize={8}
        searchKeys={(r) => `${r.id} ${r.picker} ${r.sku} ${r.product} ${r.location}`}
        filters={[
          { key: "picker", label: "Picker", options: [...new Set(rows.map((r) => r.picker))], match: (r, v) => r.picker === v },
          { key: "zone", label: "Zone", options: zones, match: (r, v) => r.zone === v },
          { key: "status", label: "Status", options: ["Pending", "In Progress", "Picked", "Short"], match: (r, v) => r.status === v },
        ]}
      />
    </div>
  );
}
