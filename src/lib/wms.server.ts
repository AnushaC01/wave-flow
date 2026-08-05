/**
 * Server-only data access layer (repository + services) for the WMS backend.
 * Never import this from components — it is reachable only from server functions.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  relativeTime,
  type ActivityItem,
  type Backorder,
  type Customer,
  type DashboardStats,
  type InventoryRecord,
  type ListParams,
  type ListResult,
  type NotificationItem,
  type PackingRecord,
  type PickLine,
  type Product,
  type SalesOrder,
  type Shipment,
  type Vehicle,
  type Warehouse,
  type Wave,
} from "./wms-types";

/* --------------------------------- client --------------------------------- */

/** Untyped client for dynamic (runtime-chosen) table names. */
export function rawDb(): SupabaseClient {
  return db() as unknown as SupabaseClient;
}

export function db(): SupabaseClient<Database> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new HttpError(500, "Backend is not configured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

/** Translate PostgREST errors into meaningful HTTP-style errors. */
export function fail(error: { code?: string; message: string; details?: string | null }): never {
  if (error.code === "23505") throw new HttpError(409, "A record with these details already exists");
  if (error.code === "23503") throw new HttpError(409, "Related record not found — check the linked order, wave or product");
  if (error.code === "23514") throw new HttpError(422, "One or more values are outside the allowed range");
  if (error.code === "PGRST116") throw new HttpError(404, "Record not found");
  throw new HttpError(400, error.message);
}

/* ------------------------------ generic list ------------------------------ */

interface EntityConfig {
  table: string;
  select: string;
  search: string[];
  sortable: string[];
  defaultSort: string;
  defaultDir: "asc" | "desc";
  /** UI filter key -> db column */
  filters: Record<string, string>;
}

const asc = (dir: string) => dir === "asc";

async function listRows<Row>(cfg: EntityConfig, params: ListParams): Promise<ListResult<Row>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const sortKey = params.sort && cfg.sortable.includes(params.sort) ? params.sort : cfg.defaultSort;
  const dir = params.dir ?? cfg.defaultDir;

  let q = rawDb().from(cfg.table).select(cfg.select, { count: "exact" });

  if (params.search && cfg.search.length) {
    const term = params.search.replace(/[%,()]/g, " ").trim();
    if (term) q = q.or(cfg.search.map((c) => `${c}.ilike.%${term}%`).join(","));
  }
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    const column = cfg.filters[key];
    if (!column || !value || value === "all") continue;
    if (value === "true" || value === "false") q = q.eq(column, value === "true");
    else q = q.eq(column, value);
  }

  q = q.order(sortKey, { ascending: asc(dir) }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;
  if (error) fail(error);
  return { rows: (data ?? []) as Row[], total: count ?? 0, page, pageSize };
}

/* --------------------------------- mappers -------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapOrder = (r: any): SalesOrder => {
  const lines = (r.order_lines ?? []).map((l: any) => ({
    id: l.id,
    sku: l.sku,
    product: l.product,
    quantity: l.quantity,
    allocated: l.allocated,
    picked: l.picked,
    location: l.location,
  }));
  return {
    id: r.id,
    customer: r.customer,
    orderDate: r.order_date,
    deliveryDate: r.delivery_date,
    priority: r.priority,
    warehouse: r.warehouse,
    carrier: r.carrier,
    route: r.route,
    lines,
    items: lines.length,
    quantity: lines.reduce((s: number, l: any) => s + l.quantity, 0),
    status: r.status,
    validation: r.validation,
    valueUsd: Number(r.value_usd),
  };
};

const mapInventory = (r: any): InventoryRecord => ({
  id: r.id,
  sku: r.sku,
  product: r.product,
  warehouse: r.warehouse,
  zone: r.zone,
  location: r.location,
  available: r.available,
  reserved: r.reserved,
  allocated: r.allocated,
  status: r.available === 0 ? "Out of Stock" : r.available < 60 ? "Low Stock" : "In Stock",
});

const mapWave = (r: any): Wave => ({
  id: r.id,
  name: r.name,
  warehouse: r.warehouse,
  zone: r.zone,
  priority: r.priority,
  carrier: r.carrier,
  route: r.route,
  deliveryDate: r.delivery_date ?? "",
  orders: (r.wave_orders ?? []).map((w: any) => w.order_id),
  capacity: r.capacity,
  lines: r.lines,
  reservationConfirmed: r.reservation_confirmed,
  status: r.status,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

const mapPick = (r: any): PickLine => ({
  id: r.id,
  wave: r.wave_id ?? "",
  picker: r.picker,
  zone: r.zone,
  location: r.location,
  sku: r.sku,
  product: r.product,
  quantity: r.quantity,
  pickedQty: r.picked_qty,
  barcode: r.barcode,
  serial: r.serial,
  verified: r.verified,
  status: r.status,
});

const mapPacking = (r: any): PackingRecord => ({
  id: r.id,
  order: r.order_id,
  wave: r.wave_id ?? "",
  packageType: r.package_type,
  carton: r.carton,
  weightKg: Number(r.weight_kg),
  dimensions: r.dimensions,
  material: r.material,
  labelNumber: r.label_number,
  station: r.station,
  operator: r.operator,
  status: r.status,
});

const mapShipment = (r: any): Shipment => ({
  id: r.id,
  orders: (r.shipment_orders ?? []).map((s: any) => s.order_id),
  carrier: r.carrier,
  vehicle: r.vehicle ?? "",
  driver: r.driver,
  dock: r.dock,
  container: r.container,
  seal: r.seal,
  scheduledAt: r.scheduled_at ? String(r.scheduled_at).slice(0, 16).replace("T", " ") : "",
  destination: r.destination,
  trackingNo: r.tracking_no,
  loadVerified: r.load_verified,
  checklist: Array.isArray(r.verification_checklist) ? r.verification_checklist : [],
  dispatch: r.dispatch,
  status: r.status,
});

const mapBackorder = (r: any): Backorder => ({
  id: r.id,
  order: r.order_id,
  customer: r.customer,
  sku: r.sku,
  product: r.product,
  missingQty: r.missing_qty,
  availableQty: r.available_qty,
  suggested: r.suggested,
  reason: r.reason,
  expectedDate: r.expected_date ?? "",
  priority: r.priority,
  status: r.status,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/* -------------------------------- registry -------------------------------- */

const ORDERS: EntityConfig = {
  table: "sales_orders",
  select: "*, order_lines(*)",
  search: ["id", "customer", "carrier", "route", "warehouse"],
  sortable: ["id", "customer", "order_date", "delivery_date", "priority", "warehouse", "carrier", "status", "value_usd"],
  defaultSort: "id",
  defaultDir: "desc",
  filters: { status: "status", priority: "priority", warehouse: "warehouse", carrier: "carrier", validation: "validation", customer: "customer" },
};

const INVENTORY: EntityConfig = {
  table: "inventory",
  select: "*",
  search: ["id", "sku", "product", "location", "zone"],
  sortable: ["id", "sku", "product", "warehouse", "zone", "available", "reserved", "allocated"],
  defaultSort: "sku",
  defaultDir: "asc",
  filters: { warehouse: "warehouse", zone: "zone", sku: "sku" },
};

const WAVES: EntityConfig = {
  table: "waves",
  select: "*, wave_orders(order_id)",
  search: ["id", "name", "warehouse", "carrier", "route", "zone"],
  sortable: ["id", "name", "warehouse", "zone", "priority", "carrier", "delivery_date", "status", "created_at"],
  defaultSort: "created_at",
  defaultDir: "desc",
  filters: { status: "status", warehouse: "warehouse", zone: "zone", carrier: "carrier", priority: "priority" },
};

const PICKS: EntityConfig = {
  table: "pick_lines",
  select: "*",
  search: ["id", "wave_id", "picker", "sku", "product", "barcode", "serial", "location"],
  sortable: ["id", "wave_id", "picker", "zone", "location", "sku", "quantity", "status"],
  defaultSort: "id",
  defaultDir: "asc",
  filters: { wave: "wave_id", zone: "zone", status: "status", picker: "picker" },
};

const PACKING: EntityConfig = {
  table: "packing_records",
  select: "*",
  search: ["id", "order_id", "wave_id", "carton", "label_number", "station", "operator"],
  sortable: ["id", "order_id", "wave_id", "package_type", "weight_kg", "station", "status"],
  defaultSort: "id",
  defaultDir: "asc",
  filters: { status: "status", packageType: "package_type", station: "station", wave: "wave_id" },
};

const SHIPMENTS: EntityConfig = {
  table: "shipments",
  select: "*, shipment_orders(order_id)",
  search: ["id", "carrier", "driver", "destination", "tracking_no", "container", "seal", "dock"],
  sortable: ["id", "carrier", "driver", "dock", "scheduled_at", "destination", "status", "dispatch"],
  defaultSort: "id",
  defaultDir: "asc",
  filters: { carrier: "carrier", status: "status", dispatch: "dispatch", dock: "dock", vehicle: "vehicle" },
};

const BACKORDERS: EntityConfig = {
  table: "backorders",
  select: "*",
  search: ["id", "order_id", "customer", "sku", "product", "reason"],
  sortable: ["id", "order_id", "customer", "sku", "missing_qty", "expected_date", "priority", "status"],
  defaultSort: "id",
  defaultDir: "asc",
  filters: { status: "status", priority: "priority", customer: "customer", sku: "sku" },
};

/* ------------------------------- reference -------------------------------- */

export async function getReference() {
  const client = db();
  const [customers, products, warehouses, zones, carriers, routes, docks, vehicles] = await Promise.all([
    client.from("customers").select("*").order("name"),
    client.from("products").select("*").order("sku"),
    client.from("warehouses").select("*").order("code"),
    client.from("zones").select("name").order("name"),
    client.from("carriers").select("name").order("name"),
    client.from("routes").select("code").order("code"),
    client.from("docks").select("name").order("name"),
    client.from("vehicles").select("*").order("id"),
  ]);
  const err = [customers, products, warehouses, zones, carriers, routes, docks, vehicles].find((r) => r.error);
  if (err?.error) fail(err.error);
  return {
    customers: (customers.data ?? []).map(
      (c): Customer => ({ id: c.id, name: c.name, segment: c.segment, city: c.city, country: c.country, creditStatus: c.credit_status as Customer["creditStatus"] }),
    ),
    products: (products.data ?? []).map(
      (p): Product => ({ sku: p.sku, name: p.name, uom: p.uom, category: p.category, barcode: p.barcode, weightKg: Number(p.weight_kg) }),
    ),
    warehouses: (warehouses.data ?? []).map((w): Warehouse => ({ code: w.code, name: w.name, city: w.city, zones: w.zones })),
    zones: (zones.data ?? []).map((z) => z.name),
    carriers: (carriers.data ?? []).map((c) => c.name),
    routes: (routes.data ?? []).map((r) => r.code),
    docks: (docks.data ?? []).map((d) => d.name),
    vehicles: (vehicles.data ?? []).map(
      (v): Vehicle => ({ id: v.id, plate: v.plate, type: v.type, driver: v.driver, capacityPallets: v.capacity_pallets }),
    ),
  };
}

export type Reference = Awaited<ReturnType<typeof getReference>>;

/* --------------------------------- reads ---------------------------------- */

export const listOrders = async (p: ListParams) => {
  const r = await listRows(ORDERS, p);
  return { ...r, rows: r.rows.map(mapOrder) };
};
export const listInventory = async (p: ListParams) => {
  const r = await listRows(INVENTORY, p);
  return { ...r, rows: r.rows.map(mapInventory) };
};
export const listWaves = async (p: ListParams) => {
  const r = await listRows(WAVES, p);
  return { ...r, rows: r.rows.map(mapWave) };
};
export const listPickLines = async (p: ListParams) => {
  const r = await listRows(PICKS, p);
  return { ...r, rows: r.rows.map(mapPick) };
};
export const listPacking = async (p: ListParams) => {
  const r = await listRows(PACKING, p);
  return { ...r, rows: r.rows.map(mapPacking) };
};
export const listShipments = async (p: ListParams) => {
  const r = await listRows(SHIPMENTS, p);
  return { ...r, rows: r.rows.map(mapShipment) };
};
export const listBackorders = async (p: ListParams) => {
  const r = await listRows(BACKORDERS, p);
  return { ...r, rows: r.rows.map(mapBackorder) };
};

export async function listActivity(limit = 12): Promise<ActivityItem[]> {
  const { data, error } = await db().from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) fail(error);
  return (data ?? []).map((a) => ({
    id: a.id,
    actor: a.actor,
    action: a.action,
    target: a.target,
    time: relativeTime(a.created_at),
    type: a.type as ActivityItem["type"],
  }));
}

export async function listNotifications(limit = 20): Promise<NotificationItem[]> {
  const { data, error } = await db().from("notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) fail(error);
  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    time: relativeTime(n.created_at),
    severity: n.severity as NotificationItem["severity"],
    read: n.read,
  }));
}

export async function logActivity(actor: string, action: string, target: string, type: ActivityItem["type"]) {
  await db().from("activity_log").insert({ actor, action, target, type });
}

export async function notify(title: string, message: string, severity: NotificationItem["severity"]) {
  await db().from("notifications").insert({ title, message, severity });
}

/* ------------------------------ id generation ----------------------------- */

export async function nextId(table: string, column: string, prefix: string, pad: number): Promise<string> {
  const { data, error } = await rawDb().from(table).select(column).ilike(column, `${prefix}%`).order(column, { ascending: false }).limit(1);
  if (error) fail(error);
  const last = (data?.[0] as Record<string, string> | undefined)?.[column];
  const n = last ? Number(last.slice(prefix.length).replace(/\D/g, "")) + 1 : 1;
  return `${prefix}${String(n).padStart(pad, "0")}`;
}

/* -------------------------------- dashboard ------------------------------- */

export async function getDashboard(): Promise<DashboardStats> {
  const client = db();
  const [orders, waves, picks, packs, shipments, backorders] = await Promise.all([
    client.from("sales_orders").select("id, status, priority, order_date, delivery_date, carrier"),
    client.from("waves").select("id, status"),
    client.from("pick_lines").select("id, status, quantity, picked_qty"),
    client.from("packing_records").select("id, status"),
    client.from("shipments").select("id, status, dispatch, carrier, scheduled_at"),
    client.from("backorders").select("id, status, missing_qty"),
  ]);
  const err = [orders, waves, picks, packs, shipments, backorders].find((r) => r.error);
  if (err?.error) fail(err.error);

  const o = orders.data ?? [];
  const w = waves.data ?? [];
  const p = picks.data ?? [];
  const pk = packs.data ?? [];
  const sh = shipments.data ?? [];
  const bo = backorders.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const count = <T,>(rows: T[], fn: (r: T) => boolean) => rows.filter(fn).length;
  const shipped = count(o, (r) => r.status === "Shipped");

  const byDay = new Map<string, { shipped: number; planned: number }>();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay.set(d.toISOString().slice(0, 10), { shipped: 0, planned: 0 });
  }
  for (const row of o) {
    const key = row.delivery_date;
    const entry = byDay.get(key);
    if (!entry) continue;
    entry.planned += 1;
    if (row.status === "Shipped") entry.shipped += 1;
  }

  const carrierMap = new Map<string, number>();
  for (const s of sh) carrierMap.set(s.carrier, (carrierMap.get(s.carrier) ?? 0) + 1);

  const statusMap = new Map<string, number>();
  for (const row of o) statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);

  const pickedUnits = p.reduce((s, r) => s + r.picked_qty, 0);
  const totalUnits = p.reduce((s, r) => s + r.quantity, 0);

  return {
    totalOrders: o.length,
    ordersToday: count(o, (r) => r.order_date === today),
    openWaves: count(w, (r) => r.status === "Planned" || r.status === "Draft"),
    releasedWaves: count(w, (r) => r.status === "Released" || r.status === "Picking"),
    pickLinesPending: count(p, (r) => r.status === "Pending" || r.status === "In Progress"),
    packagesPacked: count(pk, (r) => r.status === "Completed"),
    shipmentsInTransit: count(sh, (r) => r.status === "In Transit"),
    awaitingDispatch: count(sh, (r) => r.dispatch === "Awaiting Dispatch"),
    openBackorders: count(bo, (r) => r.status === "Open" || r.status === "Partially Allocated"),
    unitsShipped: pickedUnits,
    fulfilmentRate: o.length ? Math.round((shipped / o.length) * 100) : 0,
    onTimeRate: totalUnits ? Math.round((pickedUnits / totalUnits) * 100) : 0,
    waveStatusChart: ["Draft", "Planned", "Released", "Picking", "Completed"].map((name) => ({
      name,
      value: count(w, (r) => r.status === name),
    })),
    ordersByPriorityChart: ["Critical", "High", "Medium", "Low"].map((priority) => ({
      priority,
      orders: count(o, (r) => r.priority === priority),
    })),
    shipmentTrendChart: [...byDay.entries()].map(([day, v]) => ({
      day: new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      shipped: v.shipped,
      planned: v.planned,
    })),
    dailyFulfillmentChart: [
      { hour: "Picked", picked: count(p, (r) => r.status === "Picked"), packed: 0, shipped: 0 },
      { hour: "In Progress", picked: count(p, (r) => r.status === "In Progress"), packed: 0, shipped: 0 },
      { hour: "Packed", picked: 0, packed: count(pk, (r) => r.status === "Completed"), shipped: 0 },
      { hour: "Packing", picked: 0, packed: count(pk, (r) => r.status !== "Completed"), shipped: 0 },
      { hour: "Shipped", picked: 0, packed: 0, shipped: count(sh, (r) => r.status === "In Transit" || r.status === "Delivered") },
      { hour: "Staged", picked: 0, packed: 0, shipped: count(sh, (r) => r.status === "Staged" || r.status === "Loading") },
    ],
    orderStatusChart: [...statusMap.entries()].map(([status, orders]) => ({ status, orders })),
    carrierChart: [...carrierMap.entries()].map(([carrier, shipments]) => ({ carrier, shipments })),
  };
}

/* --------------------- manual pick list eligible orders -------------------- */

export interface PickableOrder {
  id: string;
  customer: string;
  warehouse: string;
  priority: string;
  deliveryDate: string;
  lines: number;
  units: number;
}

/**
 * Orders eligible for manual (wave-less) pick list creation — BR-151 Workflow B.
 * Validated, fully allocated/reserved, not on an active wave, no existing pick list.
 */
export async function listPickableOrders(): Promise<PickableOrder[]> {
  const client = db();
  const [ordersRes, waveRes, pickRes] = await Promise.all([
    client
      .from("sales_orders")
      .select("id, customer, warehouse, priority, delivery_date, status, validation, order_lines(quantity, allocated)")
      .eq("validation", "Passed")
      .in("status", ["Allocated", "Reserved"]),
    client.from("wave_orders").select("order_id, waves(status)"),
    client.from("pick_lines").select("order_id").not("order_id", "is", null),
  ]);
  const err = [ordersRes, waveRes, pickRes].find((r) => r.error);
  if (err?.error) fail(err.error);

  const waved = new Set(
    (waveRes.data ?? [])
      .filter((w: any) => (w.waves?.status ?? "") !== "Completed")
      .map((w: any) => w.order_id as string),
  );
  const picked = new Set((pickRes.data ?? []).map((p: any) => p.order_id as string));

  return (ordersRes.data ?? [])
    .filter((o: any) => {
      const lines = o.order_lines ?? [];
      if (lines.length === 0) return false;
      if (waved.has(o.id) || picked.has(o.id)) return false;
      return lines.every((l: any) => l.allocated >= l.quantity);
    })
    .map((o: any) => ({
      id: o.id,
      customer: o.customer,
      warehouse: o.warehouse,
      priority: o.priority,
      deliveryDate: o.delivery_date,
      lines: (o.order_lines ?? []).length,
      units: (o.order_lines ?? []).reduce((s: number, l: any) => s + l.quantity, 0),
    }));
}
