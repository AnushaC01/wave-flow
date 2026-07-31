import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { carriers, customers, salesOrders, warehouses, type SalesOrder } from "@/data/mock-data";

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

const PRIORITIES = ["Critical", "High", "Medium", "Low"];

function SalesOrdersPage() {
  const { can } = useRole();
  const [orders, setOrders] = useState<SalesOrder[]>(salesOrders);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<SalesOrder | null>(null);

  const validate = (o: SalesOrder) => {
    // TODO(integration): call ERP order validation service (credit, address, tax, stock feasibility).
    setOrders((s) => s.map((r) => (r.id === o.id ? { ...r, validation: "Passed", status: r.status === "Received" ? "Validated" : r.status } : r)));
    toast.success(`${o.id} validated`, { description: "Credit, delivery window and item master checks passed." });
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
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="View" onClick={() => setSelected(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => toast.info(`Editing ${r.id}`)} disabled={!can("order.create")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={r.validation === "Passed" || !can("order.validate")}
            onClick={() => validate(r)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Validate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="BR-148 · Customer order integration and outbound order lifecycle."
        breadcrumbs={[{ label: "Order Management" }, { label: "Sales Orders" }]}
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={!can("order.create")}>
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
        searchKeys={(r) => `${r.id} ${r.customer} ${r.warehouse} ${r.carrier}`}
        onExport={() => toast.success("Export queued", { description: "TODO: connect Reporting Engine export service." })}
        filters={[
          { key: "priority", label: "Priority", options: PRIORITIES, match: (r, v) => r.priority === v },
          { key: "warehouse", label: "Warehouse", options: warehouses.map((w) => w.code), match: (r, v) => r.warehouse === v },
          { key: "customer", label: "Customer", options: customers.map((c) => c.name), match: (r, v) => r.customer === v },
          { key: "carrier", label: "Carrier", options: carriers, match: (r, v) => r.carrier === v },
        ]}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>Manual order entry. Orders normally arrive via the ERP integration.</DialogDescription>
          </DialogHeader>
          {/* TODO(integration): submit to the ERP Sales Order API instead of local mock state. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sales Order Number">
              <Input defaultValue={`SO-2026-${4125 + orders.length - salesOrders.length}`} readOnly />
            </Field>
            <Field label="Customer">
              <Selector options={customers.map((c) => c.name)} placeholder="Select customer" />
            </Field>
            <Field label="Order Date">
              <Input type="date" defaultValue="2026-07-31" />
            </Field>
            <Field label="Delivery Date">
              <Input type="date" defaultValue="2026-08-07" />
            </Field>
            <Field label="Priority">
              <Selector options={PRIORITIES} placeholder="Select priority" />
            </Field>
            <Field label="Warehouse">
              <Selector options={warehouses.map((w) => w.code)} placeholder="Select warehouse" />
            </Field>
            <Field label="Items">
              <Input type="number" defaultValue={3} />
            </Field>
            <Field label="Total Quantity">
              <Input type="number" defaultValue={120} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setCreateOpen(false);
                toast.success("Sales order created", { description: "Order queued for validation and allocation." });
              }}
            >
              Create Order
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
                {selected?.lines.map((l) => (
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

function Selector({ options, placeholder }: { options: string[]; placeholder: string }) {
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
