"use client";

import { create } from "zustand";
import type { Org, User } from "@/lib/types";
import { api } from "@/lib/api";

export type ViewKey =
  | "dashboard"
  | "prospects"
  | "clients"
  | "client-detail"
  | "proposals"
  | "proposal-detail"
  | "quotes"
  | "contracts"
  | "contract-detail"
  | "projects"
  | "project-detail"
  | "invoices"
  | "invoice-detail"
  | "payments"
  | "documents"
  | "reports"
  | "audit"
  | "templates"
  | "notifications"
  | "settings"
  | "onboarding";

export type PortalKind = "proposal" | "contract" | "invoice" | "quote" | "client";

type State = {
  // auth
  user: User | null;
  org: Org | null;
  authLoaded: boolean;
  // navigation
  view: ViewKey;
  params: Record<string, string>;
  // mobile sidebar
  sidebarOpen: boolean;
  // public portal
  portal: { kind: PortalKind; token: string } | null;
  // tick used to refetch queries after mutations
  tick: number;
};

type Actions = {
  setAuth: (user: User | null, org: Org | null) => void;
  clearAuth: () => void;
  refreshAuth: () => Promise<void>;
  navigate: (view: ViewKey, params?: Record<string, string>) => void;
  setSidebarOpen: (open: boolean) => void;
  setPortal: (p: State["portal"]) => void;
  bump: () => void;
  logout: () => Promise<void>;
};

const PORTAL_KINDS: PortalKind[] = ["proposal", "contract", "invoice", "quote", "client"];

function readPortalFromUrl(): State["portal"] {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const kind = url.searchParams.get("portal") as PortalKind | null;
  const token = url.searchParams.get("token");
  if (kind && token && (PORTAL_KINDS as string[]).includes(kind)) {
    return { kind, token };
  }
  return null;
}

export const useStore = create<State & Actions>((set, get) => ({
  user: null,
  org: null,
  authLoaded: false,
  view: "dashboard",
  params: {},
  sidebarOpen: false,
  portal: null,
  tick: 0,

  setAuth: (user, org) => set({ user, org, authLoaded: true }),
  clearAuth: () => set({ user: null, org: null, authLoaded: true }),

  refreshAuth: async () => {
    try {
      const res = await api.get<{ user: User; organization: Org }>("/api/auth/me");
      set({ user: res.user, org: res.organization, authLoaded: true, portal: get().portal || readPortalFromUrl() });
    } catch {
      set({ user: null, org: null, authLoaded: true, portal: readPortalFromUrl() });
    }
  },

  navigate: (view, params = {}) => {
    set({ view, params, sidebarOpen: false });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setPortal: (p) => set({ portal: p }),
  bump: () => set((s) => ({ tick: s.tick + 1 })),

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {}
    set({ user: null, org: null, view: "dashboard", params: {} });
  },
}));
