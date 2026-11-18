import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDir = resolve(projectRoot, "work/preview-runtime");
const [workerTemplate, page, artwork] = await Promise.all([
  readFile(resolve(projectRoot, "worker/index.js"), "utf8"),
  readFile(resolve(projectRoot, "web/index.html"), "utf8"),
  readFile(resolve(projectRoot, "web/assets/relay-triptych.webp")),
]);

const worker = workerTemplate
  .replace("__PAGE_HTML__", JSON.stringify(page))
  .replace("__SEED_ARTWORK_BASE64__", JSON.stringify(artwork.toString("base64")));

if (worker.includes("__PAGE_HTML__") || worker.includes("__SEED_ARTWORK_BASE64__")) {
  throw new Error("Preview worker still contains unresolved asset placeholders");
}

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "worker.mjs"), worker);
console.log("Prepared local Worker preview without modifying dist/.");
