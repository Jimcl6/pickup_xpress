export type AdminSession = {
  user: { id: string; name: string; email: string; role: string };
  merchant: { id: string; name: string; slug: string };
};

export type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "instructions_sent" | "reference_submitted" | "confirmed";

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "gcash" | "bank_transfer" | "cash_on_pickup";
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  totalCents: number;
  customerNote: string | null;
  createdAt: string;
  completedAt: string | null;
  customer: { name: string; phone: string; email: string | null };
  pickupSlot: { id: string; label: string; startTime: string; endTime: string } | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    totalCostCents: number | null;
  }>;
  statusEvents: Array<{ status: OrderStatus; note: string | null; createdAt: string }>;
};

export type AdminDashboard = {
  today: { salesCents: number; orderCount: number };
  week: { salesCents: number; costCents: number; grossProfitCents: number };
  statusCounts: Partial<Record<OrderStatus, number>>;
  bestSellers: Array<{ productId: string; productName: string; quantity: number; salesCents: number }>;
  salesByDay: Array<{ date: string; salesCents: number; orderCount: number }>;
  lowStock: InventoryItem[];
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalCents: number;
    createdAt: string;
    customer: { name: string };
    pickupSlot: { label: string } | null;
  }>;
};

export type RecipeRequirement = {
  id: string;
  inventoryItemId: string;
  quantity: number | string;
  inventoryItem: { id: string; name: string; unit: string; unitCostCents: number | string };
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  isActive: boolean;
  inventoryRequirements: RecipeRequirement[];
};

export type CatalogCategory = {
  id: string;
  name: string;
  sortOrder: number;
  products: CatalogProduct[];
};

export type InventoryMovement = {
  id: string;
  type: "purchase" | "adjustment" | "sale" | "reversal";
  quantityChange: number | string;
  unitCostCents: number | string | null;
  note: string | null;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCostCents: number;
  isActive: boolean;
  lowStock: boolean;
  movements?: InventoryMovement[];
  _count?: { requirements: number };
};

export type AdminPickupSlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
  _count: { orders: number };
};
