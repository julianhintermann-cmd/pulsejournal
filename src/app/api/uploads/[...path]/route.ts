import { readFile } from "node:fs/promises";

import { getApiUser, unauthorized } from "@/lib/auth/guard";
import { resolveUploadPath } from "@/lib/uploads";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await getApiUser())) return unauthorized();
  const { path: segments } = await params;
  if (segments.some((s) => s === ".." || s === "." || s.includes("\\") || s.includes("\0"))) {
    return new Response("Not found", { status: 404 });
  }
  const relative = segments.join("/");
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}(_thumb)?\.webp$/.test(relative)) return new Response("Not found", { status: 404 });
  const absolute = resolveUploadPath(relative);
  if (!absolute) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(absolute);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
