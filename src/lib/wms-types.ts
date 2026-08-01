/**
 * Shared, client-safe domain types + validation schemas for the WMS backend.
 * These mirror the database tables in Lovable Cloud.
 */
import { z } from "zod";

export type Priority = "Critical" | "High" | "Medium" | "Low";

export const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];

export const ORDER_STATUSES = [
  "Received",
  "Validated",
  "Allocated",
  "Reserved",
  "Wave Planned",
  "Released",
  "Picking",
  "Packed",
  "Staged",
  "Loading",
  "Ready for Shipment",
  "Shipped",
  "Backordered",
] as const;

export const WAVE_STATUSES = ["Draft", "Planned", "Released", "Picking", "Completed"] as const;
export const PICK_STATUSES = ["Pending", "In Progress", "Picked", "Short"] as const;
export const PACK_STATUSES = ["Pending", "In Progress", "Completed"] as const;
export const PACKAGE_TYPES = ["Carton", "Pallet", "Tote", "Crate"] as const;
export const DISPATCH_STATUSES = ["Awaiting Dispatch", "Approved", "Rejected", "Dispatched"] as const;
export const SHIPMENT_STATUSES = ["Staged", "Loading", "Ready for Shipment", "In Transit", "Delivered"] as const;
export const BACKORDER_STATUSES = ["Open", "Partially Allocated", "Fulfilled", "Closed"] as const;

const priority = z.enum(["Critical", "High", "Medium", "Low"]);
const nonEmpty = (max = 120) => z.string().trim().min(1, "Required").max(max);

/* ---------------------------------- list ---------------------------------- */

export const listParamsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  filters: z.record(z.string(), z.string()).optional(),
  sort: z.string().max(60).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});
export type ListParams = z.infer<typeof listParamsSchema>;

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* -------------------------------- entities -------------------------------- */

export interface Customer {
  id: string;
  name: string;
  segment: string;
  city: string;
  country: string;
  creditStatus: "Approved" | "On Hold" | "Review";
}

export interface Product {
  sku: string;
  name: string;
  uom: string;
  category: string;
  barcode: string;
  weightKg: number;
}

export interface Warehouse {
  code: string;
  name: string;
  city: string;
  zones: string[];
}

export interface Vehicle {
  id: string;
  plate: string;
  type: string;
  driver: string;
  capacityPallets: number;
}

export interface OrderLine {
  id: string;
  sku: string;
  product: string;
  quantity: number;
  allocated: number;
  picked: number;
  location: string;
}

export interface SalesOrder {
  id: string;
  customer: string;
  orderDate: string;
  deliveryDate: string;
  priority: Priority;
  warehouse: string;
  carrier: string;
  route: string;
  lines: OrderLine[];
  items: number;
  quantity: number;
  status: (typeof ORDER_STATUSES)[number];
  validation: "Pending" | "Passed" | "Failed";
  valueUsd: number;
}

export interface InventoryRecord {
  id: string;
  sku: string;
  product: string;
  warehouse: string;
  zone: string;
  location: string;
  available: number;
  reserved: number;
  allocated: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

export interface Wave {
  id: string;
  name: string;
  warehouse: string;
  zone: string;
  priority: Priority;
  carrier: string;
  route: string;
  deliveryDate: string;
  orders: string[];
  capacity: number;
  lines: number;
  reservationConfirmed: boolean;
  status: (typeof WAVE_STATUSES)[number];
  createdBy: string;
  createdAt: string;
}

export interface PickLine {
  id: string;
  wave: string;
  picker: string;
  zone: string;
  location: string;
  sku: string;
  product: string;
  quantity: number;
  pickedQty: number;
  barcode: string;
  serial: string;
  verified: boolean;
  status: (typeof PICK_STATUSES)[number];
}

export interface PackingRecord {
  id: string;
  order: string;
  wave: string;
  packageType: (typeof PACKAGE_TYPES)[number];
  carton: string;
  weightKg: number;
  dimensions: string;
  material: string;
  labelNumber: string;
  station: string;
  operator: string;
  status: (typeof PACK_STATUSES)[number];
}

export interface Shipment {
  id: string;
  orders: string[];
  carrier: string;
  vehicle: string;
  driver: string;
  dock: string;
  container: string;
  seal: string;
  scheduledAt: string;
  destination: string;
  trackingNo: string;
  loadVerified: boolean;
  checklist: string[];
  dispatch: (typeof DISPATCH_STATUSES)[number];
  status: (typeof SHIPMENT_STATUSES)[number];
}

export interface Backorder {
  id: string;
  order: string;
  customer: string;
  sku: string;
  product: string;
  missingQty: number;
  availableQty: number;
  suggested: number;
  reason: string;
  expectedDate: string;
  priority: Priority;
  status: (typeof BACKORDER_STATUSES)[number];
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  type: "order" | "wave" | "pick" | "pack" | "ship" | "alert";
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  severity: "info" | "success" | "warning" | "danger";
  read: boolean;
}

/* --------------------------------- schemas -------------------------------- */

export const orderLineInput = z.object({
  sku: nonEmpty(40),
  product: z.string().trim().max(160).default(""),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(1_000_000),
  allocated: z.number().int().min(0).max(1_000_000).default(0),
  picked: z.number().int().min(0).max(1_000_000).default(0),
  location: z.string().trim().max(40).default(""),
});

export const salesOrderInput = z.object({
  id: z.string().trim().min(3).max(40).optional(),
  customer: nonEmpty(160),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  priority,
  warehouse: nonEmpty(40),
  carrier: nonEmpty(80),
  route: z.string().trim().max(40).default(""),
  status: z.enum(ORDER_STATUSES).default("Received"),
  validation: z.enum(["Pending", "Passed", "Failed"]).default("Pending"),
  valueUsd: z.number().min(0).max(100_000_000).default(0),
  lines: z.array(orderLineInput).min(1, "At least one order line is required"),
});
export type SalesOrderInput = z.infer<typeof salesOrderInput>;

export const waveInput = z.object({
  id: z.string().trim().min(3).max(40).optional(),
  name: nonEmpty(120),
  warehouse: nonEmpty(40),
  zone: z.string().trim().max(60).default(""),
  priority,
  carrier: z.string().trim().max(80).default(""),
  route: z.string().trim().max(40).default(""),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  capacity: z.number().int().min(0).max(100_000).default(0),
  status: z.enum(WAVE_STATUSES).default("Draft"),
  createdBy: z.string().trim().max(80).default("System"),
  orders: z.array(z.string().trim().min(1)).min(1, "Select at least one order"),
});
export type WaveInput = z.infer<typeof waveInput>;

export const packingInput = z.object({
  id: z.string().trim().min(3).max(40).optional(),
  order: nonEmpty(40),
  wave: z.string().trim().max(40).optional().nullable(),
  packageType: z.enum(PACKAGE_TYPES),
  carton: z.string().trim().max(60).default(""),
  weightKg: z.number().min(0, "Weight must be positive").max(50_000),
  dimensions: z.string().trim().max(60).default(""),
  material: z.string().trim().max(160).default(""),
  labelNumber: z.string().trim().max(60).default(""),
  station: z.string().trim().max(60).default(""),
  operator: z.string().trim().max(80).default(""),
  status: z.enum(PACK_STATUSES).default("Pending"),
});
export type PackingInput = z.infer<typeof packingInput>;

export const shipmentInput = z.object({
  id: z.string().trim().min(3).max(40).optional(),
  carrier: nonEmpty(80),
  vehicle: z.string().trim().max(40).nullable().optional(),
  driver: z.string().trim().max(80).default(""),
  dock: z.string().trim().max(40).default(""),
  container: z.string().trim().max(60).default(""),
  seal: z.string().trim().max(60).default(""),
  scheduledAt: z.string().trim().max(40).optional().nullable(),
  destination: z.string().trim().max(120).default(""),
  trackingNo: z.string().trim().max(60).default(""),
  status: z.enum(SHIPMENT_STATUSES).default("Staged"),
  orders: z.array(z.string().trim().min(1)).default([]),
});
export type ShipmentInput = z.infer<typeof shipmentInput>;

export const backorderInput = z.object({
  id: z.string().trim().min(3).max(40).optional(),
  order: nonEmpty(40),
  customer: z.string().trim().max(160).default(""),
  sku: nonEmpty(40),
  product: z.string().trim().max(160).default(""),
  missingQty: z.number().int().min(0).max(1_000_000),
  availableQty: z.number().int().min(0).max(1_000_000).default(0),
  suggested: z.number().int().min(0).max(1_000_000).default(0),
  reason: z.string().trim().max(200).default(""),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  priority,
  status: z.enum(BACKORDER_STATUSES).default("Open"),
});
export type BackorderInput = z.infer<typeof backorderInput>;

export const pickLineInput = z.object({
  id: z.string().trim().min(3).max(40).optional(),
  wave: nonEmpty(40),
  picker: z.string().trim().max(80).default(""),
  zone: z.string().trim().max(60).default(""),
  location: z.string().trim().max(40).default(""),
  sku: nonEmpty(40),
  product: z.string().trim().max(160).default(""),
  quantity: z.number().int().min(1).max(1_000_000),
  pickedQty: z.number().int().min(0).max(1_000_000).default(0),
  barcode: z.string().trim().max(60).default(""),
  serial: z.string().trim().max(60).default(""),
  verified: z.boolean().default(false),
  status: z.enum(PICK_STATUSES).default("Pending"),
});
export type PickLineInput = z.infer<typeof pickLineInput>;

export interface DashboardStats {
  totalOrders: number;
  ordersToday: number;
  openWaves: number;
  releasedWaves: number;
  pickLinesPending: number;
  packagesPacked: number;
  shipmentsInTransit: number;
  awaitingDispatch: number;
  openBackorders: number;
  unitsShipped: number;
  fulfilmentRate: number;
  onTimeRate: number;
  waveStatusChart: { name: string; value: number }[];
  ordersByPriorityChart: { priority: string; orders: number }[];
  shipmentTrendChart: { day: string; shipped: number; planned: number }[];
  dailyFulfillmentChart: { hour: string; picked: number; packed: number; shipped: number }[];
  orderStatusChart: { status: string; orders: number }[];
  carrierChart: { carrier: string; shipments: number }[];
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
