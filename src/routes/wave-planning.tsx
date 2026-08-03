import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, Layers, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { errorMessage, ordersQuery, referenceQuery, useWmsMutation, wavesQuery } from "@/lib/wms-queries";
import { createWaveFn, deleteWaveFn, updateWaveFn } from "@/lib/wms.functions";
import { waveInput, type Priority, type SalesOrder, type Wave } from "@/lib/wms-types";

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

const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];

interface FormState {
  name: string;
  warehouse: string;
  zone: string;
  priority: Priority | "";
  carrier: string;
  route: string;
  deliveryDate: string;
  capacity: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  warehouse: "",
  zone: "",
  priority: "",
  carrier: "",
  route: "",
  deliveryDate: "",
  capacity: "80",
};

function WavePlanningPage() {
  const { can } = useRole();
  const { data: wavesResult, isLoading } = useQuery(wavesQuery());
  const { data: ordersResult } = useQuery(ordersQuery());
  const { data: reference } = useQuery(referenceQuery());
  const rows = wavesResult?.rows ?? [];
  const salesOrders: SalesOrder[] = ordersResult?.rows ?? [];
  const warehouses = reference?.warehouses ?? [];
  const zones = reference?.zones ?? [];
  const carriers = reference?.carriers ?? [];
  const routes = reference?.routes ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Wave | null>(null);
  const [preview, setPreview] = useState<Wave | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Wave | null>(null);
  const [pickedOrders, setPickedOrders] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const eligible = salesOrders.filter((o) => ["Reserved", "Allocated", "Validated"].includes(o.status));

  const createFn = useServerFn(createWaveFn);
  const updateFn = useServerFn(updateWaveFn);
  const deleteFn = useServerFn(deleteWaveFn);

  const createMutation = useWmsMutation((args: Parameters<typeof createFn>[0]["data"]) => createFn({ data: args }), {
    success: () => ({ title: "Wave created", description: "Awaiting reservation confirmation." }),
  });
  const updateMutation = useWmsMutation((args: { id: string; data: Parameters<typeof updateFn>[0]["data"]["data"] }) => updateFn({ data: args }), {
    success: (_r, args) => ({ title: `${args.id} updated` }),
  });
  const deleteMutation = useWmsMutation((args: { id: string }) => deleteFn({ data: args }), {
    success: (_r, args) => ({ title: `${args.id} deleted` }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPickedOrders([]);
    setOpen(true);
  };

  const openEdit = (w: Wave) => {
    setEditing(w);
    setForm({
      name: w.name,
      warehouse: w.warehouse,
      zone: w.zone,
      priority: w.priority,
      carrier: w.carrier,
      route: w.route,
      deliveryDate: w.deliveryDate,
      capacity: String(w.capacity),
    });
    setPickedOrders(w.orders);
    setOpen(true);
  };

  const selectedOrders = salesOrders.filter((o) => pickedOrders.includes(o.id));
  const computedLines = selectedOrders.reduce((s, o) => s + o.lines.length, 0);

  const submit = () => {
    const parsed = waveInput.safeParse({
      id: editing?.id,
      name: form.name,
      warehouse: form.warehouse,
      zone: form.zone,
      priority: form.priority || undefined,
      carrier: form.carrier,
      route: form.route,
      deliveryDate: form.deliveryDate,
      capacity: Number(form.capacity) || 0,
      status: editing?.status ?? "Draft",
      createdBy: editing?.createdBy ?? "System",
      orders: pickedOrders,
    });
    if (!parsed.success) {
      toast.error("Invalid wave", { description: parsed.error.issues[0]?.message });
      return;
    }
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: parsed.data },
        {
          onSuccess: () => {
            setOpen(false);
            setPickedOrders([]);
          },
        },
      );
    } else {
      createMutation.mutate(parsed.data, {
        onSuccess: () => {
          setOpen(false);
          setPickedOrders([]);
        },
        onError: (err) => toast.error("Failed to create wave", { description: errorMessage(err) }),
      });
    }
  };

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
      value: (r) => (r.capacity ? r.lines / r.capacity : 0),
      render: (r) => (
        <div className="w-28">
          <Progress value={r.capacity ? Math.round((r.lines / r.capacity) * 100) : 0} className="h-1.5" />
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
          <Button size="icon" variant="ghost" aria-label="Edit" disabled={!can("wave.create")} onClick={() => openEdit(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete"
            disabled={!can("wave.create") || r.status !== "Draft"}
            onClick={() => setPendingDelete(r)}
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
          <Button disabled={!can("wave.create")} onClick={openCreate}>
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
        loading={isLoading}
        searchKeys={(r) => `${r.id} ${r.name} ${r.warehouse} ${r.carrier} ${r.route}`}
        onExport={() => toast.success("Wave report queued")}
        filters={[
          { key: "warehouse", label: "Warehouse", options: warehouses.map((w) => w.code), match: (r, v) => r.warehouse === v },
          { key: "zone", label: "Zone", options: zones, match: (r, v) => r.zone === v },
          { key: "priority", label: "Priority", options: PRIORITIES, match: (r, v) => r.priority === v },
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.id}` : "Create Wave"}</DialogTitle>
            <DialogDescription>Define planning criteria and select the orders to group into this wave.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wave Name">
              <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Morning Metro Wave" />
            </Field>
            <Field label="Wave Number">
              <Input value={editing?.id ?? "Auto-generated"} readOnly />
            </Field>
            <Field label="Warehouse">
              <Picker options={warehouses.map((w) => w.code)} placeholder="Select warehouse" value={form.warehouse} onChange={(v) => setForm((s) => ({ ...s, warehouse: v }))} />
            </Field>
            <Field label="Zone">
              <Picker options={zones} placeholder="Select zone" value={form.zone} onChange={(v) => setForm((s) => ({ ...s, zone: v }))} />
            </Field>
            <Field label="Priority">
              <Picker options={PRIORITIES} placeholder="Select priority" value={form.priority} onChange={(v) => setForm((s) => ({ ...s, priority: v as Priority }))} />
            </Field>
            <Field label="Carrier">
              <Picker options={carriers} placeholder="Select carrier" value={form.carrier} onChange={(v) => setForm((s) => ({ ...s, carrier: v }))} />
            </Field>
            <Field label="Route">
              <Picker options={routes} placeholder="Select route" value={form.route} onChange={(v) => setForm((s) => ({ ...s, route: v }))} />
            </Field>
            <Field label="Delivery Date">
              <Input type="date" value={form.deliveryDate} onChange={(e) => setForm((s) => ({ ...s, deliveryDate: e.target.value }))} />
            </Field>
            <Field label="Wave Capacity (lines)">
              <Input type="number" value={form.capacity} onChange={(e) => setForm((s) => ({ ...s, capacity: e.target.value }))} />
            </Field>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Eligible Orders ({eligible.length}) · Selected lines: {computedLines}
              </CardTitle>
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
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save Changes" : "Create Wave"}
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.id}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The wave and its association with orders will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate({ id: pendingDelete.id });
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function Picker({ options, placeholder, value, onChange }: { options: string[]; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
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
