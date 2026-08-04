/**
 * Client-callable server functions (thin wrappers only — no helpers here).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getDashboard,
  getReference,
  listActivity,
  listBackorders,
  listInventory,
  listNotifications,
  listOrders,
  listPacking,
  listPickLines,
  listShipments,
  listWaves,
} from "./wms.server";
import {
  allocateOrder,
  authorizeDispatch,
  completeWavePicking,
  confirmPick,
  confirmWaveReservation,
  createOrder,
  createShipment,
  createWave,
  deleteOrder,
  deletePacking,
  deleteShipment,
  deleteWave,
  generatePickLists,
  getSettings,
  inventoryAction,
  markNotificationsRead,
  releaseWave,
  reserveOrder,
  resolveBackorder,
  setOrderStatus,
  setSetting,
  setShipmentStatus,
  updateOrder,
  updatePickLine,
  updateShipment,
  updateWave,
  upsertBackorder,
  upsertPacking,
  validateOrder,
  verifyLoad,
} from "./wms-mutations.server";
import {
  backorderInput,
  listParamsSchema,
  packingInput,
  pickLineInput,
  salesOrderInput,
  shipmentInput,
  waveInput,
} from "./wms-types";

const list = listParamsSchema.default({});
const idOnly = z.object({ id: z.string().trim().min(1).max(40) });

/* ---------------------------------- reads --------------------------------- */

export const fetchOrders = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listOrders(data));

export const fetchInventory = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listInventory(data));

export const fetchWaves = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listWaves(data));

export const fetchPickLines = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listPickLines(data));

export const fetchPacking = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listPacking(data));

export const fetchShipments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listShipments(data));

export const fetchBackorders = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => list.parse(d))
  .handler(({ data }) => listBackorders(data));

export const fetchReference = createServerFn({ method: "GET" }).handler(() => getReference());
export const fetchDashboard = createServerFn({ method: "GET" }).handler(() => getDashboard());
export const fetchActivity = createServerFn({ method: "GET" }).handler(() => listActivity(12));
export const fetchNotifications = createServerFn({ method: "GET" }).handler(() => listNotifications(20));
export const fetchSettings = createServerFn({ method: "GET" }).handler(() => getSettings());

/* --------------------------------- orders --------------------------------- */

export const createOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => salesOrderInput.parse(d))
  .handler(({ data }) => createOrder(data));

export const updateOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), data: salesOrderInput.partial() }).parse(d))
  .handler(({ data }) => updateOrder(data.id, data.data as Record<string, unknown>));

export const deleteOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => deleteOrder(data.id));

export const validateOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => validateOrder(data.id));

export const allocateOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => allocateOrder(data.id));

export const reserveOrderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => reserveOrder(data.id));

export const setOrderStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), status: z.string().min(1).max(40) }).parse(d))
  .handler(({ data }) => setOrderStatus(data.id, data.status));

/* ------------------------------- inventory -------------------------------- */

export const inventoryActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(z.string().min(1)).min(1, "Select at least one inventory record"),
        kind: z.enum(["reserve", "release", "reallocate"]),
        qty: z.number().int().min(1).max(100_000).default(10),
      })
      .parse(d),
  )
  .handler(({ data }) => inventoryAction(data.ids, data.kind, data.qty));

/* ---------------------------------- waves --------------------------------- */

export const createWaveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => waveInput.parse(d))
  .handler(({ data }) => createWave(data));

export const updateWaveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), data: waveInput.partial() }).parse(d))
  .handler(({ data }) => updateWave(data.id, data.data as Record<string, unknown>));

export const deleteWaveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => deleteWave(data.id));

export const releaseWaveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => releaseWave(data.id));

export const confirmWaveReservationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => confirmWaveReservation(data.id));

export const generatePickListsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ wave: z.string().min(1).max(40) }).parse(d))
  .handler(({ data }) => generatePickLists(data.wave));

/* ---------------------------------- picks --------------------------------- */

export const confirmPickFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        barcode: z.string().trim().min(1, "Barcode is required").max(60),
        qty: z.number().int().min(0).max(1_000_000),
        picker: z.string().trim().max(80).default(""),
      })
      .parse(d),
  )
  .handler(({ data }) => confirmPick(data.id, data.barcode, data.qty, data.picker));

export const updatePickLineFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        data: z.object({
          picker: z.string().trim().max(80).optional(),
          status: pickLineInput.shape.status.optional(),
          pickedQty: z.number().int().min(0).max(1_000_000).optional(),
          verified: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(({ data }) => updatePickLine(data.id, data.data));

export const completeWavePickingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ wave: z.string().min(1).max(40) }).parse(d))
  .handler(({ data }) => completeWavePicking(data.wave));

/* --------------------------------- packing -------------------------------- */

export const savePackingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => packingInput.parse(d))
  .handler(({ data }) => upsertPacking(data));

export const deletePackingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => deletePacking(data.id));

/* -------------------------------- shipments ------------------------------- */

export const createShipmentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => shipmentInput.parse(d))
  .handler(({ data }) => createShipment(data));

export const updateShipmentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), data: shipmentInput.partial() }).parse(d))
  .handler(({ data }) => updateShipment(data.id, data.data as Record<string, unknown>));

export const deleteShipmentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(({ data }) => deleteShipment(data.id));

export const verifyLoadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), checklist: z.array(z.string().min(1)), actor: z.string().max(80).default("System") }).parse(d),
  )
  .handler(({ data }) => verifyLoad(data.id, data.checklist, data.actor));

export const authorizeDispatchFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        approve: z.boolean(),
        role: z.string().max(60).default(""),
        actor: z.string().max(80).default("System"),
      })
      .parse(d),
  )
  .handler(({ data }) => authorizeDispatch(data.id, data.approve, data.role, data.actor));

export const setShipmentStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        status: z.enum(["Staged", "Loading", "Ready for Shipment", "In Transit", "Delivered"]),
        actor: z.string().max(80).default("System"),
      })
      .parse(d),
  )
  .handler(({ data }) => setShipmentStatus(data.id, data.status, data.actor));

/* ------------------------------- backorders ------------------------------- */

export const resolveBackorderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1), action: z.enum(["fulfil", "allocate", "close"]) }).parse(d))
  .handler(({ data }) => resolveBackorder(data.id, data.action));

export const saveBackorderFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => backorderInput.parse(d))
  .handler(({ data }) => upsertBackorder(data));

/* --------------------------- notifications/config -------------------------- */

export const markNotificationsReadFn = createServerFn({ method: "POST" }).handler(() => markNotificationsRead());

export const setSettingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1).max(80), value: z.unknown() }).parse(d))
  .handler(({ data }) => setSetting(data.key, data.value));
