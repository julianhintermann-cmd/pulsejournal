// Completes the standalone output so `pnpm start` (and the Docker image) can run it directly:
// copies static assets, public files and migrations, and stamps the service worker version.
import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = process.env.APP_VERSION || pkg.version;

await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
await cp(path.join(root, "drizzle"), path.join(standalone, "drizzle"), { recursive: true });

const swPath = path.join(standalone, "public", "sw.js");
const sw = await readFile(swPath, "utf8");
await writeFile(swPath, sw.replaceAll("__APP_VERSION__", version));

console.log(`Standalone output prepared (version ${version}).`);
