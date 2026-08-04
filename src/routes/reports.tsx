import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/wms/data-table";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { downloadCsv } from "@/lib/csv";
import { dashboardQuery, ordersQuery, wavesQuery } from "@/lib/wms-queries";
import type { Wave } from "@/lib/wms-types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Outbound Reports & Analytics | NEXUS WMS" },
      { name: "description", content: "Fulfillment throughput, wave performance, shipment trends and order priority analytics." },
      { property: "og:title", content: "Outbound Reports & Analytics | NEXUS WMS" },
      { property: "og:description", content: "Operational analytics for outbound order fulfillment and wave management." },
    ],
  }),
  component: ReportsPage,
});

const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ReportsPage() {
  const { data: stats } = useQuery(dashboardQuery());
  const { data: wavesResult, isLoading } = useQuery(wavesQuery());
  const { data: ordersResult } = useQuery(ordersQuery());
  const waves: Wave[] = wavesResult?.rows ?? [];
  const orders = ordersResult?.rows ?? [];

  const columns: Column<Wave>[] = [
    { key: "id", header: "Wave", value: (r) => r.id, render: (r) => <span className="font-medium text-primary">{r.id}</span> },
    { key: "name", header: "Wave Name", value: (r) => r.name },
    { key: "warehouse", header: "Warehouse", value: (r) => r.warehouse },
    { key: "orders", header: "Orders", value: (r) => r.orders.length, className: "num text-right" },
    { key: "lines", header: "Lines", value: (r) => r.lines, className: "num text-right" },
    { key: "capacity", header: "Capacity", value: (r) => r.capacity, className: "num text-right" },
    { key: "route", header: "Route", value: (r) => r.route },
    { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const shipped = orders.filter((o) => o.status === "Shipped").length;
  const fulfilmentRate = stats?.fulfilmentRate ?? 0;

  const exportCsv = () => {
    const ok = downloadCsv(
      "outbound-summary",
      orders.map((o) => ({
        order: o.id,
        customer: o.customer,
        orderDate: o.orderDate,
        deliveryDate: o.deliveryDate,
        priority: o.priority,
        warehouse: o.warehouse,
        carrier: o.carrier,
        items: o.items,
        quantity: o.quantity,
        valueUsd: o.valueUsd,
        validation: o.validation,
        status: o.status,
      })),
    );
    toast[ok ? "success" : "info"](ok ? "CSV export started" : "Nothing to export");
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Operational performance across order fulfillment, wave execution and outbound shipping."
        breadcrumbs={[{ label: "Insights" }, { label: "Reports" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("PDF report queued", { description: "TODO: Reporting Engine." })}>
              <FileBarChart className="h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders Processed" value={stats?.totalOrders ?? orders.length} tone="primary" />
        <StatCard label="Orders Shipped" value={shipped} tone="success" />
        <StatCard label="Fulfillment Rate" value={`${fulfilmentRate}%`} tone="warning" />
        <StatCard label="Active Waves" value={waves.filter((w) => w.status !== "Completed").length} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Daily Fulfillment Throughput">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats?.dailyFulfillmentChart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="picked" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="packed" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shipped" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Shipment Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats?.shipmentTrendChart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="shipped" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="planned" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Wave Status Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={stats?.waveStatusChart ?? []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {(stats?.waveStatusChart ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders by Priority">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats?.ordersByPriorityChart ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="priority" width={70} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="orders" fill="var(--color-chart-4)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DataTable
        data={waves}
        columns={columns}
        loading={isLoading}
        searchKeys={(r) => `${r.id} ${r.name} ${r.warehouse}`}
        filters={[
          { key: "status", label: "Status", options: ["Draft", "Planned", "Released", "Picking", "Completed"], match: (r, v) => r.status === v },
          { key: "warehouse", label: "Warehouse", options: [...new Set(waves.map((w) => w.warehouse))], match: (r, v) => r.warehouse === v },
        ]}
        onExport={() => {
          const ok = downloadCsv(
            "wave-performance",
            waves.map((w) => ({
              wave: w.id,
              name: w.name,
              warehouse: w.warehouse,
              zone: w.zone,
              orders: w.orders.length,
              lines: w.lines,
              capacity: w.capacity,
              carrier: w.carrier,
              route: w.route,
              status: w.status,
            })),
          );
          toast[ok ? "success" : "info"](ok ? "Wave performance exported" : "Nothing to export");
        }}
      />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
