import { Prisma, type PrismaClient } from "@prisma/client";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { createAdminRouter } from "./admin-routes.js";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";
import {
  createOrderNumber,
  createOrderSchema,
  normalizePhone
} from "./order-contract.js";
import { prisma } from "./prisma.js";

const webDistPath = fileURLToPath(new URL("../../web/dist", import.meta.url));

const orderInclude = {
  merchant: { select: { name: true, slug: true, pickupInstructions: true } },
  customer: { select: { name: true, phone: true, email: true } },
  pickupSlot: { select: { id: true, label: true, startTime: true, endTime: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
      lineTotalCents: true
    }
  },
  statusEvents: {
    select: { status: true, note: true, createdAt: true },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.OrderInclude;

export function createApp(database: PrismaClient = prisma) {
  const app = express();

  if (config.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  if (config.CORS_ORIGIN) {
    app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  }
  app.use(express.json({ limit: "32kb" }));
  app.use(express.static(webDistPath));
  app.use("/api/admin", createAdminRouter(database));

  app.get("/api/health", async (_request, response) => {
    try {
      await database.$queryRaw`SELECT 1`;
      response.json({ ok: true, database: "connected" });
    } catch {
      response.status(503).json({ ok: false, database: "unavailable" });
    }
  });

  app.get("/api/menu", async (_request, response, next) => {
    try {
      const merchant = await database.merchant.findFirst({
        where: { slug: "cafe-stellaire" },
        select: {
          id: true,
          name: true,
          slug: true,
          tagline: true,
          pickupInstructions: true,
          gcashAccountName: true,
          gcashNumber: true,
          bankName: true,
          bankAccountName: true,
          bankAccountNumber: true,
          categories: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              products: {
                where: { isActive: true },
                orderBy: { name: "asc" },
                select: {
                  id: true,
                  name: true,
                  description: true,
                  priceCents: true,
                  imageUrl: true
                }
              }
            }
          },
          pickupSlots: {
            where: { isActive: true, startTime: { gt: new Date() } },
            orderBy: { startTime: "asc" },
            select: {
              id: true,
              label: true,
              startTime: true,
              endTime: true,
              capacity: true,
              orders: {
                where: { status: { not: "cancelled" } },
                select: { id: true }
              }
            }
          }
        }
      });

      if (!merchant) {
        throw new HttpError(404, "Demo merchant has not been seeded yet.");
      }

      response.json({
        ...merchant,
        pickupSlots: merchant.pickupSlots
          .map(({ orders, capacity, ...slot }) => ({
            ...slot,
            capacity,
            remainingCapacity: Math.max(0, capacity - orders.length)
          }))
          .filter((slot) => slot.remainingCapacity > 0)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/orders", async (request, response, next) => {
    try {
      const input = createOrderSchema.parse(request.body);
      const persistOrder = () => database.$transaction(
        async (transaction) => {
          const merchant = await transaction.merchant.findUnique({
            where: { slug: input.merchantSlug },
            select: { id: true }
          });

          if (!merchant) {
            throw new HttpError(404, "Merchant not found.");
          }

          const pickupSlot = await transaction.pickupSlot.findFirst({
            where: {
              id: input.pickupSlotId,
              merchantId: merchant.id,
              isActive: true,
              startTime: { gt: new Date() }
            },
            select: {
              id: true,
              capacity: true,
              orders: {
                where: { status: { not: "cancelled" } },
                select: { id: true }
              }
            }
          });

          if (!pickupSlot) {
            throw new HttpError(409, "That pickup time is no longer available.");
          }

          if (pickupSlot.orders.length >= pickupSlot.capacity) {
            throw new HttpError(409, "That pickup time has just filled up. Please choose another.");
          }

          const requestedIds = input.items.map((item) => item.productId);
          const products = await transaction.product.findMany({
            where: {
              id: { in: requestedIds },
              merchantId: merchant.id,
              isActive: true
            },
            select: { id: true, name: true, priceCents: true }
          });

          if (products.length !== requestedIds.length) {
            throw new HttpError(409, "One or more menu items are no longer available.");
          }

          const productById = new Map(products.map((product) => [product.id, product]));
          const orderItems = input.items.map((item) => {
            const product = productById.get(item.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              unitPriceCents: product.priceCents,
              lineTotalCents: product.priceCents * item.quantity
            };
          });
          const subtotalCents = orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0);

          const customer = await transaction.customer.create({
            data: {
              name: input.customer.name,
              phone: normalizePhone(input.customer.phone),
              email: input.customer.email || null
            }
          });

          return transaction.order.create({
            data: {
              orderNumber: createOrderNumber(),
              merchantId: merchant.id,
              customerId: customer.id,
              pickupSlotId: pickupSlot.id,
              paymentMethod: input.paymentMethod,
              paymentStatus:
                input.paymentMethod === "cash_on_pickup" ? "unpaid" : "reference_submitted",
              paymentReference: input.paymentReference || null,
              subtotalCents,
              totalCents: subtotalCents,
              customerNote: input.customerNote || null,
              items: { create: orderItems },
              statusEvents: {
                create: {
                  status: "pending",
                  note: "Order received and awaiting confirmation."
                }
              }
            },
            include: orderInclude
          });
        },
        { isolationLevel: "Serializable" }
      );

      let order: Awaited<ReturnType<typeof persistOrder>> | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          order = await persistOrder();
          break;
        } catch (error) {
          const canRetry =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === "P2034" || error.code === "P2002");
          if (!canRetry || attempt === 2) throw error;
        }
      }

      if (!order) throw new Error("Order transaction did not complete.");

      response.status(201).json(order);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/orders/:orderNumber", async (request, response, next) => {
    try {
      const phone = normalizePhone(String(request.query.phone ?? ""));
      if (!phone) {
        throw new HttpError(400, "A mobile number is required to view this order.");
      }

      const order = await database.order.findFirst({
        where: {
          orderNumber: request.params.orderNumber,
          customer: { phone }
        },
        include: orderInclude
      });

      if (!order) {
        throw new HttpError(404, "Order not found. Check the order number and mobile number.");
      }

      response.json(order);
    } catch (error) {
      next(error);
    }
  });

  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(webDistPath, "index.html"));
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof ZodError) {
        response.status(400).json({
          message: "Please check your order details.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        });
        return;
      }

      if (error instanceof HttpError) {
        response.status(error.status).json({ message: error.message });
        return;
      }

      if (
        error instanceof Prisma.PrismaClientInitializationError ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
      ) {
        response.status(503).json({ message: "The ordering service is temporarily unavailable." });
        return;
      }

      console.error(error);
      response.status(500).json({ message: "Something went wrong." });
    }
  );

  return app;
}
