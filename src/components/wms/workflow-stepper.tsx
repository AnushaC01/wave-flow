import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowStepper({ steps, currentIndex }: { steps: string[]; currentIndex: number }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              done && "border-success/20 bg-success-soft text-success",
              active && "border-primary/30 bg-primary-soft text-primary",
              !done && !active && "border-border bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "num grid h-4 w-4 place-items-center rounded-full text-[10px]",
                done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-border text-foreground",
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}
