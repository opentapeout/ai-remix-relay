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

test("TapeOut Circuit eval endpoint decodes the live ABI shape", async () => {
  const originalFetch = globalThis.fetch;
  const info = "0x" + [9, 4, 0, 24].map(value => BigInt(value).toString(16).padStart(64, "0")).join("");
  const output = "0x" + [32, 1].map(value => BigInt(value).toString(16).padStart(64, "0")).join("") + "0b".padEnd(64, "0");
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    const result = payload.method === "eth_blockNumber" ? "0x123" : payload.params[0].data.startsWith("0x084d60f1") ? info : output;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/circuit/eval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipeCode: "TEXT_TONE_SHIFT" }),
    }), {});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.passed, true);
    assert.equal(payload.result.inputBytes, "0x7f01");
    assert.equal(payload.result.outputBytes, "0x0b");
    assert.deepEqual(payload.result.circuitInfo, { nIn: 9, nOut: 4, nState: 0, gateCount: 24 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
