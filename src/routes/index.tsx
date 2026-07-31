import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  Layers,
  PackageCheck,
  Printer,
  Rocket,
  ShoppingCart,
  Timer,
  Truck,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/wms/page-header";
import { StatCard } from "@/components/wms/stat-card";
import { StatusBadge } from "@/components/wms/status-badge";
import { WorkflowStepper } from "@/components/wms/workflow-stepper";
import {
  activities,
  backorders,
  dailyFulfillmentChart,
  notifications,
  ordersByPriorityChart,
  salesOrders,
  shipmentTrendChart,
  waveStatusChart,
  waves,
  workflowSteps,
} from "@/data/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Outbound Fulfillment Dashboard | NEXUS WMS" },
      {
        name: "description",
        content: "Live KPIs for sales orders, waves, picking, packing, staging, loading and shipments across all warehouses.",
      },
      { property: "og:title", content: "Outbound Fulfillment Dashboard | NEXUS WMS" },
      { property: "og:description", content: "Live outbound KPIs, wave status, shipment trends and fulfillment activity." },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function count(fn: (s: (typeof salesOrders)[number]) => boolean) {
  return salesOrders.filter(fn).length;
}

function DashboardPage() {
  const kpis = [
    { label: "Total Sales Orders", value: salesOrders.length, icon: <ShoppingCart className="h-4 w-4" />, tone: "primary" as const },
    { label: "Pending Planning", value: count((o) => ["Received", "Validated", "Allocated"].includes(o.status)), icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Orders Reserved", value: count((o) => o.status === "Reserved"), icon: <Boxes className="h-4 w-4" />, tone: "primary" as const },
    { label: "Active Waves", value: waves.filter((w) => ["Planned", "Draft"].includes(w.status)).length, icon: <Layers className="h-4 w-4" /> },
    { label: "Released Waves", value: waves.filter((w) => ["Released", "Picking"].includes(w.status)).length, icon: <Rocket className="h-4 w-4" />, tone: "primary" as const },
    { label: "Orders Picking", value: count((o) => o.status === "Picking"), icon: <Activity className="h-4 w-4" />, tone: "warning" as const },
    { label: "Orders Packed", value: count((o) => o.status === "Packed"), icon: <PackageCheck className="h-4 w-4" />, tone: "success" as const },
    { label: "Orders Staged", value: count((o) => o.status === "Staged"), icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Ready for Shipment", value: count((o) => o.status === "Ready for Shipment"), icon: <Truck className="h-4 w-4" />, tone: "primary" as const },
    { label: "Orders Shipped", value: count((o) => o.status === "Shipped"), icon: <Truck className="h-4 w-4" />, tone: "success" as const },
    { label: "Late Orders", value: 3, icon: <Timer className="h-4 w-4" />, tone: "danger" as const },
    { label: "Backorders", value: backorders.filter((b) => b.status !== "Closed").length, icon: <AlertTriangle className="h-4 w-4" />, tone: "danger" as const },
  ];

  const quickActions = [
    { label: "Create Wave", icon: Layers, to: "/wave-planning" },
    { label: "Release Wave", icon: Rocket, to: "/wave-release" },
    { label: "Generate Pick List", icon: ClipboardList, to: "/pick-lists" },
    { label: "Print Shipping Labels", icon: Printer, to: "/shipping-labels" },
  ];

  return (
    <div>
      <PageHeader
        title="Outbound Fulfillment Dashboard"
        description="Real-time control tower for order fulfillment, wave execution and dispatch."
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Dashboard refreshed", { description: "Mock data reloaded." })}>
              Refresh
            </Button>
            <Button asChild>
              <Link to="/wave-planning">
                <Layers className="h-4 w-4" />
                Create Wave
              </Link>
            </Button>
          </>
        }
      />

      <Card className="mb-5 border-border shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Outbound Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowStepper steps={workflowSteps} currentIndex={7} />
        </CardContent>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone ?? "default"} />
        ))}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-[var(--shadow-card)] xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Shipment Trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={shipmentTrendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="planned" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.18} />
                <Area type="monotone" dataKey="shipped" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wave Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={waveStatusChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {waveStatusChart.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Orders by Priority</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersByPriorityChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="priority" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }} />
                <Bar dataKey="orders" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)] xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Fulfillment Throughput</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyFulfillmentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="picked" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="packed" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="shipped" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <Button key={a.label} asChild variant="outline" className="h-auto flex-col items-start gap-1.5 py-3 text-left">
                <Link to={a.to}>
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium whitespace-normal">{a.label}</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.slice(0, 6).map((a) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <p className="min-w-0 text-muted-foreground">
                  <span className="font-medium text-foreground">{a.actor}</span> {a.action}{" "}
                  <span className="font-medium text-primary">{a.target}</span>
                  <span className="block text-xs">{a.time}</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                  <StatusBadge value={n.severity === "danger" ? "Critical" : n.severity === "warning" ? "High" : "Completed"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
