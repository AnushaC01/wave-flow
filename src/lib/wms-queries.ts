/**
 * Client-side query/mutation helpers around the WMS server functions.
 */
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  fetchActivity,
  fetchBackorders,
  fetchDashboard,
  fetchInventory,
  fetchNotifications,
  fetchOrders,
  fetchPacking,
  fetchPickLines,
  fetchPickableOrders,
  fetchReference,
  fetchSettings,
  fetchShipments,
  fetchWaves,
} from "./wms.functions";
import type { ListParams } from "./wms-types";

export const ALL = { pageSize: 200 } satisfies ListParams;

export const ordersQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["orders", p], queryFn: () => fetchOrders({ data: p }) });
export const inventoryQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["inventory", p], queryFn: () => fetchInventory({ data: p }) });
export const wavesQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["waves", p], queryFn: () => fetchWaves({ data: p }) });
export const pickLinesQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["pickLines", p], queryFn: () => fetchPickLines({ data: p }) });
export const packingQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["packing", p], queryFn: () => fetchPacking({ data: p }) });
export const shipmentsQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["shipments", p], queryFn: () => fetchShipments({ data: p }) });
export const backordersQuery = (p: ListParams = ALL) =>
  queryOptions({ queryKey: ["backorders", p], queryFn: () => fetchBackorders({ data: p }) });

export const pickableOrdersQuery = () =>
  queryOptions({ queryKey: ["pickableOrders"], queryFn: () => fetchPickableOrders() });

export const referenceQuery = () =>
  queryOptions({ queryKey: ["reference"], queryFn: () => fetchReference(), staleTime: 5 * 60_000 });
export const dashboardQuery = () => queryOptions({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
export const activityQuery = () => queryOptions({ queryKey: ["activity"], queryFn: () => fetchActivity() });
export const notificationsQuery = () => queryOptions({ queryKey: ["notifications"], queryFn: () => fetchNotifications() });
export const settingsQuery = () => queryOptions({ queryKey: ["settings"], queryFn: () => fetchSettings() });

/** Keys refreshed after any workflow mutation — every step feeds the next one. */
export const WORKFLOW_KEYS = [
  "orders",
  "inventory",
  "waves",
  "pickLines",
  "packing",
  "shipments",
  "backorders",
  "pickableOrders",
  "dashboard",
  "activity",
  "notifications",
] as const;

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * Wraps a server function in a mutation that refreshes the whole workflow
 * cache and reports success/failure through the existing toast UI.
 */
export function useWmsMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  options: { success?: (result: TResult, args: TArgs) => { title: string; description?: string } } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      for (const key of WORKFLOW_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
      const msg = options.success?.(result, args);
      if (msg) toast.success(msg.title, msg.description ? { description: msg.description } : undefined);
    },
    onError: (error) => toast.error("Action failed", { description: errorMessage(error) }),
  });
}
