import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, hashSessionToken, verifyPassword } from "./admin-auth.js";

describe("admin authentication helpers", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("A-strong-demo-password");
    assert.notEqual(hash, "A-strong-demo-password");
    assert.equal(await verifyPassword("A-strong-demo-password", hash), true);
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });

  it("creates stable one-way session token hashes", () => {
    assert.equal(hashSessionToken("session-token"), hashSessionToken("session-token"));
    assert.notEqual(hashSessionToken("session-token"), "session-token");
  });
});
