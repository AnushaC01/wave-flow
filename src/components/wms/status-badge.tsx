import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const TONE_MAP: Record<string, Tone> = {
  // order / generic
  Received: "neutral",
  Validated: "info",
  Allocated: "info",
  Reserved: "primary",
  "Wave Planned": "primary",
  Released: "primary",
  Picking: "warning",
  Picked: "success",
  Packed: "success",
  Staged: "info",
  Loading: "warning",
  "Ready for Shipment": "primary",
  Shipped: "success",
  Delivered: "success",
  "In Transit": "info",
  Backordered: "danger",
  Draft: "neutral",
  Planned: "info",
  Completed: "success",
  Pending: "neutral",
  "In Progress": "warning",
  Short: "danger",
  Open: "warning",
  "Partially Allocated": "info",
  Fulfilled: "success",
  Closed: "neutral",
  Passed: "success",
  Failed: "danger",
  // stock
  "In Stock": "success",
  "Low Stock": "warning",
  "Out of Stock": "danger",
  // dispatch
  "Awaiting Dispatch": "warning",
  Approved: "success",
  Rejected: "danger",
  Dispatched: "primary",
  // priority
  Critical: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
  // credit
  "On Hold": "danger",
  Review: "warning",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning-foreground border-warning/30",
  danger: "bg-danger-soft text-destructive border-destructive/20",
  primary: "bg-primary-soft text-primary border-primary/20",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const tone = TONE_MAP[value] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {value}
    </span>
  );
}
