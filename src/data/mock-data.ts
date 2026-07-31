/**
 * Central mock data store for the Outbound Fulfillment & Wave Management module.
 *
 * TODO(integration): Replace every export here with data fetched from the WMS
 * backend / ERP (Inventory API, Order API, Shipping API). Keep the exported
 * shapes stable so pages and components do not need changes.
 */

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type Role =
  | "Warehouse Executive"
  | "Warehouse Manager"
  | "Picker"
  | "Packing Operator"
  | "Loading Supervisor"
  | "Dispatcher"
  | "Administrator";

export const ROLES: Role[] = [
  "Administrator",
  "Warehouse Manager",
  "Warehouse Executive",
  "Picker",
  "Packing Operator",
  "Loading Supervisor",
  "Dispatcher",
];

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

export interface OrderLine {
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
  status:
    | "Received"
    | "Validated"
    | "Allocated"
    | "Reserved"
    | "Wave Planned"
    | "Released"
    | "Picking"
    | "Packed"
    | "Staged"
    | "Loading"
    | "Ready for Shipment"
    | "Shipped"
    | "Backordered";
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
  status: "Draft" | "Planned" | "Released" | "Picking" | "Completed";
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
  status: "Pending" | "In Progress" | "Picked" | "Short";
}

export interface PackingRecord {
  id: string;
  order: string;
  wave: string;
  packageType: "Carton" | "Pallet" | "Tote" | "Crate";
  carton: string;
  weightKg: number;
  dimensions: string;
  material: string;
  labelNumber: string;
  station: string;
  operator: string;
  status: "Pending" | "In Progress" | "Completed";
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
  dispatch: "Awaiting Dispatch" | "Approved" | "Rejected" | "Dispatched";
  status: "Staged" | "Loading" | "Ready for Shipment" | "In Transit" | "Delivered";
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
  status: "Open" | "Partially Allocated" | "Fulfilled" | "Closed";
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


function at<T>(arr: readonly T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length] as T;
}

export const customers: Customer[] = [
  { id: "CUST-1001", name: "Northwind Retail Group", segment: "Retail", city: "Chicago", country: "USA", creditStatus: "Approved" },
  { id: "CUST-1002", name: "Aurora Pharma Distribution", segment: "Healthcare", city: "Boston", country: "USA", creditStatus: "Review" },
  { id: "CUST-1003", name: "Vertex Industrial Supply", segment: "Industrial", city: "Houston", country: "USA", creditStatus: "Approved" },
  { id: "CUST-1004", name: "BlueLine Grocers", segment: "FMCG", city: "Toronto", country: "Canada", creditStatus: "Approved" },
  { id: "CUST-1005", name: "Helix Electronics Ltd.", segment: "Electronics", city: "Austin", country: "USA", creditStatus: "On Hold" },
  { id: "CUST-1006", name: "Meridian Auto Parts", segment: "Automotive", city: "Detroit", country: "USA", creditStatus: "Approved" },
  { id: "CUST-1007", name: "Coastal Home Living", segment: "Retail", city: "Miami", country: "USA", creditStatus: "Approved" },
  { id: "CUST-1008", name: "Sierra Foods Wholesale", segment: "FMCG", city: "Denver", country: "USA", creditStatus: "Review" },
];

export const products: Product[] = [
  { sku: "SKU-48120", name: 'LED Panel Light 40W 2x2"', uom: "EA", category: "Electrical", barcode: "8901234481203", weightKg: 2.4 },
  { sku: "SKU-48221", name: "Industrial Hex Bolt M12 (100pk)", uom: "BOX", category: "Fasteners", barcode: "8901234482217", weightKg: 5.1 },
  { sku: "SKU-49330", name: "Nitrile Gloves Large (Case)", uom: "CS", category: "Safety", barcode: "8901234493307", weightKg: 3.8 },
  { sku: "SKU-50110", name: "Thermal Printer Ribbon 110mm", uom: "EA", category: "Consumables", barcode: "8901234501106", weightKg: 0.6 },
  { sku: "SKU-51044", name: "Stainless Steel Shelf 900mm", uom: "EA", category: "Fixtures", barcode: "8901234510449", weightKg: 12.5 },
  { sku: "SKU-52781", name: "Cordless Drill Kit 18V", uom: "EA", category: "Power Tools", barcode: "8901234527818", weightKg: 4.2 },
  { sku: "SKU-53902", name: "Corrugated Carton 600x400x400", uom: "BDL", category: "Packaging", barcode: "8901234539026", weightKg: 7.0 },
  { sku: "SKU-54118", name: "Hydraulic Hose 3/8in 2m", uom: "EA", category: "Hydraulics", barcode: "8901234541180", weightKg: 1.9 },
  { sku: "SKU-55420", name: "Vitamin C Tablets 500mg (Case)", uom: "CS", category: "Pharma", barcode: "8901234554205", weightKg: 6.3 },
  { sku: "SKU-56033", name: "Automotive Oil Filter A/12", uom: "EA", category: "Automotive", barcode: "8901234560338", weightKg: 0.9 },
];

export const warehouses: Warehouse[] = [
  { code: "WH-CHI-01", name: "Chicago Central DC", city: "Chicago", zones: ["Zone A", "Zone B", "Zone C", "Cold Zone"] },
  { code: "WH-DAL-02", name: "Dallas Regional DC", city: "Dallas", zones: ["Zone A", "Zone B", "Bulk Zone"] },
  { code: "WH-NJ-03", name: "New Jersey Hub", city: "Newark", zones: ["Zone A", "Zone D", "High Bay"] },
];

export const zones = ["Zone A", "Zone B", "Zone C", "Zone D", "Bulk Zone", "Cold Zone", "High Bay"];

export const carriers = ["FedEx Freight", "UPS Supply Chain", "DHL Express", "XPO Logistics", "Regional Fleet"];

export const routes = ["RT-NORTH-12", "RT-SOUTH-04", "RT-EAST-07", "RT-WEST-19", "RT-METRO-02"];

export const vehicles = [
  { id: "VH-4410", plate: "IL-8842-TR", type: "53ft Trailer", driver: "Marcus Reed", capacityPallets: 26 },
  { id: "VH-4411", plate: "TX-1190-BX", type: "26ft Box Truck", driver: "Dana Whitfield", capacityPallets: 14 },
  { id: "VH-4412", plate: "NJ-7723-CT", type: "40ft Container", driver: "Samuel Ortiz", capacityPallets: 22 },
  { id: "VH-4413", plate: "IL-5561-VN", type: "Delivery Van", driver: "Priya Raman", capacityPallets: 6 },
];

export const docks = ["Dock 01", "Dock 02", "Dock 03", "Dock 04", "Dock 05", "Dock 06"];

const orderSeed: Array<[string, string, Priority, SalesOrder["status"], SalesOrder["validation"], string, string, string]> = [
  ["SO-2026-4101", "Northwind Retail Group", "High", "Shipped", "Passed", "WH-CHI-01", "FedEx Freight", "RT-NORTH-12"],
  ["SO-2026-4102", "Aurora Pharma Distribution", "Critical", "Ready for Shipment", "Passed", "WH-CHI-01", "DHL Express", "RT-METRO-02"],
  ["SO-2026-4103", "Vertex Industrial Supply", "Medium", "Packed", "Passed", "WH-DAL-02", "XPO Logistics", "RT-SOUTH-04"],
  ["SO-2026-4104", "BlueLine Grocers", "High", "Picking", "Passed", "WH-CHI-01", "UPS Supply Chain", "RT-NORTH-12"],
  ["SO-2026-4105", "Helix Electronics Ltd.", "Low", "Received", "Pending", "WH-NJ-03", "FedEx Freight", "RT-EAST-07"],
  ["SO-2026-4106", "Meridian Auto Parts", "Medium", "Reserved", "Passed", "WH-DAL-02", "Regional Fleet", "RT-WEST-19"],
  ["SO-2026-4107", "Coastal Home Living", "High", "Wave Planned", "Passed", "WH-NJ-03", "UPS Supply Chain", "RT-EAST-07"],
  ["SO-2026-4108", "Sierra Foods Wholesale", "Critical", "Backordered", "Failed", "WH-CHI-01", "DHL Express", "RT-METRO-02"],
  ["SO-2026-4109", "Northwind Retail Group", "Medium", "Staged", "Passed", "WH-CHI-01", "FedEx Freight", "RT-NORTH-12"],
  ["SO-2026-4110", "Vertex Industrial Supply", "Low", "Validated", "Passed", "WH-DAL-02", "XPO Logistics", "RT-SOUTH-04"],
  ["SO-2026-4111", "Aurora Pharma Distribution", "High", "Released", "Passed", "WH-CHI-01", "DHL Express", "RT-METRO-02"],
  ["SO-2026-4112", "BlueLine Grocers", "Medium", "Allocated", "Passed", "WH-NJ-03", "Regional Fleet", "RT-EAST-07"],
  ["SO-2026-4113", "Helix Electronics Ltd.", "Critical", "Loading", "Passed", "WH-NJ-03", "FedEx Freight", "RT-EAST-07"],
  ["SO-2026-4114", "Meridian Auto Parts", "Low", "Received", "Pending", "WH-DAL-02", "UPS Supply Chain", "RT-WEST-19"],
  ["SO-2026-4115", "Coastal Home Living", "Medium", "Picking", "Passed", "WH-CHI-01", "XPO Logistics", "RT-SOUTH-04"],
  ["SO-2026-4116", "Sierra Foods Wholesale", "High", "Reserved", "Passed", "WH-CHI-01", "Regional Fleet", "RT-METRO-02"],
  ["SO-2026-4117", "Northwind Retail Group", "Low", "Wave Planned", "Passed", "WH-DAL-02", "FedEx Freight", "RT-NORTH-12"],
  ["SO-2026-4118", "Vertex Industrial Supply", "Critical", "Shipped", "Passed", "WH-NJ-03", "DHL Express", "RT-EAST-07"],
  ["SO-2026-4119", "Aurora Pharma Distribution", "Medium", "Packed", "Passed", "WH-CHI-01", "UPS Supply Chain", "RT-METRO-02"],
  ["SO-2026-4120", "BlueLine Grocers", "High", "Ready for Shipment", "Passed", "WH-DAL-02", "XPO Logistics", "RT-SOUTH-04"],
  ["SO-2026-4121", "Helix Electronics Ltd.", "Medium", "Received", "Pending", "WH-CHI-01", "Regional Fleet", "RT-NORTH-12"],
  ["SO-2026-4122", "Sierra Foods Wholesale", "Low", "Validated", "Passed", "WH-NJ-03", "FedEx Freight", "RT-EAST-07"],
  ["SO-2026-4123", "Meridian Auto Parts", "High", "Backordered", "Passed", "WH-DAL-02", "UPS Supply Chain", "RT-WEST-19"],
  ["SO-2026-4124", "Coastal Home Living", "Critical", "Released", "Passed", "WH-CHI-01", "DHL Express", "RT-METRO-02"],
];

export const salesOrders: SalesOrder[] = orderSeed.map(
  ([id, customer, priority, status, validation, warehouse, carrier, route], i) => {
    const lineCount = (i % 3) + 2;
    const lines: OrderLine[] = Array.from({ length: lineCount }, (_, j) => {
      const p = at(products, i + j * 3);
      const quantity = 10 + ((i * 7 + j * 13) % 90);
      const allocated = status === "Received" || status === "Validated" ? 0 : quantity;
      const picked = ["Picking"].includes(status)
        ? Math.floor(quantity / 2)
        : ["Packed", "Staged", "Loading", "Ready for Shipment", "Shipped"].includes(status)
          ? quantity
          : 0;
      return {
        sku: p.sku,
        product: p.name,
        quantity,
        allocated,
        picked,
        location: `${String.fromCharCode(65 + (j % 4))}-${10 + ((i + j) % 20)}-${(j % 5) + 1}`,
      };
    });
    const quantity = lines.reduce((s, l) => s + l.quantity, 0);
    return {
      id,
      customer,
      orderDate: `2026-07-${String(10 + (i % 18)).padStart(2, "0")}`,
      deliveryDate: `2026-08-${String(1 + (i % 20)).padStart(2, "0")}`,
      priority,
      warehouse,
      carrier,
      route,
      lines,
      items: lines.length,
      quantity,
      status,
      validation,
      valueUsd: 1500 + i * 875,
    };
  },
);

export const inventory: InventoryRecord[] = products.flatMap((p, i) =>
  warehouses.map((w, j) => {
    const available = ((i * 37 + j * 91) % 500) + (i === 3 && j === 1 ? 0 : 20);
    const reserved = Math.floor(available * 0.25);
    const allocated = Math.floor(available * 0.15);
    return {
      id: `INV-${p.sku}-${w.code}`,
      sku: p.sku,
      product: p.name,
      warehouse: w.code,
      zone: at(w.zones, i + j),
      location: `${String.fromCharCode(65 + (j % 4))}-${10 + ((i + j) % 20)}-${(i % 5) + 1}`,
      available,
      reserved,
      allocated,
      status: available === 0 ? "Out of Stock" : available < 60 ? "Low Stock" : "In Stock",
    } satisfies InventoryRecord;
  }),
);

export const waves: Wave[] = [
  {
    id: "WV-2026-0231",
    name: "Morning Metro Wave",
    warehouse: "WH-CHI-01",
    zone: "Zone A",
    priority: "Critical",
    carrier: "DHL Express",
    route: "RT-METRO-02",
    deliveryDate: "2026-08-02",
    orders: ["SO-2026-4102", "SO-2026-4111", "SO-2026-4124"],
    capacity: 80,
    lines: 42,
    reservationConfirmed: true,
    status: "Released",
    createdBy: "K. Alvarez",
    createdAt: "2026-07-31 06:12",
  },
  {
    id: "WV-2026-0232",
    name: "North Route Consolidation",
    warehouse: "WH-CHI-01",
    zone: "Zone B",
    priority: "High",
    carrier: "FedEx Freight",
    route: "RT-NORTH-12",
    deliveryDate: "2026-08-03",
    orders: ["SO-2026-4104", "SO-2026-4109"],
    capacity: 60,
    lines: 28,
    reservationConfirmed: true,
    status: "Picking",
    createdBy: "K. Alvarez",
    createdAt: "2026-07-31 06:40",
  },
  {
    id: "WV-2026-0233",
    name: "Dallas Bulk Wave",
    warehouse: "WH-DAL-02",
    zone: "Bulk Zone",
    priority: "Medium",
    carrier: "XPO Logistics",
    route: "RT-SOUTH-04",
    deliveryDate: "2026-08-05",
    orders: ["SO-2026-4103", "SO-2026-4117", "SO-2026-4120"],
    capacity: 120,
    lines: 51,
    reservationConfirmed: false,
    status: "Planned",
    createdBy: "R. Nakamura",
    createdAt: "2026-07-31 07:05",
  },
  {
    id: "WV-2026-0234",
    name: "East Coast Express",
    warehouse: "WH-NJ-03",
    zone: "Zone D",
    priority: "High",
    carrier: "UPS Supply Chain",
    route: "RT-EAST-07",
    deliveryDate: "2026-08-04",
    orders: ["SO-2026-4107", "SO-2026-4113"],
    capacity: 55,
    lines: 19,
    reservationConfirmed: true,
    status: "Planned",
    createdBy: "R. Nakamura",
    createdAt: "2026-07-31 07:44",
  },
  {
    id: "WV-2026-0235",
    name: "West Fleet Draft",
    warehouse: "WH-DAL-02",
    zone: "Zone A",
    priority: "Low",
    carrier: "Regional Fleet",
    route: "RT-WEST-19",
    deliveryDate: "2026-08-08",
    orders: ["SO-2026-4106"],
    capacity: 40,
    lines: 9,
    reservationConfirmed: false,
    status: "Draft",
    createdBy: "T. Boyle",
    createdAt: "2026-07-31 08:20",
  },
  {
    id: "WV-2026-0230",
    name: "Overnight Pharma Wave",
    warehouse: "WH-CHI-01",
    zone: "Cold Zone",
    priority: "Critical",
    carrier: "DHL Express",
    route: "RT-METRO-02",
    deliveryDate: "2026-07-31",
    orders: ["SO-2026-4101", "SO-2026-4118"],
    capacity: 70,
    lines: 33,
    reservationConfirmed: true,
    status: "Completed",
    createdBy: "K. Alvarez",
    createdAt: "2026-07-30 21:10",
  },
];

const pickers = ["J. Fernandes", "A. Osei", "L. Kim", "M. Duarte", "S. Patel"];

export const pickLines: PickLine[] = Array.from({ length: 18 }, (_, i) => {
  const p = at(products, i);
  const wave = at(waves, i % 3).id;
  const quantity = 5 + ((i * 11) % 45);
  const state = i % 4;
  return {
    id: `PL-${9100 + i}`,
    wave,
    picker: at(pickers, i),
    zone: at(zones, i),
    location: `${String.fromCharCode(65 + (i % 4))}-${12 + (i % 18)}-${(i % 5) + 1}`,
    sku: p.sku,
    product: p.name,
    quantity,
    pickedQty: state === 0 ? 0 : state === 1 ? Math.floor(quantity / 2) : state === 3 ? quantity - 3 : quantity,
    barcode: p.barcode,
    serial: `SN-${480000 + i * 137}`,
    verified: state === 2,
    status: state === 0 ? "Pending" : state === 1 ? "In Progress" : state === 3 ? "Short" : "Picked",
  } satisfies PickLine;
});

export const packingRecords: PackingRecord[] = [
  { id: "PK-7701", order: "SO-2026-4103", wave: "WV-2026-0233", packageType: "Carton", carton: "CTN-60x40x40", weightKg: 18.4, dimensions: "60 x 40 x 40 cm", material: "Double-wall + bubble wrap", labelNumber: "LBL-99120", station: "Pack Station 2", operator: "N. Ibrahim", status: "Completed" },
  { id: "PK-7702", order: "SO-2026-4119", wave: "WV-2026-0231", packageType: "Pallet", carton: "PLT-EUR-1", weightKg: 220.0, dimensions: "120 x 80 x 145 cm", material: "Stretch wrap + corner boards", labelNumber: "LBL-99121", station: "Pack Station 1", operator: "N. Ibrahim", status: "Completed" },
  { id: "PK-7703", order: "SO-2026-4104", wave: "WV-2026-0232", packageType: "Carton", carton: "CTN-40x30x30", weightKg: 9.2, dimensions: "40 x 30 x 30 cm", material: "Single-wall + void fill", labelNumber: "LBL-99122", station: "Pack Station 3", operator: "C. Reyes", status: "In Progress" },
  { id: "PK-7704", order: "SO-2026-4115", wave: "WV-2026-0232", packageType: "Tote", carton: "TOTE-STD-B", weightKg: 6.8, dimensions: "60 x 40 x 32 cm", material: "Reusable tote + lid seal", labelNumber: "LBL-99123", station: "Pack Station 2", operator: "C. Reyes", status: "Pending" },
  { id: "PK-7705", order: "SO-2026-4102", wave: "WV-2026-0231", packageType: "Crate", carton: "CRT-COLD-4", weightKg: 44.5, dimensions: "100 x 60 x 60 cm", material: "Insulated crate + gel packs", labelNumber: "LBL-99124", station: "Cold Pack Bay", operator: "D. Sorensen", status: "Completed" },
  { id: "PK-7706", order: "SO-2026-4120", wave: "WV-2026-0233", packageType: "Pallet", carton: "PLT-US-2", weightKg: 310.0, dimensions: "122 x 102 x 160 cm", material: "Stretch wrap", labelNumber: "LBL-99125", station: "Pack Station 1", operator: "N. Ibrahim", status: "Pending" },
];

export const shipments: Shipment[] = [
  { id: "SH-30411", orders: ["SO-2026-4101", "SO-2026-4118"], carrier: "FedEx Freight", vehicle: "VH-4410", driver: "Marcus Reed", dock: "Dock 01", container: "CNT-88120", seal: "SEAL-441209", scheduledAt: "2026-07-31 09:00", destination: "Chicago, IL", trackingNo: "FX-772199310", loadVerified: true, dispatch: "Dispatched", status: "In Transit" },
  { id: "SH-30412", orders: ["SO-2026-4102"], carrier: "DHL Express", vehicle: "VH-4413", driver: "Priya Raman", dock: "Dock 03", container: "CNT-88121", seal: "SEAL-441210", scheduledAt: "2026-07-31 11:30", destination: "Boston, MA", trackingNo: "DH-559120044", loadVerified: true, dispatch: "Approved", status: "Ready for Shipment" },
  { id: "SH-30413", orders: ["SO-2026-4113"], carrier: "FedEx Freight", vehicle: "VH-4412", driver: "Samuel Ortiz", dock: "Dock 05", container: "CNT-88122", seal: "SEAL-441211", scheduledAt: "2026-07-31 13:15", destination: "Austin, TX", trackingNo: "FX-772199344", loadVerified: false, dispatch: "Awaiting Dispatch", status: "Loading" },
  { id: "SH-30414", orders: ["SO-2026-4109", "SO-2026-4120"], carrier: "XPO Logistics", vehicle: "VH-4411", driver: "Dana Whitfield", dock: "Dock 02", container: "CNT-88123", seal: "SEAL-441212", scheduledAt: "2026-07-31 15:45", destination: "Dallas, TX", trackingNo: "XP-330128877", loadVerified: false, dispatch: "Awaiting Dispatch", status: "Staged" },
  { id: "SH-30415", orders: ["SO-2026-4123"], carrier: "UPS Supply Chain", vehicle: "VH-4411", driver: "Dana Whitfield", dock: "Dock 04", container: "CNT-88124", seal: "SEAL-441213", scheduledAt: "2026-08-01 08:00", destination: "Detroit, MI", trackingNo: "UP-100238841", loadVerified: false, dispatch: "Rejected", status: "Staged" },
];

export const backorders: Backorder[] = [
  { id: "BO-5501", order: "SO-2026-4108", customer: "Sierra Foods Wholesale", sku: "SKU-50110", product: "Thermal Printer Ribbon 110mm", missingQty: 120, availableQty: 45, suggested: 45, reason: "Insufficient stock at allocation", expectedDate: "2026-08-06", priority: "Critical", status: "Open" },
  { id: "BO-5502", order: "SO-2026-4123", customer: "Meridian Auto Parts", sku: "SKU-56033", product: "Automotive Oil Filter A/12", missingQty: 60, availableQty: 60, suggested: 60, reason: "Reserved by higher priority wave", expectedDate: "2026-08-02", priority: "High", status: "Partially Allocated" },
  { id: "BO-5503", order: "SO-2026-4105", customer: "Helix Electronics Ltd.", sku: "SKU-48120", product: 'LED Panel Light 40W 2x2"', missingQty: 35, availableQty: 0, suggested: 0, reason: "Supplier delay", expectedDate: "2026-08-12", priority: "Medium", status: "Open" },
  { id: "BO-5504", order: "SO-2026-4114", customer: "Meridian Auto Parts", sku: "SKU-54118", product: "Hydraulic Hose 3/8in 2m", missingQty: 18, availableQty: 210, suggested: 18, reason: "Cycle count adjustment", expectedDate: "2026-08-01", priority: "Low", status: "Fulfilled" },
];

export const activities: ActivityItem[] = [
  { id: "AC-1", actor: "K. Alvarez", action: "released wave", target: "WV-2026-0231", time: "8 min ago", type: "wave" },
  { id: "AC-2", actor: "J. Fernandes", action: "completed picking for", target: "SO-2026-4109", time: "22 min ago", type: "pick" },
  { id: "AC-3", actor: "N. Ibrahim", action: "packed shipment", target: "PK-7702", time: "41 min ago", type: "pack" },
  { id: "AC-4", actor: "System", action: "created backorder", target: "BO-5501", time: "1 hr ago", type: "alert" },
  { id: "AC-5", actor: "T. Boyle", action: "approved dispatch for", target: "SH-30412", time: "1 hr ago", type: "ship" },
  { id: "AC-6", actor: "ERP Sync", action: "received sales order", target: "SO-2026-4124", time: "2 hrs ago", type: "order" },
  { id: "AC-7", actor: "R. Nakamura", action: "planned wave", target: "WV-2026-0234", time: "3 hrs ago", type: "wave" },
];

export const notifications: NotificationItem[] = [
  { id: "NT-1", title: "Wave released", message: "WV-2026-0231 released with 3 orders and 42 lines.", time: "8 min ago", severity: "success", read: false },
  { id: "NT-2", title: "Backorder created", message: "BO-5501 raised for SO-2026-4108 — 120 units short.", time: "1 hr ago", severity: "danger", read: false },
  { id: "NT-3", title: "Dispatch approved", message: "SH-30412 approved by Warehouse Manager.", time: "1 hr ago", severity: "success", read: false },
  { id: "NT-4", title: "Picking started", message: "Wave WV-2026-0232 picking in progress (Zone B).", time: "2 hrs ago", severity: "info", read: true },
  { id: "NT-5", title: "Reservation pending", message: "WV-2026-0233 cannot be released — inventory not reserved.", time: "3 hrs ago", severity: "warning", read: true },
  { id: "NT-6", title: "Shipment completed", message: "SH-30411 departed Dock 01 at 09:12.", time: "5 hrs ago", severity: "info", read: true },
];

export const waveStatusChart = [
  { name: "Draft", value: 1 },
  { name: "Planned", value: 2 },
  { name: "Released", value: 1 },
  { name: "Picking", value: 1 },
  { name: "Completed", value: 1 },
];

export const shipmentTrendChart = [
  { day: "Jul 25", shipped: 42, planned: 48 },
  { day: "Jul 26", shipped: 51, planned: 54 },
  { day: "Jul 27", shipped: 38, planned: 44 },
  { day: "Jul 28", shipped: 61, planned: 60 },
  { day: "Jul 29", shipped: 57, planned: 62 },
  { day: "Jul 30", shipped: 66, planned: 68 },
  { day: "Jul 31", shipped: 49, planned: 72 },
];

export const ordersByPriorityChart = [
  { priority: "Critical", orders: 5 },
  { priority: "High", orders: 7 },
  { priority: "Medium", orders: 7 },
  { priority: "Low", orders: 5 },
];

export const dailyFulfillmentChart = [
  { hour: "06:00", picked: 120, packed: 90, shipped: 40 },
  { hour: "08:00", picked: 260, packed: 210, shipped: 130 },
  { hour: "10:00", picked: 410, packed: 340, shipped: 250 },
  { hour: "12:00", picked: 520, packed: 470, shipped: 360 },
  { hour: "14:00", picked: 680, packed: 590, shipped: 470 },
  { hour: "16:00", picked: 790, packed: 710, shipped: 610 },
];

export const workflowSteps = [
  "Sales Order Received",
  "Order Validation",
  "Inventory Allocation",
  "Inventory Reservation",
  "Wave Planning",
  "Wave Release",
  "Pick List Generated",
  "Picking",
  "Packing",
  "Staging",
  "Loading",
  "Dispatch Authorization",
  "Shipment",
  "Tracking Updated",
  "Completed",
];
