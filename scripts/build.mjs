import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const [workerTemplate, page, artwork, manifest] = await Promise.all([
  readFile(resolve(projectRoot, "worker/index.js"), "utf8"),
  readFile(resolve(projectRoot, "web/index.html"), "utf8"),
  readFile(resolve(projectRoot, "web/assets/relay-triptych.webp")),
  readFile(resolve(projectRoot, ".openai/hosting.json"), "utf8"),
]);

const worker = workerTemplate
  .replace("__PAGE_HTML__", JSON.stringify(page))
  .replace("__SEED_ARTWORK_BASE64__", JSON.stringify(artwork.toString("base64")));

await rm(distRoot, { recursive: true, force: true });
await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
await mkdir(resolve(distRoot, "drizzle"), { recursive: true });
await writeFile(resolve(distRoot, "server/index.js"), worker);
await writeFile(resolve(distRoot, ".openai/hosting.json"), manifest);
await copyFile(resolve(projectRoot, "drizzle/0000_relay_core.sql"), resolve(distRoot, "drizzle/0000_relay_core.sql"));
console.log(`Built ${distRoot}`);
