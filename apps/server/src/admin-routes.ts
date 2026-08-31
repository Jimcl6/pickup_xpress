import { Prisma, type OrderStatus, type PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  categorySchema,
  inventoryAdjustmentSchema,
  inventoryItemSchema,
  loginSchema,
  orderStatusSchema,
  paymentStatusSchema,
  pickupSlotSchema,
  productSchema,
  recipeSchema
} from "./admin-contract.js";
import {
  clearAdminCookie,
  createAdminSession,
  deleteAdminSession,
  requireAdmin,
  setAdminCookie,
  verifyPassword
} from "./admin-auth.js";
import { HttpError } from "./http-error.js";
import { canTransitionOrder, recipeCostCents, weightedUnitCost } from "./admin-operations.js";

const adminOrderInclude = {
  customer: { select: { name: true, phone: true, email: true } },
  pickupSlot: { select: { id: true, label: true, startTime: true, endTime: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
      lineTotalCents: true,
      totalCostCents: true
    }
  },
  statusEvents: {
    select: { status: true, note: true, createdAt: true },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.OrderInclude;

function startOfManilaDay(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  ) - 8 * 60 * 60 * 1000);
}

function serializeInventoryItem<T extends { quantityOnHand: Prisma.Decimal; reorderLevel: Prisma.Decimal; unitCostCents: Prisma.Decimal }>(item: T) {
  return {
    ...item,
    quantityOnHand: item.quantityOnHand.toNumber(),
    reorderLevel: item.reorderLevel.toNumber(),
    unitCostCents: item.unitCostCents.toNumber(),
    lowStock: item.quantityOnHand.lessThanOrEqualTo(item.reorderLevel)
  };
}

export function createAdminRouter(database: PrismaClient) {
  const router = Router();
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  router.post("/login", async (request, response) => {
    const attemptKey = request.ip || "unknown";
    const existingAttempt = loginAttempts.get(attemptKey);
    if (existingAttempt && existingAttempt.resetAt > Date.now() && existingAttempt.count >= 10) {
      throw new HttpError(429, "Too many sign-in attempts. Please try again in 15 minutes.");
    }
    if (existingAttempt && existingAttempt.resetAt <= Date.now()) loginAttempts.delete(attemptKey);
    const input = loginSchema.parse(request.body);
    const user = await database.merchantUser.findUnique({
      where: { email: input.email },
      include: { merchant: { select: { id: true, name: true, slug: true } } }
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      const currentAttempt = loginAttempts.get(attemptKey);
      loginAttempts.set(attemptKey, {
        count: (currentAttempt?.count ?? 0) + 1,
        resetAt: currentAttempt?.resetAt ?? Date.now() + 15 * 60 * 1000
      });
      throw new HttpError(401, "The email or password is incorrect.");
    }

    loginAttempts.delete(attemptKey);
    await database.merchantSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { userId: user.id }] }
    });
    const session = await createAdminSession(database, user);
    setAdminCookie(response, session.token, session.expiresAt);
    response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      merchant: user.merchant
    });
  });

  router.post("/logout", async (request, response) => {
    await deleteAdminSession(database, request);
    clearAdminCookie(response);
    response.status(204).end();
  });

  router.get("/me", async (request, response) => {
    response.json(await requireAdmin(database, request));
  });

  router.get("/dashboard", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const today = startOfManilaDay();
    const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    const merchantId = admin.merchant.id;

    const [todayTotals, weekOrders, statusCounts, bestSellers, recentOrders, inventoryItems] = await Promise.all([
      database.order.aggregate({
        where: { merchantId, status: "completed", completedAt: { gte: today } },
        _sum: { totalCents: true },
        _count: { id: true }
      }),
      database.order.findMany({
        where: { merchantId, status: "completed", completedAt: { gte: weekStart } },
        select: { totalCents: true, completedAt: true, items: { select: { totalCostCents: true } } }
      }),
      database.order.groupBy({
        by: ["status"],
        where: { merchantId },
        _count: { id: true }
      }),
      database.orderItem.groupBy({
        by: ["productId", "productName"],
        where: { order: { merchantId, status: "completed" } },
        _sum: { quantity: true, lineTotalCents: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5
      }),
      database.order.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          createdAt: true,
          customer: { select: { name: true } },
          pickupSlot: { select: { label: true } }
        }
      }),
      database.inventoryItem.findMany({ where: { merchantId, isActive: true } })
    ]);

    const salesByDay = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const orders = weekOrders.filter((order) => order.completedAt && order.completedAt >= day && order.completedAt < next);
      return {
        date: day.toISOString(),
        salesCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
        orderCount: orders.length
      };
    });
    const weekSalesCents = weekOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const weekCostCents = weekOrders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (item.totalCostCents ?? 0), 0),
      0
    );

    response.json({
      today: { salesCents: todayTotals._sum.totalCents ?? 0, orderCount: todayTotals._count.id },
      week: { salesCents: weekSalesCents, costCents: weekCostCents, grossProfitCents: weekSalesCents - weekCostCents },
      statusCounts: Object.fromEntries(statusCounts.map((item) => [item.status, item._count.id])),
      bestSellers: bestSellers.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item._sum.quantity ?? 0,
        salesCents: item._sum.lineTotalCents ?? 0
      })),
      salesByDay,
      lowStock: inventoryItems.filter((item) => item.quantityOnHand.lessThanOrEqualTo(item.reorderLevel)).map(serializeInventoryItem),
      recentOrders
    });
  });

  router.get("/orders", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const status = typeof request.query.status === "string" ? request.query.status : undefined;
    const allowed = ["pending", "accepted", "preparing", "ready", "completed", "cancelled"];
    if (status && !allowed.includes(status)) throw new HttpError(400, "Unknown order status.");

    const orders = await database.order.findMany({
      where: { merchantId: admin.merchant.id, ...(status ? { status: status as OrderStatus } : {}) },
      include: adminOrderInclude,
      orderBy: [{ pickupSlot: { startTime: "asc" } }, { createdAt: "desc" }],
      take: 100
    });
    response.json(orders);
  });

  router.patch("/orders/:id/status", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = orderStatusSchema.parse(request.body);
    const order = await database.$transaction(async (transaction) => {
      const current = await transaction.order.findFirst({
        where: { id: request.params.id, merchantId: admin.merchant.id },
        include: {
          items: {
            include: {
              product: {
                include: {
                  inventoryRequirements: { include: { inventoryItem: true } }
                }
              }
            }
          }
        }
      });
      if (!current) throw new HttpError(404, "Order not found.");
      if (input.status === current.status) {
        return transaction.order.findUniqueOrThrow({ where: { id: current.id }, include: adminOrderInclude });
      }
      if (!canTransitionOrder(current.status, input.status)) {
        throw new HttpError(409, `An order cannot move from ${current.status} to ${input.status}.`);
      }

      if (input.status === "completed" && current.paymentStatus !== "confirmed") {
        throw new HttpError(409, "Confirm payment before completing this pickup.");
      }

      if (input.status === "completed" && !current.inventoryDeductedAt) {
        for (const item of current.items) {
          for (const requirement of item.product.inventoryRequirements) {
            const deduction = requirement.quantity.mul(item.quantity);
            const changed = await transaction.inventoryItem.updateMany({
              where: {
                id: requirement.inventoryItemId,
                merchantId: admin.merchant.id,
                quantityOnHand: { gte: deduction }
              },
              data: { quantityOnHand: { decrement: deduction } }
            });
            if (changed.count !== 1) {
              throw new HttpError(409, `There is not enough ${requirement.inventoryItem.name} to complete this order.`);
            }
            await transaction.inventoryMovement.create({
              data: {
                merchantId: admin.merchant.id,
                inventoryItemId: requirement.inventoryItemId,
                orderId: current.id,
                createdById: admin.user.id,
                type: "sale",
                quantityChange: deduction.negated(),
                unitCostCents: requirement.inventoryItem.unitCostCents,
                note: `${current.orderNumber}: ${item.quantity} x ${item.productName}`
              }
            });
          }
          await transaction.orderItem.update({
            where: { id: item.id },
            data: {
              totalCostCents: recipeCostCents(
                item.product.inventoryRequirements.map((requirement) => ({
                  quantity: requirement.quantity,
                  unitCostCents: requirement.inventoryItem.unitCostCents
                })),
                item.quantity
              )
            }
          });
        }
      }

      await transaction.order.update({
        where: { id: current.id },
        data: {
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : current.completedAt,
          inventoryDeductedAt: input.status === "completed" ? new Date() : current.inventoryDeductedAt
        }
      });
      await transaction.orderStatusEvent.create({
        data: {
          orderId: current.id,
          status: input.status,
          note: input.note ?? `Order marked ${input.status} by ${admin.user.name}.`
        }
      });
      return transaction.order.findUniqueOrThrow({ where: { id: current.id }, include: adminOrderInclude });
    }, { isolationLevel: "Serializable" });

    response.json(order);
  });

  router.patch("/orders/:id/payment", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = paymentStatusSchema.parse(request.body);
    const result = await database.order.updateMany({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      data: { paymentStatus: input.status }
    });
    if (!result.count) throw new HttpError(404, "Order not found.");
    response.json(await database.order.findUniqueOrThrow({ where: { id: request.params.id }, include: adminOrderInclude }));
  });

  router.get("/catalog", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const categories = await database.productCategory.findMany({
      where: { merchantId: admin.merchant.id },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          orderBy: { name: "asc" },
          include: {
            inventoryRequirements: {
              include: { inventoryItem: { select: { id: true, name: true, unit: true, unitCostCents: true } } }
            }
          }
        }
      }
    });
    response.json(categories);
  });

  router.post("/categories", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = categorySchema.parse(request.body);
    const category = await database.productCategory.create({ data: { ...input, merchantId: admin.merchant.id } });
    response.status(201).json(category);
  });

  router.patch("/categories/:id", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = categorySchema.parse(request.body);
    const result = await database.productCategory.updateMany({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      data: input
    });
    if (!result.count) throw new HttpError(404, "Category not found.");
    response.json(await database.productCategory.findUniqueOrThrow({ where: { id: request.params.id } }));
  });

  router.delete("/categories/:id", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const category = await database.productCategory.findFirst({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      include: { _count: { select: { products: true } } }
    });
    if (!category) throw new HttpError(404, "Category not found.");
    if (category._count.products) throw new HttpError(409, "Move or remove this category's products first.");
    await database.productCategory.delete({ where: { id: category.id } });
    response.status(204).end();
  });

  router.post("/products", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = productSchema.parse(request.body);
    const category = await database.productCategory.findFirst({ where: { id: input.categoryId, merchantId: admin.merchant.id } });
    if (!category) throw new HttpError(400, "Choose a category from this store.");
    const product = await database.product.create({ data: { ...input, merchantId: admin.merchant.id } });
    response.status(201).json(product);
  });

  router.patch("/products/:id", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = productSchema.parse(request.body);
    const category = await database.productCategory.findFirst({ where: { id: input.categoryId, merchantId: admin.merchant.id } });
    if (!category) throw new HttpError(400, "Choose a category from this store.");
    const result = await database.product.updateMany({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      data: input
    });
    if (!result.count) throw new HttpError(404, "Product not found.");
    response.json(await database.product.findUniqueOrThrow({ where: { id: request.params.id } }));
  });

  router.put("/products/:id/recipe", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = recipeSchema.parse(request.body);
    const product = await database.product.findFirst({ where: { id: request.params.id, merchantId: admin.merchant.id } });
    if (!product) throw new HttpError(404, "Product not found.");
    const validItems = await database.inventoryItem.count({
      where: { id: { in: input.items.map((item) => item.inventoryItemId) }, merchantId: admin.merchant.id }
    });
    if (validItems !== input.items.length) throw new HttpError(400, "A recipe item does not belong to this store.");
    await database.$transaction([
      database.productInventoryRequirement.deleteMany({ where: { productId: product.id } }),
      database.productInventoryRequirement.createMany({
        data: input.items.map((item) => ({ ...item, productId: product.id }))
      })
    ]);
    response.json({ ok: true });
  });

  router.get("/inventory", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const items = await database.inventoryItem.findMany({
      where: { merchantId: admin.merchant.id },
      orderBy: { name: "asc" },
      include: {
        movements: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, type: true, quantityChange: true, unitCostCents: true, note: true, createdAt: true }
        },
        _count: { select: { requirements: true } }
      }
    });
    response.json(items.map(serializeInventoryItem));
  });

  router.post("/inventory", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = inventoryItemSchema.parse(request.body);
    const item = await database.inventoryItem.create({ data: { ...input, merchantId: admin.merchant.id } });
    if (input.quantityOnHand > 0) {
      await database.inventoryMovement.create({
        data: {
          merchantId: admin.merchant.id,
          inventoryItemId: item.id,
          createdById: admin.user.id,
          type: "adjustment",
          quantityChange: input.quantityOnHand,
          unitCostCents: input.unitCostCents,
          note: "Opening stock"
        }
      });
    }
    response.status(201).json(serializeInventoryItem(item));
  });

  router.patch("/inventory/:id", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = inventoryItemSchema.omit({ quantityOnHand: true }).parse(request.body);
    const result = await database.inventoryItem.updateMany({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      data: input
    });
    if (!result.count) throw new HttpError(404, "Inventory item not found.");
    response.json(serializeInventoryItem(await database.inventoryItem.findUniqueOrThrow({ where: { id: request.params.id } })));
  });

  router.post("/inventory/:id/adjustments", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = inventoryAdjustmentSchema.parse(request.body);
    const item = await database.$transaction(async (transaction) => {
      const current = await transaction.inventoryItem.findFirst({
        where: { id: request.params.id, merchantId: admin.merchant.id }
      });
      if (!current) throw new HttpError(404, "Inventory item not found.");
      const change = new Prisma.Decimal(input.quantityChange);
      const nextQuantity = current.quantityOnHand.plus(change);
      if (nextQuantity.isNegative()) throw new HttpError(409, "Stock cannot be reduced below zero.");

      let nextCost = current.unitCostCents;
      if (input.type === "purchase" && input.unitCostCents !== undefined) {
        nextCost = weightedUnitCost(current.quantityOnHand, current.unitCostCents, change, input.unitCostCents);
      }
      const updated = await transaction.inventoryItem.update({
        where: { id: current.id },
        data: { quantityOnHand: nextQuantity, unitCostCents: nextCost }
      });
      await transaction.inventoryMovement.create({
        data: {
          merchantId: admin.merchant.id,
          inventoryItemId: current.id,
          createdById: admin.user.id,
          type: input.type,
          quantityChange: change,
          unitCostCents: input.unitCostCents,
          note: input.note
        }
      });
      return updated;
    }, { isolationLevel: "Serializable" });
    response.json(serializeInventoryItem(item));
  });

  router.get("/pickup-slots", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const slots = await database.pickupSlot.findMany({
      where: { merchantId: admin.merchant.id, endTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { startTime: "asc" },
      include: { _count: { select: { orders: true } } },
      take: 200
    });
    response.json(slots);
  });

  router.post("/pickup-slots", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = pickupSlotSchema.parse(request.body);
    const slot = await database.pickupSlot.create({
      data: { ...input, startTime: new Date(input.startTime), endTime: new Date(input.endTime), merchantId: admin.merchant.id }
    });
    response.status(201).json(slot);
  });

  router.patch("/pickup-slots/:id", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const input = pickupSlotSchema.parse(request.body);
    const result = await database.pickupSlot.updateMany({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      data: { ...input, startTime: new Date(input.startTime), endTime: new Date(input.endTime) }
    });
    if (!result.count) throw new HttpError(404, "Pickup slot not found.");
    response.json(await database.pickupSlot.findUniqueOrThrow({ where: { id: request.params.id } }));
  });

  router.delete("/pickup-slots/:id", async (request, response) => {
    const admin = await requireAdmin(database, request);
    const slot = await database.pickupSlot.findFirst({
      where: { id: request.params.id, merchantId: admin.merchant.id },
      include: { _count: { select: { orders: true } } }
    });
    if (!slot) throw new HttpError(404, "Pickup slot not found.");
    if (slot._count.orders) {
      await database.pickupSlot.update({ where: { id: slot.id }, data: { isActive: false } });
    } else {
      await database.pickupSlot.delete({ where: { id: slot.id } });
    }
    response.status(204).end();
  });

  return router;
}
