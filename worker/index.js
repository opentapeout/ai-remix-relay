const page = __PAGE_HTML__;
const seedArtworkBase64 = __SEED_ARTWORK_BASE64__;

const RELAY_ID = "city-signal-2049";
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
  const userId = request.headers.get("oai-authenticated-user-id") || "local-preview-user";
  const email = request.headers.get("oai-authenticated-user-email") || "";
  const encodedName = request.headers.get("oai-authenticated-user-full-name") || "";
  let name = email ? email.split("@")[0] : "guest";
  if (encodedName) {
    try { name = decodeURIComponent(encodedName); } catch { name = encodedName; }
  }
  return { id: userId, email, name, handle: `@${name.replace(/\s+/g, "_").slice(0, 24)}` };
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

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function sha256(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return `0x${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function loadNodes(env) {
  const result = await env.DB.prepare(
    "SELECT id, parent_id, creator_name, title, asset_key, created_at FROM nodes WHERE relay_id = ? ORDER BY created_at ASC LIMIT 100"
  ).bind(RELAY_ID).all();
  const persisted = result.results.map((row, index) => ({
    id: row.id,
    parent: row.parent_id,
    creator: row.creator_name,
    title: row.title,
    panel: index % 3,
    branch: row.parent_id !== "n2",
    assetUrl: `/api/assets/${encodeURIComponent(row.asset_key)}`,
  }));
  return [...seedNodes, ...persisted];
}

async function handleBootstrap(request, env) {
  const identity = getIdentity(request);
  const nodes = await loadNodes(env);
  return json({
    ok: true,
    relay: { id: RELAY_ID, title: "City Signal 2049", nodes },
    identity: { handle: identity.handle },
    integrations: {
      ai: Boolean(env.OPENAI_API_KEY),
      database: true,
      storage: true,
      xLayer: { chainId: 196, mode: "read-only" },
      tapeOut: { mode: "planned", circuitId: null },
    },
  });
}

async function resolveParentArtwork(parentNodeId, env) {
  if (/^n[0-3]$/.test(parentNodeId)) return decodeBase64(seedArtworkBase64);
  const row = await env.DB.prepare("SELECT asset_key FROM nodes WHERE id = ? AND relay_id = ?")
    .bind(parentNodeId, RELAY_ID).first();
  if (!row) throw new Error("parent_not_found");
  const object = await env.BUCKET.get(row.asset_key);
  if (!object) throw new Error("parent_asset_not_found");
  return new Uint8Array(await object.arrayBuffer());
}

async function callImageEdit({ apiKey, imageBytes, rule, prompt }) {
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
    outputs.push({ bytes: decodeBase64(payload.data[0].b64_json), revisedPrompt: payload.data[0].revised_prompt || null });
  }
  return outputs;
}

async function handleGenerate(request, env) {
  if (!env.OPENAI_API_KEY) {
    return error("provider_not_configured", "真实 AI 生成尚未配置。请由站点所有者添加 OPENAI_API_KEY Secret。", 503);
  }
  const identity = getIdentity(request);
  let body;
  try { body = await readJson(request); } catch (caught) {
    return error(caught.message === "payload_too_large" ? "payload_too_large" : "invalid_json", "请求内容无效。", 400);
  }
  const parentNodeId = safeText(body.parentNodeId, 80);
  const rule = safeText(body.rule, 40);
  const prompt = safeText(body.prompt, 500);
  if (!parentNodeId || !rule || prompt.length < 4) return error("invalid_input", "请选择父节点和规则，并写下至少 4 个字符的创作意图。", 422);

  let parentArtwork;
  try { parentArtwork = await resolveParentArtwork(parentNodeId, env); }
  catch { return error("parent_not_found", "父节点或其作品不存在。", 404); }

  const generationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let generated;
  try { generated = await callImageEdit({ apiKey: env.OPENAI_API_KEY, imageBytes: parentArtwork, rule, prompt }); }
  catch (caught) { return error("generation_failed", "图像生成暂时失败，请稍后重试。", 502, safeText(caught.message, 180)); }

  await env.DB.prepare(
    "INSERT INTO generations (id, user_id, relay_id, parent_node_id, rule, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(generationId, identity.id, RELAY_ID, parentNodeId, rule, prompt, createdAt).run();

  const candidates = [];
  for (let index = 0; index < generated.length; index += 1) {
    const id = crypto.randomUUID();
    const assetKey = `relays/${RELAY_ID}/generations/${generationId}/${index}.webp`;
    await env.BUCKET.put(assetKey, generated[index].bytes, { httpMetadata: { contentType: "image/webp" } });
    await env.DB.prepare(
      "INSERT INTO candidates (id, generation_id, ordinal, asset_key, revised_prompt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, generationId, index, assetKey, generated[index].revisedPrompt, createdAt).run();
    candidates.push({ id, ordinal: index, imageUrl: `/api/assets/${encodeURIComponent(assetKey)}` });
  }
  return json({ ok: true, generationId, candidates }, 201);
}

async function handlePublish(request, env) {
  const identity = getIdentity(request);
  let body;
  try { body = await readJson(request); } catch { return error("invalid_json", "请求内容无效。", 400); }
  const candidateId = safeText(body.candidateId, 80);
  if (!candidateId) return error("candidate_required", "请先选择一个真实生成的候选作品。", 422);
  const candidate = await env.DB.prepare(
    "SELECT c.id, c.asset_key, c.generation_id, g.parent_node_id, g.rule, g.prompt FROM candidates c JOIN generations g ON g.id = c.generation_id WHERE c.id = ? AND g.user_id = ?"
  ).bind(candidateId, identity.id).first();
  if (!candidate) return error("candidate_not_found", "候选作品不存在，或不属于当前用户。", 404);

  const nodeId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const receiptHash = await sha256(JSON.stringify({ relayId: RELAY_ID, nodeId, parentId: candidate.parent_node_id, candidateId, assetKey: candidate.asset_key, rule: candidate.rule, prompt: candidate.prompt, createdAt }));
  await env.DB.batch([
    env.DB.prepare("UPDATE candidates SET selected = 1 WHERE id = ?").bind(candidateId),
    env.DB.prepare(
      "INSERT INTO nodes (id, relay_id, parent_id, user_id, creator_name, title, rule, prompt, asset_key, receipt_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(nodeId, RELAY_ID, candidate.parent_node_id, identity.id, identity.handle, candidate.rule, candidate.rule, candidate.prompt, candidate.asset_key, receiptHash, createdAt),
  ]);
  return json({
    ok: true,
    node: { id: nodeId, parent: candidate.parent_node_id, creator: identity.handle, title: candidate.rule, panel: 0, branch: candidate.parent_node_id !== "n2", assetUrl: `/api/assets/${encodeURIComponent(candidate.asset_key)}` },
    receipt: { hash: receiptHash, createdAt, storage: "D1 + R2", chain: "not-submitted" },
  }, 201);
}

async function handleAsset(pathname, env) {
  const key = decodeURIComponent(pathname.slice("/api/assets/".length));
  if (!key.startsWith(`relays/${RELAY_ID}/`)) return new Response("Not found", { status: 404 });
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
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (request.method === "GET" && url.pathname === "/assets/relay-triptych.webp") {
      return new Response(decodeBase64(seedArtworkBase64), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (request.method === "GET" && url.pathname === "/api/bootstrap") return handleBootstrap(request, env);
    if (request.method === "POST" && url.pathname === "/api/generate") return handleGenerate(request, env);
    if (request.method === "POST" && url.pathname === "/api/nodes") return handlePublish(request, env);
    if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) return handleAsset(url.pathname, env);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "ai-remix-relay" });
    return new Response("Not found", { status: 404 });
  },
};
