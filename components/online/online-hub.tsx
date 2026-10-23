"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorOpen, Database, Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Loading } from "@/components/ui/common";
import { api, lastRoomCode, saveCreds } from "@/lib/online/client";
import { DEFAULT_LOBBY_CONFIG } from "@/lib/online/config";

type Health = { db: boolean; error?: string; lan: string[] } | null;

export function OnlineHub() {
  const app = useApp();
  const router = useRouter();
  const [health, setHealth] = useState<Health>(null);
  const [hostName, setHostName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const refresh = async () => {
    const r = await api.health();
    setHealth(r.ok ? r.value : { db: false, error: r.error, lan: [] });
  };
  useEffect(() => { void refresh(); setLast(lastRoomCode()); }, []);

  if (!app.hydrated) return <Loading />;

  async function host(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    await app.flushLibrary(); // the server picks words from its copy of the library
    const { settings, setup, groups } = app;
    const enabled = new Set(groups.filter((g) => g.enabled).map((g) => g.id));
    const config = {
      ...DEFAULT_LOBBY_CONFIG,
      undercover: setup.undercover,
      white: setup.white,
      selectedGroupIds: setup.selectedGroupIds.filter((id) => enabled.has(id)),
      randomGroup: setup.randomGroup,
      tieRule: settings.tieRule,
      survivalRule: settings.survivalRule,
      timerSeconds: settings.timerSeconds,
      scoring: settings.scoring,
    };
    const r = await api.createRoom(hostName, config);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    saveCreds(r.value);
    router.push(`/online/room/${r.value.code}`);
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) { setError("Room codes are 4 letters."); return; }
    router.push(`/online/room/${c}`);
  }

  const dbOk = health?.db === true;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="h1 flex items-center gap-2"><Smartphone className="h-7 w-7 text-indigo-300" aria-hidden /> Play on your phones</h1>
        <p className="mt-1 text-sm text-slate-400">Everyone joins a room from their own phone on the same Wi-Fi. Each player sees only their own word.</p>
      </div>

      <div className={`card flex items-start gap-3 text-sm ${health && !dbOk ? "border-rose-400/40" : ""}`} role="status">
        <Database className={`mt-0.5 h-5 w-5 shrink-0 ${dbOk ? "text-emerald-300" : "text-slate-400"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          {health === null && <p className="flex items-center gap-2 text-slate-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking MariaDB…</p>}
          {dbOk && <p className="text-emerald-200">MariaDB connected. Rooms and the word library are stored in the database.</p>}
          {health && !dbOk && <p className="text-rose-200">{health.error ?? "MariaDB is not reachable."}</p>}
          {dbOk && health.lan.length > 0 && <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-400"><Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Phones can open <span className="break-all font-mono text-slate-200">{health.lan.join("  or  ")}</span></p>}
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => { void refresh(); void app.retryDb(); }} aria-label="Check again"><RefreshCw className="h-4 w-4" aria-hidden /></button>
      </div>

      {last && <Link href={`/online/room/${last}`} className="btn btn-secondary w-full">Return to room {last}</Link>}

      <form onSubmit={host} className="card space-y-3" noValidate>
        <h2 className="h2">Host a game</h2>
        <div>
          <label htmlFor="host-name" className="label">Your name</label>
          <input id="host-name" className="input h-12 text-base" autoComplete="off" maxLength={24} value={hostName} onChange={(e) => { setHostName(e.target.value); setError(null); }} />
        </div>
        <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={busy || !hostName.trim() || !dbOk}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <DoorOpen className="h-5 w-5" aria-hidden />} Create room
        </button>
        <p className="hint">You choose word groups and rules in the lobby. The host also plays.</p>
      </form>

      <form onSubmit={join} className="card space-y-3" noValidate>
        <h2 className="h2">Join a game</h2>
        <div>
          <label htmlFor="join-code" className="label">Room code</label>
          <input id="join-code" className="input h-12 text-center text-2xl font-bold uppercase tracking-[0.4em]" autoComplete="off" autoCapitalize="characters" maxLength={4} value={code}
            onChange={(e) => { setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase()); setError(null); }} />
        </div>
        <button type="submit" className="btn btn-secondary h-12 w-full text-base" disabled={code.length !== 4 || !dbOk}>Continue</button>
      </form>

      {error && <p className="error-text text-center" role="alert">{error}</p>}
      <p className="text-center text-sm text-slate-400">Prefer one shared device? <Link href="/game/setup" className="text-indigo-300 underline">Use pass-and-play</Link>.</p>
    </div>
  );
}
