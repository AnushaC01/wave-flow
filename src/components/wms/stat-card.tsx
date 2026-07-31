import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  className?: string;
}

const TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-danger-soft text-destructive",
};

export function StatCard({ label, value, hint, icon, trend, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("gap-0 border-border p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="num mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        {icon ? <div className={cn("shrink-0 rounded-md p-2", TONE[tone])}>{icon}</div> : null}
      </div>
      {(hint || trend) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {trend ? (
            <span
              className={cn(
                "font-medium",
                trend.direction === "up" ? "text-success" : trend.direction === "down" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "■"} {trend.value}
            </span>
          ) : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      )}
    </Card>
  );
}
