import { apiBaseUrl } from "./api";
import type {
  AdminDashboard,
  AdminOrder,
  AdminPickupSlot,
  AdminSession,
  CatalogCategory,
  InventoryItem,
  OrderStatus,
  PaymentStatus
} from "./admin-types";

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}/api/admin${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "The request could not be completed.");
  return body as T;
}

const body = (value: unknown) => JSON.stringify(value);

export const adminApi = {
  me: () => request<AdminSession>("/me"),
  login: (email: string, password: string) => request<AdminSession>("/login", { method: "POST", body: body({ email, password }) }),
  logout: () => request<void>("/logout", { method: "POST" }),
  dashboard: () => request<AdminDashboard>("/dashboard"),
  orders: (status?: OrderStatus) => request<AdminOrder[]>(`/orders${status ? `?status=${status}` : ""}`),
  updateOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    request<AdminOrder>(`/orders/${id}/status`, { method: "PATCH", body: body({ status, note }) }),
  updatePayment: (id: string, status: PaymentStatus) =>
    request<AdminOrder>(`/orders/${id}/payment`, { method: "PATCH", body: body({ status }) }),
  catalog: () => request<CatalogCategory[]>("/catalog"),
  createCategory: (data: { name: string; sortOrder: number }) => request("/categories", { method: "POST", body: body(data) }),
  updateCategory: (id: string, data: { name: string; sortOrder: number }) => request(`/categories/${id}`, { method: "PATCH", body: body(data) }),
  deleteCategory: (id: string) => request<void>(`/categories/${id}`, { method: "DELETE" }),
  createProduct: (data: ProductInput) => request("/products", { method: "POST", body: body(data) }),
  updateProduct: (id: string, data: ProductInput) => request(`/products/${id}`, { method: "PATCH", body: body(data) }),
  saveRecipe: (id: string, items: Array<{ inventoryItemId: string; quantity: number }>) =>
    request(`/products/${id}/recipe`, { method: "PUT", body: body({ items }) }),
  inventory: () => request<InventoryItem[]>("/inventory"),
  createInventory: (data: InventoryInput) => request("/inventory", { method: "POST", body: body(data) }),
  updateInventory: (id: string, data: Omit<InventoryInput, "quantityOnHand">) =>
    request(`/inventory/${id}`, { method: "PATCH", body: body(data) }),
  adjustInventory: (id: string, data: { quantityChange: number; unitCostCents?: number; type: "purchase" | "adjustment"; note?: string }) =>
    request(`/inventory/${id}/adjustments`, { method: "POST", body: body(data) }),
  pickupSlots: () => request<AdminPickupSlot[]>("/pickup-slots"),
  createPickupSlot: (data: PickupSlotInput) => request("/pickup-slots", { method: "POST", body: body(data) }),
  updatePickupSlot: (id: string, data: PickupSlotInput) => request(`/pickup-slots/${id}`, { method: "PATCH", body: body(data) }),
  deletePickupSlot: (id: string) => request<void>(`/pickup-slots/${id}`, { method: "DELETE" })
};

export type ProductInput = {
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isActive: boolean;
};

export type InventoryInput = {
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCostCents: number;
  isActive: boolean;
};

export type PickupSlotInput = {
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
};
