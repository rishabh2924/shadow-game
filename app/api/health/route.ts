import os from "node:os";
import { ensureSchema, query, toApiError } from "@/lib/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function lanUrls(req: Request): string[] {
  const host = req.headers.get("host") ?? "";
  const port = host.includes(":") ? host.split(":").pop() : process.env.PORT ?? "3000";
  const urls: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === "IPv4" && !i.internal) urls.push(`http://${i.address}:${port}`);
    }
  }
  return urls;
}

/** Reports database status plus the addresses other phones on the Wi-Fi can use. */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    await ensureSchema();
    await query("SELECT 1");
    return Response.json({ db: true, lan: lanUrls(req) }, { headers });
  } catch (e) {
    return Response.json({ db: false, error: toApiError(e).message, lan: lanUrls(req) }, { headers });
  }
}
