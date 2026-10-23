"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Mic, Pause, Play, RotateCcw, Skull, Timer, Vote } from "lucide-react";
import type { GameSession } from "@/types/game";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import {
  activePlayers, castVote, continueAfterElimination, finishVoting, playerById, speakingOrder, startDiscussion, startRevote, startVoting, submitWhiteGuess,
} from "@/lib/game/engine";
import { ROLE_LABEL } from "@/lib/game/roles";
import { cn } from "@/lib/utils";

/* ---------- Clue ---------- */
export function CluePhase({ session }: { session: GameSession }) {
  const { dispatchSession } = useApp();
  const order = speakingOrder(session);
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="card space-y-4">
        <div className="flex items-center gap-3"><Mic className="h-6 w-6 text-indigo-300" aria-hidden /><div><h2 className="h2">Clue round</h2><p className="text-sm text-slate-400">Each player gives one spoken clue about their word, in this order.</p></div></div>
        <ol className="space-y-2">
          {order.map((p, i) => (
            <li key={p.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-3", i === 0 ? "border-indigo-400/50 bg-indigo-500/15" : "border-white/10")}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">{i + 1}</span>
              <span className="flex-1 truncate font-medium">{p.name}</span>
              {i === 0 && <span className="badge border-indigo-400/40 text-indigo-200">Starts</span>}
            </li>
          ))}
        </ol>
        <p className="hint">Don’t say your word out loud. Be vague enough to hide, specific enough to be believed.</p>
        <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => dispatchSession(startDiscussion)}>Clues done: start discussion</button>
      </div>
    </div>
  );
}

/* ---------- Discussion ---------- */
export function DiscussionPhase({ session }: { session: GameSession }) {
  const { dispatchSession } = useApp();
  const active = activePlayers(session);
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="card space-y-4">
        <h2 className="h2">Discussion</h2>
        <p className="text-sm text-slate-400">Compare the clues. Who sounds off?</p>
        {session.config.timerSeconds > 0 && <CountDown seconds={session.config.timerSeconds} />}
        <ul className="flex flex-wrap gap-2">{active.map((p) => <li key={p.id} className="badge px-3 py-1.5 text-sm">{p.name}</li>)}</ul>
        <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => dispatchSession(startVoting)}><Vote className="h-5 w-5" aria-hidden /> Proceed to voting</button>
      </div>
    </div>
  );
}

function CountDown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { setRunning(false); return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
  }, [running]);
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  return (
    <div className={cn("flex items-center justify-between rounded-xl border px-4 py-3", left === 0 ? "border-rose-400/50 bg-rose-950/40" : "border-white/10 bg-black/20")}>
      <div className="flex items-center gap-2"><Timer className="h-5 w-5 text-sky-300" aria-hidden /><span className="font-mono text-3xl font-bold tabular-nums" role="timer" aria-live="off">{mm}:{ss}</span>{left === 0 && <span className="text-sm text-rose-300">Time’s up!</span>}</div>
      <div className="flex gap-1">
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => setRunning((r) => !r)} disabled={left === 0} aria-label={running ? "Pause timer" : "Start timer"}>{running ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}</button>
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => { setRunning(false); setLeft(seconds); }} aria-label="Reset timer"><RotateCcw className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  );
}

/* ---------- Voting ---------- */
export function VotingPhase({ session }: { session: GameSession }) {
  const { dispatchSession } = useApp();
  const { toast } = useToast();
  const voters = useMemo(() => speakingOrder(session), [session]);
  const voter = voters.find((v) => !session.votes[v.id]);
  const cast = Object.keys(session.votes).length;
  const [gateFor, setGateFor] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const candidates = (session.revoteCandidates ?? voters.map((p) => p.id)).map((id) => playerById(session, id)!).filter((p) => p?.active);

  function lockIn() {
    if (!voter || !choice) return;
    const r = dispatchSession((s) => castVote(s, voter.id, choice));
    if (!r.ok) { toast(r.error, "error"); return; }
    setChoice(null);
    if (Object.keys(r.value.votes).length >= voters.length) dispatchSession(finishVoting);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between"><h2 className="h2">{session.revoteCandidates ? "Revote" : "Voting"}</h2><span className="badge">{cast} of {voters.length} voted</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${(cast / voters.length) * 100}%` }} /></div>
        {session.revoteCandidates && <p className="text-sm text-amber-200">Tie! Vote again — choose one of: {candidates.map((c) => c.name).join(", ")}.</p>}
        <p className="hint">Votes stay hidden until everyone has voted.</p>
      </div>

      {voter && gateFor !== voter.id && (
        <div className="card pop space-y-4 py-8 text-center">
          <p className="text-slate-400">Pass the device to</p>
          <h3 className="break-words text-3xl font-extrabold">{voter.name}</h3>
          <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => { setGateFor(voter.id); setChoice(null); }}>I’m {voter.name}, show my ballot</button>
        </div>
      )}

      {voter && gateFor === voter.id && (
        <div className="card pop space-y-3">
          <h3 className="font-semibold">{voter.name}, who do you suspect?</h3>
          <ul className="space-y-2" role="radiogroup" aria-label="Vote for a player">
            {candidates.filter((c) => c.id !== voter.id).map((c) => (
              <li key={c.id}>
                <button type="button" role="radio" aria-checked={choice === c.id} onClick={() => setChoice(c.id)}
                  className={cn("flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 text-left font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                    choice === c.id ? "border-indigo-400 bg-indigo-500/25 text-white" : "border-white/10 hover:bg-white/5")}>
                  {c.name}{choice === c.id && <CheckCircle2 className="h-5 w-5 text-indigo-300" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={!choice} onClick={lockIn}>Lock in vote &amp; hide</button>
        </div>
      )}

      {cast > 0 && cast < voters.length && (
        <button type="button" className="btn btn-secondary w-full" onClick={() => { const r = dispatchSession(finishVoting); if (!r.ok) toast(r.error, "error"); }}>End voting now ({cast} vote{cast === 1 ? "" : "s"} counted)</button>
      )}
    </div>
  );
}

/* ---------- Elimination ---------- */
export function EliminationPhase({ session }: { session: GameSession }) {
  const { dispatchSession } = useApp();
  const out = session.lastOutcome;
  const [revealed, setRevealed] = useState(false);
  const rows = out ? Object.entries(out.tally).map(([id, n]) => ({ name: playerById(session, id)?.name ?? "?", n })).sort((a, b) => b.n - a.n) : [];
  if (!out) return null;
  const tally = (
    <ul className="space-y-1 text-sm">{rows.map((r) => <li key={r.name} className="flex justify-between rounded-lg bg-white/5 px-3 py-2"><span>{r.name}</span><span className="font-semibold">{r.n} vote{r.n === 1 ? "" : "s"}</span></li>)}</ul>
  );

  if (out.kind === "tie") {
    const names = out.tied.map((id) => playerById(session, id)?.name).join(" & ");
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="card space-y-4 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" aria-hidden />
          <h2 className="h2">It’s a tie</h2>
          <p className="text-slate-300">{names} received the same number of votes.</p>
          {tally}
          <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => dispatchSession(startRevote)}>Start revote</button>
        </div>
      </div>
    );
  }

  const victim = playerById(session, out.playerId)!;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card space-y-4 text-center">
        <Skull className="mx-auto h-10 w-10 text-rose-300" aria-hidden />
        <h2 className="h2">{victim.name} was voted out</h2>
        {out.byRandomTie && <p className="text-sm text-amber-200">The vote was tied, so one tied player was chosen at random.</p>}
        {tally}
        {!revealed ? (
          <button type="button" className="btn btn-secondary h-12 w-full text-base" onClick={() => setRevealed(true)}>Reveal role</button>
        ) : (
          <>
            <div className={cn("pop rounded-2xl border p-5", victim.role === "civilian" ? "border-sky-400/40 bg-sky-500/10" : victim.role === "undercover" ? "border-violet-400/50 bg-violet-500/15" : "border-amber-400/50 bg-amber-500/10")}>
              <p className="text-sm text-slate-300">{victim.name} was</p>
              <p className="text-3xl font-extrabold">{ROLE_LABEL[victim.role]}</p>
            </div>
            <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => dispatchSession(continueAfterElimination)}>{victim.role === "white" ? "Mr. White’s final guess" : "Continue"}</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Mr. White guess ---------- */
export function WhiteGuessPhase({ session }: { session: GameSession }) {
  const { dispatchSession } = useApp();
  const { toast } = useToast();
  const [guess, setGuess] = useState("");
  const submitting = useRef(false);
  const victim = session.lastOutcome?.kind === "eliminated" ? playerById(session, session.lastOutcome.playerId) : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const r = dispatchSession((s) => submitWhiteGuess(s, guess));
    if (!r.ok) { toast(r.error, "error"); return; }
    submitting.current = true;
    const last = r.value.eliminationHistory[r.value.eliminationHistory.length - 1];
    toast(last?.guessCorrect ? "Correct guess!" : "Wrong guess.", last?.guessCorrect ? "success" : "info");
  }
  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 text-center" noValidate>
        <h2 className="h2">{victim?.name} is Mr. White</h2>
        <p className="text-sm text-slate-300">One guess at the Civilians’ word. If it’s right, Mr. White wins immediately.</p>
        <div className="text-left"><label htmlFor="guess" className="label">Your guess</label><input id="guess" className="input" autoFocus autoComplete="off" value={guess} onChange={(e) => setGuess(e.target.value)} /></div>
        <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={!guess.trim()}>Submit guess</button>
      </form>
    </div>
  );
}
