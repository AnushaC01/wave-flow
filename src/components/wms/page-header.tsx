import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  badge,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Outbound Fulfillment
        </Link>
        {breadcrumbs.map((c) => (
          <span key={c.label} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {c.to ? (
              <Link to={c.to} className="hover:text-primary">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
            {badge}
          </div>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
