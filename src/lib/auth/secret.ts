import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dataPath, env } from "@/lib/env";

let cached: string | null = null;

/**
 * Returns SESSION_SECRET, or a 64-byte secret persisted in ${DATA_DIR}/secret.key (created on first use, chmod 600).
 */
export function getSessionSecret() {
  if (env.sessionSecret) return env.sessionSecret;
  if (cached) return cached;
  const file = dataPath("secret.key");
  if (existsSync(file)) {
    cached = readFileSync(file, "utf8").trim();
    if (cached) return cached;
  }
  mkdirSync(env.dataDir, { recursive: true });
  cached = randomBytes(64).toString("hex");
  writeFileSync(file, cached, { mode: 0o600 });
  chmodSync(file, 0o600);
  return cached;
}
