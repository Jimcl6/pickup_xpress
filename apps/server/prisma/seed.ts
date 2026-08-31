import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/admin-auth.js";

const prisma = new PrismaClient();

function buildSlot(serviceDate: Date, hour: number, minute: number) {
  const startTime = new Date(
    Date.UTC(
      serviceDate.getUTCFullYear(),
      serviceDate.getUTCMonth(),
      serviceDate.getUTCDate(),
      hour,
      minute,
      0
    )
  );
  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
  return {
    label: startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila"
    }),
    startTime,
    endTime
  };
}

async function main() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "PickupXpress123!";
  const passwordHash = await hashPassword(adminPassword);
  const merchant = await prisma.merchant.upsert({
    where: { slug: "cafe-stellaire" },
    update: {
      name: "Cafe Stellaire",
      tagline: "Right order. Right time. No line.",
      pickupInstructions: "Please pick up at the express pickup counter.",
      gcashAccountName: "Cafe Stellaire Demo",
      gcashNumber: "09XX XXX XXXX",
      bankName: "Demo Bank",
      bankAccountName: "Cafe Stellaire Demo",
      bankAccountNumber: "XXXX XXXX XXXX"
    },
    create: {
      name: "Cafe Stellaire",
      slug: "cafe-stellaire",
      tagline: "Right order. Right time. No line.",
      pickupInstructions: "Please pick up at the express pickup counter.",
      gcashAccountName: "Cafe Stellaire Demo",
      gcashNumber: "09XX XXX XXXX",
      bankName: "Demo Bank",
      bankAccountName: "Cafe Stellaire Demo",
      bankAccountNumber: "XXXX XXXX XXXX"
    }
  });

  await prisma.merchantUser.upsert({
    where: { email: "merchant@cafestellaire.test" },
    update: {
      merchantId: merchant.id,
      name: "Cafe Stellaire Merchant",
      role: "owner",
      passwordHash
    },
    create: {
      merchantId: merchant.id,
      name: "Cafe Stellaire Merchant",
      email: "merchant@cafestellaire.test",
      role: "owner",
      passwordHash
    }
  });

  const drinks = await prisma.productCategory.upsert({
    where: { id: "seed-category-drinks" },
    update: {
      merchantId: merchant.id,
      name: "Drinks",
      sortOrder: 1
    },
    create: {
      id: "seed-category-drinks",
      merchantId: merchant.id,
      name: "Drinks",
      sortOrder: 1
    }
  });

  const food = await prisma.productCategory.upsert({
    where: { id: "seed-category-food" },
    update: {
      merchantId: merchant.id,
      name: "Food",
      sortOrder: 2
    },
    create: {
      id: "seed-category-food",
      merchantId: merchant.id,
      name: "Food",
      sortOrder: 2
    }
  });

  const products = [
    {
      id: "seed-product-iced-latte",
      categoryId: drinks.id,
      name: "Iced Latte",
      description: "Chilled espresso with milk.",
      priceCents: 12000
    },
    {
      id: "seed-product-calamansi-cooler",
      categoryId: drinks.id,
      name: "Calamansi Cooler",
      description: "Bright citrus cooler for quick pickup.",
      priceCents: 9500
    },
    {
      id: "seed-product-chicken-panini",
      categoryId: food.id,
      name: "Chicken Panini",
      description: "Pressed sandwich with chicken and cheese.",
      priceCents: 16000
    },
    {
      id: "seed-product-momo-pork",
      categoryId: food.id,
      name: "Momo Pork",
      description: "Cafe Stellaire demo savory bowl.",
      priceCents: 15000
    },
    {
      id: "seed-product-blueberry-muffin",
      categoryId: food.id,
      name: "Blueberry Muffin",
      description: "Soft muffin with blueberry filling.",
      priceCents: 8500
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        merchantId: merchant.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        isActive: true
      },
      create: {
        ...product,
        merchantId: merchant.id,
        isActive: true
      }
    });
  }

  const inventory = [
    { id: "seed-stock-coffee", name: "Espresso beans", unit: "g", quantityOnHand: 5000, reorderLevel: 1000, unitCostCents: 2.4 },
    { id: "seed-stock-milk", name: "Fresh milk", unit: "ml", quantityOnHand: 12000, reorderLevel: 3000, unitCostCents: 0.12 },
    { id: "seed-stock-cup", name: "Cold cups", unit: "pc", quantityOnHand: 200, reorderLevel: 40, unitCostCents: 650 },
    { id: "seed-stock-calamansi", name: "Calamansi concentrate", unit: "ml", quantityOnHand: 5000, reorderLevel: 1000, unitCostCents: 0.3 },
    { id: "seed-stock-panini", name: "Chicken panini", unit: "pc", quantityOnHand: 50, reorderLevel: 10, unitCostCents: 7200 },
    { id: "seed-stock-momo", name: "Pork momo serving", unit: "pc", quantityOnHand: 40, reorderLevel: 8, unitCostCents: 6800 },
    { id: "seed-stock-muffin", name: "Blueberry muffin", unit: "pc", quantityOnHand: 36, reorderLevel: 8, unitCostCents: 3800 }
  ];

  for (const item of inventory) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: { ...item, merchantId: merchant.id, isActive: true },
      create: { ...item, merchantId: merchant.id, isActive: true }
    });
    await prisma.inventoryMovement.upsert({
      where: { id: `seed-movement-${item.id}` },
      update: { quantityChange: item.quantityOnHand, unitCostCents: item.unitCostCents },
      create: {
        id: `seed-movement-${item.id}`,
        merchantId: merchant.id,
        inventoryItemId: item.id,
        type: "adjustment",
        quantityChange: item.quantityOnHand,
        unitCostCents: item.unitCostCents,
        note: "Opening stock"
      }
    });
  }

  await prisma.productInventoryRequirement.deleteMany({
    where: { product: { merchantId: merchant.id } }
  });
  await prisma.productInventoryRequirement.createMany({
    data: [
      { productId: "seed-product-iced-latte", inventoryItemId: "seed-stock-coffee", quantity: 18 },
      { productId: "seed-product-iced-latte", inventoryItemId: "seed-stock-milk", quantity: 180 },
      { productId: "seed-product-iced-latte", inventoryItemId: "seed-stock-cup", quantity: 1 },
      { productId: "seed-product-calamansi-cooler", inventoryItemId: "seed-stock-calamansi", quantity: 40 },
      { productId: "seed-product-calamansi-cooler", inventoryItemId: "seed-stock-cup", quantity: 1 },
      { productId: "seed-product-chicken-panini", inventoryItemId: "seed-stock-panini", quantity: 1 },
      { productId: "seed-product-momo-pork", inventoryItemId: "seed-stock-momo", quantity: 1 },
      { productId: "seed-product-blueberry-muffin", inventoryItemId: "seed-stock-muffin", quantity: 1 }
    ]
  });

  await prisma.pickupSlot.deleteMany({
    where: { merchantId: merchant.id }
  });

  const manilaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const nextServiceDate = new Date(
    Date.UTC(
      manilaNow.getUTCFullYear(),
      manilaNow.getUTCMonth(),
      manilaNow.getUTCDate() + 1
    )
  );
  const slots = [
    buildSlot(nextServiceDate, 3, 0),
    buildSlot(nextServiceDate, 3, 15),
    buildSlot(nextServiceDate, 3, 30),
    buildSlot(nextServiceDate, 3, 45),
    buildSlot(nextServiceDate, 4, 0),
    buildSlot(nextServiceDate, 4, 15),
    buildSlot(nextServiceDate, 4, 30),
    buildSlot(nextServiceDate, 4, 45),
    buildSlot(nextServiceDate, 5, 0),
    buildSlot(nextServiceDate, 5, 15),
    buildSlot(nextServiceDate, 5, 30),
    buildSlot(nextServiceDate, 5, 45),
    buildSlot(nextServiceDate, 6, 0)
  ];

  await prisma.pickupSlot.createMany({
    data: slots.map((slot) => ({
      merchantId: merchant.id,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: 8,
      isActive: true
    }))
  });

  console.log("Seeded Cafe Stellaire demo data.");
  console.log("Admin login: merchant@cafestellaire.test");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
