import "server-only";
import { NextResponse } from "next/server";
import { ApiError, toApiError } from "./db";

const NO_STORE = { "Cache-Control": "no-store" };

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), { headers: NO_STORE });
  } catch (e) {
    const err = toApiError(e);
    return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}

export const tokenOf = (req: Request) => req.headers.get("x-player-token") ?? "";
