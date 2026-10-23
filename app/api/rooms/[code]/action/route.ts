import { handle, readJson, tokenOf } from "@/lib/server/http";
import { runAction } from "@/lib/server/rooms";
import type { RoomAction } from "@/types/online";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: Request, { params }: { params: Promise<{ code: string }> }) =>
  handle(async () => runAction((await params).code, tokenOf(req), (await readJson(req)) as unknown as RoomAction));
