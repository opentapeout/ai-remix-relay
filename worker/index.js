const page = __PAGE_HTML__;
const seedArtworkBase64 = __SEED_ARTWORK_BASE64__;

const RELAY_ID = "city-signal-2049";
const ALLOWED_RULES = new Set(["色彩气候", "构图重心", "时代氛围", "文字节奏", "叙事视角", "语气风格", "情节推进", "标题钩子", "自由创作"]);
const ALLOWED_CONTENT_TYPES = new Set(["image", "text"]);
const RECIPE_CODES = new Map([
  ["image:色彩气候", "IMAGE_COLOR_SHIFT"],
  ["image:构图重心", "IMAGE_COMPOSITION_SHIFT"],
  ["image:时代氛围", "IMAGE_ERA_SHIFT"],
  ["image:文字节奏", "IMAGE_TEXT_RHYTHM"],
  ["text:叙事视角", "TEXT_NARRATIVE_LENS"],
  ["text:语气风格", "TEXT_TONE_SHIFT"],
  ["text:情节推进", "TEXT_PLOT_BRANCH"],
  ["text:标题钩子", "TEXT_TITLE_HOOK"],
]);
const RECIPE_CODE_LIST = Array.from(RECIPE_CODES.values());
const ALLOWED_LICENSES = new Set(["CC-BY-NC-4.0", "CC-BY-4.0", "ALL-RIGHTS-RESERVED"]);
const seedNodes = [
  { id: "n0", parent: null, creator: "@miko", title: "Seed", panel: 0, branch: false, assetUrl: "/assets/relay-triptych.webp" },
  { id: "n1", parent: "n0", creator: "@lin", title: "Signal", panel: 1, branch: false, assetUrl: "/assets/relay-triptych.webp" },
  { id: "n2", parent: "n1", creator: "@sola", title: "Current", panel: 2, branch: false, assetUrl: "/assets/relay-triptych.webp" },
  { id: "n3", parent: "n0", creator: "@noon", title: "Quiet branch", panel: 1, branch: true, assetUrl: "/assets/relay-triptych.webp" },
];

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function error(code, message, status = 400, details) {
  return json({ ok: false, error: { code, message, details } }, status);
}

function getIdentity(request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email") || "";
  const encodedName = request.headers.get("oai-authenticated-user-full-name") || "";
  let name = email ? email.split("@")[0] : "guest";
  if (encodedName) {
    try { name = decodeURIComponent(encodedName); } catch { name = encodedName; }
  }
  return { id: userId, email, name, handle: `@${name.replace(/\s+/g, "_").slice(0, 24)}` };
}

function requireIdentity(request) {
  const identity = getIdentity(request);
  const local = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
  if (!identity.id && !local) return null;
  return identity.id ? identity : { ...identity, id: "local-preview-user" };
}

async function resolveIdentity(request, env) {
  const identity = requireIdentity(request);
  if (identity && identity.id !== "local-preview-user") return identity;
  const wallet = await getWalletSession(request, env);
  if (wallet) return { id: `wallet:${wallet.address}`, email: "", name: wallet.address, handle: `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` };
  return identity;
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request, maxBytes = 24_000) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("payload_too_large");
  const raw = await request.text();
  if (raw.length > maxBytes) throw new Error("payload_too_large");
  return raw ? JSON.parse(raw) : {};
}

function safeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function validTxHash(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(value || ""));
}

function getWalletSessionToken(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)relay_wallet_session=([a-f0-9-]{36})/i);
  return match?.[1] || null;
}

async function getWalletSession(request, env) {
  const token = getWalletSessionToken(request);
  if (!token || !env.DB) return null;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare("SELECT wallet_address, expires_at FROM wallet_sessions WHERE token_hash = ? AND expires_at > ?").bind(tokenHash, new Date().toISOString()).first();
  return session ? { address: String(session.wallet_address).toLowerCase(), expiresAt: session.expires_at } : null;
}

const KECCAK_MASK = (1n << 64n) - 1n;
const KECCAK_ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const KECCAK_ROTATIONS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

function rotateKeccakLane(value, shift) {
  if (!shift) return value;
  const amount = BigInt(shift);
  return ((value << amount) | (value >> (64n - amount))) & KECCAK_MASK;
}

export function keccak256(input) {
  const rate = 136;
  const blockCount = Math.ceil((input.length + 1) / rate);
  const padded = new Uint8Array(blockCount * rate);
  padded.set(input);
  padded[input.length] = 0x01;
  padded[padded.length - 1] |= 0x80;
  const state = Array(25).fill(0n);

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let index = 0; index < rate; index++) {
      state[index >> 3] ^= BigInt(padded[offset + index]) << BigInt((index & 7) * 8);
    }
    for (const roundConstant of KECCAK_ROUND_CONSTANTS) {
      const columns = Array(5).fill(0n);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) columns[x] ^= state[x + 5 * y];
      const deltas = columns.map((column, x) => columns[(x + 4) % 5] ^ rotateKeccakLane(columns[(x + 1) % 5], 1));
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x + 5 * y] ^= deltas[x];

      const rotated = Array(25).fill(0n);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
        rotated[y + 5 * ((2 * x + 3 * y) % 5)] = rotateKeccakLane(state[x + 5 * y], KECCAK_ROTATIONS[x + 5 * y]);
      }
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
        state[x + 5 * y] = rotated[x + 5 * y] ^ ((~rotated[(x + 1) % 5 + 5 * y]) & rotated[(x + 2) % 5 + 5 * y]);
      }
      state[0] ^= roundConstant;
    }
  }

  const digest = new Uint8Array(32);
  for (let index = 0; index < digest.length; index++) digest[index] = Number((state[index >> 3] >> BigInt((index & 7) * 8)) & 0xffn);
  return `0x${Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function personalSignDigest(message) {
  const messageBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${messageBytes.length}`);
  const payload = new Uint8Array(prefix.length + messageBytes.length);
  payload.set(prefix);
  payload.set(messageBytes, prefix.length);
  return keccak256(payload);
}

async function verifyPersonalSignature(message, signature, walletAddress, env) {
  if (!/^0x[0-9a-f]{40}$/i.test(walletAddress) || !/^0x[0-9a-f]{130}$/i.test(signature)) return false;
  const digest = personalSignDigest(message);
  let v = Number.parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;
  if (v !== 27 && v !== 28) return false;
  const input = `${digest.slice(2)}${v.toString(16).padStart(64, "0")}${signature.slice(2, 66)}${signature.slice(66, 130)}`;
  const recovered = await xLayerRpc(env, "eth_call", [{ to: "0x0000000000000000000000000000000000000001", data: `0x${input}` }, "latest"]);
  return /^0x0{24}[0-9a-f]{40}$/i.test(recovered || "") && `0x${recovered.slice(-40)}`.toLowerCase() === walletAddress.toLowerCase();
}

async function handleWalletChallenge(request, env) {
  let body;
  try { body = await readJson(request, 2_000); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const wallet = safeText(body.address, 42).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) return error("invalid_wallet", "钱包地址格式无效。", 422);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM wallet_challenges WHERE expires_at <= ? OR used_at IS NOT NULL").bind(now),
    env.DB.prepare("DELETE FROM wallet_sessions WHERE expires_at <= ?").bind(now),
  ]);
  const activeChallenges = await env.DB.prepare("SELECT COUNT(*) AS count FROM wallet_challenges WHERE wallet_address = ? AND used_at IS NULL AND expires_at > ?").bind(wallet, now).first();
  if (Number(activeChallenges?.count || 0) >= 3) return error("wallet_challenge_rate_limited", "验证请求过多，请稍后重试。", 429);
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const message = `AI Remix Relay sign-in (no transaction)\nAddress: ${wallet}\nNonce: ${nonce}\nExpires: ${expiresAt}`;
  await env.DB.prepare("INSERT INTO wallet_challenges (nonce, wallet_address, message, expires_at) VALUES (?, ?, ?, ?)").bind(nonce, wallet, message, expiresAt).run();
  return json({ ok: true, nonce, message, expiresAt });
}

async function handleWalletVerify(request, env) {
  let body;
  try { body = await readJson(request, 3_000); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const wallet = safeText(body.address, 42).toLowerCase();
  const nonce = safeText(body.nonce, 80);
  const signature = safeText(body.signature, 132);
  const challenge = await env.DB.prepare("SELECT message, expires_at, used_at FROM wallet_challenges WHERE nonce = ? AND wallet_address = ?").bind(nonce, wallet).first();
  if (!challenge || challenge.used_at || Date.parse(challenge.expires_at) <= Date.now()) return error("challenge_expired", "钱包验证已过期，请重新连接。", 401);
  let verified = false;
  try { verified = await verifyPersonalSignature(challenge.message, signature, wallet, env); } catch { return error("wallet_verification_unavailable", "暂时无法验证钱包签名，请稍后重试。", 503); }
  if (!verified) return error("invalid_signature", "钱包签名无效。", 401);
  const used = await env.DB.prepare("UPDATE wallet_challenges SET used_at = ? WHERE nonce = ? AND used_at IS NULL AND expires_at > ?").bind(new Date().toISOString(), nonce, new Date().toISOString()).run();
  if (!used.meta?.changes) return error("challenge_used", "此签名请求已使用，请重新连接钱包。", 409);
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  await env.DB.prepare("INSERT INTO wallet_sessions (token_hash, wallet_address, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), wallet, expiresAt, new Date().toISOString()).run();
  return new Response(JSON.stringify({ ok: true, address: wallet, expiresAt }), { status: 200, headers: { ...jsonHeaders, "set-cookie": `relay_wallet_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800` } });
}

async function authorizeRelay(request, env, relay, inviteToken = "") {
  if (!relay || relay.access_mode === "public") return { allowed: Boolean(relay), wallet: null };
  const session = await getWalletSession(request, env);
  if (!session) return { allowed: false, wallet: null };
  if (relay.access_mode === "wallets") {
    let allowedWallets = [];
    try { allowedWallets = JSON.parse(relay.allowed_wallets || "[]"); } catch {}
    return { allowed: allowedWallets.some(address => String(address).toLowerCase() === session.address), wallet: session.address };
  }
  if (relay.access_mode === "link") {
    if (!inviteToken) return { allowed: false, wallet: session.address };
    const invite = await env.DB.prepare("SELECT relay_id, status, expires_at, lock_first_wallet, bound_wallet FROM invites WHERE token = ?").bind(inviteToken).first();
    const valid = invite?.relay_id === relay.id && invite.status === "open" && (!invite.expires_at || Date.parse(invite.expires_at) > Date.now());
    const walletMatches = !invite?.lock_first_wallet || !invite.bound_wallet || invite.bound_wallet.toLowerCase() === session.address;
    return { allowed: Boolean(valid && walletMatches), wallet: session.address };
  }
  return { allowed: false, wallet: session.address };
}

const DEFAULT_X_LAYER_RPC_URL = "https://rpc.xlayer.tech";
const DEFAULT_TAPEOUT_PROCESSOR_ADDRESS = "0x9e2849c04a513fe64db07521cbe52d078d905c0e";
const DEFAULT_AI_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TAPEOUT_CIRCUIT_ID = 5;
const DEFAULT_TAPEOUT_TAPE_ID = "5.2.414";
const TAPEOUT_SELECTORS = {
  circuitInfo: "0x084d60f1",
  eval: "0x934d06ea",
};
const REGISTRY_NODE_PUBLISHED_TOPIC = keccak256(new TextEncoder().encode("NodePublished(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,address,uint8,uint16)"));

function hexWord(value) {
  const numeric = typeof value === "bigint" ? value : BigInt(value);
  return numeric.toString(16).padStart(64, "0");
}

function stripHex(value) {
  return String(value || "").replace(/^0x/i, "");
}

function bytesFromHex(value) {
  const clean = stripHex(value);
  if (!/^(?:[0-9a-f]{2})*$/i.test(clean)) throw new Error("invalid_hex_bytes");
  return Uint8Array.from(clean.match(/.{2}/g) || [], byte => Number.parseInt(byte, 16));
}

function decodeUintWord(hex, index = 0) {
  const clean = stripHex(hex);
  const word = clean.slice(index * 64, (index + 1) * 64);
  if (word.length !== 64) throw new Error("invalid_abi_word");
  return Number(BigInt(`0x${word}`));
}

function encodeTapeOutEvalCall(circuitId, inputBytes) {
  const bytes = stripHex(inputBytes);
  if (!bytes || bytes.length % 2 !== 0) throw new Error("invalid_circuit_input_bytes");
  return `${TAPEOUT_SELECTORS.eval}${hexWord(circuitId)}${hexWord(64)}${hexWord(bytes.length / 2)}${bytes.padEnd(Math.ceil(bytes.length / 64) * 64, "0")}`;
}

function decodeDynamicBytesResult(result) {
  const clean = stripHex(result);
  if (!clean) return "0x";
  if (clean.length >= 128) {
    const offset = Number(BigInt(`0x${clean.slice(0, 64)}`));
    const lengthOffset = offset * 2;
    if (Number.isFinite(offset) && clean.length >= lengthOffset + 64) {
      const length = Number(BigInt(`0x${clean.slice(lengthOffset, lengthOffset + 64)}`));
      const start = lengthOffset + 64;
      const bytes = clean.slice(start, start + length * 2);
      if (bytes.length === length * 2) return `0x${bytes}`;
    }
  }
  return `0x${clean}`;
}

async function xLayerRpc(env, method, params = []) {
  const rpcUrl = safeText(env.X_LAYER_RPC_URL, 200) || DEFAULT_X_LAYER_RPC_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      const detail = payload.error?.message || `rpc_http_${response.status}`;
      throw new Error(`xlayer_rpc_${detail}`);
    }
    return payload.result;
  } catch (caught) {
    if (caught?.name === "AbortError") throw new Error("xlayer_rpc_timeout");
    throw caught;
  } finally {
    clearTimeout(timeout);
  }
}

function packTapeOutInput(input) {
  const policyKeys = ["parentExists", "contentTypeAllowed", "ruleAllowed", "attributionPreserved", "licenseAccepted", "splitWithinLimit"];
  const bytes = [0, 0];
  policyKeys.forEach((key, index) => { if (input[key]) bytes[0] |= (1 << index); });
  const recipeIndex = Array.from(RECIPE_CODES.values()).indexOf(input.recipeCode);
  if (recipeIndex < 0) throw new Error("recipe_not_found");
  bytes[0] |= (recipeIndex & 1) << 6;
  bytes[0] |= ((recipeIndex >> 1) & 1) << 7;
  bytes[1] |= ((recipeIndex >> 2) & 1);
  return `0x${bytes.map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function decodeTapeOutOutput(outputBytes) {
  const clean = stripHex(outputBytes);
  const byte = clean.length >= 2 ? Number.parseInt(clean.slice(0, 2), 16) : 0;
  const recipeBits = [(byte >> 1) & 1, (byte >> 2) & 1, (byte >> 3) & 1];
  const recipeIndex = recipeBits[0] | (recipeBits[1] << 1) | (recipeBits[2] << 2);
  return { allow: Boolean(byte & 1), recipeBits, recipeIndex, recipeCode: RECIPE_CODE_LIST[recipeIndex] || null, outputByte: `0x${byte.toString(16).padStart(2, "0")}` };
}

async function evaluateTapeOutCircuit(env, circuitInput) {
  const processorAddress = safeText(env.TAPEOUT_PROCESSOR_ADDRESS, 42) || DEFAULT_TAPEOUT_PROCESSOR_ADDRESS;
  const circuitId = Number(env.TAPEOUT_CIRCUIT_ID || DEFAULT_TAPEOUT_CIRCUIT_ID);
  if (!/^0x[0-9a-fA-F]{40}$/.test(processorAddress) || !Number.isInteger(circuitId) || circuitId < 0) throw new Error("tapeout_config_invalid");
  const inputBytes = packTapeOutInput(circuitInput);
  const infoResult = await xLayerRpc(env, "eth_call", [{ to: processorAddress, data: `${TAPEOUT_SELECTORS.circuitInfo}${hexWord(circuitId)}` }, "latest"]);
  const circuitInfo = { nIn: decodeUintWord(infoResult, 0), nOut: decodeUintWord(infoResult, 1), nState: decodeUintWord(infoResult, 2), gateCount: decodeUintWord(infoResult, 3) };
  if (circuitInfo.nIn !== 9 || circuitInfo.nOut !== 4 || circuitInfo.nState !== 0) throw new Error("tapeout_circuit_shape_mismatch");
  const outputResult = await xLayerRpc(env, "eth_call", [{ to: processorAddress, data: encodeTapeOutEvalCall(circuitId, inputBytes) }, "latest"]);
  const outputBytes = decodeDynamicBytesResult(outputResult);
  const decoded = decodeTapeOutOutput(outputBytes);
  const expectedRecipeIndex = RECIPE_CODE_LIST.indexOf(circuitInput.recipeCode);
  const recipeMatched = expectedRecipeIndex >= 0 && decoded.recipeIndex === expectedRecipeIndex;
  const blockNumber = await xLayerRpc(env, "eth_blockNumber", []);
  return {
    engine: "tapeout-circuit",
    version: 1,
    passed: decoded.allow && recipeMatched,
    chainId: 196,
    processorAddress,
    circuitId,
    tapeId: safeText(env.TAPEOUT_TAPE_ID, 32) || DEFAULT_TAPEOUT_TAPE_ID,
    inputBytes,
    outputBytes,
    circuitInfo,
    allow: decoded.allow,
    recipeBits: decoded.recipeBits,
    recipeCode: decoded.recipeCode,
    recipeIndex: decoded.recipeIndex,
    recipeMatched,
    execution: { method: "eth_call", blockTag: "latest", blockNumber },
  };
}

function buildCircuitInput(candidate, licenseCode, splitBps) {
  const contentType = candidate.content_type || "image";
  const recipeCode = candidate.recipe_code || recipeFor(contentType, candidate.rule);
  return {
    parentExists: Boolean(candidate.parent_node_id),
    contentTypeAllowed: ALLOWED_CONTENT_TYPES.has(contentType),
    ruleAllowed: Boolean(recipeCode && recipeFor(contentType, candidate.rule) === recipeCode),
    attributionPreserved: Boolean(candidate.parent_node_id),
    licenseAccepted: ALLOWED_LICENSES.has(licenseCode),
    splitWithinLimit: Number.isInteger(splitBps) && splitBps >= 0 && splitBps <= 3000,
    contentType,
    rule: candidate.rule,
    recipeCode,
  };
}

export function verifyRegistryReceipt(receipt, expected) {
  if (!receipt || String(receipt.status || "").toLowerCase() !== "0x1" || String(receipt.to || "").toLowerCase() !== expected.registryAddress.toLowerCase()) return false;
  if (expected.txHash && String(receipt.transactionHash || "").toLowerCase() !== expected.txHash.toLowerCase()) return false;
  const relayId = expected.relayHash.toLowerCase();
  const parentId = expected.parentHash.toLowerCase();
  const dataWords = expected.dataWords.map(value => value.toLowerCase().replace(/^0x/, "").padStart(64, "0"));
  return (receipt.logs || []).some(log => {
    const topics = log.topics || [];
    if (String(log.address || "").toLowerCase() !== expected.registryAddress.toLowerCase()) return false;
    if (String(topics[0] || "").toLowerCase() !== REGISTRY_NODE_PUBLISHED_TOPIC.toLowerCase()) return false;
    if (topics.length !== 4) return false;
    if (!/^0x[0-9a-f]{64}$/i.test(String(topics[1] || "")) || /^0x0{64}$/i.test(topics[1])) return false;
    if (!expected.creatorAddress || !/^0x[0-9a-f]{40}$/i.test(expected.creatorAddress) || !/^0x[0-9a-f]+$/i.test(String(receipt.blockNumber || ""))) return false;
    if (String(topics[2] || "").toLowerCase() !== relayId || String(topics[3] || "").toLowerCase() !== parentId) return false;
    const actualWords = (log.data || "").replace(/^0x/, "").match(/.{64}/g) || [];
    if (actualWords.length !== dataWords.length || !dataWords.every((word, index) => actualWords[index]?.toLowerCase() === word)) return false;
    const encodedNode = [expected.relayHash, expected.parentHash, expected.dataWords[0], expected.creatorAddress, `0x${hexWord(BigInt(receipt.blockNumber))}`]
      .map(value => bytesFromHex(value.length === 42 ? `0x${value.slice(2).padStart(64, "0")}` : value));
    const encodedLength = encodedNode.reduce((sum, bytes) => sum + bytes.length, 0);
    const encoded = new Uint8Array(encodedLength);
    let offset = 0;
    encodedNode.forEach(bytes => { encoded.set(bytes, offset); offset += bytes.length; });
    return String(topics[1]).toLowerCase() === keccak256(encoded).toLowerCase();
  });
}

export async function verifyRegistryTransaction(env, txHash, expected) {
  const chainId = await xLayerRpc(env, "eth_chainId", []);
  if (String(chainId).toLowerCase() !== "0xc4") return false;
  const transaction = await xLayerRpc(env, "eth_getTransactionByHash", [txHash]);
  if (!transaction) return null;
  if (String(transaction.hash || "").toLowerCase() !== txHash.toLowerCase()) return false;
  if (String(transaction.to || "").toLowerCase() !== expected.registryAddress.toLowerCase()) return false;
  if (expected.creatorAddress && String(transaction.from || "").toLowerCase() !== expected.creatorAddress.toLowerCase()) return false;
  const creatorWord = String(transaction.from || "").replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  if (!/^0x[0-9a-f]{40}$/i.test(String(transaction.from || ""))) return false;
  const expectedCalldata = `0x3d85d609${[expected.relayHash, expected.parentHash, ...expected.dataWords].map(value => value.replace(/^0x/i, "").padStart(64, "0")).join("")}`;
  if (String(transaction.input || transaction.data || "").toLowerCase() !== expectedCalldata.toLowerCase()) return false;
  const receipt = await xLayerRpc(env, "eth_getTransactionReceipt", [txHash]);
  if (!receipt) return null;
  return verifyRegistryReceipt(receipt, { ...expected, creatorAddress: transaction.from, txHash, dataWords: [...expected.dataWords.slice(0, 4), creatorWord, ...expected.dataWords.slice(4)] });
}

function chainIntegration(env) {
  const registryAddress = safeText(env.RELAY_REGISTRY_ADDRESS, 42);
  const tapeOutProcessor = safeText(env.TAPEOUT_PROCESSOR_ADDRESS, 42) || DEFAULT_TAPEOUT_PROCESSOR_ADDRESS;
  const tapeOutCircuitId = safeText(env.TAPEOUT_CIRCUIT_ID, 32) || String(DEFAULT_TAPEOUT_CIRCUIT_ID);
  const tapeOutCircuitAddress = safeText(env.TAPEOUT_CIRCUIT_ADDRESS, 42);
  const tapeOutCircuitTxHash = safeText(env.TAPEOUT_CIRCUIT_TX_HASH, 80);
  return {
    registryAddress: /^0x[0-9a-fA-F]{40}$/.test(registryAddress) ? registryAddress : null,
    tapeOut: {
      processorAddress: /^0x[0-9a-fA-F]{40}$/.test(tapeOutProcessor) ? tapeOutProcessor : null,
      circuitId: tapeOutCircuitId || null,
      circuitAddress: /^0x[0-9a-fA-F]{40}$/.test(tapeOutCircuitAddress) ? tapeOutCircuitAddress : null,
      circuitTxHash: validTxHash(tapeOutCircuitTxHash) ? tapeOutCircuitTxHash : null,
      tapeId: safeText(env.TAPEOUT_TAPE_ID, 32) || DEFAULT_TAPEOUT_TAPE_ID,
      rpcUrl: safeText(env.X_LAYER_RPC_URL, 200) || DEFAULT_X_LAYER_RPC_URL,
    },
  };
}

function recipeFor(contentType, rule) {
  if (rule === "自由创作") {
    // Keep the existing 3-bit TapeOut recipe space stable while allowing
    // the participant instruction itself to be free-form. The rule hash and
    // prompt remain part of the node evidence; the circuit validates the
    // generic content-type recipe plus attribution/licensing/split policy.
    return contentType === "text" ? "TEXT_TONE_SHIFT" : "IMAGE_TEXT_RHYTHM";
  }
  return RECIPE_CODES.get(`${contentType}:${rule}`) || null;
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function aiApiBaseUrl(env) {
  const configured = safeText(env.OPENAI_BASE_URL, 240) || DEFAULT_AI_API_BASE_URL;
  let url;
  try { url = new URL(configured); } catch { throw new Error("ai_endpoint_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("ai_endpoint_invalid");
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function aiModel(env, key, fallback) {
  return safeText(env[key], 100) || fallback;
}

async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256(input) {
  return sha256Bytes(new TextEncoder().encode(input));
}

export function deriveBranchFlags(nodes) {
  const firstChildByParent = new Set();
  return nodes.map(node => {
    const branch = Boolean(node.parent && firstChildByParent.has(node.parent));
    if (node.parent) firstChildByParent.add(node.parent);
    return { ...node, branch };
  });
}

async function loadNodes(env, relayId = RELAY_ID) {
  const result = await env.DB.prepare(
    "SELECT id, parent_id, creator_name, title, asset_key, content_type, mime_type, preview_text, prompt, preserve_prompt, license_code, split_bps, rule_result, content_hash, circuit_result, circuit_tx_hash, registry_tx_hash, recipe_code, circuit_input_commitment, created_at FROM nodes WHERE relay_id = ? ORDER BY created_at ASC LIMIT 250"
  ).bind(relayId).all();
  const persisted = result.results.map((row, index) => ({
    id: row.id,
    parent: row.parent_id,
    creator: row.creator_name,
    title: row.title,
    panel: index % 3,
    assetUrl: `/api/assets/${encodeURIComponent(row.asset_key)}`,
    contentType: row.content_type || "image",
    mimeType: row.mime_type || "image/webp",
    previewText: row.preview_text || null,
    prompt: row.prompt || "",
    preservePrompt: row.preserve_prompt || "",
    licenseCode: row.license_code,
    splitBps: row.split_bps,
    ruleResult: row.rule_result ? JSON.parse(row.rule_result) : null,
    contentHash: row.content_hash,
    recipeCode: row.recipe_code || null,
    circuitInputCommitment: row.circuit_input_commitment || null,
    circuitResult: row.circuit_result ? JSON.parse(row.circuit_result) : null,
    circuitTxHash: row.circuit_tx_hash || null,
    registryTxHash: row.registry_tx_hash || null,
    createdAt: row.created_at,
  }));
  return deriveBranchFlags(relayId === RELAY_ID ? [...seedNodes, ...persisted] : persisted);
}

function assetUrl(assetKey, inviteToken = "") {
  const path = `/api/assets/${encodeURIComponent(assetKey)}`;
  return inviteToken ? `${path}?invite=${encodeURIComponent(inviteToken)}` : path;
}

async function handleBootstrap(request, env, url) {
  const identity = await resolveIdentity(request, env);
  const relayId = safeText(url.searchParams.get("relay") || RELAY_ID, 80);
  const relay = relayId === RELAY_ID
    ? { id: RELAY_ID, title: "City Signal 2049", description: "从一座漂浮城市开始，每一棒只能改变一个视觉维度。", content_type: "image", access_mode: "public", allowed_wallets: "[]" }
    : await env.DB.prepare("SELECT id, title, description, content_type, owner_user_id, access_mode, allowed_wallets FROM relays WHERE id = ? AND status = 'active'").bind(relayId).first();
  if (!relay) return error("relay_not_found", "这个 Relay 不存在或已关闭。", 404);
  const inviteToken = safeText(url.searchParams.get("invite"), 80);
  const access = await authorizeRelay(request, env, relay, inviteToken);
  if (!access.allowed && relay.owner_user_id !== identity?.id) return error("relay_access_denied", "此 Seed 仅对指定钱包或有效接力链接开放。", 403);
  const nodes = await loadNodes(env, relayId);
  const invite = inviteToken ? await env.DB.prepare("SELECT token, relay_id, node_id, sender_name, recipient_hint, status, accepted_by_user_id, created_at FROM invites WHERE token = ?").bind(inviteToken).first() : null;
  const userId = identity?.id;
  const credits = userId ? await env.DB.prepare("SELECT balance, lifetime_granted, lifetime_spent FROM credit_accounts WHERE user_id = ?").bind(userId).first() : null;
  const mine = userId ? await env.DB.prepare("SELECT n.id, n.relay_id, n.parent_id, n.title, n.asset_key, n.content_type, n.mime_type, n.preview_text, n.content_hash, n.created_at, r.owner_user_id, r.access_mode, r.allowed_wallets FROM nodes n JOIN relays r ON r.id = n.relay_id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50").bind(userId).all() : { results: [] };
  const invites = userId ? await env.DB.prepare("SELECT token, relay_id, node_id, sender_name, status, accepted_at, created_at FROM invites WHERE accepted_by_user_id = ? OR sender_user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId, userId).all() : { results: [] };
  const feed = await env.DB.prepare("SELECT r.id, r.title, r.description, n.asset_key, r.created_at FROM relays r JOIN nodes n ON n.id = r.seed_node_id WHERE r.status = 'active' AND r.access_mode = 'public' ORDER BY r.created_at DESC LIMIT 24").all();
  const relayNodes = nodes.map(node => node.assetUrl.startsWith("/api/assets/") ? { ...node, assetUrl: assetUrl(decodeURIComponent(node.assetUrl.slice("/api/assets/".length)), inviteToken) } : node);
  const walletSession = await getWalletSession(request, env);
  const visibleMine = mine.results.filter(row => {
    if (row.access_mode === "public" || row.owner_user_id === userId) return true;
    if (row.access_mode === "wallets") {
      try { return Boolean(walletSession && JSON.parse(row.allowed_wallets || "[]").some(address => String(address).toLowerCase() === walletSession.address)); } catch { return false; }
    }
    return Boolean(row.access_mode === "link" && row.relay_id === relayId && inviteToken && access.allowed);
  });
  return json({
    ok: true,
    relay: { id: relay.id, title: relay.title, description: relay.description, content_type: relay.content_type, access_mode: relay.access_mode || "public", nodes: relayNodes },
    identity: identity ? { handle: identity.handle } : null,
    wallet: walletSession,
    credits: credits || { balance: 3, lifetime_granted: 3, lifetime_spent: 0 },
    mine: visibleMine.map(row => ({ ...row, assetUrl: assetUrl(row.asset_key, row.relay_id === relayId ? inviteToken : "") })),
    invites: invites.results,
    feed: feed.results.map(item => ({ ...item, coverUrl: assetUrl(item.asset_key) })),
    invite: invite ? { ...invite, canAccept: Boolean(identity && invite.status === "open" && invite.relay_id === relayId) } : null,
    integrations: {
      ai: Boolean(env.OPENAI_API_KEY),
      database: true,
      storage: true,
      xLayer: { chainId: 196, mode: chainIntegration(env).registryAddress ? "registry-configured" : "read-only", registryAddress: chainIntegration(env).registryAddress },
      tapeOut: { mode: chainIntegration(env).tapeOut.processorAddress ? "live-circuit" : "planned", ...chainIntegration(env).tapeOut },
      contentTypes: ["image", "text"],
    },
  });
}

async function handleCircuitStatus(env) {
  const integration = chainIntegration(env);
  try {
    const result = await evaluateTapeOutCircuit(env, {
      parentExists: true,
      contentTypeAllowed: true,
      ruleAllowed: true,
      attributionPreserved: true,
      licenseAccepted: true,
      splitWithinLimit: true,
      recipeCode: "TEXT_TONE_SHIFT",
    });
    return json({ ok: true, configured: true, ...result });
  } catch (caught) {
    return json({ ok: false, configured: Boolean(integration.tapeOut.processorAddress), error: { code: "tapeout_unavailable", message: safeText(caught.message, 240) }, integration: integration.tapeOut }, 503);
  }
}

async function handleCircuitEval(request, env) {
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const recipeCode = safeText(body.recipeCode || "TEXT_TONE_SHIFT", 80);
  const input = {
    parentExists: body.parentExists !== false,
    contentTypeAllowed: body.contentTypeAllowed !== false,
    ruleAllowed: body.ruleAllowed !== false,
    attributionPreserved: body.attributionPreserved !== false,
    licenseAccepted: body.licenseAccepted !== false,
    splitWithinLimit: body.splitWithinLimit !== false,
    recipeCode,
  };
  try {
    return json({ ok: true, result: await evaluateTapeOutCircuit(env, input) });
  } catch (caught) {
    return error("tapeout_unavailable", safeText(caught.message, 240), 503);
  }
}

async function resolveParentAsset(parentNodeId, relayId, env) {
  if (relayId === RELAY_ID && /^n[0-3]$/.test(parentNodeId)) return { bytes: decodeBase64(seedArtworkBase64), contentType: "image", mimeType: "image/webp", previewText: null };
  const row = await env.DB.prepare("SELECT asset_key, content_type, mime_type, preview_text FROM nodes WHERE id = ? AND relay_id = ?")
    .bind(parentNodeId, relayId).first();
  if (!row) throw new Error("parent_not_found");
  const object = await env.BUCKET.get(row.asset_key);
  if (!object) throw new Error("parent_asset_not_found");
  return { bytes: new Uint8Array(await object.arrayBuffer()), contentType: row.content_type || "image", mimeType: row.mime_type || "image/webp", previewText: row.preview_text || null };
}

export function buildImageRemixPrompt({ rule, prompt, preserve, recipeCode, direction }) {
  return [
    "Create the next artwork in a collaborative AI remix relay.",
    `The relay rule is: change only the ${rule}.`,
    `The TapeOut remix recipe is ${recipeCode}. Follow this recipe exactly.`,
    `The participant requires these elements to remain unchanged: ${preserve || "the core subject, composition, and source identity"}. Treat this as a creative instruction, not a guarantee.`,
    `Participant instruction: ${prompt}.`,
    `Candidate direction: ${direction}.`,
    rule === "文字节奏"
      ? "Typography and text rhythm are the only allowed visual dimension to change. Use the exact wording supplied in the participant instruction where wording is specified; otherwise make only a typographic rhythm variation. Keep the parent composition and subject unchanged."
      : "Do not add or alter text. Keep the parent subject, composition, and all unselected visual dimensions recognizable and unchanged.",
    "Return a polished standalone artwork with no UI, borders, watermarks, or triptych layout.",
  ].join(" ");
}

async function callImageEdit({ apiKey, apiBaseUrl, model, imageBytes, rule, prompt, preserve, recipeCode }) {
  const directions = [
    "make a restrained, subtle interpretation of the requested change",
    "make the requested change clear and expressive without changing other dimensions",
    "explore an unexpected but coherent interpretation within the requested change",
  ];
  const outputs = [];
  for (const direction of directions) {
    const form = new FormData();
    form.append("model", model);
    form.append("image", new File([imageBytes], "parent.webp", { type: "image/webp" }));
    form.append("prompt", buildImageRemixPrompt({ rule, prompt, preserve, recipeCode, direction }));
    form.append("size", "1024x1024");
    form.append("quality", "low");
    form.append("output_format", "webp");

    const response = await fetch(`${apiBaseUrl}/images/edits`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const payload = await response.json();
    if (!response.ok || !payload.data?.[0]?.b64_json) {
      throw new Error(payload.error?.message || `image_provider_${response.status}`);
    }
    const bytes = decodeBase64(payload.data[0].b64_json);
    outputs.push({ bytes, contentHash: await sha256Bytes(bytes), revisedPrompt: payload.data[0].revised_prompt || null });
  }
  return outputs;
}

export function buildTextRemixPrompt({ sourceText, rule, prompt, preserve, recipeCode, direction }) {
  return `父作品：\n${sourceText}\n\n必须保留：${preserve || "核心主题、关键事实与父作品来源"}\n接力规则：${rule === "自由创作" ? "按用户意图创作，但保留指定内容和父作品来源" : `只改变${rule}`}。\nTapeOut Remix Recipe：${recipeCode}\n本轮意图：${prompt}\n候选方向：${direction}\n\n只输出可直接发布的作品，不要解释。语义保留要求由模型执行，TapeOut Circuit 不会检查作品是否满足。`;
}

async function callTextRemix({ apiKey, apiBaseUrl, model, sourceText, rule, prompt, preserve, recipeCode }) {
  const directions = [
    "克制延展：以尽可能小的改动呈现本棒变化",
    "强化表达：让本棒变化更清晰鲜明，不改其他维度",
    "意外分支：在本棒规则范围内寻找不同但合理的表达",
  ];
  const outputs = [];
  for (const direction of directions) {
    const response = await fetch(`${apiBaseUrl}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: "你是 AI Remix Relay 的文字接力编辑。每次只改变用户指定的维度，输出可直接发布的纯文本，不要解释过程，不要加引号。" },
          { role: "user", content: buildTextRemixPrompt({ sourceText, rule, prompt, preserve, recipeCode, direction }) },
        ],
        max_output_tokens: 700,
      }),
    });
    const payload = await response.json();
    const text = payload.output_text?.trim();
    if (!response.ok || !text) throw new Error(payload.error?.message || `text_provider_${response.status}`);
    const bytes = new TextEncoder().encode(text);
    outputs.push({ bytes, contentHash: await sha256Bytes(bytes), revisedPrompt: direction, contentType: "text", mimeType: "text/plain; charset=utf-8", previewText: text.slice(0, 280) });
  }
  return outputs;
}

async function reserveCredit(env, userId, referenceId) {
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO credit_accounts (user_id, balance, lifetime_granted, lifetime_spent, updated_at) VALUES (?, 3, 3, 0, ?)").bind(userId, now).run();
  const result = await env.DB.prepare("UPDATE credit_accounts SET balance = balance - 1, lifetime_spent = lifetime_spent + 1, updated_at = ? WHERE user_id = ? AND balance >= 1").bind(now, userId).run();
  if (!result.meta?.changes) return false;
  await env.DB.prepare("INSERT INTO credit_entries (id, user_id, amount, kind, reference_id, note, created_at) VALUES (?, ?, -1, 'generation', ?, 'AI remix generation', ?)").bind(crypto.randomUUID(), userId, referenceId, now).run();
  return true;
}

async function refundCredit(env, userId, referenceId) {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE credit_accounts SET balance = balance + 1, lifetime_spent = CASE WHEN lifetime_spent > 0 THEN lifetime_spent - 1 ELSE 0 END, updated_at = ? WHERE user_id = ?").bind(now, userId),
    env.DB.prepare("INSERT INTO credit_entries (id, user_id, amount, kind, reference_id, note, created_at) VALUES (?, ?, 1, 'refund', ?, 'Provider failure refund', ?)").bind(crypto.randomUUID(), userId, referenceId, now),
  ]);
}

async function handleGenerate(request, env) {
  if (!env.OPENAI_API_KEY) {
    return error("provider_not_configured", "真实 AI 生成尚未配置。请由站点所有者添加 OPENAI_API_KEY Secret。", 503);
  }
  let apiBaseUrl;
  try { apiBaseUrl = aiApiBaseUrl(env); } catch { return error("provider_configuration_invalid", "AI 服务端点配置无效。请检查 HTTPS 地址和路径。", 503); }
  const identity = await resolveIdentity(request, env);
  if (!identity) return error("authentication_required", "请先登录后再生成作品。", 401);
  let body;
  try { body = await readJson(request); } catch (caught) {
    return error(caught.message === "payload_too_large" ? "payload_too_large" : "invalid_json", "请求内容无效。", 400);
  }
  const parentNodeId = safeText(body.parentNodeId, 80);
  const relayId = safeText(body.relayId || RELAY_ID, 80);
  const inviteToken = safeText(body.inviteToken, 80);
  const rule = safeText(body.rule, 40);
  const prompt = safeText(body.prompt, 500);
  const preserve = safeText(body.preserve, 220);
  const requestedContentType = safeText(body.contentType || "", 20);
  const licenseCode = safeText(body.licenseCode || "CC-BY-NC-4.0", 40);
  const splitBps = Number(body.splitBps ?? 0);
  const imageModel = aiModel(env, "OPENAI_IMAGE_MODEL", "gpt-image-2.5-flare");
  const textModel = aiModel(env, "OPENAI_TEXT_MODEL", "gpt-5-mini");
  const idempotencyKey = safeText(body.idempotencyKey, 80);
  if (!parentNodeId || !ALLOWED_RULES.has(rule) || prompt.length < 4 || !idempotencyKey || !ALLOWED_LICENSES.has(licenseCode) || !Number.isInteger(splitBps) || splitBps < 0 || splitBps > 3000) return error("invalid_input", "父节点、规则、创作意图、授权或分成设置无效。", 422);
  const relay = relayId === RELAY_ID ? { id: RELAY_ID, access_mode: "public", allowed_wallets: "[]" } : await env.DB.prepare("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays WHERE id = ? AND status = 'active'").bind(relayId).first();
  const access = await authorizeRelay(request, env, relay, inviteToken);
  if (!access.allowed && relay?.owner_user_id !== identity.id) return error("relay_access_denied", "没有权限继续这个 Seed。", 403);
  const previous = await env.DB.prepare("SELECT id, status FROM generations WHERE user_id = ? AND idempotency_key = ?").bind(identity.id, idempotencyKey).first();
  if (previous) {
    if (previous.status !== "completed") return error("generation_in_progress", "同一请求正在处理或已经失败，请重新生成。", 409);
    const stored = await env.DB.prepare("SELECT id, ordinal, asset_key, content_type FROM candidates WHERE generation_id = ? ORDER BY ordinal").bind(previous.id).all();
    const generation = await env.DB.prepare("SELECT content_type, circuit_result FROM generations WHERE id = ?").bind(previous.id).first();
    const candidateRows = await env.DB.prepare("SELECT id, ordinal, asset_key, content_type, content_hash, recipe_code, circuit_input_commitment FROM candidates WHERE generation_id = ? ORDER BY ordinal").bind(previous.id).all();
    return json({ ok: true, generationId: previous.id, duplicate: true, candidates: candidateRows.results.map(row => ({ id: row.id, ordinal: row.ordinal, contentType: row.content_type || generation?.content_type || "image", contentHash: row.content_hash, recipeCode: row.recipe_code || null, circuitInputCommitment: row.circuit_input_commitment || null, assetUrl: assetUrl(row.asset_key, inviteToken) })), circuitResult: generation?.circuit_result ? JSON.parse(generation.circuit_result) : null });
  }
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM generations WHERE user_id = ? AND created_at >= ?").bind(identity.id, new Date(Date.now() - 60_000).toISOString()).first();
  if (Number(recent?.count || 0) >= 2) return error("rate_limited", "生成过于频繁，请一分钟后再试。", 429);

  let parentAsset;
  try { parentAsset = await resolveParentAsset(parentNodeId, relayId, env); }
  catch { return error("parent_not_found", "父节点或其作品不存在。", 404); }

  const contentType = parentAsset.contentType;
  if (requestedContentType && requestedContentType !== contentType) return error("content_type_mismatch", "本轮内容类型必须与父节点一致。", 422);
  const recipeCode = recipeFor(contentType, rule);
  if (!recipeCode) return error("recipe_not_found", "当前内容类型没有可用的 Remix Recipe。", 422);
  const circuitInput = { parentExists: true, contentTypeAllowed: ALLOWED_CONTENT_TYPES.has(contentType), ruleAllowed: true, attributionPreserved: true, licenseAccepted: ALLOWED_LICENSES.has(licenseCode), splitWithinLimit: splitBps >= 0 && splitBps <= 3000, contentType, rule, recipeCode };
  let circuitResult;
  try {
    circuitResult = await evaluateTapeOutCircuit(env, circuitInput);
  } catch (caught) {
    return error("tapeout_unavailable", "无法读取 X Layer TapeOut Circuit，本次不会调用 AI 或扣除 Credit。请稍后重试。", 503, { reason: safeText(caught.message, 200) });
  }
  if (!circuitResult.passed) {
    return error("circuit_rejected", "TapeOut Circuit 未放行本轮挑战；尚未调用 AI，也没有扣除 Credit。", 422, { circuitResult, input: circuitInput });
  }
  const circuitInputCommitment = await sha256(JSON.stringify(circuitInput));
  const generationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO generations (id, user_id, relay_id, parent_node_id, rule, prompt, preserve_prompt, content_type, recipe_code, circuit_input_commitment, created_at, idempotency_key, status, circuit_result, license_code, split_bps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)").bind(generationId, identity.id, relayId, parentNodeId, rule, prompt, preserve, contentType, circuitResult.recipeCode, circuitInputCommitment, createdAt, idempotencyKey, JSON.stringify(circuitResult), licenseCode, splitBps).run();
  const reserved = await reserveCredit(env, identity.id, generationId);
  if (!reserved) { await env.DB.prepare("UPDATE generations SET status = 'failed', error_message = 'insufficient_credits' WHERE id = ?").bind(generationId).run(); return error("insufficient_credits", "免费额度已用完，请补充 Credits 后继续。", 402); }
  let generated;
  try {
    generated = parentAsset.contentType === "text"
      ? await callTextRemix({ apiKey: env.OPENAI_API_KEY, apiBaseUrl, model: textModel, sourceText: new TextDecoder().decode(parentAsset.bytes), rule, prompt, preserve, recipeCode: circuitResult.recipeCode })
      : await callImageEdit({ apiKey: env.OPENAI_API_KEY, apiBaseUrl, model: imageModel, imageBytes: parentAsset.bytes, rule, prompt, preserve, recipeCode: circuitResult.recipeCode });
  }
  catch (caught) { await refundCredit(env, identity.id, generationId); await env.DB.prepare("UPDATE generations SET status = 'failed', error_message = ? WHERE id = ?").bind(safeText(caught.message, 180), generationId).run(); return error("generation_failed", "AI 生成失败，本次 Credit 已自动退回。", 502); }

  const candidates = [];
  const storedKeys = [];
  try {
    for (let index = 0; index < generated.length; index += 1) {
      const id = crypto.randomUUID();
      const item = generated[index];
      const extension = item.contentType === "text" ? "txt" : "webp";
      const assetKey = `relays/${relayId}/generations/${generationId}/${index}.${extension}`;
      await env.BUCKET.put(assetKey, item.bytes, { httpMetadata: { contentType: item.mimeType || "image/webp" } }); storedKeys.push(assetKey);
      await env.DB.prepare("INSERT INTO candidates (id, generation_id, ordinal, asset_key, revised_prompt, created_at, content_hash, content_type, recipe_code, circuit_input_commitment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, generationId, index, assetKey, item.revisedPrompt, createdAt, item.contentHash, item.contentType || "image", circuitResult.recipeCode, circuitInputCommitment).run();
      candidates.push({ id, ordinal: index, contentType: item.contentType || "image", contentHash: item.contentHash, recipeCode: circuitResult.recipeCode, circuitInputCommitment, previewText: item.previewText || null, assetUrl: assetUrl(assetKey, inviteToken) });
    }
    await env.DB.prepare("UPDATE generations SET status = 'completed' WHERE id = ?").bind(generationId).run();
  } catch {
    await Promise.all(storedKeys.map(key => env.BUCKET.delete(key))); await refundCredit(env, identity.id, generationId); await env.DB.prepare("UPDATE generations SET status = 'failed', error_message = 'storage_failure' WHERE id = ?").bind(generationId).run(); return error("storage_failed", "作品保存失败，本次 Credit 已自动退回。", 503);
  }
  const account = await env.DB.prepare("SELECT balance, lifetime_granted, lifetime_spent FROM credit_accounts WHERE user_id = ?").bind(identity.id).first();
  return json({ ok: true, generationId, candidates, credits: account, circuitResult }, 201);
}

async function handleAssist(request, env) {
  if (!env.OPENAI_API_KEY) return error("provider_not_configured", "真实 AI 助手尚未配置。", 503);
  let apiBaseUrl;
  try { apiBaseUrl = aiApiBaseUrl(env); } catch { return error("provider_configuration_invalid", "AI 服务端点配置无效。", 503); }
  const identity = await resolveIdentity(request, env);
  if (!identity) return error("authentication_required", "请先登录后使用 AI 工作台。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const message = safeText(body.message, 8000);
  if (message.length < 2) return error("invalid_input", "请先描述你希望完成的任务。", 422);
  const history = Array.isArray(body.history) ? body.history.slice(-8).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: safeText(item?.content, 4000),
  })).filter(item => item.content) : [];
  const contentType = safeText(body.contentType, 20);
  const parentTitle = safeText(body.parentTitle, 120);
  const system = [
    "你是 AI Remix Relay 的创作搭档，帮助用户从现有 Seed 或父作品继续创作图片与文字。",
    "给出具体、可执行的创作方向；尊重用户指定的变化规则，不要要求用户从空白提示词开始。",
    "保留用户明确要求延续的主题、角色、语气或视觉元素；不要声称你已生成、发布或验证作品。",
    "不要替用户执行链上交易、改变授权、替代 TapeOut Circuit 判定或声称完成链上操作。",
    "回答直接、专业、易懂；避免空泛建议。",
  ].join("\n");
  const response = await fetch(`${apiBaseUrl}/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: aiModel(env, "OPENAI_TEXT_MODEL", "gpt-5-mini"),
      input: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: [`内容类型：${contentType || "未指定"}`, `父作品：${parentTitle || "未指定"}`, `创作需求：${message}`].join("\n") },
      ],
      max_output_tokens: 900,
    }),
  });
  const payload = await response.json();
  const reply = payload.output_text?.trim();
  if (!response.ok || !reply) return error("assistant_failed", payload.error?.message || `assistant_provider_${response.status}`, 502);
  return json({ ok: true, reply, actions: [] }, 200);
}

async function handlePublish(request, env) {
  const identity = await resolveIdentity(request, env);
  if (!identity) return error("authentication_required", "请先登录后再发布。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const candidateId = safeText(body.candidateId, 80);
  const inviteToken = safeText(body.inviteToken, 80);
  const licenseCode = safeText(body.licenseCode || "CC-BY-NC-4.0", 40);
  const splitBps = Number(body.splitBps ?? 0);
  const submittedCircuitResult = body.circuitResult && typeof body.circuitResult === "object" ? body.circuitResult : null;
  const circuitTxHash = safeText(body.circuitTxHash, 80) || null;
  const registryTxHash = safeText(body.registryTxHash, 80) || null;
  if (!candidateId || !ALLOWED_LICENSES.has(licenseCode) || !Number.isInteger(splitBps) || splitBps < 0 || splitBps > 3000) return error("invalid_publication", "候选作品、授权方式或分成比例无效。", 422);
  if ((circuitTxHash && !validTxHash(circuitTxHash)) || (registryTxHash && !validTxHash(registryTxHash))) return error("invalid_chain_proof", "Circuit 或 Registry 交易哈希格式无效。", 422);
  const duplicate = await env.DB.prepare("SELECT id, relay_id, parent_id, creator_name, title, asset_key, content_hash, license_code, split_bps, rule_result FROM nodes WHERE candidate_id = ?").bind(candidateId).first();
  if (duplicate) {
    const duplicateRelay = duplicate.relay_id === RELAY_ID ? { id: RELAY_ID, access_mode: "public", allowed_wallets: "[]" } : await env.DB.prepare("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays WHERE id = ? AND status = 'active'").bind(duplicate.relay_id).first();
    const duplicateAccess = await authorizeRelay(request, env, duplicateRelay, inviteToken);
    if (!duplicateAccess.allowed && duplicateRelay?.owner_user_id !== identity.id) return error("relay_access_denied", "没有权限查看这个作品。", 403);
    return json({ ok: true, duplicate: true, node: { id: duplicate.id, parent: duplicate.parent_id, creator: duplicate.creator_name, title: duplicate.title, assetUrl: assetUrl(duplicate.asset_key, inviteToken), contentHash: duplicate.content_hash, licenseCode: duplicate.license_code, splitBps: duplicate.split_bps, ruleResult: duplicate.rule_result ? JSON.parse(duplicate.rule_result) : null } });
  }
  const candidate = await env.DB.prepare(
    "SELECT c.id, c.asset_key, c.content_hash, c.content_type, c.recipe_code, c.circuit_input_commitment, c.generation_id, g.relay_id, g.parent_node_id, g.rule, g.prompt, g.preserve_prompt, g.circuit_result AS generation_circuit_result, g.license_code AS generation_license_code, g.split_bps AS generation_split_bps FROM candidates c JOIN generations g ON g.id = c.generation_id WHERE c.id = ? AND g.user_id = ? AND c.selected = 0"
  ).bind(candidateId, identity.id).first();
  if (!candidate) return error("candidate_not_found", "候选作品不存在，或不属于当前用户。", 404);
  if (candidate.generation_license_code !== licenseCode || Number(candidate.generation_split_bps) !== splitBps) return error("challenge_policy_changed", "授权或分成设置与生成前通过的 Circuit 挑战不一致。请按原设置发布，或重新生成候选。", 409);
  const relay = candidate.relay_id === RELAY_ID ? { id: RELAY_ID, access_mode: "public", allowed_wallets: "[]" } : await env.DB.prepare("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays WHERE id = ? AND status = 'active'").bind(candidate.relay_id).first();
  const access = await authorizeRelay(request, env, relay, inviteToken);
  if (!access.allowed && relay?.owner_user_id !== identity.id) return error("relay_access_denied", "没有权限发布到这个 Seed。", 403);

  const circuitInput = buildCircuitInput(candidate, licenseCode, splitBps);
  let circuitResult;
  try {
    circuitResult = await evaluateTapeOutCircuit(env, circuitInput);
  } catch (caught) {
    return error("tapeout_unavailable", "无法读取 X Layer TapeOut Circuit，请稍后重试；本次不会产生链上费用。", 503, { reason: safeText(caught.message, 200) });
  }
  if (!circuitResult.passed) {
    return error("circuit_rejected", "TapeOut Circuit 未通过本次发布条件，作品不会被发布。", 422, { circuitResult, input: circuitInput });
  }
  if (circuitResult.recipeCode !== candidate.recipe_code) return error("circuit_recipe_mismatch", "Circuit 配方与已生成候选不一致，作品不会被发布。", 422, { circuitResult });

  if (registryTxHash) {
    const integration = chainIntegration(env);
    if (!integration.registryAddress) return error("registry_not_configured", "当前环境未配置 RelayRegistry，不能验证这笔链上交易。", 503);
    const creator = await resolveIdentity(request, env);
    const ruleHash = await sha256(`${candidate.rule}|${licenseCode}|${splitBps}`);
    const recipeHash = await sha256(candidate.recipe_code || "UNKNOWN_RECIPE");
    const expected = {
      registryAddress: integration.registryAddress,
      relayHash: await sha256(candidate.relay_id),
      parentHash: await sha256(candidate.parent_node_id),
      creatorAddress: creator?.id?.startsWith("wallet:0x") ? creator.id.slice(7) : null,
      dataWords: [candidate.content_hash, ruleHash, candidate.circuit_input_commitment, recipeHash, candidate.content_type === "text" ? "02" : "01", splitBps.toString(16)],
    };
    let verification;
    try {
      verification = await verifyRegistryTransaction(env, registryTxHash, expected);
    } catch {
      return error("registry_receipt_unavailable", "暂时无法读取 X Layer 交易回执。节点尚未发布，请稍后重试并使用同一笔交易。", 503);
    }
    if (verification === null) return error("registry_receipt_pending", "X Layer 尚未确认这笔交易。节点暂未发布；请稍后使用同一笔交易重试。", 503);
    if (!verification) return error("registry_receipt_mismatch", "这笔交易未能证明当前 Relay 的父子作品关系；节点尚未发布。请确认交易已成功并来自本次发布。", 422);
  }

  const nodeId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const ruleResult = {
    ...circuitResult,
    generationCircuitResult: candidate.generation_circuit_result ? JSON.parse(candidate.generation_circuit_result) : null,
    rule: candidate.rule,
    inputCommitment: candidate.circuit_input_commitment,
    submittedResultAccepted: Boolean(submittedCircuitResult),
  };
  const receiptHash = await sha256(JSON.stringify({ relayId: candidate.relay_id, nodeId, parentId: candidate.parent_node_id, contentHash: candidate.content_hash, licenseCode, splitBps, ruleResult, createdAt }));
  const siblings = await env.DB.prepare("SELECT COUNT(*) AS count FROM nodes WHERE relay_id = ? AND parent_id = ?").bind(candidate.relay_id, candidate.parent_node_id).first();
  await env.DB.batch([
    env.DB.prepare("UPDATE candidates SET selected = 1 WHERE id = ? AND selected = 0").bind(candidateId),
    env.DB.prepare(
      "INSERT INTO nodes (id, relay_id, parent_id, user_id, creator_name, title, rule, prompt, preserve_prompt, asset_key, receipt_hash, created_at, candidate_id, license_code, split_bps, rule_result, content_hash, content_type, mime_type, preview_text, circuit_result, circuit_tx_hash, registry_tx_hash, recipe_code, circuit_input_commitment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(nodeId, candidate.relay_id, candidate.parent_node_id, identity.id, identity.handle, candidate.rule, candidate.rule, candidate.prompt, candidate.preserve_prompt || "", candidate.asset_key, receiptHash, createdAt, candidateId, licenseCode, splitBps, JSON.stringify(ruleResult), candidate.content_hash, candidate.content_type || "image", candidate.content_type === "text" ? "text/plain; charset=utf-8" : "image/webp", null, JSON.stringify(ruleResult), circuitTxHash, registryTxHash, candidate.recipe_code || null, candidate.circuit_input_commitment || null),
  ]);
  return json({
    ok: true,
    node: { id: nodeId, parent: candidate.parent_node_id, creator: identity.handle, title: candidate.rule, panel: 0, branch: Number(siblings?.count || 0) > 0, contentType: candidate.content_type || "image", assetUrl: assetUrl(candidate.asset_key, inviteToken), contentHash: candidate.content_hash, licenseCode, splitBps, ruleResult, recipeCode: candidate.recipe_code || null, circuitInputCommitment: candidate.circuit_input_commitment || null, circuitTxHash, registryTxHash },
    receipt: { hash: receiptHash, createdAt, storage: "D1 + R2", chain: registryTxHash ? "xlayer" : "not-submitted", circuit: circuitTxHash ? "xlayer" : "not-submitted", registryTxHash, circuitTxHash },
  }, 201);
}

async function handleCreateSeed(request, env) {
  const identity = await resolveIdentity(request, env);
  if (!identity) return error("authentication_required", "请先登录后再发起 Seed。", 401);
  let form;
  try { form = await request.formData(); } catch { return error("invalid_form", "上传内容无法解析。", 400); }
  const contentType = safeText(form.get("contentType") || "image", 20);
  const file = form.get("artwork");
  const text = safeText(form.get("textContent"), 10_000);
  const title = safeText(form.get("title"), 80);
  const description = safeText(form.get("description"), 280);
  const licenseCode = safeText(form.get("licenseCode") || "CC-BY-NC-4.0", 40);
  const splitBps = Number(form.get("splitBps") || 0);
  const accessMode = safeText(form.get("accessMode") || "public", 20);
  const ownerWallet = safeText(form.get("ownerWallet"), 42).toLowerCase();
  let allowedWallets = [];
  try { allowedWallets = JSON.parse(String(form.get("allowedWallets") || "[]")); } catch { return error("invalid_wallet_list", "钱包白名单格式无效。", 422); }
  if (!Array.isArray(allowedWallets) || allowedWallets.length > 50 || allowedWallets.some(wallet => !/^0x[0-9a-f]{40}$/i.test(String(wallet)))) return error("invalid_wallet_list", "最多添加 50 个有效钱包地址。", 422);
  if (!["public", "wallets", "link"].includes(accessMode)) return error("invalid_access_mode", "Seed 访问方式无效。", 422);
  if (accessMode !== "public") {
    const session = await getWalletSession(request, env);
    if (!session || session.address !== ownerWallet) return error("wallet_required", "私密 Seed 需要先连接并签名验证创建者钱包。", 401);
  }
  if (accessMode === "wallets" && !allowedWallets.some(wallet => String(wallet).toLowerCase() === ownerWallet)) allowedWallets.push(ownerWallet);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) return error("invalid_content_type", "暂时支持图片和文字两种内容类型。", 422);
  if (contentType === "image" && (!(file instanceof File) || file.size < 1 || file.size > 8_000_000)) return error("invalid_file", "请选择不超过 8 MB 的 PNG、JPEG 或 WebP 图片。", 422);
  if (contentType === "image" && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return error("invalid_file_type", "仅支持 PNG、JPEG 或 WebP。", 422);
  if (contentType === "text" && text.length < 10) return error("invalid_text", "文字 Seed 至少需要 10 个字符。", 422);
  if (title.length < 2 || !ALLOWED_LICENSES.has(licenseCode) || !Number.isInteger(splitBps) || splitBps < 0 || splitBps > 3000) return error("invalid_seed", "标题、授权或分成比例无效。", 422);
  const bytes = contentType === "text" ? new TextEncoder().encode(text) : new Uint8Array(await file.arrayBuffer());
  const contentHash = await sha256Bytes(bytes);
  const relayId = crypto.randomUUID();
  const nodeId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const extension = contentType === "text" ? "txt" : file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const assetKey = `relays/${relayId}/seed/${nodeId}.${extension}`;
  const mimeType = contentType === "text" ? "text/plain; charset=utf-8" : file.type;
  const ruleResult = { engine: "seed-policy", version: 1, passed: true, attributionPreserved: true, tapeOutCircuit: "pending" };
  const receiptHash = await sha256(JSON.stringify({ relayId, nodeId, contentHash, licenseCode, splitBps, createdAt }));
  await env.BUCKET.put(assetKey, bytes, { httpMetadata: { contentType: mimeType } });
  const inviteToken = accessMode === "link" ? crypto.randomUUID() : null;
  const inviteExpiresHours = Number(form.get("inviteExpiresHours") || 72);
  const lockFirstWallet = form.get("lockFirstWallet") === "true";
  if (accessMode === "link" && ![1, 24, 72, 168, 0].includes(inviteExpiresHours)) {
    await env.BUCKET.delete(assetKey);
    return error("invalid_invite_expiry", "接力链接有效期选项无效。", 422);
  }
  const inviteExpiresAt = accessMode === "link" && inviteExpiresHours ? new Date(Date.now() + inviteExpiresHours * 60 * 60_000).toISOString() : null;
  try {
    const statements = [
      env.DB.prepare("INSERT INTO relays (id, owner_user_id, title, description, seed_node_id, status, created_at, content_type, access_mode, owner_wallet, allowed_wallets) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)").bind(relayId, identity.id, title, description, nodeId, createdAt, contentType, accessMode, ownerWallet || null, JSON.stringify(allowedWallets.map(wallet => String(wallet).toLowerCase()))),
      env.DB.prepare("INSERT INTO nodes (id, relay_id, parent_id, user_id, creator_name, title, rule, prompt, asset_key, receipt_hash, created_at, license_code, split_bps, rule_result, content_hash, content_type, mime_type, preview_text) VALUES (?, ?, NULL, ?, ?, ?, 'Seed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(nodeId, relayId, identity.id, identity.handle, title, description, assetKey, receiptHash, createdAt, licenseCode, splitBps, JSON.stringify(ruleResult), contentHash, contentType, mimeType, contentType === "text" ? text.slice(0, 280) : null),
    ];
    if (inviteToken) statements.push(env.DB.prepare("INSERT INTO invites (id, token, relay_id, node_id, sender_user_id, sender_name, status, created_at, expires_at, lock_first_wallet) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)").bind(crypto.randomUUID(), inviteToken, relayId, nodeId, identity.id, identity.handle, createdAt, inviteExpiresAt, lockFirstWallet ? 1 : 0));
    await env.DB.batch(statements);
  } catch (caught) {
    await env.BUCKET.delete(assetKey);
    throw caught;
  }
  const inviteUrl = inviteToken ? `${new URL(request.url).origin}${new URL(request.url).pathname}?relay=${encodeURIComponent(relayId)}&node=${encodeURIComponent(nodeId)}&invite=${encodeURIComponent(inviteToken)}` : null;
  return json({ ok: true, relay: { id: relayId, title, description, contentType, accessMode }, node: { id: nodeId, creator: identity.handle, title, contentType, previewText: contentType === "text" ? text.slice(0, 280) : null, assetUrl: assetUrl(assetKey), licenseCode, splitBps, contentHash }, invite: inviteToken ? { token: inviteToken, url: inviteUrl, expiresAt: inviteExpiresAt, lockFirstWallet } : null }, 201);
}

async function handleCreateInvite(request, env, url) {
  const identity = await resolveIdentity(request, env);
  if (!identity) return error("authentication_required", "请先登录后再发出邀请。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const relayId = safeText(body.relayId || RELAY_ID, 80);
  const nodeId = safeText(body.nodeId, 80);
  const recipientHint = safeText(body.recipientHint, 120) || null;
  const expiresInHours = Number(body.expiresInHours || 0);
  const lockFirstWallet = body.lockFirstWallet === true;
  if (![0, 1, 6, 24, 72, 168].includes(expiresInHours)) return error("invalid_invite_expiry", "邀请有效期选项无效。", 422);
  const relay = relayId === RELAY_ID ? { id: RELAY_ID, access_mode: "public", allowed_wallets: "[]" } : await env.DB.prepare("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays WHERE id = ? AND status = 'active'").bind(relayId).first();
  const access = await authorizeRelay(request, env, relay, safeText(body.inviteToken, 80));
  if (!relay || (!access.allowed && relay.owner_user_id !== identity.id)) return error("relay_access_denied", "只有 Relay 创建者或获准的钱包可以发出接力链接。", 403);
  if (relay.access_mode === "wallets") return error("invites_disabled", "指定钱包模式请直接授权钱包地址，不能通过链接扩大访问范围。", 409);
  const exists = relayId === RELAY_ID && /^n[0-3]$/.test(nodeId) ? true : Boolean(await env.DB.prepare("SELECT id FROM nodes WHERE id = ? AND relay_id = ?").bind(nodeId, relayId).first());
  if (!exists) return error("node_not_found", "无法为不存在的节点创建邀请。", 404);
  const token = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60_000).toISOString() : null;
  await env.DB.prepare("INSERT INTO invites (id, token, relay_id, node_id, sender_user_id, sender_name, recipient_hint, status, created_at, expires_at, lock_first_wallet) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)").bind(crypto.randomUUID(), token, relayId, nodeId, identity.id, identity.handle, recipientHint, createdAt, expiresAt, lockFirstWallet ? 1 : 0).run();
  return json({ ok: true, invite: { token, status: "open", expiresAt, lockFirstWallet, url: `${url.origin}${url.pathname}?relay=${encodeURIComponent(relayId)}&node=${encodeURIComponent(nodeId)}&invite=${encodeURIComponent(token)}` } }, 201);
}

async function handleAcceptInvite(request, env) {
  const identity = await resolveIdentity(request, env);
  if (!identity) return error("authentication_required", "请先登录后再接受接力。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const token = safeText(body.token, 80);
  const invite = await env.DB.prepare("SELECT i.relay_id, i.status, i.expires_at, i.lock_first_wallet, i.bound_wallet, r.access_mode FROM invites i JOIN relays r ON r.id = i.relay_id WHERE i.token = ?").bind(token).first();
  if (!invite || invite.status !== "open" || (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())) return error("invite_unavailable", "邀请不存在、已过期或已被接受。", 409);
  const session = await getWalletSession(request, env);
  if ((invite.access_mode !== "public" || invite.lock_first_wallet) && !session) return error("wallet_required", "接受此接力前请先连接并验证钱包。", 401);
  const now = new Date().toISOString();
  const reusableLink = invite.access_mode === "link";
  const result = reusableLink
    ? await env.DB.prepare("UPDATE invites SET accepted_by_user_id = COALESCE(accepted_by_user_id, ?), accepted_at = COALESCE(accepted_at, ?), bound_wallet = CASE WHEN lock_first_wallet = 1 AND bound_wallet IS NULL THEN ? ELSE bound_wallet END WHERE token = ? AND status = 'open' AND (expires_at IS NULL OR expires_at > ?) AND (lock_first_wallet = 0 OR bound_wallet IS NULL OR bound_wallet = ?)").bind(identity.id, now, session.address, token, now, session.address).run()
    : await env.DB.prepare("UPDATE invites SET status = 'accepted', accepted_by_user_id = ?, accepted_at = ? WHERE token = ? AND status = 'open' AND (expires_at IS NULL OR expires_at > ?)").bind(identity.id, now, token, now).run();
  if (!result.meta?.changes) return error("invite_unavailable", "邀请不存在或已被接受。", 409);
  return json({ ok: true, status: "accepted", acceptedAt: now });
}

async function handleAsset(request, url, env) {
  let key;
  try { key = decodeURIComponent(url.pathname.slice("/api/assets/".length)); } catch { return new Response("Not found", { status: 404 }); }
  if (!key.startsWith("relays/")) return new Response("Not found", { status: 404 });
  const node = await env.DB.prepare("SELECT relay_id FROM nodes WHERE asset_key = ?").bind(key).first();
  const candidate = node ? null : await env.DB.prepare("SELECT g.relay_id FROM candidates c JOIN generations g ON g.id = c.generation_id WHERE c.asset_key = ?").bind(key).first();
  const relayId = node?.relay_id || candidate?.relay_id;
  if (!relayId) return new Response("Not found", { status: 404 });
  const relay = relayId === RELAY_ID ? { id: RELAY_ID, access_mode: "public", allowed_wallets: "[]" } : await env.DB.prepare("SELECT id, owner_user_id, access_mode, allowed_wallets FROM relays WHERE id = ? AND status = 'active'").bind(relayId).first();
  const identity = await resolveIdentity(request, env);
  const access = await authorizeRelay(request, env, relay, safeText(url.searchParams.get("invite"), 80));
  if (!access.allowed && relay?.owner_user_id !== identity?.id) return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", relay.access_mode === "public" ? "public, max-age=31536000, immutable" : "no-store");
  headers.set("referrer-policy", "no-referrer");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && !isSameOrigin(request)) return error("invalid_origin", "请求来源无效。", 403);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "referrer-policy": "no-referrer" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/relay-triptych.webp") {
      return new Response(decodeBase64(seedArtworkBase64), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (request.method === "GET" && url.pathname === "/api/bootstrap") return handleBootstrap(request, env, url);
    if (request.method === "POST" && url.pathname === "/api/wallet/challenge") return handleWalletChallenge(request, env);
    if (request.method === "POST" && url.pathname === "/api/wallet/verify") return handleWalletVerify(request, env);
    if (request.method === "GET" && url.pathname === "/api/circuit/status") return handleCircuitStatus(env);
    if (request.method === "POST" && url.pathname === "/api/circuit/eval") return handleCircuitEval(request, env);
    if (request.method === "POST" && url.pathname === "/api/generate") return handleGenerate(request, env);
    if (request.method === "POST" && url.pathname === "/api/assist") return handleAssist(request, env);
    if (request.method === "POST" && url.pathname === "/api/nodes") return handlePublish(request, env);
    if (request.method === "POST" && url.pathname === "/api/seeds") return handleCreateSeed(request, env);
    if (request.method === "POST" && url.pathname === "/api/invites") return handleCreateInvite(request, env, url);
    if (request.method === "POST" && url.pathname === "/api/invites/accept") return handleAcceptInvite(request, env);
    if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) return handleAsset(request, url, env);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "ai-remix-relay", version: 2 });
    return new Response("Not found", { status: 404 });
  },
};
