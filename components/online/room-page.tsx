"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, WifiOff } from "lucide-react";
import { Loading } from "@/components/ui/common";
import { useRoom } from "./use-room";
import { Lobby } from "./lobby";
import { OnlineGame } from "./online-game";

export function RoomPage({ code }: { code: string }) {
  const room = useRoom(code.toUpperCase());

  if (room.creds === undefined) return <Loading />;
  if (room.creds === null) return <JoinForm code={code.toUpperCase()} room={room} />;
  if (!room.view) return <Loading label="Connecting to the room…" />;

  return (
    <div className="space-y-4">
      {room.offline && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> Connection lost. Retrying…
        </div>
      )}
      {room.view.game ? <OnlineGame room={room} /> : <Lobby room={room} />}
    </div>
  );
}

function JoinForm({ code, room }: { code: string; room: ReturnType<typeof useRoom> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await room.join(name);
    setBusy(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4" noValidate>
      <div>
        <p className="text-sm text-slate-400">Join room</p>
        <h1 className="text-4xl font-extrabold tracking-[0.3em] text-white">{code}</h1>
      </div>
      {room.notice && <p className="rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100" role="status">{room.notice}</p>}
      <div>
        <label htmlFor="join-name" className="label">Your name</label>
        <input id="join-name" className="input h-12 text-base" autoFocus autoComplete="off" maxLength={24} value={name} aria-invalid={!!error}
          onChange={(e) => { setName(e.target.value); setError(null); }} />
        <p className="hint">Playing again after a disconnect? Enter the same name to get your seat back.</p>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={busy || !name.trim()}><LogIn className="h-5 w-5" aria-hidden /> Join game</button>
      <Link href="/online" className="btn btn-ghost w-full">Back</Link>
    </form>
  );
}
