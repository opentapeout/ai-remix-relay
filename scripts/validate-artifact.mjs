import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [source, manifestText, migration, commercialMigration, accessMigration, circuitMigration, remixIntentMigration] = await Promise.all([
  readFile(resolve(projectRoot, "dist/server/index.js"), "utf8"),
  readFile(resolve(projectRoot, "dist/.openai/hosting.json"), "utf8"),
  readFile(resolve(projectRoot, "dist/drizzle/0000_relay_core.sql"), "utf8"),
  readFile(resolve(projectRoot, "dist/drizzle/0001_commercial_core.sql"), "utf8"),
  readFile(resolve(projectRoot, "dist/drizzle/0004_seed_access.sql"), "utf8"),
  readFile(resolve(projectRoot, "dist/drizzle/0005_circuit_challenge.sql"), "utf8"),
  readFile(resolve(projectRoot, "dist/drizzle/0006_remix_intent.sql"), "utf8"),
]);
const manifest = JSON.parse(manifestText);
assert.equal(manifest.project_id, "appgprj_6af30357ca508191a088ade9dddc0bac");
assert.equal(manifest.d1, "DB");
assert.equal(manifest.r2, "BUCKET");
assert.ok(!("static" in manifest));
assert.ok(source.includes("default {\n  async fetch"));
assert.ok(!source.includes("__PAGE_HTML__"));
assert.ok(source.includes("verifyRegistryTransaction"));
assert.ok(source.includes("registry_receipt_pending"));
assert.ok(source.includes("eth_chainId"));
assert.ok(migration.includes("CREATE TABLE nodes"));
assert.ok(commercialMigration.includes("CREATE TABLE invites"));
assert.ok(commercialMigration.includes("CREATE TABLE credit_accounts"));
assert.ok(accessMigration.includes("CREATE TABLE wallet_sessions"));
assert.ok(accessMigration.includes("ALTER TABLE relays ADD COLUMN access_mode"));
assert.ok(circuitMigration.includes("ALTER TABLE generations ADD COLUMN circuit_result"));
assert.ok(remixIntentMigration.includes("ALTER TABLE generations ADD COLUMN preserve_prompt"));
assert.ok(remixIntentMigration.includes("ALTER TABLE nodes ADD COLUMN preserve_prompt"));
console.log("Artifact contains Worker, ordered D1 migrations, R2 binding, and no unresolved placeholders");
