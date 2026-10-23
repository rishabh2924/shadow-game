import { handle, readJson } from "@/lib/server/http";
import { createRoom } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: Request) =>
  handle(async () => {
    const body = await readJson(req);
    return createRoom(body.name, body.config);
  });
