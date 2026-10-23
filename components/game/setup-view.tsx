"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Info, Minus, Play, Plus, RotateCcw, Shuffle, Trash2, UserPlus } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { EmptyState, Loading, Switch } from "@/components/ui/common";
import { getEligibleWordPairs } from "@/lib/game/selection";
import { validatePlayerNames, validateRoleCounts } from "@/lib/game/roles";
import { evaluateWinCondition } from "@/lib/game/win-conditions";
import { normalizeWord } from "@/lib/words/normalization";
import { groupStats } from "@/lib/words/groups";
import { uid } from "@/lib/utils";
import type { Player } from "@/types/game";

export function SetupView() {
  const app = useApp();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { setup, settings, groups } = app;

  const selectedIds = useMemo(() => setup.selectedGroupIds.filter((id) => groups.some((g) => g.id === id && g.enabled)), [setup.selectedGroupIds, groups]);
  const pool = useMemo(() => getEligibleWordPairs(groups, selectedIds, false), [groups, selectedIds]);
  const usedInPool = useMemo(() => { const keys = new Set(pool.map((p) => p.key)); return new Set(app.usedPairKeys.filter((k) => keys.has(k))).size; }, [pool, app.usedPairKeys]);

  if (!app.hydrated) return <Loading />;

  const n = setup.players.length;
  const civilians = n - setup.undercover - setup.white;
  const nameErrors = validatePlayerNames(setup.players);
  const errors: string[] = [...validateRoleCounts(n, setup.undercover, setup.white)];
  if (n > settings.playerLimit) errors.push(`The player limit is ${settings.playerLimit}. Remove players or raise the limit below.`);
  if (Object.keys(nameErrors).length) errors.push("Every player needs a unique name.");
  if (pool.length === 0) errors.push("Select at least one enabled group that has a valid word pair.");
  if (!errors.length) {
    const fake: Player[] = setup.players.map((p, i) => ({ id: p.id, name: p.name, role: i < setup.undercover ? "undercover" : i < setup.undercover + setup.white ? "white" : "civilian", assignedWord: null, active: true, score: 0 }));
    if (evaluateWinCondition(fake, settings.survivalRule)) errors.push("Too many Undercover / Mr. White players: they would win immediately. Add players or reduce them.");
  }
  const warnings: string[] = [];
  if (n >= 5 && setup.white === 0) warnings.push("Tip: with 5 or more players, adding a Mr. White makes the game more exciting.");
  if (pool.length > 0 && pool.length < 5) warnings.push(`Only ${pool.length} word pair${pool.length === 1 ? "" : "s"} available. Pairs will start repeating after every one has been used.`);
  if (setup.selectedGroupIds.length > selectedIds.length) warnings.push("Some selected groups are disabled or deleted and will be ignored.");

  function addPlayer() {
    const v = name.trim().replace(/\s+/g, " ");
    if (!v) { setAddError("Enter a name."); return; }
    if (setup.players.some((p) => normalizeWord(p.name) === normalizeWord(v))) { setAddError("That name is already taken."); return; }
    if (n >= settings.playerLimit) { setAddError(`The player limit is ${settings.playerLimit}.`); return; }
    app.updateSetup((s) => ({ players: [...s.players, { id: uid(), name: v }] }));
    setName(""); setAddError(null);
  }
  const rename = (id: string, value: string) => app.updateSetup((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, name: value } : p)) }));
  const move = (i: number, d: -1 | 1) => app.updateSetup((s) => { const a = [...s.players]; const j = i + d; if (j < 0 || j >= a.length) return {}; [a[i], a[j]] = [a[j], a[i]]; return { players: a }; });
  const remove = (id: string) => app.updateSetup((s) => ({ players: s.players.filter((p) => p.id !== id) }));
  const toggleGroup = (id: string, on: boolean) => app.updateSetup((s) => ({ selectedGroupIds: on ? [...new Set([...s.selectedGroupIds, id])] : s.selectedGroupIds.filter((x) => x !== id) }));

  function start() {
    const r = app.startGame();
    if (!r.ok) { setStartError(r.error); return; }
    router.push("/game/play");
  }

  const Stepper = ({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
      <div><p className="text-sm font-medium">{label}</p><p className="hint mt-0">{hint}</p></div>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Fewer ${label}`}><Minus className="h-4 w-4" aria-hidden /></button>
        <span className="w-8 text-center text-lg font-semibold" aria-live="polite">{value}</span>
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => onChange(value + 1)} aria-label={`More ${label}`}><Plus className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">New game</h1>
        <p className="mt-1 text-sm text-slate-400">Add players, choose roles and word groups, then pass the device around.</p>
        {app.session && app.session.currentPhase !== "results" && <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">A game is already in progress. Starting a new one will replace it.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4" aria-labelledby="players-h">
          <h2 id="players-h" className="h2">Players <span className="text-sm font-normal text-slate-400">({n})</span></h2>
          <form onSubmit={(e) => { e.preventDefault(); addPlayer(); }} className="flex gap-2" noValidate>
            <div className="flex-1">
              <label htmlFor="pn" className="sr-only">Player name</label>
              <input id="pn" className="input" placeholder="Player name" value={name} maxLength={24} autoComplete="off" aria-invalid={!!addError} onChange={(e) => { setName(e.target.value); setAddError(null); }} />
            </div>
            <button type="submit" className="btn btn-primary"><UserPlus className="h-4 w-4" aria-hidden /> Add</button>
          </form>
          {addError && <p className="error-text -mt-2" role="alert">{addError}</p>}
          {n === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-slate-400">No players yet. Add at least 3 to begin.</p> : (
            <ol className="space-y-2">
              {setup.players.map((p, i) => (
                <li key={p.id}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center text-xs text-slate-500">{i + 1}</span>
                    <input className="input" aria-label={`Name of player ${i + 1}`} value={p.name} maxLength={24} aria-invalid={!!nameErrors[p.id]} onChange={(e) => rename(p.id, e.target.value)} />
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name || "player"} up`}><ArrowUp className="h-4 w-4" aria-hidden /></button>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, 1)} disabled={i === n - 1} aria-label={`Move ${p.name || "player"} down`}><ArrowDown className="h-4 w-4" aria-hidden /></button>
                    <button type="button" className="btn btn-ghost btn-icon text-rose-300" onClick={() => remove(p.id)} aria-label={`Remove ${p.name || "player"}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                  {nameErrors[p.id] && <p className="error-text ml-7">{nameErrors[p.id]}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section className="card space-y-3" aria-labelledby="roles-h">
            <h2 id="roles-h" className="h2">Roles</h2>
            <Stepper label="Undercover" value={setup.undercover} onChange={(v) => app.updateSetup({ undercover: v })} hint="Gets a similar but different word" />
            <Stepper label="Mr. White" value={setup.white} onChange={(v) => app.updateSetup({ white: v })} hint="Gets no word at all" />
            <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 px-3 py-3 text-sm"><span>Civilians (automatic)</span><strong className={civilians < 1 ? "text-rose-300" : "text-white"}>{Math.max(civilians, 0)}</strong></div>
          </section>

          <section className="card space-y-3" aria-labelledby="groups-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="groups-h" className="h2">Word groups</h2>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => app.updateSetup({ selectedGroupIds: groups.filter((g) => g.enabled).map((g) => g.id) })}>Select all enabled</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => app.updateSetup({ selectedGroupIds: [] })}>Clear</button>
              </div>
            </div>
            {groups.length === 0 ? (
              <EmptyState icon={<Info className="h-6 w-6" aria-hidden />} title="No groups" action={<Link href="/library" className="btn btn-primary">Open library</Link>}>Create or restore a group first.</EmptyState>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {[...groups].sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                  <li key={g.id}>
                    <label className={`flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 px-3 text-sm ${g.enabled ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-50"}`}>
                      <input type="checkbox" className="check" disabled={!g.enabled} checked={g.enabled && setup.selectedGroupIds.includes(g.id)} onChange={(e) => toggleGroup(g.id, e.target.checked)} />
                      <span className="min-w-0 flex-1 truncate">{g.name}</span>
                      <span className="text-xs text-slate-400">{g.enabled ? `${groupStats(g).pairs} pairs` : "Disabled"}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
              <div><p className="flex items-center gap-1.5 text-sm font-medium"><Shuffle className="h-4 w-4" aria-hidden /> Random group</p><p className="hint mt-0">Pick one of the selected groups at random each game.</p></div>
              <Switch checked={setup.randomGroup} onChange={(v) => app.updateSetup({ randomGroup: v })} label="Random group" />
            </div>
            <p className={`text-sm ${pool.length ? "text-slate-300" : "text-rose-300"}`}>
              <strong>{pool.length}</strong> valid word pair{pool.length === 1 ? "" : "s"} available
              {pool.length > 0 && <span className="text-slate-400"> · {usedInPool} used this cycle</span>}
            </p>
            {usedInPool > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { app.resetHistory(); toast("Word history cleared."); }}><RotateCcw className="h-4 w-4" aria-hidden /> Reset used-word history</button>}
          </section>

          <section className="card space-y-3" aria-labelledby="rules-h">
            <h2 id="rules-h" className="h2">Rules</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="r-tie" className="label">If votes tie</label>
                <select id="r-tie" className="input" value={settings.tieRule} onChange={(e) => app.setSettings({ tieRule: e.target.value as "revote" | "random" })}>
                  <option value="revote">Revote among tied players</option><option value="random">Eliminate one at random</option></select>
                {settings.tieRule === "revote" && <p className="hint">After 2 tied revotes, one tied player is picked at random.</p>}</div>
              <div><label htmlFor="r-win" className="label">Infiltrators win when</label>
                <select id="r-win" className="input" value={settings.survivalRule} onChange={(e) => app.setSettings({ survivalRule: e.target.value as "parity" | "final-two" })}>
                  <option value="parity">They equal the Civilians</option><option value="final-two">Only 2 players remain</option></select></div>
              <div><label htmlFor="r-timer" className="label">Discussion timer</label>
                <select id="r-timer" className="input" value={settings.timerSeconds} onChange={(e) => app.setSettings({ timerSeconds: Number(e.target.value) })}>
                  <option value={0}>Off</option>{[30, 60, 90, 120, 180, 300].map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} min${s > 60 ? "s" : ""}` : `${s} sec`}</option>)}</select></div>
              <div><label htmlFor="r-limit" className="label">Player limit</label>
                <input id="r-limit" type="number" min={3} max={100} className="input" value={settings.playerLimit} onChange={(e) => app.setSettings({ playerLimit: Math.min(100, Math.max(3, Number(e.target.value) || 3)) })} /></div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
              <div><p className="text-sm font-medium">Keep score</p><p className="hint mt-0">Points carry over between rounds of Play again.</p></div>
              <Switch checked={settings.scoring} onChange={(v) => app.setSettings({ scoring: v })} label="Keep score" />
            </div>
          </section>
        </div>
      </div>

      <div className="card space-y-3">
        {errors.length > 0 && <ul className="space-y-1" role="alert">{errors.map((e) => <li key={e} className="flex items-start gap-2 text-sm text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{e}</li>)}</ul>}
        {warnings.length > 0 && <ul className="space-y-1">{warnings.map((w) => <li key={w} className="flex items-start gap-2 text-sm text-amber-200"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{w}</li>)}</ul>}
        {startError && <p className="error-text" role="alert">{startError}</p>}
        <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={errors.length > 0} onClick={start}><Play className="h-5 w-5" aria-hidden /> Start game</button>
      </div>
    </div>
  );
}
