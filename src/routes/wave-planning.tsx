import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Layers, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import { carriers, routes, salesOrders, warehouses, waves, zones, type Wave } from "@/data/mock-data";

export const Route = createFileRoute("/wave-planning")({
  head: () => ({
    meta: [
      { title: "Wave Planning | NEXUS WMS Outbound" },
      { name: "description", content: "BR-150 wave planning: group orders by warehouse, zone, priority, carrier, route and capacity." },
      { property: "og:title", content: "Wave Planning | NEXUS WMS Outbound" },
      { property: "og:description", content: "Group outbound orders into optimised picking waves with capacity control." },
    ],
  }),
  component: WavePlanningPage,
});

function WavePlanningPage() {
  const { can } = useRole();
  const [rows, setRows] = useState<Wave[]>(waves);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Wave | null>(null);
  const [pickedOrders, setPickedOrders] = useState<string[]>([]);

  const eligible = salesOrders.filter((o) => ["Reserved", "Allocated", "Validated"].includes(o.status));

  const columns: Column<Wave>[] = [
    { key: "id", header: "Wave Number", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "name", header: "Wave Name", value: (r) => r.name },
    { key: "warehouse", header: "Warehouse", value: (r) => r.warehouse },
    { key: "zone", header: "Zone", value: (r) => r.zone },
    { key: "priority", header: "Priority", value: (r) => r.priority, render: (r) => <StatusBadge value={r.priority} /> },
    { key: "carrier", header: "Carrier", value: (r) => r.carrier },
    { key: "route", header: "Route", value: (r) => r.route },
    { key: "deliveryDate", header: "Delivery Date", value: (r) => r.deliveryDate },
    { key: "orders", header: "Orders", value: (r) => r.orders.length, className: "num text-right" },
    {
      key: "capacity",
      header: "Capacity",
      value: (r) => r.lines / r.capacity,
      render: (r) => (
        <div className="w-28">
          <Progress value={Math.round((r.lines / r.capacity) * 100)} className="h-1.5" />
          <span className="num text-[11px] text-muted-foreground">
            {r.lines}/{r.capacity} lines
          </span>
        </div>
      ),
    },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Preview" onClick={() => setPreview(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Edit" disabled={!can("wave.create")} onClick={() => toast.info(`Editing ${r.id}`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete"
            disabled={!can("wave.create") || r.status !== "Draft"}
            onClick={() => {
              setRows((s) => s.filter((w) => w.id !== r.id));
              toast.success(`${r.id} deleted`);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Wave Planning"
        description="BR-150 · Group multiple orders into waves using warehouse, zone, priority, carrier, route and capacity criteria."
        breadcrumbs={[{ label: "Wave Management" }, { label: "Wave Planning" }]}
        actions={
          <Button disabled={!can("wave.create")} onClick={() => setOpen(true)}>
            <Layers className="h-4 w-4" />
            Create Wave
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Waves" value={rows.length} tone="primary" />
        <StatCard label="Draft" value={rows.filter((r) => r.status === "Draft").length} />
        <StatCard label="Planned" value={rows.filter((r) => r.status === "Planned").length} tone="warning" />
        <StatCard label="Eligible Orders" value={eligible.length} tone="success" />
      </div>

      <DataTable
        data={rows}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.name} ${r.warehouse} ${r.carrier} ${r.route}`}
        onExport={() => toast.success("Wave report queued")}
        filters={[
          { key: "warehouse", label: "Warehouse", options: warehouses.map((w) => w.code), match: (r, v) => r.warehouse === v },
          { key: "zone", label: "Zone", options: zones, match: (r, v) => r.zone === v },
          { key: "priority", label: "Priority", options: ["Critical", "High", "Medium", "Low"], match: (r, v) => r.priority === v },
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Wave</DialogTitle>
            <DialogDescription>Define planning criteria and select the orders to group into this wave.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wave Name">
              <Input placeholder="e.g. Morning Metro Wave" />
            </Field>
            <Field label="Wave Number">
              <Input value={`WV-2026-0${236 + rows.length - waves.length}`} readOnly />
            </Field>
            <Field label="Warehouse">
              <Picker options={warehouses.map((w) => w.code)} placeholder="Select warehouse" />
            </Field>
            <Field label="Zone">
              <Picker options={zones} placeholder="Select zone" />
            </Field>
            <Field label="Priority">
              <Picker options={["Critical", "High", "Medium", "Low"]} placeholder="Select priority" />
            </Field>
            <Field label="Carrier">
              <Picker options={carriers} placeholder="Select carrier" />
            </Field>
            <Field label="Route">
              <Picker options={routes} placeholder="Select route" />
            </Field>
            <Field label="Delivery Date">
              <Input type="date" defaultValue="2026-08-05" />
            </Field>
            <Field label="Wave Capacity (lines)">
              <Input type="number" defaultValue={80} />
            </Field>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Eligible Orders ({eligible.length})</CardTitle>
            </CardHeader>
            <CardContent className="max-h-56 space-y-2 overflow-y-auto">
              {eligible.map((o) => (
                <label key={o.id} className="flex items-center gap-3 rounded-md border border-border p-2 text-sm">
                  <Checkbox
                    checked={pickedOrders.includes(o.id)}
                    onCheckedChange={(v) => setPickedOrders((s) => (v ? [...s, o.id] : s.filter((x) => x !== o.id)))}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-primary">{o.id}</span> · {o.customer}
                  </span>
                  <StatusBadge value={o.priority} />
                  <StatusBadge value={o.status} />
                </label>
              ))}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO(integration): persist wave via the WMS Wave API.
                setOpen(false);
                toast.success("Wave created", { description: `${pickedOrders.length} order(s) grouped. Awaiting reservation confirmation.` });
                setPickedOrders([]);
              }}
            >
              Create Wave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {preview?.name} {preview && <StatusBadge value={preview.status} />}
            </DialogTitle>
            <DialogDescription>
              {preview?.id} · Created by {preview?.createdBy} at {preview?.createdAt}
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Warehouse" value={preview?.warehouse} />
            <Detail label="Zone" value={preview?.zone} />
            <Detail label="Carrier" value={preview?.carrier} />
            <Detail label="Route" value={preview?.route} />
            <Detail label="Delivery Date" value={preview?.deliveryDate} />
            <Detail label="Capacity" value={`${preview?.lines}/${preview?.capacity} lines`} />
            <Detail label="Reservation" value={preview?.reservationConfirmed ? "Confirmed" : "Not confirmed"} />
            <Detail label="Orders" value={preview?.orders.join(", ")} />
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
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

function Picker({ options, placeholder }: { options: string[]; placeholder: string }) {
  return (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
