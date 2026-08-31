import type { MerchantMenu, OrderResponse } from "./types";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? "The service is temporarily unavailable.");
  }
  return body as T;
}

export async function getMenu(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/api/menu`, { signal });
  return readJson<MerchantMenu>(response);
}

export type CreateOrderPayload = {
  merchantSlug: string;
  pickupSlotId: string;
  customer: { name: string; phone: string; email?: string };
  paymentMethod: "gcash" | "bank_transfer" | "cash_on_pickup";
  paymentReference?: string;
  customerNote?: string;
  items: Array<{ productId: string; quantity: number }>;
};

export async function createOrder(payload: CreateOrderPayload) {
  const response = await fetch(`${apiBaseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJson<OrderResponse>(response);
}
