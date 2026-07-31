import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Rocket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { carriers, warehouses, waves, type Wave } from "@/data/mock-data";

export const Route = createFileRoute("/wave-release")({
  head: () => ({
    meta: [
      { title: "Wave Release | NEXUS WMS Outbound" },
      { name: "description", content: "Release planned waves to the floor. Inventory reservation must be confirmed before release." },
      { property: "og:title", content: "Wave Release | NEXUS WMS Outbound" },
      { property: "og:description", content: "Validate reservations and release waves for pick list generation." },
    ],
  }),
  component: WaveReleasePage,
});

function WaveReleasePage() {
  const { can } = useRole();
  const [rows, setRows] = useState<Wave[]>(waves);
  const blocked = rows.filter((w) => w.status === "Planned" && !w.reservationConfirmed);

  const release = (w: Wave) => {
    if (!w.reservationConfirmed) {
      toast.error("Release blocked", { description: `${w.id} has no confirmed inventory reservation (validation rule).` });
      return;
    }
    // TODO(integration): call the Wave Release API and trigger pick list generation.
    setRows((s) => s.map((r) => (r.id === w.id ? { ...r, status: "Released" } : r)));
    toast.success(`${w.id} released`, { description: "Pick lists can now be generated." });
  };

  const columns: Column<Wave>[] = [
    { key: "id", header: "Wave", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "name", header: "Wave Name", value: (r) => r.name },
    { key: "warehouse", header: "Warehouse", value: (r) => r.warehouse },
    { key: "priority", header: "Priority", value: (r) => r.priority, render: (r) => <StatusBadge value={r.priority} /> },
    { key: "carrier", header: "Carrier", value: (r) => r.carrier },
    { key: "orders", header: "Orders", value: (r) => r.orders.length, className: "num text-right" },
    { key: "lines", header: "Lines", value: (r) => r.lines, className: "num text-right" },
    {
      key: "reservation",
      header: "Reservation",
      value: (r) => String(r.reservationConfirmed),
      render: (r) => <StatusBadge value={r.reservationConfirmed ? "Passed" : "Pending"} />,
    },
    { key: "status", header: "Wave Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <Button
          size="sm"
          disabled={!can("wave.release") || !["Planned", "Draft"].includes(r.status)}
          onClick={() => release(r)}
        >
          <Rocket className="h-4 w-4" />
          Release
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Wave Release"
        description="Validation rule · A wave cannot be released without confirmed inventory reservation."
        breadcrumbs={[{ label: "Wave Management" }, { label: "Wave Release" }]}
        actions={
          <Button
            variant="outline"
            disabled={!can("wave.release")}
            onClick={() => toast.info("Reservation re-check requested", { description: "TODO: Inventory API reservation validation." })}
          >
            <ShieldCheck className="h-4 w-4" />
            Re-check Reservations
          </Button>
        }
      />

      {blocked.length > 0 && (
        <Alert className="mb-4 border-warning/30 bg-warning-soft">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{blocked.length} wave(s) blocked from release</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Reserve inventory for {blocked.map((w) => w.id).join(", ")} before release.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready to Release" value={rows.filter((r) => r.status === "Planned" && r.reservationConfirmed).length} tone="success" />
        <StatCard label="Blocked" value={blocked.length} tone="danger" />
        <StatCard label="Released" value={rows.filter((r) => r.status === "Released").length} tone="primary" />
        <StatCard label="In Picking" value={rows.filter((r) => r.status === "Picking").length} tone="warning" />
      </div>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.name} ${r.warehouse} ${r.carrier}`}
        filters={[
          { key: "warehouse", label: "Warehouse", options: warehouses.map((w) => w.code), match: (r, v) => r.warehouse === v },
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
          { key: "status", label: "Status", options: ["Draft", "Planned", "Released", "Picking", "Completed"], match: (r, v) => r.status === v },
        ]}
      />
    </div>
  );
}
