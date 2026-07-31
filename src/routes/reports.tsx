import { createFileRoute } from "@tanstack/react-router";
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
import {
  dailyFulfillmentChart,
  ordersByPriorityChart,
  salesOrders,
  shipmentTrendChart,
  waveStatusChart,
  waves,
  type Wave,
} from "@/data/mock-data";

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

  const shipped = salesOrders.filter((o) => o.status === "Shipped").length;
  const onTime = Math.round((shipped / Math.max(salesOrders.length, 1)) * 100);

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
            <Button onClick={() => toast.success("CSV export started")}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders Processed" value={salesOrders.length} tone="primary" />
        <StatCard label="Orders Shipped" value={shipped} tone="success" trend={{ value: "+8.2%", direction: "up" }} />
        <StatCard label="Fulfillment Rate" value={`${onTime}%`} tone="warning" />
        <StatCard label="Active Waves" value={waves.filter((w) => w.status !== "Completed").length} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Daily Fulfillment Throughput">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailyFulfillmentChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
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
            <LineChart data={shipmentTrendChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="shipments" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="onTime" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Wave Status Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={waveStatusChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {waveStatusChart.map((_, i) => (
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
            <BarChart data={ordersByPriorityChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--color-chart-4)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DataTable
        data={waves}
        columns={columns}
        searchKeys={(r) => `${r.id} ${r.name} ${r.warehouse}`}
        onExport={() => toast.success("Wave performance exported")}
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
