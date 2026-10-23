"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Crown, Info, LogOut, Minus, Play, Plus, RotateCcw, Shuffle, X } from "lucide-react";
import QRCode from "qrcode";
import type { Player } from "@/types/game";
import type { LobbyConfig } from "@/types/online";
import { MAX_ROOM_PLAYERS } from "@/types/online";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/common";
import { api } from "@/lib/online/client";
import { getEligibleWordPairs } from "@/lib/game/selection";
import { validateRoleCounts } from "@/lib/game/roles";
import { evaluateWinCondition } from "@/lib/game/win-conditions";
import { groupStats } from "@/lib/words/groups";
import type { RoomHandle } from "./use-room";
import { Dot, Section, WaitingForHost, useDo } from "./ui";

export function Lobby({ room }: { room: RoomHandle }) {
  const view = room.view!;
  const { run, busy } = useDo(room);
  const isHost = view.me.isHost;
  const n = view.players.length;

  return (
    <Section className="max-w-lg">
      <SharePanel code={view.code} />

      <section className="card space-y-3" aria-labelledby="pl">
        <h2 id="pl" className="h2">Players <span className="text-sm font-normal text-slate-400">({n}/{MAX_ROOM_PLAYERS})</span></h2>
        <ul className="space-y-1.5">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5">
              <Dot on={p.connected} />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}{p.id === view.me.id && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</span>
              {p.isHost && <span className="badge border-amber-400/40 text-amber-200"><Crown className="mr-1 h-3 w-3" aria-hidden /> Host</span>}
              {isHost && !p.isHost && <button type="button" className="btn btn-ghost btn-icon text-rose-300" disabled={busy} onClick={() => run({ type: "kick", playerId: p.id })} aria-label={`Remove ${p.name}`}><X className="h-4 w-4" aria-hidden /></button>}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? <HostSettings room={room} /> : <ConfigSummary config={view.config} />}

      {!isHost && <WaitingForHost view={view} run={run} busy={busy} what="the host to start the game" />}

      <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => run({ type: "leave" })}><LogOut className="h-4 w-4" aria-hidden /> Leave room</button>
    </Section>
  );
}

/* ---------------------------------------------------------- share panel */

function SharePanel({ code }: { code: string }) {
  const { toast } = useToast();
  const [base, setBase] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let origin = window.location.origin;
      // Opened via localhost? Other phones can't reach that, so use the LAN address instead.
      if (/^(localhost|127\.|\[::1\])/.test(window.location.hostname)) {
        const h = await api.health();
        if (h.ok && h.value.lan[0]) origin = h.value.lan[0];
      }
      setBase(origin);
    })();
  }, []);

  const url = base ? `${base}/online/room/${code}` : "";
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#0b0d24", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [url]);

  async function copy() {
    try { await navigator.clipboard.writeText(url); toast("Link copied."); }
    catch { toast("Copy isn't available here. Select the link and copy it manually.", "info"); }
  }

  return (
    <section className="card space-y-3 text-center" aria-labelledby="share">
      <p id="share" className="text-sm text-slate-400">Room code</p>
      <p className="text-5xl font-extrabold tracking-[0.3em] text-white">{code}</p>
      {url && (
        <>
          {qr && <img src={qr} alt={`QR code for ${url}`} width={176} height={176} className="mx-auto rounded-xl bg-white p-1.5" />}
          <p className="text-xs text-slate-400">Scan with a phone camera, or open this link on the same Wi-Fi:</p>
          <div className="flex items-center gap-2">
            <input readOnly className="input text-center font-mono text-xs" value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Join link" />
            <button type="button" className="btn btn-secondary btn-icon" onClick={copy} aria-label="Copy link"><Copy className="h-4 w-4" aria-hidden /></button>
          </div>
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------- config views */

function ConfigSummary({ config }: { config: LobbyConfig }) {
  return (
    <section className="card space-y-1 text-sm text-slate-300">
      <h2 className="h2 mb-1">Game settings</h2>
      <p>Undercover: <strong>{config.undercover}</strong> · Mr. White: <strong>{config.white}</strong></p>
      <p>Ties: {config.tieRule === "revote" ? "revote" : "random elimination"} · Timer: {config.timerSeconds ? `${config.timerSeconds}s` : "off"} · Scoring: {config.scoring ? "on" : "off"}</p>
      <p className="hint">The host picks the word groups.</p>
    </section>
  );
}

function Stepper({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
      <div><p className="text-sm font-medium">{label}</p><p className="hint mt-0">{hint}</p></div>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Fewer ${label}`}><Minus className="h-4 w-4" aria-hidden /></button>
        <span className="w-8 text-center text-lg font-semibold" aria-live="polite">{value}</span>
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => onChange(value + 1)} aria-label={`More ${label}`}><Plus className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  );
}

function HostSettings({ room }: { room: RoomHandle }) {
  const app = useApp();
  const { toast } = useToast();
  const { run, busy } = useDo(room);
  const view = room.view!;
  const c = view.config;
  const n = view.players.length;
  const set = (patch: Partial<LobbyConfig>) => { void run({ type: "config", config: patch }); };

  const selectedIds = useMemo(() => c.selectedGroupIds.filter((id) => app.groups.some((g) => g.id === id && g.enabled)), [c.selectedGroupIds, app.groups]);
  const pool = useMemo(() => getEligibleWordPairs(app.groups, selectedIds, false), [app.groups, selectedIds]);

  const errors: string[] = [...validateRoleCounts(n, c.undercover, c.white)];
  if (pool.length === 0) errors.push("Select at least one enabled word group that has a valid pair.");
  if (app.dbStatus === "offline") errors.push("MariaDB is offline, so the room can't pick words. Check the database and press Retry on the Online page.");
  if (!errors.length) {
    const fake: Player[] = view.players.map((p, i) => ({ id: p.id, name: p.name, role: i < c.undercover ? "undercover" : i < c.undercover + c.white ? "white" : "civilian", assignedWord: null, active: true, score: 0 }));
    if (evaluateWinCondition(fake, c.survivalRule)) errors.push("Too many Undercover / Mr. White players: they would win immediately.");
  }
  const civilians = n - c.undercover - c.white;

  const toggle = (id: string, on: boolean) => set({ selectedGroupIds: on ? [...new Set([...c.selectedGroupIds, id])] : c.selectedGroupIds.filter((x) => x !== id) });

  async function start() {
    if (!(await app.flushLibrary())) { toast("Couldn't save the word library to MariaDB.", "error"); return; }
    await run({ type: "start" });
  }

  return (
    <>
      <section className="card space-y-3" aria-labelledby="roles-h">
        <h2 id="roles-h" className="h2">Roles</h2>
        <Stepper label="Undercover" value={c.undercover} onChange={(v) => set({ undercover: v })} hint="Gets a similar but different word" />
        <Stepper label="Mr. White" value={c.white} onChange={(v) => set({ white: v })} hint="Gets no word at all" />
        <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 px-3 py-3 text-sm"><span>Civilians (automatic)</span><strong className={civilians < 1 ? "text-rose-300" : "text-white"}>{Math.max(civilians, 0)}</strong></div>
      </section>

      <section className="card space-y-3" aria-labelledby="groups-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="groups-h" className="h2">Word groups</h2>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ selectedGroupIds: app.groups.filter((g) => g.enabled).map((g) => g.id) })}>All</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ selectedGroupIds: [] })}>None</button>
          </div>
        </div>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {[...app.groups].sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
            <li key={g.id}>
              <label className={`flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 px-3 text-sm ${g.enabled ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-50"}`}>
                <input type="checkbox" className="check" disabled={!g.enabled} checked={g.enabled && c.selectedGroupIds.includes(g.id)} onChange={(e) => toggle(g.id, e.target.checked)} />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <span className="text-xs text-slate-400">{g.enabled ? `${groupStats(g).pairs} pairs` : "Disabled"}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
          <div><p className="flex items-center gap-1.5 text-sm font-medium"><Shuffle className="h-4 w-4" aria-hidden /> Random group</p><p className="hint mt-0">Pick one selected group at random.</p></div>
          <Switch checked={c.randomGroup} onChange={(v) => set({ randomGroup: v })} label="Random group" />
        </div>
        <p className={`text-sm ${pool.length ? "text-slate-300" : "text-rose-300"}`}><strong>{pool.length}</strong> valid word pair{pool.length === 1 ? "" : "s"} available</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { if (await run({ type: "resetHistory" })) toast("Used-word history cleared."); }}><RotateCcw className="h-4 w-4" aria-hidden /> Reset used-word history</button>
      </section>

      <section className="card space-y-3" aria-labelledby="rules-h">
        <h2 id="rules-h" className="h2">Rules</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="o-tie" className="label">If votes tie</label>
            <select id="o-tie" className="input" value={c.tieRule} onChange={(e) => set({ tieRule: e.target.value as LobbyConfig["tieRule"] })}>
              <option value="revote">Revote among tied players</option><option value="random">Eliminate one at random</option></select></div>
          <div><label htmlFor="o-win" className="label">Infiltrators win when</label>
            <select id="o-win" className="input" value={c.survivalRule} onChange={(e) => set({ survivalRule: e.target.value as LobbyConfig["survivalRule"] })}>
              <option value="parity">They equal the Civilians</option><option value="final-two">Only 2 players remain</option></select></div>
          <div><label htmlFor="o-timer" className="label">Discussion timer</label>
            <select id="o-timer" className="input" value={c.timerSeconds} onChange={(e) => set({ timerSeconds: Number(e.target.value) })}>
              <option value={0}>Off</option>{[30, 60, 90, 120, 180, 300].map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} min${s > 60 ? "s" : ""}` : `${s} sec`}</option>)}</select></div>
          <div className="flex items-end"><div className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><p className="text-sm font-medium">Keep score</p><Switch checked={c.scoring} onChange={(v) => set({ scoring: v })} label="Keep score" /></div></div>
        </div>
      </section>

      <div className="card space-y-3">
        {errors.length > 0 && <ul className="space-y-1" role="alert">{errors.map((e) => <li key={e} className="flex items-start gap-2 text-sm text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{e}</li>)}</ul>}
        {n >= 5 && c.white === 0 && <p className="flex items-start gap-2 text-sm text-amber-200"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Tip: with 5+ players, a Mr. White makes it more exciting.</p>}
        {!errors.length && <p className="flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" aria-hidden /> Ready: {n} players, {civilians} Civilian{civilians === 1 ? "" : "s"}.</p>}
        <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={busy || errors.length > 0} onClick={start}><Play className="h-5 w-5" aria-hidden /> Start game</button>
      </div>
    </>
  );
}
