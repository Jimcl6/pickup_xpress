import type { MerchantMenu } from "./types";

export const demoMenu: MerchantMenu = {
  id: "demo-merchant",
  name: "Cafe Stellaire",
  slug: "cafe-stellaire",
  tagline: "Right order. Right time. No line.",
  pickupInstructions: "Please pick up at the express pickup counter.",
  gcashAccountName: "Cafe Stellaire Demo",
  gcashNumber: "09XX XXX XXXX",
  bankName: "Demo Bank",
  bankAccountName: "Cafe Stellaire Demo",
  bankAccountNumber: "XXXX XXXX XXXX",
  categories: [
    {
      id: "seed-category-drinks",
      name: "Drinks",
      products: [
        {
          id: "seed-product-iced-latte",
          name: "Iced Latte",
          description: "Chilled espresso with milk.",
          priceCents: 12000,
          imageUrl: null
        },
        {
          id: "seed-product-calamansi-cooler",
          name: "Calamansi Cooler",
          description: "Bright citrus cooler for quick pickup.",
          priceCents: 9500,
          imageUrl: null
        }
      ]
    },
    {
      id: "seed-category-food",
      name: "Food",
      products: [
        {
          id: "seed-product-blueberry-muffin",
          name: "Blueberry Muffin",
          description: "Soft muffin with blueberry filling.",
          priceCents: 8500,
          imageUrl: null
        },
        {
          id: "seed-product-chicken-panini",
          name: "Chicken Panini",
          description: "Pressed sandwich with chicken and cheese.",
          priceCents: 16000,
          imageUrl: null
        },
        {
          id: "seed-product-momo-pork",
          name: "Momo Pork",
          description: "Cafe Stellaire demo savory bowl.",
          priceCents: 15000,
          imageUrl: null
        }
      ]
    }
  ],
  pickupSlots: ["11:00 AM", "11:15 AM", "11:30 AM", "11:45 AM", "12:00 PM"].map(
    (label, index) => ({
      id: `preview-slot-${index}`,
      label,
      startTime: `2026-07-22T${String(3 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}:00.000Z`,
      endTime: `2026-07-22T${String(3 + Math.floor((index + 1) / 4)).padStart(2, "0")}:${String(((index + 1) % 4) * 15).padStart(2, "0")}:00.000Z`,
      capacity: 8,
      remainingCapacity: 8 - index
    })
  )
};
