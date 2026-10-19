import { getSqlite } from "@/lib/db/client";
import { appInfo } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  let db = "ok";
  try {
    getSqlite().prepare("select 1").get();
  } catch {
    db = "error";
  }
  return Response.json(
    { status: db === "ok" ? "ok" : "degraded", version: appInfo.version, db },
    { status: db === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
