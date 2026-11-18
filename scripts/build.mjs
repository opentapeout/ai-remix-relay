import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const [workerTemplate, page, artwork, manifest, drizzleFiles] = await Promise.all([
  readFile(resolve(projectRoot, "worker/index.js"), "utf8"),
  readFile(resolve(projectRoot, "web/index.html"), "utf8"),
  readFile(resolve(projectRoot, "web/assets/relay-triptych.webp")),
  readFile(resolve(projectRoot, ".openai/hosting.json"), "utf8"),
  readdir(resolve(projectRoot, "drizzle")),
]);

const worker = workerTemplate
  .replace("__PAGE_HTML__", JSON.stringify(page))
  .replace("__SEED_ARTWORK_BASE64__", JSON.stringify(artwork.toString("base64")));

await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
await mkdir(resolve(distRoot, "drizzle"), { recursive: true });
await writeFile(resolve(distRoot, "server/index.js"), worker);
await writeFile(resolve(distRoot, ".openai/hosting.json"), manifest);
await Promise.all(drizzleFiles.filter(file => file.endsWith(".sql")).map(file => copyFile(resolve(projectRoot, "drizzle", file), resolve(distRoot, "drizzle", file))));
console.log(`Built ${distRoot}`);
