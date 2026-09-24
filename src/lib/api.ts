// API client — thin wrapper around fetch for the SPA frontend.
// Uses relative paths only (so it works behind the gateway).

import type { DashboardData, ReportData } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) ||
      (data && typeof data === "object" && "message" in data && String((data as { message: unknown }).message)) ||
      res.statusText ||
      "Erreur";
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: "GET" }),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// Convenience namespaces
export const dashboardApi = {
  get: () => api.get<DashboardData>("/api/dashboard"),
};

export const reportsApi = {
  get: (range: string) => api.get<ReportData>(`/api/reports?range=${range}`),
};
