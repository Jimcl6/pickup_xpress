import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";

let server: Server;
let baseUrl: string;
let createdOrderData: Record<string, unknown> | undefined;

const transaction = {
  merchant: {
    findUnique: async () => ({ id: "merchant-1" })
  },
  pickupSlot: {
    findFirst: async () => ({ id: "slot-1", capacity: 8, orders: [] })
  },
  product: {
    findMany: async () => [{ id: "product-1", name: "Iced Latte", priceCents: 12000 }]
  },
  customer: {
    create: async () => ({ id: "customer-1" })
  },
  order: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createdOrderData = data;
      return {
        id: "order-1",
        orderNumber: data.orderNumber,
        status: "pending",
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentStatus,
        subtotalCents: data.subtotalCents,
        totalCents: data.totalCents,
        createdAt: new Date().toISOString(),
        customer: { name: "Ana Santos", phone: "+639171234567", email: null },
        merchant: { name: "Cafe Stellaire", slug: "cafe-stellaire", pickupInstructions: "Express counter" },
        pickupSlot: { id: "slot-1", label: "11:00 AM", startTime: new Date().toISOString(), endTime: new Date().toISOString() },
        items: [{ productId: "product-1", productName: "Iced Latte", quantity: 2, unitPriceCents: 12000, lineTotalCents: 24000 }],
        statusEvents: [{ status: "pending", note: "Order received", createdAt: new Date().toISOString() }]
      };
    }
  }
};

const fakeDatabase = {
  $transaction: async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction)
} as unknown as PrismaClient;

before(async () => {
  server = await new Promise<Server>((resolve) => {
    const listener = createApp(fakeDatabase).listen(0, () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("order API contract", () => {
  it("returns field issues for an invalid order", async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] })
    });
    const body = (await response.json()) as { message: string; issues: unknown[] };

    assert.equal(response.status, 400);
    assert.equal(body.message, "Please check your order details.");
    assert.ok(body.issues.length > 0);
  });

  it("requires a mobile number when retrieving an order", async () => {
    const response = await fetch(`${baseUrl}/api/orders/PX-20260719-0001`);
    const body = (await response.json()) as { message: string };

    assert.equal(response.status, 400);
    assert.equal(body.message, "A mobile number is required to view this order.");
  });

  it("creates a valid order using prices from the product record", async () => {
    createdOrderData = undefined;
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantSlug: "cafe-stellaire",
        pickupSlotId: "slot-1",
        customer: { name: "Ana Santos", phone: "0917 123 4567" },
        paymentMethod: "cash_on_pickup",
        items: [{ productId: "product-1", quantity: 2 }]
      })
    });
    const body = (await response.json()) as { totalCents: number; orderNumber: string };

    assert.equal(response.status, 201);
    assert.equal(body.totalCents, 24000);
    assert.match(body.orderNumber, /^PX-\d{8}-\d{4}$/);
    const savedOrder = createdOrderData as Record<string, unknown> | undefined;
    assert.ok(savedOrder);
    assert.equal(savedOrder.subtotalCents, 24000);
    assert.equal(savedOrder.paymentStatus, "unpaid");
  });
});
