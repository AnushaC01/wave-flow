import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eye, PackageCheck, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { useRole } from "@/context/role-context";
import {
  allocateOrderFn,
  createOrderFn,
  deleteOrderFn,
  reserveOrderFn,
  updateOrderFn,
  validateOrderFn,
} from "@/lib/wms.functions";
import { errorMessage, ordersQuery, referenceQuery, useWmsMutation } from "@/lib/wms-queries";
import { PRIORITIES, salesOrderInput, type OrderLine, type SalesOrder } from "@/lib/wms-types";

export const Route = createFileRoute("/sales-orders")({
  head: () => ({
    meta: [
      { title: "Sales Orders | NEXUS WMS Outbound" },
      { name: "description", content: "BR-148 customer order integration: create, validate and track outbound sales orders." },
      { property: "og:title", content: "Sales Orders | NEXUS WMS Outbound" },
      { property: "og:description", content: "Create, validate and monitor customer sales orders ready for wave planning." },
    ],
  }),
  component: SalesOrdersPage,
});

interface FormLine {
  sku: string;
  product: string;
  quantity: string;
}

interface FormState {
  customer: string;
  orderDate: string;
  deliveryDate: string;
  priority: string;
  warehouse: string;
  carrier: string;
  route: string;
  valueUsd: string;
  lines: FormLine[];
}

const emptyForm = (): FormState => ({
  customer: "",
  orderDate: "",
  deliveryDate: "",
  priority: "",
  warehouse: "",
  carrier: "",
  route: "",
  valueUsd: "",
  lines: [{ sku: "", product: "", quantity: "1" }],
});

function toForm(o: SalesOrder): FormState {
  return {
    customer: o.customer,
    orderDate: o.orderDate,
    deliveryDate: o.deliveryDate,
    priority: o.priority,
    warehouse: o.warehouse,
    carrier: o.carrier,
    route: o.route ?? "",
    valueUsd: String(o.valueUsd ?? 0),
    lines: o.lines.length
      ? o.lines.map((l) => ({ sku: l.sku, product: l.product, quantity: String(l.quantity) }))
      : [{ sku: "", product: "", quantity: "1" }],
  };
}

function toCsv(rows: SalesOrder[]): string {
  const header = ["Sales Order", "Customer", "Order Date", "Delivery Date", "Priority", "Warehouse", "Items", "Qty", "Status", "Validation"];
  const lines = rows.map((r) =>
    [r.id, r.customer, r.orderDate, r.deliveryDate, r.priority, r.warehouse, r.items, r.quantity, r.status, r.validation]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function SalesOrdersPage() {
  const { can } = useRole();

  const ordersQ = useQuery(ordersQuery());
  const referenceQ = useQuery(referenceQuery());
  const orders = ordersQ.data?.rows ?? [];
  const customers = referenceQ.data?.customers ?? [];
  const products = referenceQ.data?.products ?? [];
  const warehouses = referenceQ.data?.warehouses ?? [];
  const carriers = referenceQ.data?.carriers ?? [];
  const routes = referenceQ.data?.routes ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [deleting, setDeleting] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createFn = useServerFn(createOrderFn);
  const updateFn = useServerFn(updateOrderFn);
  const deleteFn = useServerFn(deleteOrderFn);
  const validateFn = useServerFn(validateOrderFn);
  const allocateFn = useServerFn(allocateOrderFn);
  const reserveFn = useServerFn(reserveOrderFn);

  const createMutation = useWmsMutation((args: Parameters<typeof createFn>[0]["data"]) => createFn({ data: args }), {
    success: () => ({ title: "Sales order created", description: "Order queued for validation and allocation." }),
  });
  const updateMutation = useWmsMutation(
    (args: { id: string; data: Parameters<typeof updateFn>[0]["data"]["data"] }) => updateFn({ data: args }),
    { success: (_r, args) => ({ title: `${args.id} updated` }) },
  );
  const deleteMutation = useWmsMutation((args: { id: string }) => deleteFn({ data: args }), {
    success: (_r, args) => ({ title: `${args.id} deleted` }),
  });
  const validateMutation = useWmsMutation((args: { id: string }) => validateFn({ data: args }), {
    success: (result: { reason?: string; validation?: string }, args) => ({
      title: `${args.id} validation ${result?.validation ?? "checked"}`,
      description: result?.reason,
    }),
  });
  const allocateMutation = useWmsMutation((args: { id: string }) => allocateFn({ data: args }), {
    success: (_r, args) => ({ title: `${args.id} allocated` }),
  });
  const reserveMutation = useWmsMutation((args: { id: string }) => reserveFn({ data: args }), {
    success: (_r, args) => ({ title: `${args.id} reserved` }),
  });

  useEffect(() => {
    if (editing) setForm(toForm(editing));
  }, [editing]);

  const openCreate = () => {
    setForm(emptyForm());
    setErrors({});
    setCreateOpen(true);
  };

  const closeDialog = () => {
    setCreateOpen(false);
    setEditing(null);
    setErrors({});
  };

  const updateLine = (idx: number, patch: Partial<FormLine>) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  };

  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, { sku: "", product: "", quantity: "1" }] }));
  const removeLine = (idx: number) => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const submit = () => {
    const payload = {
      id: editing?.id,
      customer: form.customer,
      orderDate: form.orderDate,
      deliveryDate: form.deliveryDate,
      priority: form.priority,
      warehouse: form.warehouse,
      carrier: form.carrier,
      route: form.route,
      status: editing?.status ?? "Received",
      validation: editing?.validation ?? "Pending",
      valueUsd: Number(form.valueUsd) || 0,
      lines: form.lines.map((l) => {
        const product = products.find((p) => p.sku === l.sku);
        return {
          sku: l.sku,
          product: product?.name ?? l.product,
          quantity: Number(l.quantity) || 0,
          allocated: 0,
          picked: 0,
          location: "",
        };
      }),
    };
    const parsed = salesOrderInput.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields", { description: parsed.error.issues[0]?.message });
      return;
    }
    setErrors({});
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: parsed.data },
        { onSuccess: closeDialog, onError: (e) => toast.error("Update failed", { description: errorMessage(e) }) },
      );
    } else {
      createMutation.mutate(parsed.data, {
        onSuccess: closeDialog,
        onError: (e) => toast.error("Create failed", { description: errorMessage(e) }),
      });
    }
  };

  const columns: Column<SalesOrder>[] = [
    { key: "id", header: "Sales Order", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "customer", header: "Customer", value: (r) => r.customer },
    { key: "orderDate", header: "Order Date", value: (r) => r.orderDate },
    { key: "deliveryDate", header: "Delivery Date", value: (r) => r.deliveryDate },
    { key: "priority", header: "Priority", value: (r) => r.priority, render: (r) => <StatusBadge value={r.priority} /> },
    { key: "warehouse", header: "Warehouse", value: (r) => r.warehouse },
    { key: "items", header: "Items", value: (r) => r.items, className: "num text-right" },
    { key: "quantity", header: "Qty", value: (r) => r.quantity, className: "num text-right" },
    { key: "status", header: "Order Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
    { key: "validation", header: "Validation", value: (r) => r.validation, render: (r) => <StatusBadge value={r.validation} /> },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="View" onClick={() => setSelected(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(r)} disabled={!can("order.create")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDeleting(r)} disabled={!can("order.create")}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={r.validation === "Passed" || !can("order.validate") || validateMutation.isPending}
            onClick={() => validateMutation.mutate({ id: r.id })}
          >
            <CheckCircle2 className="h-4 w-4" />
            Validate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={r.status !== "Validated" || !can("inventory.reserve") || allocateMutation.isPending}
            onClick={() => allocateMutation.mutate({ id: r.id })}
          >
            <PackagePlus className="h-4 w-4" />
            Allocate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={r.status !== "Allocated" || !can("inventory.reserve") || reserveMutation.isPending}
            onClick={() => reserveMutation.mutate({ id: r.id })}
          >
            <PackageCheck className="h-4 w-4" />
            Reserve
          </Button>
        </div>
      ),
    },
  ];

  const dialogOpen = createOpen || !!editing;

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="BR-148 · Customer order integration and outbound order lifecycle."
        breadcrumbs={[{ label: "Order Management" }, { label: "Sales Orders" }]}
        actions={
          <Button onClick={openCreate} disabled={!can("order.create")}>
            <Plus className="h-4 w-4" />
            Create Order
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Orders" value={orders.length} tone="primary" />
        <StatCard label="Pending Validation" value={orders.filter((o) => o.validation === "Pending").length} tone="warning" />
        <StatCard label="Validation Failed" value={orders.filter((o) => o.validation === "Failed").length} tone="danger" />
        <StatCard label="Ready for Planning" value={orders.filter((o) => o.status === "Reserved").length} tone="success" />
      </div>

      <DataTable
        data={orders}
        columns={columns}
        loading={ordersQ.isLoading}
        searchKeys={(r) => `${r.id} ${r.customer} ${r.warehouse} ${r.carrier}`}
        onExport={() => {
          const blob = new Blob([toCsv(orders)], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "sales-orders.csv";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Export ready", { description: "sales-orders.csv downloaded." });
        }}
        filters={[
          { key: "priority", label: "Priority", options: PRIORITIES, match: (r, v) => r.priority === v },
          { key: "warehouse", label: "Warehouse", options: warehouses.map((w) => w.code), match: (r, v) => r.warehouse === v },
          { key: "customer", label: "Customer", options: customers.map((c) => c.name), match: (r, v) => r.customer === v },
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
        ]}
      />

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.id}` : "Create Sales Order"}</DialogTitle>
            <DialogDescription>Manual order entry. Orders normally arrive via the ERP integration.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" error={errors.customer}>
              <Selector options={customers.map((c) => c.name)} value={form.customer} onChange={(v) => setForm((f) => ({ ...f, customer: v }))} placeholder="Select customer" />
            </Field>
            <Field label="Order Date" error={errors.orderDate}>
              <Input type="date" value={form.orderDate} onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))} />
            </Field>
            <Field label="Delivery Date" error={errors.deliveryDate}>
              <Input type="date" value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} />
            </Field>
            <Field label="Priority" error={errors.priority}>
              <Selector options={PRIORITIES} value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} placeholder="Select priority" />
            </Field>
            <Field label="Warehouse" error={errors.warehouse}>
              <Selector options={warehouses.map((w) => w.code)} value={form.warehouse} onChange={(v) => setForm((f) => ({ ...f, warehouse: v }))} placeholder="Select warehouse" />
            </Field>
            <Field label="Carrier" error={errors.carrier}>
              <Selector options={carriers} value={form.carrier} onChange={(v) => setForm((f) => ({ ...f, carrier: v }))} placeholder="Select carrier" />
            </Field>
            <Field label="Route" error={errors.route}>
              <Selector options={routes} value={form.route} onChange={(v) => setForm((f) => ({ ...f, route: v }))} placeholder="Select route" />
            </Field>
            <Field label="Order Value (USD)" error={errors.valueUsd}>
              <Input type="number" value={form.valueUsd} onChange={(e) => setForm((f) => ({ ...f, valueUsd: e.target.value }))} />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Order Lines</Label>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>
            {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
            <div className="space-y-2">
              {form.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_32px] items-end gap-2 rounded-md border border-border p-2">
                  <Field label="SKU">
                    <Selector
                      options={products.map((p) => p.sku)}
                      value={line.sku}
                      onChange={(v) => updateLine(idx, { sku: v, product: products.find((p) => p.sku === v)?.name ?? "" })}
                      placeholder="Select SKU"
                    />
                  </Field>
                  <Field label="Quantity">
                    <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                  </Field>
                  <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => removeLine(idx)} disabled={form.lines.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save Changes" : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {selected?.id}
              {selected && <StatusBadge value={selected.status} />}
            </DialogTitle>
            <DialogDescription>
              {selected?.customer} · {selected?.warehouse} · {selected?.carrier} · {selected?.route}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Picked</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected?.lines.map((l: OrderLine) => (
                  <TableRow key={l.sku}>
                    <TableCell className="font-medium">{l.sku}</TableCell>
                    <TableCell>{l.product}</TableCell>
                    <TableCell className="num text-right">{l.quantity}</TableCell>
                    <TableCell className="num text-right">{l.allocated}</TableCell>
                    <TableCell className="num text-right">{l.picked}</TableCell>
                    <TableCell>{l.location}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.id}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The order will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleting) return;
                deleteMutation.mutate({ id: deleting.id });
                setDeleting(null);
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

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Selector({
  options,
  placeholder,
  value,
  onChange,
}: {
  options: string[];
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
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
