/**
 * Server-only write/service layer for the WMS backend.
 * All multi-table business rules run inside Postgres functions (transactions).
 */
import { db, fail, HttpError, logActivity, rawDb } from "./wms.server";
import type { BackorderInput, PackingInput, PickLineInput, SalesOrderInput, ShipmentInput, WaveInput } from "./wms-types";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (rawDb() as any).rpc(name, args);
  if (error) fail(error);
  return data as T;
}

/* --------------------------------- orders --------------------------------- */

export const createOrder = (input: SalesOrderInput) => rpc<string>("create_sales_order", { p: input });

export const updateOrder = (id: string, input: Record<string, unknown>) =>
  rpc<string>("update_sales_order", { p_id: id, p: input });

export async function deleteOrder(id: string) {
  const client = db();
  const { count } = await client.from("wave_orders").select("wave_id", { count: "exact", head: true }).eq("order_id", id);
  if ((count ?? 0) > 0) throw new HttpError(409, `${id} is assigned to a wave — remove it from the wave first`);
  await client.from("order_lines").delete().eq("order_id", id);
  await client.from("backorders").delete().eq("order_id", id);
  await client.from("shipment_orders").delete().eq("order_id", id);
  const { error } = await client.from("sales_orders").delete().eq("id", id);
  if (error) fail(error);
  await logActivity("System", "deleted sales order", id, "order");
  return id;
}

export const validateOrder = (id: string) => rpc<{ validation: string; reason: string }>("validate_sales_order", { p_id: id });
export const allocateOrder = (id: string) => rpc<{ allocated: number; short: number }>("allocate_order", { p_id: id });
export const reserveOrder = (id: string) => rpc<string>("reserve_order", { p_id: id });

export async function setOrderStatus(id: string, status: string) {
  const { error } = await db().from("sales_orders").update({ status }).eq("id", id);
  if (error) fail(error);
  await logActivity("System", `set status to ${status} for`, id, "order");
  return id;
}

/* ------------------------------- inventory -------------------------------- */

export async function inventoryAction(ids: string[], kind: "reserve" | "release" | "reallocate", qty: number) {
  const client = db();
  const { data, error } = await client.from("inventory").select("*").in("id", ids);
  if (error) fail(error);
  const rows = data ?? [];
  if (rows.length === 0) throw new HttpError(404, "No inventory records found");

  for (const r of rows) {
    let patch: { available: number; reserved: number; allocated: number };
    if (kind === "reserve") {
      const take = Math.min(qty, r.available);
      if (take <= 0) throw new HttpError(422, `${r.sku} at ${r.location} has no available stock to reserve`);
      patch = { available: r.available - take, reserved: r.reserved + take, allocated: r.allocated };
    } else if (kind === "release") {
      const give = Math.min(qty, r.reserved);
      if (give <= 0) throw new HttpError(422, `${r.sku} at ${r.location} has no reservation to release`);
      patch = { available: r.available + give, reserved: r.reserved - give, allocated: Math.max(0, r.allocated - give) };
    } else {
      const take = Math.min(qty, r.reserved);
      if (take <= 0) throw new HttpError(422, `${r.sku} at ${r.location} has nothing reserved to reallocate`);
      patch = { available: r.available, reserved: r.reserved, allocated: r.allocated + take };
    }
    const { error: uerr } = await client.from("inventory").update(patch).eq("id", r.id);
    if (uerr) fail(uerr);
  }
  await logActivity("System", `${kind}d inventory for`, `${rows.length} location(s)`, "order");
  return { updated: rows.length };
}

/* ---------------------------------- waves --------------------------------- */

export const createWave = (input: WaveInput) => rpc<string>("create_wave", { p: input });
export const updateWave = (id: string, input: Record<string, unknown>) => rpc<string>("update_wave", { p_id: id, p: input });
export const releaseWave = (id: string) => rpc<string>("release_wave", { p_id: id });
export const confirmWaveReservation = (id: string) => rpc<boolean>("confirm_wave_reservation", { p_id: id });
export const generatePickLists = (wave: string) => rpc<number>("generate_pick_lists", { p_wave: wave });

export async function deleteWave(id: string) {
  const client = db();
  const { data: wave } = await client.from("waves").select("status").eq("id", id).maybeSingle();
  if (!wave) throw new HttpError(404, `Wave ${id} not found`);
  if (wave.status !== "Draft" && wave.status !== "Planned") {
    throw new HttpError(409, `Wave ${id} is ${wave.status} and can no longer be deleted`);
  }
  const { data: links } = await client.from("wave_orders").select("order_id").eq("wave_id", id);
  await client.from("pick_lines").delete().eq("wave_id", id);
  await client.from("wave_orders").delete().eq("wave_id", id);
  const { error } = await client.from("waves").delete().eq("id", id);
  if (error) fail(error);
  for (const l of links ?? []) {
    await client.from("sales_orders").update({ status: "Reserved" }).eq("id", l.order_id).eq("status", "Wave Planned");
  }
  await logActivity("System", "deleted wave", id, "wave");
  return id;
}

/* ---------------------------------- picks --------------------------------- */

export const confirmPick = (id: string, barcode: string, qty: number, picker: string) =>
  rpc<{ status: string; pickedQty: number }>("confirm_pick", { p_id: id, p_barcode: barcode, p_qty: qty, p_picker: picker });

export interface PickLinePatch {
  picker?: string | undefined;
  status?: PickLineInput["status"] | undefined;
  pickedQty?: number | undefined;
  verified?: boolean | undefined;
}

export async function updatePickLine(id: string, input: PickLinePatch) {
  const patch: { picker?: string; status?: string; picked_qty?: number; verified?: boolean } = {};
  if (input.picker !== undefined) patch.picker = input.picker;
  if (input.status !== undefined) patch.status = input.status;
  if (input.pickedQty !== undefined) patch.picked_qty = input.pickedQty;
  if (input.verified !== undefined) patch.verified = input.verified;
  const { error } = await db().from("pick_lines").update(patch).eq("id", id);
  if (error) fail(error);
  await logActivity("System", "updated pick line", id, "pick");
  return id;
}

export async function completeWavePicking(waveId: string) {
  const client = db();
  const { data } = await client.from("pick_lines").select("status").eq("wave_id", waveId);
  const lines = data ?? [];
  if (lines.length === 0) throw new HttpError(422, `No pick lines exist for ${waveId}`);
  const open = lines.filter((l) => l.status === "Pending" || l.status === "In Progress").length;
  if (open > 0) throw new HttpError(422, `${open} pick line(s) in ${waveId} are not confirmed yet`);
  const { error } = await client.from("waves").update({ status: "Completed" }).eq("id", waveId);
  if (error) fail(error);
  const { data: links } = await client.from("wave_orders").select("order_id").eq("wave_id", waveId);
  for (const l of links ?? []) {
    await client.from("sales_orders").update({ status: "Packed" }).eq("id", l.order_id).eq("status", "Released");
    await client.from("sales_orders").update({ status: "Packed" }).eq("id", l.order_id).eq("status", "Picking");
  }
  await logActivity("System", "completed picking for", waveId, "pick");
  return waveId;
}

/* --------------------------------- packing -------------------------------- */

export async function upsertPacking(input: PackingInput) {
  const client = db();
  const row = {
    order_id: input.order,
    wave_id: input.wave || null,
    package_type: input.packageType,
    carton: input.carton,
    weight_kg: input.weightKg,
    dimensions: input.dimensions,
    material: input.material,
    label_number: input.labelNumber,
    station: input.station,
    operator: input.operator,
    status: input.status,
  };
  if (input.id) {
    const { error } = await client.from("packing_records").update(row).eq("id", input.id);
    if (error) fail(error);
    await logActivity(input.operator || "System", "updated packing record", input.id, "pack");
    return input.id;
  }
  const id = await rpc<string>("next_code", { p_table: "packing_records", p_column: "id", p_prefix: "PK-", p_pad: 4 });
  const { error } = await client.from("packing_records").insert({ id, ...row, label_number: row.label_number || `LB-${id}` });
  if (error) fail(error);
  if (input.status === "Completed") {
    await client.from("sales_orders").update({ status: "Packed" }).eq("id", input.order).in("status", ["Picking", "Released"]);
  }
  await logActivity(input.operator || "System", "created packing record", id, "pack");
  return id;
}

export async function deletePacking(id: string) {
  const { error } = await db().from("packing_records").delete().eq("id", id);
  if (error) fail(error);
  await logActivity("System", "deleted packing record", id, "pack");
  return id;
}

/* -------------------------------- shipments ------------------------------- */

export const createShipment = (input: ShipmentInput) => rpc<string>("create_shipment", { p: input });
export const updateShipment = (id: string, input: Record<string, unknown>) =>
  rpc<string>("update_shipment", { p_id: id, p: input });
export const verifyLoad = (id: string, checklist: string[], actor: string) =>
  rpc<boolean>("verify_load", { p_id: id, p_checklist: checklist, p_actor: actor });
export const authorizeDispatch = (id: string, approve: boolean, role: string, actor: string) =>
  rpc<string>("authorize_dispatch", { p_id: id, p_approve: approve, p_role: role, p_actor: actor });

export async function deleteShipment(id: string) {
  const client = db();
  await client.from("shipment_orders").delete().eq("shipment_id", id);
  const { error } = await client.from("shipments").delete().eq("id", id);
  if (error) fail(error);
  await logActivity("System", "deleted shipment", id, "ship");
  return id;
}

/* ------------------------------- backorders ------------------------------- */

export const resolveBackorder = (id: string, action: "fulfil" | "allocate" | "close") =>
  rpc<{ allocated?: number; status?: string }>("resolve_backorder", { p_id: id, p_action: action });

export async function upsertBackorder(input: BackorderInput) {
  const client = db();
  const row = {
    order_id: input.order,
    customer: input.customer,
    sku: input.sku,
    product: input.product,
    missing_qty: input.missingQty,
    available_qty: input.availableQty,
    suggested: input.suggested,
    reason: input.reason,
    expected_date: input.expectedDate,
    priority: input.priority,
    status: input.status,
  };
  if (input.id) {
    const { error } = await client.from("backorders").update(row).eq("id", input.id);
    if (error) fail(error);
    return input.id;
  }
  const id = await rpc<string>("next_code", { p_table: "backorders", p_column: "id", p_prefix: "BO-", p_pad: 4 });
  const { error } = await client.from("backorders").insert({ id, ...row });
  if (error) fail(error);
  await logActivity("System", "created backorder", id, "alert");
  return id;
}

/* ----------------------------- notifications ------------------------------ */

export async function markNotificationsRead() {
  const { error } = await db().from("notifications").update({ read: true }).eq("read", false);
  if (error) fail(error);
  return true;
}

/* -------------------------------- settings -------------------------------- */

export async function getSettings(): Promise<Record<string, string | number | boolean | null>> {
  const { data, error } = await db().from("app_settings").select("*");
  if (error) fail(error);
  return Object.fromEntries(
    (data ?? []).map((r) => [r.key, r.value as string | number | boolean | null]),
  );
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value: value as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) fail(error);
  return true;
}
