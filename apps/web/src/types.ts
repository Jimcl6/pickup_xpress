export type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
};

export type MenuCategory = {
  id: string;
  name: string;
  products: Product[];
};

export type PickupSlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remainingCapacity: number;
};

export type MerchantMenu = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  pickupInstructions: string | null;
  gcashAccountName: string | null;
  gcashNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  categories: MenuCategory[];
  pickupSlots: PickupSlot[];
};

export type OrderResponse = {
  id: string;
  orderNumber: string;
  status: "pending" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: "gcash" | "bank_transfer" | "cash_on_pickup";
  paymentStatus: "unpaid" | "instructions_sent" | "reference_submitted" | "confirmed";
  subtotalCents: number;
  totalCents: number;
  customerNote: string | null;
  createdAt: string;
  merchant: { name: string; slug: string; pickupInstructions: string | null };
  customer: { name: string; phone: string; email: string | null };
  pickupSlot: Pick<PickupSlot, "id" | "label" | "startTime" | "endTime"> | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  statusEvents: Array<{ status: OrderResponse["status"]; note: string | null; createdAt: string }>;
};
