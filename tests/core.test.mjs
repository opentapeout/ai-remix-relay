import test from "node:test";
import assert from "node:assert/strict";
import worker, { deriveBranchFlags } from "../dist/server/index.js";

test("branch derivation marks only later siblings as branches", () => {
  const nodes = deriveBranchFlags([
    { id: "seed", parent: null },
    { id: "a", parent: "seed" },
    { id: "b", parent: "a" },
    { id: "c", parent: "seed" },
    { id: "d", parent: "b" },
    { id: "e", parent: "d" },
    { id: "f", parent: "e" },
  ]);
  assert.deepEqual(nodes.map(node => node.branch), [false, false, false, true, false, false, false]);
});

test("health endpoint is available without storage bindings", async () => {
  const response = await worker.fetch(new Request("http://localhost/health"), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "ai-remix-relay", version: 2 });
});

test("cross-origin writes are rejected before handlers run", async () => {
  const response = await worker.fetch(new Request("http://localhost/api/nodes", {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body: "{}",
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "invalid_origin");
});
