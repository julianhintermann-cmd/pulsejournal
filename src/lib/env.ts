import path from "node:path";

/** Server-side runtime configuration (section 4). Read lazily so tests can override process.env. */
export const env = {
  get dataDir() {
    return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "/data");
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET || "";
  },
  get cookieSecure(): "auto" | "true" | "false" {
    const v = (process.env.COOKIE_SECURE || "auto").toLowerCase();
    return v === "true" || v === "false" ? v : "auto";
  },
  get backupKeepDays() {
    const n = Number.parseInt(process.env.BACKUP_KEEP_DAYS || "14", 10);
    return Number.isFinite(n) && n > 0 ? n : 14;
  },
  get seedDemo() {
    return (process.env.SEED_DEMO || "false").toLowerCase() === "true";
  },
  get logLevel(): "debug" | "info" | "warn" | "error" {
    const v = (process.env.LOG_LEVEL || "info").toLowerCase();
    return v === "debug" || v === "warn" || v === "error" ? v : "info";
  },
};

export const appInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0",
  gitSha: process.env.NEXT_PUBLIC_GIT_SHA || "dev",
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE || "",
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/julianhintermann-cmd/pulsejournal",
};

export function dataPath(...segments: string[]) {
  return path.join(/*turbopackIgnore: true*/ env.dataDir, ...segments);
}
