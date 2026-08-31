import { Prisma } from "@prisma/client";

export const orderTransitions: Record<string, string[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: []
};

export function canTransitionOrder(from: string, to: string) {
  return orderTransitions[from]?.includes(to) ?? false;
}

export function weightedUnitCost(
  currentQuantity: Prisma.Decimal.Value,
  currentUnitCost: Prisma.Decimal.Value,
  addedQuantity: Prisma.Decimal.Value,
  addedUnitCost: Prisma.Decimal.Value
) {
  const current = new Prisma.Decimal(currentQuantity);
  const added = new Prisma.Decimal(addedQuantity);
  const nextQuantity = current.plus(added);
  if (added.isNegative() || nextQuantity.isNegative()) throw new Error("Quantities must not produce negative stock.");
  if (nextQuantity.isZero()) return new Prisma.Decimal(addedUnitCost);
  return current.mul(currentUnitCost).plus(added.mul(addedUnitCost)).div(nextQuantity);
}

export function recipeCostCents(
  requirements: Array<{ quantity: Prisma.Decimal.Value; unitCostCents: Prisma.Decimal.Value }>,
  productQuantity: number
) {
  return Math.round(requirements.reduce(
    (sum, requirement) => sum + new Prisma.Decimal(requirement.quantity).mul(productQuantity).mul(requirement.unitCostCents).toNumber(),
    0
  ));
}
