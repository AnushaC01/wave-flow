import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/wms/page-header";
import { ROLES, useRole } from "@/context/role-context";
import { carriers, docks, warehouses, zones } from "@/data/mock-data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Warehouse Settings | NEXUS WMS" },
      { name: "description", content: "Configure warehouse defaults, wave capacity rules, carrier options and role access for outbound fulfillment." },
      { property: "og:title", content: "Warehouse Settings | NEXUS WMS" },
      { property: "og:description", content: "Operational configuration for the outbound fulfillment module." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { role, setRole } = useRole();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Module configuration — defaults, business rule thresholds and access control."
        breadcrumbs={[{ label: "Insights" }, { label: "Settings" }]}
        actions={
          <Button onClick={() => toast.success("Settings saved", { description: "TODO: persist via configuration service." })}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-sm">Warehouse Defaults</CardTitle>
            <CardDescription>Applied to newly created sales orders and waves.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Default Warehouse">
              <Picker options={warehouses.map((w) => `${w.code} — ${w.name}`)} placeholder="Select warehouse" />
            </Field>
            <Field label="Default Zone">
              <Picker options={zones} placeholder="Select zone" />
            </Field>
            <Field label="Default Carrier">
              <Picker options={carriers} placeholder="Select carrier" />
            </Field>
            <Field label="Default Dock">
              <Picker options={docks} placeholder="Select dock" />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-sm">Wave & Picking Rules</CardTitle>
            <CardDescription>Thresholds enforced during wave planning and execution.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Max Orders per Wave">
              <Input type="number" defaultValue={25} />
            </Field>
            <Field label="Max Lines per Wave">
              <Input type="number" defaultValue={180} />
            </Field>
            <Field label="Short Pick Tolerance (%)">
              <Input type="number" defaultValue={5} />
            </Field>
            <Field label="Backorder Expiry (days)">
              <Input type="number" defaultValue={14} />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-sm">Validation & Compliance</CardTitle>
            <CardDescription>Business rule toggles for the outbound flow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle label="Block wave release without confirmed reservation" hint="BR-150" defaultChecked />
            <Separator />
            <Toggle label="Require barcode verification on every pick" hint="BR-152" defaultChecked />
            <Separator />
            <Toggle label="Require load verification before dispatch" hint="BR-156" defaultChecked />
            <Separator />
            <Toggle label="Restrict dispatch approval to Warehouse Managers" hint="BR-157" defaultChecked />
            <Separator />
            <Toggle label="Auto-create backorders on short allocation" hint="BR-158" defaultChecked />
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-sm">Access Control</CardTitle>
            <CardDescription>
              Active session role. TODO(integration): replace with SSO identity provider claims.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Current Role">
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Session Timeout (minutes)">
              <Input type="number" defaultValue={30} />
            </Field>
            <div className="sm:col-span-2 space-y-1">
              <Toggle label="Email alerts for blocked dispatches" defaultChecked />
              <Separator />
              <Toggle label="In-app notifications for backorders" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
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

function Toggle({ label, hint, defaultChecked = false }: { label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
