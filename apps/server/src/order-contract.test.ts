import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createOrderNumber,
  createOrderSchema,
  normalizePhone
} from "./order-contract.js";

const validOrder = {
  merchantSlug: "cafe-stellaire",
  pickupSlotId: "slot-1",
  customer: {
    name: "Ana Santos",
    phone: "0917 123 4567",
    email: "ana@example.com"
  },
  paymentMethod: "gcash" as const,
  paymentReference: "GC-123456",
  customerNote: "Less ice, please.",
  items: [{ productId: "iced-latte", quantity: 2 }]
};

describe("createOrderSchema", () => {
  it("accepts a complete customer order", () => {
    assert.equal(createOrderSchema.safeParse(validOrder).success, true);
  });

  it("requires a reference for prepaid methods", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, paymentReference: "" });
    assert.equal(result.success, false);
  });

  it("allows cash on pickup without a reference", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      paymentMethod: "cash_on_pickup",
      paymentReference: ""
    });
    assert.equal(result.success, true);
  });

  it("rejects duplicate product lines", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [validOrder.items[0], validOrder.items[0]]
    });
    assert.equal(result.success, false);
  });
});

describe("order helpers", () => {
  it("normalizes Philippine mobile numbers", () => {
    assert.equal(normalizePhone("0917-123-4567"), "+639171234567");
    assert.equal(normalizePhone("+63 917 123 4567"), "+639171234567");
  });

  it("builds a readable order number", () => {
    assert.equal(createOrderNumber(new Date("2026-07-19T04:00:00.000Z"), 42), "PX-20260719-0042");
  });
});
