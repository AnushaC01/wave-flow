/** Client-side CSV export helper shared by the reporting screens. */
export function downloadCsv(filename: string, rows: Record<string, string | number | boolean | null | undefined>[]) {
  if (rows.length === 0) return false;
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
