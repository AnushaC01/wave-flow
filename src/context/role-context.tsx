import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ROLES, type Role } from "@/data/mock-data";

/**
 * Role context for role-based screen/action visibility.
 * TODO(integration): replace the in-memory role switcher with the enterprise
 * authentication / identity provider (SSO) session claims.
 */

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  can: (action: string) => boolean;
  allowedNav: (key: string) => boolean;
}

const NAV_BY_ROLE: Record<Role, string[] | "*"> = {
  Administrator: "*",
  "Warehouse Manager": "*",
  "Warehouse Executive": [
    "dashboard",
    "sales-orders",
    "allocation",
    "wave-planning",
    "wave-release",
    "pick-lists",
    "backorders",
    "reports",
    "settings",
  ],
  Picker: ["dashboard", "pick-lists", "picking", "settings"],
  "Packing Operator": ["dashboard", "packing", "shipping-labels", "staging", "settings"],
  "Loading Supervisor": ["dashboard", "staging", "loading", "load-verification", "settings"],
  Dispatcher: ["dashboard", "loading", "load-verification", "dispatch", "shipping", "reports", "settings"],
};

const ACTIONS_BY_ROLE: Record<Role, string[] | "*"> = {
  Administrator: "*",
  "Warehouse Manager": "*",
  "Warehouse Executive": ["order.create", "order.validate", "inventory.reserve", "wave.create", "wave.release", "picklist.generate"],
  Picker: ["pick.execute"],
  "Packing Operator": ["pack.execute", "label.print"],
  "Loading Supervisor": ["load.execute", "load.verify"],
  Dispatcher: ["load.verify", "shipment.track"],
};

const Ctx = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Administrator");

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      can: (action) => {
        const list = ACTIONS_BY_ROLE[role];
        return list === "*" || list.includes(action);
      },
      allowedNav: (key) => {
        const list = NAV_BY_ROLE[role];
        return list === "*" || list.includes(key);
      },
    }),
    [role],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}

export { ROLES };
export type { Role };
