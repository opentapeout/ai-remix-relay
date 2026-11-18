import test from "node:test";
import assert from "node:assert/strict";
import { hashMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import worker, { buildImageRemixPrompt, buildTextRemixPrompt, deriveBranchFlags, keccak256, verifyRegistryReceipt, verifyRegistryTransaction } from "../dist/server/index.js";

test("Ethereum Keccak-256 matches the canonical empty-input vector", () => {
  assert.equal(keccak256(new Uint8Array()), "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
});

test("Registry receipt verification binds the exact X Layer publish event", () => {
  const registryAddress = "0x1111111111111111111111111111111111111111";
  const relayHash = `0x${"22".repeat(32)}`;
  const parentHash = `0x${"33".repeat(32)}`;
  const expected = {
    registryAddress,
    relayHash,
    parentHash,
    creatorAddress: `0x${"99".repeat(20)}`,
    txHash: `0x${"44".repeat(32)}`,
    dataWords: ["55".repeat(32), "66".repeat(32), "77".repeat(32), "88".repeat(32), "99".repeat(20).slice(0, 40), "01", "03e8"],
  };
  const topic = keccak256(new TextEncoder().encode("NodePublished(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,address,uint8,uint16)"));
  const word = value => value.replace(/^0x/, "").padStart(64, "0");
  const blockNumber = "0x10";
  const nodeId = keccak256(Uint8Array.from(Buffer.from([relayHash, parentHash, expected.dataWords[0], expected.creatorAddress, `0x${word(blockNumber)}`].map(word).join(""), "hex")));
  const receipt = {
    status: "0x1",
    to: registryAddress,
    blockNumber,
    transactionHash: expected.txHash,
    logs: [{
      address: registryAddress,
      topics: [topic, nodeId, relayHash, parentHash],
      data: `0x${expected.dataWords.map(word).join("")}`,
    }],
  };
  assert.equal(verifyRegistryReceipt(receipt, expected), true);
  assert.equal(verifyRegistryReceipt({ ...receipt, status: "0x0" }, expected), false);
  assert.equal(verifyRegistryReceipt({ ...receipt, to: `0x${"ff".repeat(20)}` }, expected), false);
  assert.equal(verifyRegistryReceipt({ ...receipt, transactionHash: `0x${"ff".repeat(32)}` }, expected), false);
  assert.equal(verifyRegistryReceipt({ ...receipt, logs: [{ ...receipt.logs[0], topics: [...receipt.logs[0].topics.slice(0, 3), `0x${"ff".repeat(32)}`] }] }, expected), false);
  assert.equal(verifyRegistryReceipt({ ...receipt, logs: [{ ...receipt.logs[0], topics: [topic, `0x${"ff".repeat(32)}`, ...receipt.logs[0].topics.slice(2)] }] }, expected), false);
  assert.equal(verifyRegistryReceipt({ ...receipt, logs: [{ ...receipt.logs[0], data: `0x${"ff".repeat(224)}` }] }, expected), false);
  assert.equal(verifyRegistryReceipt(null, expected), false);
});

test("Registry transaction verification checks X Layer, calldata, and pending receipts", async () => {
  const originalFetch = globalThis.fetch;
  const registryAddress = "0x1111111111111111111111111111111111111111";
  const creator = "0x2222222222222222222222222222222222222222";
  const relayHash = `0x${"33".repeat(32)}`;
  const parentHash = `0x${"44".repeat(32)}`;
  const txHash = `0x${"55".repeat(32)}`;
  const expected = {
    registryAddress, relayHash, parentHash, creatorAddress: creator,
    dataWords: [`0x${"66".repeat(32)}`, `0x${"77".repeat(32)}`, `0x${"88".repeat(32)}`, `0x${"99".repeat(32)}`, "01", "03e8"],
  };
  const word = value => value.replace(/^0x/i, "").padStart(64, "0");
  const input = `0x3d85d609${[relayHash, parentHash, ...expected.dataWords].map(word).join("")}`;
  const transaction = { hash: txHash, to: registryAddress, from: creator, input };
  const topic = keccak256(new TextEncoder().encode("NodePublished(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,address,uint8,uint16)"));
  const blockNumber = "0x10";
  const nodeId = keccak256(Uint8Array.from(Buffer.from([relayHash, parentHash, expected.dataWords[0], creator, `0x${word(blockNumber)}`].map(word).join(""), "hex")));
  const receipt = {
    status: "0x1", to: registryAddress, blockNumber, transactionHash: txHash,
    logs: [{ address: registryAddress, topics: [topic, nodeId, relayHash, parentHash], data: `0x${[...expected.dataWords.slice(0, 4), creator, ...expected.dataWords.slice(4)].map(word).join("")}` }],
  };
  let receiptResult = receipt;
  let chainId = "0xc4";
  const methods = [];
  globalThis.fetch = async (_url, options) => {
    const { method } = JSON.parse(options.body);
    methods.push(method);
    const result = method === "eth_chainId" ? chainId : method === "eth_getTransactionByHash" ? transaction : receiptResult;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.equal(await verifyRegistryTransaction({}, txHash, expected), true);
    receiptResult = null;
    assert.equal(await verifyRegistryTransaction({}, txHash, expected), null);
    receiptResult = receipt;
    chainId = "0x1";
    assert.equal(await verifyRegistryTransaction({}, txHash, expected), false);
    chainId = "0xc4";
    transaction.input = `${input.slice(0, -1)}0`;
    assert.equal(await verifyRegistryTransaction({}, txHash, expected), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("wallet signature verification uses local Keccak and X Layer ecrecover", async () => {
  const originalFetch = globalThis.fetch;
  const account = privateKeyToAccount(`0x${"00".repeat(31)}01`);
  const address = account.address.toLowerCase();
  const message = `AI Remix Relay sign-in (no transaction)\nAddress: ${address}\nNonce: test\nExpires: later`;
  const signature = await account.signMessage({ message });
  const methods = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("SELECT message, expires_at, used_at FROM wallet_challenges")) {
                  return { message, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null };
                }
                return null;
              },
              async run() { return { meta: { changes: 1 } }; },
            };
          },
        };
      },
    },
  };
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    methods.push(payload.method);
    assert.equal(payload.method, "eth_call");
    assert.equal(payload.params[0].to, "0x0000000000000000000000000000000000000001");
    const recovery = Number.parseInt(signature.slice(-2), 16);
    const v = recovery < 27 ? recovery + 27 : recovery;
    const expectedData = `0x${hashMessage(message).slice(2)}${v.toString(16).padStart(64, "0")}${signature.slice(2, 66)}${signature.slice(66, 130)}`;
    assert.equal(payload.params[0].data, expectedData);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: `0x${"0".repeat(24)}${address.slice(2)}` }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/wallet/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, nonce: "nonce", signature }),
    }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(methods, ["eth_call"]);
    assert.match(response.headers.get("set-cookie"), /relay_wallet_session=/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test("image remix prompts honor the selected dimension without conflicting text rules", () => {
  const typographyPrompt = buildImageRemixPrompt({ rule: "文字节奏", prompt: "把标题改成‘未来来信’", preserve: "城市轮廓和构图", recipeCode: "IMAGE_TEXT_RHYTHM", direction: "克制延展" });
  assert.match(typographyPrompt, /Use the exact wording supplied/);
  assert.match(typographyPrompt, /城市轮廓和构图/);
  assert.doesNotMatch(typographyPrompt, /Do not add or alter text/);

  const colorPrompt = buildImageRemixPrompt({ rule: "色彩气候", prompt: "增加清晨感", preserve: "城市轮廓", recipeCode: "IMAGE_COLOR_SHIFT", direction: "强化表达" });
  assert.match(colorPrompt, /change only the 色彩气候/);
  assert.match(colorPrompt, /Do not add or alter text/);
  assert.match(colorPrompt, /城市轮廓/);
});

test("text remix prompts include preserve instructions and circuit disclosure", () => {
  const prompt = buildTextRemixPrompt({ sourceText: "原文", rule: "语气风格", prompt: "更像一封信", preserve: "人物关系和事实", recipeCode: "TEXT_TONE_SHIFT", direction: "强化表达" });
  assert.match(prompt, /必须保留：人物关系和事实/);
  assert.match(prompt, /只改变语气风格/);
  assert.match(prompt, /TapeOut Circuit 不会检查作品是否满足/);
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

test("private relay assets are denied before storage access without a verified wallet session", async () => {
  let bucketReads = 0;
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                if (sql.includes("SELECT relay_id FROM nodes")) return { relay_id: "private-relay" };
                if (sql.includes("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays")) return { id: values[0], owner_user_id: "owner", access_mode: "wallets", allowed_wallets: "[\"0x1111111111111111111111111111111111111111\"]" };
                return null;
              },
            };
          },
        };
      },
    },
    BUCKET: { async get() { bucketReads += 1; return null; } },
  };
  const response = await worker.fetch(new Request("https://relay.example/api/assets/relays%2Fprivate-relay%2Fseed%2Fseed.webp"), env);
  assert.equal(response.status, 403);
  assert.equal(bucketReads, 0);
});

test("allowlisted wallet session can read a private relay asset", async () => {
  let bucketReads = 0;
  const address = "0x1111111111111111111111111111111111111111";
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                if (sql.includes("SELECT relay_id FROM nodes")) return { relay_id: "private-relay" };
                if (sql.includes("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays")) return { id: values[0], owner_user_id: "owner", access_mode: "wallets", allowed_wallets: JSON.stringify([address]) };
                if (sql.includes("SELECT wallet_address, expires_at FROM wallet_sessions")) return { wallet_address: address, expires_at: new Date(Date.now() + 60_000).toISOString() };
                return null;
              },
            };
          },
        };
      },
    },
    BUCKET: {
      async get() {
        bucketReads += 1;
        return { body: new Uint8Array([1, 2, 3]), httpEtag: '"asset"', writeHttpMetadata(headers) { headers.set("content-type", "image/webp"); } };
      },
    },
  };
  const token = "12345678-1234-1234-1234-123456789012";
  const response = await worker.fetch(new Request("https://relay.example/api/assets/relays%2Fprivate-relay%2Fseed%2Fseed.webp", { headers: { cookie: `relay_wallet_session=${token}` } }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(bucketReads, 1);
});

test("expired or wallet-locked relay links cannot unlock private assets", async () => {
  let bucketReads = 0;
  const address = "0x1111111111111111111111111111111111111111";
  const token = "12345678-1234-1234-1234-123456789012";
  for (const invite of [
    { relay_id: "private-relay", status: "open", expires_at: new Date(Date.now() - 1_000).toISOString(), lock_first_wallet: 0, bound_wallet: null },
    { relay_id: "private-relay", status: "open", expires_at: null, lock_first_wallet: 1, bound_wallet: "0x2222222222222222222222222222222222222222" },
  ]) {
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...values) {
              return {
                async first() {
                  if (sql.includes("SELECT relay_id FROM nodes")) return { relay_id: "private-relay" };
                  if (sql.includes("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays")) return { id: values[0], owner_user_id: "owner", access_mode: "link", allowed_wallets: "[]" };
                  if (sql.includes("SELECT wallet_address, expires_at FROM wallet_sessions")) return { wallet_address: address, expires_at: new Date(Date.now() + 60_000).toISOString() };
                  if (sql.includes("SELECT relay_id, status, expires_at, lock_first_wallet, bound_wallet FROM invites")) return invite;
                  return null;
                },
              };
            },
          };
        },
      },
      BUCKET: { async get() { bucketReads += 1; return null; } },
    };
    const response = await worker.fetch(new Request(`https://relay.example/api/assets/relays%2Fprivate-relay%2Fseed%2Fseed.webp?invite=${token}`, { headers: { cookie: `relay_wallet_session=${token}` } }), env);
    assert.equal(response.status, 403);
  }
  assert.equal(bucketReads, 0);
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

test("TapeOut Circuit output must match the requested remix recipe", async () => {
  const originalFetch = globalThis.fetch;
  const info = "0x" + [9, 4, 0, 24].map(value => BigInt(value).toString(16).padStart(64, "0")).join("");
  const output = "0x" + [32, 1].map(value => BigInt(value).toString(16).padStart(64, "0")).join("") + "0b".padEnd(64, "0");
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    const result = payload.method === "eth_blockNumber" ? "0x456" : payload.params[0].data.startsWith("0x084d60f1") ? info : output;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/circuit/eval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipeCode: "IMAGE_COLOR_SHIFT" }),
    }), {});
    const payload = await response.json();
    assert.equal(payload.result.recipeCode, "TEXT_TONE_SHIFT");
    assert.equal(payload.result.recipeMatched, false);
    assert.equal(payload.result.passed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejected Circuit challenge stops AI generation before spending credits", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  let dbWrites = 0;
  const info = "0x" + [9, 4, 0, 24].map(value => BigInt(value).toString(16).padStart(64, "0")).join("");
  const output = "0x" + [32, 1].map(value => BigInt(value).toString(16).padStart(64, "0")).join("") + "00".padEnd(64, "0");
  const env = {
    OPENAI_API_KEY: "test-key",
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("SELECT COUNT(*) AS count FROM generations")) return { count: 0 };
                return null;
              },
              async all() { return { results: [] }; },
              async run() { dbWrites += 1; return { meta: { changes: 1 } }; },
            };
          },
        };
      },
      async batch() { dbWrites += 1; },
    },
    BUCKET: { async get() { throw new Error("static sample should not use R2"); } },
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("api.openai.com")) { providerCalls += 1; throw new Error("AI provider must not be called"); }
    const payload = JSON.parse(options.body);
    const result = payload.method === "eth_blockNumber" ? "0x456" : payload.params[0].data.startsWith("0x084d60f1") ? info : output;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ relayId: "city-signal-2049", parentNodeId: "n0", contentType: "image", rule: "色彩气候", prompt: "shift the atmosphere", licenseCode: "CC-BY-NC-4.0", splitBps: 1000, idempotencyKey: "challenge-reject-test" }),
    }), env);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "circuit_rejected");
    assert.equal(providerCalls, 0);
    assert.equal(dbWrites, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
