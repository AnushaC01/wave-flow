import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { carriers, shipments, type Shipment } from "@/data/mock-data";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch Authorization | NEXUS WMS" },
      { name: "description", content: "BR-157 dispatch approval — only warehouse managers can authorize verified shipments for dispatch." },
      { property: "og:title", content: "Dispatch Authorization | NEXUS WMS" },
      { property: "og:description", content: "Approve or reject outbound shipments awaiting dispatch authorization." },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const { can, role } = useRole();
  const [rows, setRows] = useState<Shipment[]>(shipments);
  const isManager = role === "Warehouse Manager" || role === "Administrator";

  const decide = (r: Shipment, approve: boolean) => {
    if (!isManager) {
      toast.error("Not authorized", { description: "Only Warehouse Managers can authorize dispatch (BR-157)." });
      return;
    }
    if (approve && !r.loadVerified) {
      toast.error("Dispatch blocked", { description: `${r.id} has not passed load verification (BR-156).` });
      return;
    }
    setRows((s) =>
      s.map((x) =>
        x.id === r.id
          ? { ...x, dispatch: approve ? "Dispatched" : "Rejected", status: approve ? "In Transit" : x.status }
          : x,
      ),
    );
    toast[approve ? "success" : "warning"](approve ? `${r.id} dispatched` : `${r.id} dispatch rejected`);
  };

  const columns: Column<Shipment>[] = [
    { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "orders", header: "Orders", value: (r) => r.orders.join(", ") },
    { key: "carrier", header: "Carrier", value: (r) => r.carrier },
    { key: "vehicle", header: "Vehicle", value: (r) => r.vehicle },
    { key: "driver", header: "Driver", value: (r) => r.driver },
    { key: "destination", header: "Destination", value: (r) => r.destination },
    {
      key: "loadVerified",
      header: "Load Verified",
      value: (r) => String(r.loadVerified),
      render: (r) => <StatusBadge value={r.loadVerified ? "Passed" : "Failed"} />,
    },
    { key: "dispatch", header: "Dispatch Status", value: (r) => r.dispatch, render: (r) => <StatusBadge value={r.dispatch} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" disabled={!can("shipment.track") && !isManager} onClick={() => decide(r, true)}>
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(r, false)}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dispatch Authorization"
        description="BR-157 · Dispatch approval is restricted to Warehouse Managers."
        breadcrumbs={[{ label: "Outbound Logistics" }, { label: "Dispatch Authorization" }]}
        badge={<StatusBadge value={isManager ? "Approved" : "Pending"} />}
      />

      {!isManager && (
        <Alert className="mb-4 border-danger/30 bg-danger-soft">
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            You are signed in as {role}. Dispatch approval requires the Warehouse Manager role.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting Dispatch" value={rows.filter((r) => r.dispatch === "Awaiting Dispatch").length} tone="warning" />
        <StatCard label="Approved" value={rows.filter((r) => r.dispatch === "Approved").length} tone="primary" />
        <StatCard label="Dispatched" value={rows.filter((r) => r.dispatch === "Dispatched").length} tone="success" />
        <StatCard label="Rejected" value={rows.filter((r) => r.dispatch === "Rejected").length} tone="danger" />
      </div>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.carrier} ${r.driver} ${r.destination}`}
        onExport={() => toast.success("Dispatch log exported")}
        filters={[
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
          { key: "dispatch", label: "Dispatch Status", options: ["Awaiting Dispatch", "Approved", "Rejected", "Dispatched"], match: (r, v) => r.dispatch === v },
        ]}
      />
    </div>
  );
}
