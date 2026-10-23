import type { RoomAction, RoomView } from "@/types/online";

export interface Creds { code: string; playerId: string; token: string }
export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const credKey = (code: string) => `shadow-words:online:${code.toUpperCase()}`;

export function loadCreds(code: string): Creds | null {
  try {
    const raw = window.localStorage.getItem(credKey(code));
    if (!raw) return null;
    const c = JSON.parse(raw) as Creds;
    return c && typeof c.token === "string" && typeof c.playerId === "string" ? { ...c, code: code.toUpperCase() } : null;
  } catch {
    return null;
  }
}
const LAST_KEY = "shadow-words:online:last";
export function saveCreds(c: Creds) {
  try {
    window.localStorage.setItem(credKey(c.code), JSON.stringify(c));
    window.localStorage.setItem(LAST_KEY, c.code.toUpperCase());
  } catch { /* private mode: works until the tab closes */ }
}
export function clearCreds(code: string) {
  try {
    window.localStorage.removeItem(credKey(code));
    if (window.localStorage.getItem(LAST_KEY) === code.toUpperCase()) window.localStorage.removeItem(LAST_KEY);
  } catch { /* ignore */ }
}
/** The room this browser was last in (and still has a seat in), for a "return to room" shortcut. */
export function lastRoomCode(): string | null {
  try {
    const code = window.localStorage.getItem(LAST_KEY);
    return code && loadCreds(code) ? code : null;
  } catch { return null; }
}

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, error: typeof body.error === "string" ? body.error : `Request failed (${res.status}).` };
    return { ok: true, value: body as T };
  } catch {
    return { ok: false, status: 0, error: "Can't reach the game server. Check that you're on the same Wi-Fi." };
  }
}

const json = (body: unknown, token?: string): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { "x-player-token": token } : {}) },
  body: JSON.stringify(body),
});

export const api = {
  health: () => call<{ db: boolean; error?: string; lan: string[] }>("/api/health"),
  createRoom: (name: string, config: unknown) => call<Creds>("/api/rooms", json({ name, config })),
  join: (code: string, name: string) => call<Creds & { rejoined: boolean }>(`/api/rooms/${code}/join`, json({ name })),
  state: (code: string, token: string) => call<RoomView>(`/api/rooms/${code}`, { headers: { "x-player-token": token } }),
  action: (code: string, token: string, action: RoomAction) => call<{ view: RoomView | null }>(`/api/rooms/${code}/action`, json(action, token)),
};
