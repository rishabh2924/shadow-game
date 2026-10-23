"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomAction, RoomView } from "@/types/online";
import { api, clearCreds, loadCreds, saveCreds, type Creds } from "@/lib/online/client";

const POLL_MS = 1500;
const POLL_HIDDEN_MS = 5000;

export type RoomHandle = ReturnType<typeof useRoom>;

/** Keeps one phone in sync with its room: polls the server and exposes `send(action)`. */
export function useRoom(code: string) {
  const [creds, setCreds] = useState<Creds | null | undefined>(undefined); // undefined = still reading storage
  const [view, setView] = useState<RoomView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const credsRef = useRef<Creds | null>(null);

  useEffect(() => {
    const c = loadCreds(code);
    credsRef.current = c;
    setCreds(c);
    setView(null);
  }, [code]);

  const accept = useCallback((v: RoomView) => {
    setView((cur) => (!cur || cur.code !== v.code || v.version >= cur.version ? v : cur)); // ignore out-of-order replies
  }, []);

  const drop = useCallback((message: string) => {
    clearCreds(code);
    credsRef.current = null;
    setCreds(null);
    setView(null);
    setNotice(message);
  }, [code]);

  useEffect(() => {
    if (!creds) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (timer) clearTimeout(timer);
      const r = await api.state(creds.code, creds.token);
      if (stopped) return;
      if (r.ok) { setOffline(false); accept(r.value); }
      else if (r.status === 401) { drop("You were removed from this room."); return; }
      else if (r.status === 404) { drop("This room no longer exists."); return; }
      else setOffline(true);
      timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
    };
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [creds, accept, drop]);

  const send = useCallback(async (action: RoomAction): Promise<{ ok: true } | { ok: false; error: string }> => {
    const c = credsRef.current;
    if (!c) return { ok: false, error: "You are not in this room." };
    const r = await api.action(c.code, c.token, action);
    if (!r.ok) {
      if (r.status === 401) drop("You were removed from this room.");
      return { ok: false, error: r.error };
    }
    if (action.type === "leave") { drop("You left the room."); return { ok: true }; }
    if (r.value.view) accept(r.value.view);
    return { ok: true };
  }, [accept, drop]);

  const join = useCallback(async (name: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const r = await api.join(code, name);
    if (!r.ok) return { ok: false, error: r.error };
    const c = { code: r.value.code, playerId: r.value.playerId, token: r.value.token };
    saveCreds(c);
    credsRef.current = c;
    setNotice(null);
    setCreds(c);
    return { ok: true };
  }, [code]);

  return { creds, view, notice, offline, send, join };
}
