import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;
  className?: string;
  sortable?: boolean;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: string[];
  match: (row: T, value: string) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  filters?: FilterDef<T>[];
  searchKeys?: (row: T) => string;
  pageSize?: number;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  emptyMessage?: string;
  onExport?: () => void;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  filters = [],
  searchKeys,
  pageSize = 8,
  loading = false,
  onRowClick,
  toolbar,
  emptyMessage = "No records found.",
  onExport,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [active, setActive] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let rows = data;
    if (query.trim() && searchKeys) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => searchKeys(r).toLowerCase().includes(q));
    }
    for (const f of filters) {
      const v = active[f.key];
      if (v && v !== "all") rows = rows.filter((r) => f.match(r, v));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const av = col.value ? col.value(a) : "";
          const bv = col.value ? col.value(b) : "";
          if (av === bv) return 0;
          const res = av > bv ? 1 : -1;
          return sort.dir === "asc" ? res : -res;
        });
      }
    }
    return rows;
  }, [data, query, filters, active, sort, columns, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search records..."
            className="pl-9"
            aria-label="Search table"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {filters.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {showFilters && filters.length > 0 && (
        <div className="grid gap-3 border-b border-border bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {filters.map((f) => (
            <div key={f.key} className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</label>
              <Select
                value={active[f.key] ?? "all"}
                onValueChange={(v) => {
                  setActive((s) => ({ ...s, [f.key]: v }));
                  setPage(1);
                }}
              >
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder={`All ${f.label}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {f.label}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn("text-xs font-semibold whitespace-nowrap text-foreground", c.className)}>
                  {c.sortable !== false && c.value ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-primary"
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" },
                        )
                      }
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn("border-border", onRowClick && "cursor-pointer")}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={cn("py-2.5 text-sm whitespace-nowrap", c.className)}>
                        {c.render ? c.render(row) : String(c.value?.(row) ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="num font-medium text-foreground">{rows.length}</span> of{" "}
          <span className="num font-medium text-foreground">{filtered.length}</span> records
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="num text-xs text-muted-foreground">
            Page {current} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
