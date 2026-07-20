import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid mobile number.")
  .max(24, "Enter a valid mobile number.")
  .refine((value) => /^\+?[0-9 ()-]+$/.test(value), "Enter a valid mobile number.");

export const createOrderSchema = z
  .object({
    merchantSlug: z.string().trim().min(1),
    pickupSlotId: z.string().trim().min(1, "Choose a pickup time."),
    customer: z.object({
      name: z.string().trim().min(2, "Enter your name.").max(80),
      phone: phoneSchema,
      email: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).optional()
    }),
    paymentMethod: z.enum(["gcash", "bank_transfer", "cash_on_pickup"]),
    paymentReference: z.string().trim().max(80).optional(),
    customerNote: z.string().trim().max(240).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1),
          quantity: z.number().int().min(1).max(20)
        })
      )
      .min(1, "Add at least one item.")
      .max(30)
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.paymentMethod !== "cash_on_pickup" &&
      !value.paymentReference?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["paymentReference"],
        message: "Enter the payment reference number."
      });
    }

    const productIds = value.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Each product may only appear once."
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("63") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function createOrderNumber(now = new Date(), randomValue = Math.floor(Math.random() * 10_000)) {
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `PX-${datePart}-${randomValue.toString().padStart(4, "0")}`;
}
