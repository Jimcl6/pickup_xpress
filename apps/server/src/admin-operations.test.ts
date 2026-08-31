import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransitionOrder, recipeCostCents, weightedUnitCost } from "./admin-operations.js";

describe("admin order operations", () => {
  it("allows only the KDS workflow and cancellation before ready", () => {
    assert.equal(canTransitionOrder("pending", "accepted"), true);
    assert.equal(canTransitionOrder("accepted", "preparing"), true);
    assert.equal(canTransitionOrder("preparing", "ready"), true);
    assert.equal(canTransitionOrder("ready", "completed"), true);
    assert.equal(canTransitionOrder("pending", "completed"), false);
    assert.equal(canTransitionOrder("ready", "cancelled"), false);
    assert.equal(canTransitionOrder("completed", "pending"), false);
  });

  it("calculates weighted purchase cost", () => {
    assert.equal(weightedUnitCost(10, 100, 10, 200).toNumber(), 150);
    assert.equal(weightedUnitCost(5, 125, 15, 175).toNumber(), 162.5);
  });

  it("calculates recipe cost for the completed quantity", () => {
    assert.equal(recipeCostCents([
      { quantity: 18, unitCostCents: 2.4 },
      { quantity: 180, unitCostCents: 0.12 },
      { quantity: 1, unitCostCents: 650 }
    ], 2), 1430);
  });
});
