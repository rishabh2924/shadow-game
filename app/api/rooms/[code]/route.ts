import { handle, tokenOf } from "@/lib/server/http";
import { getRoomView } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (req: Request, { params }: { params: Promise<{ code: string }> }) =>
  handle(async () => getRoomView((await params).code, tokenOf(req)));
