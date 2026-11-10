import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [source, manifestText, migration] = await Promise.all([
  readFile(resolve(projectRoot, "dist/server/index.js"), "utf8"),
  readFile(resolve(projectRoot, "dist/.openai/hosting.json"), "utf8"),
  readFile(resolve(projectRoot, "dist/drizzle/0000_relay_core.sql"), "utf8"),
]);
const manifest = JSON.parse(manifestText);
assert.equal(manifest.project_id, "appgprj_6af30357ca508191a088ade9dddc0bac");
assert.equal(manifest.d1, "DB");
assert.equal(manifest.r2, "BUCKET");
assert.ok(!("static" in manifest));
assert.ok(source.includes("default {\n  async fetch"));
assert.ok(!source.includes("__PAGE_HTML__"));
assert.ok(migration.includes("CREATE TABLE nodes"));
console.log("Artifact contains Worker, D1 migration, R2 binding, and no unresolved placeholders");
