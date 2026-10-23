import { handle, readJson } from "@/lib/server/http";
import { getLibrary, saveLibrary } from "@/lib/server/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = () => handle(getLibrary);
export const PUT = (req: Request) => handle(async () => saveLibrary((await readJson(req)).groups));
