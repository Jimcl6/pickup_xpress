import { z } from "zod";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().transform((value) => value || null);

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(200)
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0)
});

export const productSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: optionalText(300),
  priceCents: z.coerce.number().int().min(0).max(100_000_000),
  imageUrl: optionalText(500),
  isActive: z.boolean().default(true)
});

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(24),
  quantityOnHand: z.coerce.number().min(0).max(1_000_000_000).default(0),
  reorderLevel: z.coerce.number().min(0).max(1_000_000_000).default(0),
  unitCostCents: z.coerce.number().min(0).max(100_000_000).default(0),
  isActive: z.boolean().default(true)
});

export const inventoryAdjustmentSchema = z.object({
  quantityChange: z.coerce.number().min(-1_000_000_000).max(1_000_000_000).refine((value) => value !== 0),
  unitCostCents: z.coerce.number().min(0).max(100_000_000).optional(),
  type: z.enum(["purchase", "adjustment"]).default("adjustment"),
  note: optionalText(240)
}).superRefine((value, context) => {
  if (value.type === "purchase" && (value.quantityChange <= 0 || value.unitCostCents === undefined)) {
    context.addIssue({ code: "custom", path: ["unitCostCents"], message: "Purchases require a positive quantity and unit cost." });
  }
});

export const recipeSchema = z.object({
  items: z.array(z.object({
    inventoryItemId: z.string().min(1),
    quantity: z.coerce.number().positive().max(1_000_000)
  })).max(100).refine(
    (items) => new Set(items.map((item) => item.inventoryItemId)).size === items.length,
    { message: "Each inventory item can appear only once." }
  )
});

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "accepted", "preparing", "ready", "completed", "cancelled"]),
  note: optionalText(240)
});

export const paymentStatusSchema = z.object({
  status: z.enum(["unpaid", "reference_submitted", "confirmed"])
});

export const pickupSlotSchema = z.object({
  label: z.string().trim().min(1).max(40),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  capacity: z.coerce.number().int().min(1).max(500),
  isActive: z.boolean().default(true)
}).refine((value) => new Date(value.endTime) > new Date(value.startTime), {
  path: ["endTime"],
  message: "End time must be after start time."
});
