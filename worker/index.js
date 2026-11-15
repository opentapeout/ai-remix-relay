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

const DEFAULT_X_LAYER_RPC_URL = "https://rpc.xlayer.tech";
const DEFAULT_TAPEOUT_PROCESSOR_ADDRESS = "0x9e2849c04a513fe64db07521cbe52d078d905c0e";
const DEFAULT_TAPEOUT_CIRCUIT_ID = 5;
const DEFAULT_TAPEOUT_TAPE_ID = "5.2.414";
const TAPEOUT_SELECTORS = {
  circuitInfo: "0x084d60f1",
  eval: "0x934d06ea",
};

function hexWord(value) {
  const numeric = typeof value === "bigint" ? value : BigInt(value);
  return numeric.toString(16).padStart(64, "0");
}

function stripHex(value) {
  return String(value || "").replace(/^0x/i, "");
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
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    const detail = payload.error?.message || `rpc_http_${response.status}`;
    throw new Error(`xlayer_rpc_${detail}`);
  }
  return payload.result;
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
  return { allow: Boolean(byte & 1), recipeBits, recipeIndex, outputByte: `0x${byte.toString(16).padStart(2, "0")}` };
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
  const blockNumber = await xLayerRpc(env, "eth_blockNumber", []);
  return {
    engine: "tapeout-circuit",
    version: 1,
    passed: decoded.allow,
    chainId: 196,
    processorAddress,
    circuitId,
    tapeId: safeText(env.TAPEOUT_TAPE_ID, 32) || DEFAULT_TAPEOUT_TAPE_ID,
    inputBytes,
    outputBytes,
    circuitInfo,
    allow: decoded.allow,
    recipeBits: decoded.recipeBits,
    recipeCode: circuitInput.recipeCode,
    recipeIndex: decoded.recipeIndex,
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
    "SELECT id, parent_id, creator_name, title, asset_key, content_type, mime_type, preview_text, license_code, split_bps, rule_result, content_hash, circuit_result, circuit_tx_hash, registry_tx_hash, recipe_code, circuit_input_commitment, created_at FROM nodes WHERE relay_id = ? ORDER BY created_at ASC LIMIT 250"
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

async function handleBootstrap(request, env, url) {
  const identity = requireIdentity(request);
  const relayId = safeText(url.searchParams.get("relay") || RELAY_ID, 80);
  const relay = relayId === RELAY_ID
    ? { id: RELAY_ID, title: "City Signal 2049", description: "从一座漂浮城市开始，每一棒只能改变一个视觉维度。", content_type: "image" }
    : await env.DB.prepare("SELECT id, title, description, content_type FROM relays WHERE id = ? AND status = 'active'").bind(relayId).first();
  if (!relay) return error("relay_not_found", "这个 Relay 不存在或已关闭。", 404);
  const nodes = await loadNodes(env, relayId);
  const inviteToken = safeText(url.searchParams.get("invite"), 80);
  const invite = inviteToken ? await env.DB.prepare("SELECT token, relay_id, node_id, sender_name, recipient_hint, status, accepted_by_user_id, created_at FROM invites WHERE token = ?").bind(inviteToken).first() : null;
  const userId = identity?.id;
  const credits = userId ? await env.DB.prepare("SELECT balance, lifetime_granted, lifetime_spent FROM credit_accounts WHERE user_id = ?").bind(userId).first() : null;
  const mine = userId ? await env.DB.prepare("SELECT id, relay_id, parent_id, title, asset_key, content_type, mime_type, preview_text, content_hash, created_at FROM nodes WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all() : { results: [] };
  const invites = userId ? await env.DB.prepare("SELECT token, relay_id, node_id, sender_name, status, accepted_at, created_at FROM invites WHERE accepted_by_user_id = ? OR sender_user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId, userId).all() : { results: [] };
  const feed = await env.DB.prepare("SELECT r.id, r.title, r.description, n.asset_key, r.created_at FROM relays r JOIN nodes n ON n.id = r.seed_node_id WHERE r.status = 'active' ORDER BY r.created_at DESC LIMIT 24").all();
  return json({
    ok: true,
    relay: { ...relay, nodes },
    identity: identity ? { handle: identity.handle } : null,
    credits: credits || { balance: 3, lifetime_granted: 3, lifetime_spent: 0 },
    mine: mine.results.map(row => ({ ...row, assetUrl: `/api/assets/${encodeURIComponent(row.asset_key)}` })),
    invites: invites.results,
    feed: feed.results.map(item => ({ ...item, coverUrl: `/api/assets/${encodeURIComponent(item.asset_key)}` })),
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

async function callImageEdit({ apiKey, imageBytes, rule, prompt, recipeCode }) {
  const directions = [
    "preserve the strongest composition and make one restrained, elegant change",
    "amplify the visual signal with a bolder but coherent interpretation",
    "open a surprising new branch while keeping the parent artwork recognizable",
  ];
  const outputs = [];
  for (const direction of directions) {
    const form = new FormData();
    form.append("model", "gpt-image-2.5-flare");
    form.append("image", new File([imageBytes], "parent.webp", { type: "image/webp" }));
    form.append("prompt", [
      "Create the next artwork in a collaborative AI remix relay.",
      `The relay rule is: change only the ${rule}.`,
      `The TapeOut remix recipe is ${recipeCode}. Follow this recipe exactly.`,
      `Participant instruction: ${prompt}.`,
      `Candidate direction: ${direction}.`,
      "Return a polished standalone artwork with no text, UI, borders, watermarks, or triptych layout.",
    ].join(" "));
    form.append("size", "1024x1024");
    form.append("quality", "low");
    form.append("output_format", "webp");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
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

async function callTextRemix({ apiKey, sourceText, rule, prompt, recipeCode }) {
  const directions = [
    "保留核心事实，写出更有画面感的版本",
    "保留主题，换成更适合社交平台传播的表达",
    "保留人物和冲突，打开一个意外但合理的新分支",
  ];
  const outputs = [];
  for (const direction of directions) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          { role: "system", content: "你是 AI Remix Relay 的文字接力编辑。每次只改变用户指定的维度，输出可直接发布的纯文本，不要解释过程，不要加引号。" },
          { role: "user", content: `父作品：\n${sourceText}\n\n接力规则：${rule === "自由创作" ? "自由完成任务，但保留核心事实、父作品来源和署名" : `只改变${rule}`}。\nTapeOut Remix Recipe：${recipeCode}\n本轮意图：${prompt}\n候选方向：${direction}` },
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
  const identity = requireIdentity(request);
  if (!identity) return error("authentication_required", "请先登录后再生成作品。", 401);
  let body;
  try { body = await readJson(request); } catch (caught) {
    return error(caught.message === "payload_too_large" ? "payload_too_large" : "invalid_json", "请求内容无效。", 400);
  }
  const parentNodeId = safeText(body.parentNodeId, 80);
  const relayId = safeText(body.relayId || RELAY_ID, 80);
  const rule = safeText(body.rule, 40);
  const prompt = safeText(body.prompt, 500);
  const requestedContentType = safeText(body.contentType || "", 20);
  const idempotencyKey = safeText(body.idempotencyKey, 80);
  if (!parentNodeId || !ALLOWED_RULES.has(rule) || prompt.length < 4 || !idempotencyKey) return error("invalid_input", "父节点、规则、创作意图或请求标识无效。", 422);
  const previous = await env.DB.prepare("SELECT id, status FROM generations WHERE user_id = ? AND idempotency_key = ?").bind(identity.id, idempotencyKey).first();
  if (previous) {
    if (previous.status !== "completed") return error("generation_in_progress", "同一请求正在处理或已经失败，请重新生成。", 409);
    const stored = await env.DB.prepare("SELECT id, ordinal, asset_key, content_type FROM candidates WHERE generation_id = ? ORDER BY ordinal").bind(previous.id).all();
    const generation = await env.DB.prepare("SELECT content_type FROM generations WHERE id = ?").bind(previous.id).first();
    const candidateRows = await env.DB.prepare("SELECT id, ordinal, asset_key, content_type, content_hash, recipe_code, circuit_input_commitment FROM candidates WHERE generation_id = ? ORDER BY ordinal").bind(previous.id).all();
    return json({ ok: true, generationId: previous.id, duplicate: true, candidates: candidateRows.results.map(row => ({ id: row.id, ordinal: row.ordinal, contentType: row.content_type || generation?.content_type || "image", contentHash: row.content_hash, recipeCode: row.recipe_code || null, circuitInputCommitment: row.circuit_input_commitment || null, assetUrl: `/api/assets/${encodeURIComponent(row.asset_key)}` })) });
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
  const circuitInput = { parentExists: true, contentTypeAllowed: true, ruleAllowed: true, attributionPreserved: true, licenseAccepted: true, splitWithinLimit: true, contentType, rule, recipeCode };
  const circuitInputCommitment = await sha256(JSON.stringify(circuitInput));
  const generationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO generations (id, user_id, relay_id, parent_node_id, rule, prompt, content_type, recipe_code, circuit_input_commitment, created_at, idempotency_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')").bind(generationId, identity.id, relayId, parentNodeId, rule, prompt, contentType, recipeCode, circuitInputCommitment, createdAt, idempotencyKey).run();
  const reserved = await reserveCredit(env, identity.id, generationId);
  if (!reserved) { await env.DB.prepare("UPDATE generations SET status = 'failed', error_message = 'insufficient_credits' WHERE id = ?").bind(generationId).run(); return error("insufficient_credits", "免费额度已用完，请补充 Credits 后继续。", 402); }
  let generated;
  try {
    generated = parentAsset.contentType === "text"
      ? await callTextRemix({ apiKey: env.OPENAI_API_KEY, sourceText: new TextDecoder().decode(parentAsset.bytes), rule, prompt, recipeCode })
      : await callImageEdit({ apiKey: env.OPENAI_API_KEY, imageBytes: parentAsset.bytes, rule, prompt, recipeCode });
  }
  catch (caught) { await refundCredit(env, identity.id, generationId); await env.DB.prepare("UPDATE generations SET status = 'failed', error_message = ? WHERE id = ?").bind(safeText(caught.message, 180), generationId).run(); return error("generation_failed", "图像生成失败，本次 Credit 已自动退回。", 502); }

  const candidates = [];
  const storedKeys = [];
  try {
    for (let index = 0; index < generated.length; index += 1) {
      const id = crypto.randomUUID();
      const item = generated[index];
      const extension = item.contentType === "text" ? "txt" : "webp";
      const assetKey = `relays/${relayId}/generations/${generationId}/${index}.${extension}`;
      await env.BUCKET.put(assetKey, item.bytes, { httpMetadata: { contentType: item.mimeType || "image/webp" } }); storedKeys.push(assetKey);
      await env.DB.prepare("INSERT INTO candidates (id, generation_id, ordinal, asset_key, revised_prompt, created_at, content_hash, content_type, recipe_code, circuit_input_commitment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, generationId, index, assetKey, item.revisedPrompt, createdAt, item.contentHash, item.contentType || "image", recipeCode, circuitInputCommitment).run();
      candidates.push({ id, ordinal: index, contentType: item.contentType || "image", contentHash: item.contentHash, recipeCode, circuitInputCommitment, previewText: item.previewText || null, assetUrl: `/api/assets/${encodeURIComponent(assetKey)}` });
    }
    await env.DB.prepare("UPDATE generations SET status = 'completed' WHERE id = ?").bind(generationId).run();
  } catch {
    await Promise.all(storedKeys.map(key => env.BUCKET.delete(key))); await refundCredit(env, identity.id, generationId); await env.DB.prepare("UPDATE generations SET status = 'failed', error_message = 'storage_failure' WHERE id = ?").bind(generationId).run(); return error("storage_failed", "作品保存失败，本次 Credit 已自动退回。", 503);
  }
  const account = await env.DB.prepare("SELECT balance, lifetime_granted, lifetime_spent FROM credit_accounts WHERE user_id = ?").bind(identity.id).first();
  return json({ ok: true, generationId, candidates, credits: account }, 201);
}

async function handlePublish(request, env) {
  const identity = requireIdentity(request);
  if (!identity) return error("authentication_required", "请先登录后再发布。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const candidateId = safeText(body.candidateId, 80);
  const licenseCode = safeText(body.licenseCode || "CC-BY-NC-4.0", 40);
  const splitBps = Number(body.splitBps ?? 0);
  const submittedCircuitResult = body.circuitResult && typeof body.circuitResult === "object" ? body.circuitResult : null;
  const circuitTxHash = safeText(body.circuitTxHash, 80) || null;
  const registryTxHash = safeText(body.registryTxHash, 80) || null;
  if (!candidateId || !ALLOWED_LICENSES.has(licenseCode) || !Number.isInteger(splitBps) || splitBps < 0 || splitBps > 3000) return error("invalid_publication", "候选作品、授权方式或分成比例无效。", 422);
  if ((circuitTxHash && !validTxHash(circuitTxHash)) || (registryTxHash && !validTxHash(registryTxHash))) return error("invalid_chain_proof", "Circuit 或 Registry 交易哈希格式无效。", 422);
  const duplicate = await env.DB.prepare("SELECT id, parent_id, creator_name, title, asset_key, content_hash, license_code, split_bps, rule_result FROM nodes WHERE candidate_id = ?").bind(candidateId).first();
  if (duplicate) return json({ ok: true, duplicate: true, node: { id: duplicate.id, parent: duplicate.parent_id, creator: duplicate.creator_name, title: duplicate.title, assetUrl: `/api/assets/${encodeURIComponent(duplicate.asset_key)}`, contentHash: duplicate.content_hash, licenseCode: duplicate.license_code, splitBps: duplicate.split_bps, ruleResult: duplicate.rule_result ? JSON.parse(duplicate.rule_result) : null } });
  const candidate = await env.DB.prepare(
    "SELECT c.id, c.asset_key, c.content_hash, c.content_type, c.recipe_code, c.circuit_input_commitment, c.generation_id, g.relay_id, g.parent_node_id, g.rule, g.prompt FROM candidates c JOIN generations g ON g.id = c.generation_id WHERE c.id = ? AND g.user_id = ? AND c.selected = 0"
  ).bind(candidateId, identity.id).first();
  if (!candidate) return error("candidate_not_found", "候选作品不存在，或不属于当前用户。", 404);

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

  const nodeId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const ruleResult = {
    ...circuitResult,
    rule: candidate.rule,
    inputCommitment: candidate.circuit_input_commitment,
    submittedResultAccepted: Boolean(submittedCircuitResult),
  };
  const receiptHash = await sha256(JSON.stringify({ relayId: candidate.relay_id, nodeId, parentId: candidate.parent_node_id, contentHash: candidate.content_hash, licenseCode, splitBps, ruleResult, createdAt }));
  const siblings = await env.DB.prepare("SELECT COUNT(*) AS count FROM nodes WHERE relay_id = ? AND parent_id = ?").bind(candidate.relay_id, candidate.parent_node_id).first();
  await env.DB.batch([
    env.DB.prepare("UPDATE candidates SET selected = 1 WHERE id = ? AND selected = 0").bind(candidateId),
    env.DB.prepare(
      "INSERT INTO nodes (id, relay_id, parent_id, user_id, creator_name, title, rule, prompt, asset_key, receipt_hash, created_at, candidate_id, license_code, split_bps, rule_result, content_hash, content_type, mime_type, preview_text, circuit_result, circuit_tx_hash, registry_tx_hash, recipe_code, circuit_input_commitment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(nodeId, candidate.relay_id, candidate.parent_node_id, identity.id, identity.handle, candidate.rule, candidate.rule, candidate.prompt, candidate.asset_key, receiptHash, createdAt, candidateId, licenseCode, splitBps, JSON.stringify(ruleResult), candidate.content_hash, candidate.content_type || "image", candidate.content_type === "text" ? "text/plain; charset=utf-8" : "image/webp", null, JSON.stringify(ruleResult), circuitTxHash, registryTxHash, candidate.recipe_code || null, candidate.circuit_input_commitment || null),
  ]);
  return json({
    ok: true,
    node: { id: nodeId, parent: candidate.parent_node_id, creator: identity.handle, title: candidate.rule, panel: 0, branch: Number(siblings?.count || 0) > 0, contentType: candidate.content_type || "image", assetUrl: `/api/assets/${encodeURIComponent(candidate.asset_key)}`, contentHash: candidate.content_hash, licenseCode, splitBps, ruleResult, recipeCode: candidate.recipe_code || null, circuitInputCommitment: candidate.circuit_input_commitment || null, circuitTxHash, registryTxHash },
    receipt: { hash: receiptHash, createdAt, storage: "D1 + R2", chain: registryTxHash ? "xlayer" : "not-submitted", circuit: circuitTxHash ? "xlayer" : "not-submitted", registryTxHash, circuitTxHash },
  }, 201);
}

async function handleCreateSeed(request, env) {
  const identity = requireIdentity(request);
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
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO relays (id, owner_user_id, title, description, seed_node_id, status, created_at, content_type) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)").bind(relayId, identity.id, title, description, nodeId, createdAt, contentType),
      env.DB.prepare("INSERT INTO nodes (id, relay_id, parent_id, user_id, creator_name, title, rule, prompt, asset_key, receipt_hash, created_at, license_code, split_bps, rule_result, content_hash, content_type, mime_type, preview_text) VALUES (?, ?, NULL, ?, ?, ?, 'Seed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(nodeId, relayId, identity.id, identity.handle, title, description, assetKey, receiptHash, createdAt, licenseCode, splitBps, JSON.stringify(ruleResult), contentHash, contentType, mimeType, contentType === "text" ? text.slice(0, 280) : null),
    ]);
  } catch (caught) {
    await env.BUCKET.delete(assetKey);
    throw caught;
  }
  return json({ ok: true, relay: { id: relayId, title, description, contentType }, node: { id: nodeId, creator: identity.handle, title, contentType, previewText: contentType === "text" ? text.slice(0, 280) : null, assetUrl: `/api/assets/${encodeURIComponent(assetKey)}`, licenseCode, splitBps, contentHash } }, 201);
}

async function handleCreateInvite(request, env, url) {
  const identity = requireIdentity(request);
  if (!identity) return error("authentication_required", "请先登录后再发出邀请。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const relayId = safeText(body.relayId || RELAY_ID, 80);
  const nodeId = safeText(body.nodeId, 80);
  const recipientHint = safeText(body.recipientHint, 120) || null;
  const exists = relayId === RELAY_ID && /^n[0-3]$/.test(nodeId) ? true : Boolean(await env.DB.prepare("SELECT id FROM nodes WHERE id = ? AND relay_id = ?").bind(nodeId, relayId).first());
  if (!exists) return error("node_not_found", "无法为不存在的节点创建邀请。", 404);
  const token = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO invites (id, token, relay_id, node_id, sender_user_id, sender_name, recipient_hint, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)").bind(crypto.randomUUID(), token, relayId, nodeId, identity.id, identity.handle, recipientHint, createdAt).run();
  return json({ ok: true, invite: { token, status: "open", url: `${url.origin}${url.pathname}?relay=${encodeURIComponent(relayId)}&node=${encodeURIComponent(nodeId)}&invite=${encodeURIComponent(token)}` } }, 201);
}

async function handleAcceptInvite(request, env) {
  const identity = requireIdentity(request);
  if (!identity) return error("authentication_required", "请先登录后再接受接力。", 401);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const token = safeText(body.token, 80);
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE invites SET status = 'accepted', accepted_by_user_id = ?, accepted_at = ? WHERE token = ? AND status = 'open'").bind(identity.id, now, token).run();
  if (!result.meta?.changes) return error("invite_unavailable", "邀请不存在或已被接受。", 409);
  return json({ ok: true, status: "accepted", acceptedAt: now });
}

async function handleAsset(pathname, env) {
  const key = decodeURIComponent(pathname.slice("/api/assets/".length));
  if (!key.startsWith("relays/")) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && !isSameOrigin(request)) return error("invalid_origin", "请求来源无效。", 403);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/relay-triptych.webp") {
      return new Response(decodeBase64(seedArtworkBase64), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (request.method === "GET" && url.pathname === "/api/bootstrap") return handleBootstrap(request, env, url);
    if (request.method === "GET" && url.pathname === "/api/circuit/status") return handleCircuitStatus(env);
    if (request.method === "POST" && url.pathname === "/api/circuit/eval") return handleCircuitEval(request, env);
    if (request.method === "POST" && url.pathname === "/api/generate") return handleGenerate(request, env);
    if (request.method === "POST" && url.pathname === "/api/nodes") return handlePublish(request, env);
    if (request.method === "POST" && url.pathname === "/api/seeds") return handleCreateSeed(request, env);
    if (request.method === "POST" && url.pathname === "/api/invites") return handleCreateInvite(request, env, url);
    if (request.method === "POST" && url.pathname === "/api/invites/accept") return handleAcceptInvite(request, env);
    if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) return handleAsset(url.pathname, env);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "ai-remix-relay", version: 2 });
    return new Response("Not found", { status: 404 });
  },
};
