import { handle, readJson } from "@/lib/server/http";
import { joinRoom } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: Request, { params }: { params: Promise<{ code: string }> }) =>
  handle(async () => joinRoom((await params).code, (await readJson(req)).name));
