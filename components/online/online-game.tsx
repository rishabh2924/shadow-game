"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Crown, EyeOff, Home, Mic, Play, Skull, Timer, Trophy, Vote } from "lucide-react";
import type { GamePlayerView, GameView, RoomView } from "@/types/online";
import { ROLE_LABEL } from "@/lib/game/roles";
import { cn } from "@/lib/utils";
import type { RoomHandle } from "./use-room";
import { Dot, Section, WaitingForHost, WordPeek, useDo } from "./ui";

const LABEL = { reveal: "Secret words", clue: "Clues", discussion: "Discussion", voting: "Voting", elimination: "Elimination", mrwhite: "Mr. White’s guess", results: "Results" } as const;
const WINNER = {
  civilians: { title: "Civilians win!", sub: "Every Undercover and Mr. White player was found." },
  infiltrators: { title: "The Undercover team wins!", sub: "They blended in until the Civilians could no longer outvote them." },
  white: { title: "Mr. White wins!", sub: "A correct guess at the Civilians’ word." },
} as const;

type Do = ReturnType<typeof useDo>;
interface P { view: RoomView; game: GameView; d: Do }

export function OnlineGame({ room }: { room: RoomHandle }) {
  const view = room.view!;
  const game = view.game!;
  const d = useDo(room);
  const left = game.players.filter((p) => p.active).length;
  const props: P = { view, game, d };

  return (
    <Section className="max-w-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-400">{game.phase === "reveal" ? `Room ${view.code}` : game.phase === "results" ? `Room ${view.code}` : `Round ${game.round} · ${left} players left`}</p>
          <h1 className="text-xl font-bold">{LABEL[game.phase]}</h1>
        </div>
        {game.phase !== "results" && <WordPeek word={game.myWord} white={game.iAmWhite} />}
      </div>

      {!game.amActive && game.phase !== "results" && game.phase !== "reveal" && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-100"><Skull className="h-4 w-4 shrink-0" aria-hidden /> You’re out. Keep watching, and keep quiet about what you know!</p>
      )}

      {game.phase === "reveal" && <Reveal {...props} />}
      {game.phase === "clue" && <Clue {...props} />}
      {game.phase === "discussion" && <Discussion {...props} />}
      {game.phase === "voting" && <Voting key={`${game.round}-${game.voteAttempt}`} {...props} />}
      {game.phase === "elimination" && <Elimination {...props} />}
      {game.phase === "mrwhite" && <WhiteGuess {...props} />}
      {game.phase === "results" && <Results {...props} />}
    </Section>
  );
}

const nameOf = (g: GameView, id: string) => g.players.find((p) => p.id === id)?.name ?? "?";
const HostButton = ({ d, onClick, children, disabled }: { d: Do; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={d.busy || disabled} onClick={onClick}>{children}</button>
);

/* ---------------------------------------------------------------- reveal */

function Reveal({ view, game, d }: P) {
  const [shown, setShown] = useState(false);
  const [seen, setSeen] = useState(false);
  const ready = game.readyIds.includes(view.me.id);
  const pending = game.players.filter((p) => !game.readyIds.includes(p.id));

  useEffect(() => { if (shown) setSeen(true); }, [shown]);

  return (
    <div className="card space-y-4 text-center">
      <p className="text-sm text-slate-400">Only you can see your card. Keep your screen to yourself.</p>
      <div className="mx-auto flex min-h-44 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-2xl border border-sky-400/40 bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-sky-600/40 p-5 shadow-lg shadow-indigo-900/40" aria-live="polite">
        {!shown ? <EyeOff className="h-12 w-12 text-indigo-200/70" aria-hidden />
          : game.iAmWhite ? (<><p className="text-3xl font-extrabold text-white">You are Mr. White</p><p className="text-sm text-slate-200">You have no word. Listen closely, bluff convincingly, and work out the Civilians’ word.</p></>)
          : (<><p className="text-xs text-slate-300">Your secret word</p><p className="break-words text-4xl font-extrabold text-white">{game.myWord}</p></>)}
      </div>
      <button type="button" className="btn btn-secondary h-12 w-full text-base" onClick={() => setShown((s) => !s)}>{shown ? "Hide my word" : seen ? "Show my word again" : "Tap to reveal my word"}</button>
      {!ready ? (
        <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={!seen || d.busy} onClick={() => d.run({ type: "ready" })}><CheckCircle2 className="h-5 w-5" aria-hidden /> I’ve got it, I’m ready</button>
      ) : (
        <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">You’re ready. Waiting for {pending.length} more: {pending.map((p) => p.name).join(", ")}</p>
      )}
      {view.me.isHost && pending.length > 0 && ready && (
        <button type="button" className="btn btn-ghost btn-sm" disabled={d.busy} onClick={() => d.run({ type: "skipReveal" })}>Start without waiting</button>
      )}
      <p className="text-xs text-slate-400">{game.readyIds.length} of {game.players.length} ready</p>
    </div>
  );
}

/* ------------------------------------------------------------------ clue */

function Clue({ view, game, d }: P) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3"><Mic className="h-6 w-6 text-indigo-300" aria-hidden /><div><h2 className="h2">Clue round</h2><p className="text-sm text-slate-400">Each player gives one spoken clue, in this order.</p></div></div>
      <ol className="space-y-2">
        {game.speakingOrder.map((id, i) => (
          <li key={id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-3", i === 0 ? "border-indigo-400/50 bg-indigo-500/15" : "border-white/10")}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">{i + 1}</span>
            <span className="flex-1 truncate font-medium">{nameOf(game, id)}{id === view.me.id && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</span>
            {i === 0 && <span className="badge border-indigo-400/40 text-indigo-200">Starts</span>}
          </li>
        ))}
      </ol>
      <p className="hint">Don’t say your word. Be vague enough to hide, specific enough to be believed.</p>
      {view.me.isHost ? <HostButton d={d} onClick={() => d.run({ type: "startDiscussion" })}>Clues done: start discussion</HostButton> : <WaitingForHost view={view} run={d.run} busy={d.busy} what="the host to end the clue round" />}
    </div>
  );
}

/* ------------------------------------------------------------ discussion */

/** Shared countdown: every phone computes it from the server's clock, so they all agree. */
function useRemaining(view: RoomView, game: GameView) {
  const offset = useRef(0);
  offset.current = view.serverTime - Date.now();
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 500); return () => clearInterval(t); }, []);
  if (!game.config.timerSeconds) return null;
  const elapsed = Math.floor((Date.now() + offset.current - game.phaseStartedAt) / 1000);
  return Math.max(0, game.config.timerSeconds - Math.max(0, elapsed));
}

function Discussion({ view, game, d }: P) {
  const left = useRemaining(view, game);
  const mm = left === null ? 0 : Math.floor(left / 60), ss = left === null ? "00" : String(left % 60).padStart(2, "0");
  return (
    <div className="card space-y-4">
      <h2 className="h2">Discussion</h2>
      <p className="text-sm text-slate-400">Compare the clues. Who sounds off?</p>
      {left !== null && (
        <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3", left === 0 ? "border-rose-400/50 bg-rose-950/40" : "border-white/10 bg-black/20")}>
          <Timer className="h-5 w-5 text-sky-300" aria-hidden /><span className="font-mono text-3xl font-bold tabular-nums" role="timer" aria-live="off">{mm}:{ss}</span>{left === 0 && <span className="text-sm text-rose-300">Time’s up!</span>}
        </div>
      )}
      <ul className="flex flex-wrap gap-2">{game.players.filter((p) => p.active).map((p) => <li key={p.id} className="badge px-3 py-1.5 text-sm">{p.name}</li>)}</ul>
      {view.me.isHost ? <HostButton d={d} onClick={() => d.run({ type: "startVoting" })}><Vote className="h-5 w-5" aria-hidden /> Proceed to voting</HostButton> : <WaitingForHost view={view} run={d.run} busy={d.busy} what="the host to open voting" />}
    </div>
  );
}

/* ---------------------------------------------------------------- voting */

function Voting({ view, game, d }: P) {
  const voters = game.players.filter((p) => p.active);
  const voted = game.votedIds.length;
  const [choice, setChoice] = useState<string | null>(null);
  const candidates = (game.revoteCandidates ? game.players.filter((p) => game.revoteCandidates!.includes(p.id)) : voters).filter((p) => p.active && p.id !== view.me.id);
  const waitingOn = voters.filter((p) => !game.votedIds.includes(p.id));

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between"><h2 className="h2">{game.revoteCandidates ? "Revote" : "Voting"}</h2><span className="badge">{voted} of {voters.length} voted</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${(voted / Math.max(1, voters.length)) * 100}%` }} /></div>
        {game.revoteCandidates && <p className="text-sm text-amber-200">Tie! Vote again. Choose one of: {game.revoteCandidates.map((id) => nameOf(game, id)).join(", ")}.</p>}
        <p className="hint">Votes stay hidden until everyone has voted.</p>
      </div>

      {game.amActive && !game.myVote && (
        <div className="card pop space-y-3">
          <h3 className="font-semibold">{view.me.name}, who do you suspect?</h3>
          <ul className="space-y-2" role="radiogroup" aria-label="Vote for a player">
            {candidates.map((c) => (
              <li key={c.id}>
                <button type="button" role="radio" aria-checked={choice === c.id} onClick={() => setChoice(c.id)}
                  className={cn("flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 text-left font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                    choice === c.id ? "border-indigo-400 bg-indigo-500/25 text-white" : "border-white/10 hover:bg-white/5")}>
                  {c.name}{choice === c.id && <CheckCircle2 className="h-5 w-5 text-indigo-300" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={!choice || d.busy} onClick={() => choice && d.run({ type: "vote", targetId: choice })}>Lock in my vote</button>
        </div>
      )}

      {game.amActive && game.myVote && (
        <div className="card space-y-1 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" aria-hidden /><p className="font-medium">Vote locked in for {nameOf(game, game.myVote)}</p>
          {waitingOn.length > 0 && <p className="text-sm text-slate-400">Waiting for {waitingOn.map((p) => p.name).join(", ")}</p>}</div>
      )}

      {!game.amActive && waitingOn.length > 0 && <p className="text-center text-sm text-slate-400">Waiting for {waitingOn.map((p) => p.name).join(", ")}</p>}

      {view.me.isHost && voted > 0 && voted < voters.length && (
        <button type="button" className="btn btn-secondary w-full" disabled={d.busy} onClick={() => d.run({ type: "finishVoting" })}>End voting now ({voted} vote{voted === 1 ? "" : "s"} counted)</button>
      )}
      {!view.me.isHost && !view.hostConnected && <WaitingForHost view={view} run={d.run} busy={d.busy} what="the others" />}
    </div>
  );
}

/* ----------------------------------------------------------- elimination */

function Elimination({ view, game, d }: P) {
  const out = game.lastOutcome;
  if (!out) return null;
  const rows = Object.entries(out.tally).map(([id, n]) => ({ name: nameOf(game, id), n })).sort((a, b) => b.n - a.n);
  const tally = <ul className="space-y-1 text-sm">{rows.map((r) => <li key={r.name} className="flex justify-between rounded-lg bg-white/5 px-3 py-2"><span>{r.name}</span><span className="font-semibold">{r.n} vote{r.n === 1 ? "" : "s"}</span></li>)}</ul>;

  if (out.kind === "tie") {
    return (
      <div className="card space-y-4 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" aria-hidden />
        <h2 className="h2">It’s a tie</h2>
        <p className="text-slate-300">{out.tied.map((id) => nameOf(game, id)).join(" & ")} received the same number of votes.</p>
        {tally}
        {view.me.isHost ? <HostButton d={d} onClick={() => d.run({ type: "revote" })}>Start revote</HostButton> : <WaitingForHost view={view} run={d.run} busy={d.busy} what="the host to start the revote" />}
      </div>
    );
  }

  const victim = game.players.find((p) => p.id === out.playerId)!;
  return (
    <div className="card space-y-4 text-center">
      <Skull className="mx-auto h-10 w-10 text-rose-300" aria-hidden />
      <h2 className="h2">{victim.name} was voted out{victim.id === view.me.id && " (that’s you)"}</h2>
      {out.byRandomTie && <p className="text-sm text-amber-200">The vote was tied, so one tied player was chosen at random.</p>}
      {tally}
      <div className={cn("pop rounded-2xl border p-5", victim.role === "civilian" ? "border-sky-400/40 bg-sky-500/10" : victim.role === "undercover" ? "border-violet-400/50 bg-violet-500/15" : "border-amber-400/50 bg-amber-500/10")}>
        <p className="text-sm text-slate-300">{victim.name} was</p>
        <p className="text-3xl font-extrabold">{victim.role ? ROLE_LABEL[victim.role] : "?"}</p>
      </div>
      {view.me.isHost ? <HostButton d={d} onClick={() => d.run({ type: "continue" })}>{victim.role === "white" ? "Mr. White’s final guess" : "Continue"}</HostButton> : <WaitingForHost view={view} run={d.run} busy={d.busy} what="the host to continue" />}
    </div>
  );
}

/* ------------------------------------------------------------ Mr. White */

function WhiteGuess({ view, game, d }: P) {
  const [guess, setGuess] = useState("");
  const out = game.lastOutcome;
  const victimId = out?.kind === "eliminated" ? out.playerId : null;
  const itsMe = victimId === view.me.id;

  if (!itsMe) {
    return <div className="card space-y-2 text-center"><h2 className="h2">{victimId ? nameOf(game, victimId) : "Mr. White"} is Mr. White</h2><p className="text-sm text-slate-300">They get one guess at the Civilians’ word. If it’s right, Mr. White wins.</p><p className="text-sm text-slate-400">Waiting for the guess…</p></div>;
  }
  return (
    <form className="card space-y-4 text-center" noValidate onSubmit={(e) => { e.preventDefault(); if (guess.trim()) void d.run({ type: "guess", guess }); }}>
      <h2 className="h2">You’re Mr. White</h2>
      <p className="text-sm text-slate-300">One guess at the Civilians’ word. If it’s right, you win immediately.</p>
      <div className="text-left"><label htmlFor="guess" className="label">Your guess</label><input id="guess" className="input h-12 text-base" autoFocus autoComplete="off" maxLength={80} value={guess} onChange={(e) => setGuess(e.target.value)} /></div>
      <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={!guess.trim() || d.busy}>Submit guess</button>
    </form>
  );
}

/* --------------------------------------------------------------- results */

function Results({ view, game, d }: P) {
  const w = WINNER[game.winner ?? "civilians"];
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const role = (p: GamePlayerView) => p.role ?? "civilian";
  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-violet-700/20 to-sky-600/25 p-6 text-center">
        <Trophy className="mx-auto h-12 w-12 text-amber-300" aria-hidden />
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{w.title}</h2>
        <p className="mt-1 text-slate-300">{w.sub}</p>
      </section>

      {game.words && (
        <section className="grid grid-cols-2 gap-3">
          <div className="card text-center"><p className="text-xs text-slate-400">Civilian word</p><p className="mt-1 break-words text-xl font-bold text-sky-200">{game.words.civilianWord}</p></div>
          <div className="card text-center"><p className="text-xs text-slate-400">Undercover word</p><p className="mt-1 break-words text-xl font-bold text-violet-200">{game.words.undercoverWord}</p></div>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="h2">Players &amp; roles</h2>
        <ul className="space-y-2">
          {game.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", !p.active && "text-slate-400 line-through decoration-slate-600")}>{p.name}{p.id === view.me.id && " (you)"}</p>
                <p className="text-xs text-slate-400">{p.word ?? "No word"}</p>
              </div>
              <span className={cn("badge", role(p) === "civilian" && "border-sky-400/30 text-sky-200", role(p) === "undercover" && "border-violet-400/40 text-violet-200", role(p) === "white" && "border-amber-400/40 text-amber-200")}>{ROLE_LABEL[role(p)]}</span>
              {game.pointsAwarded[p.id] ? <span className="text-sm font-semibold text-emerald-300">+{game.pointsAwarded[p.id]}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Elimination history</h2>
        {game.eliminationHistory.length === 0 ? <p className="text-sm text-slate-400">Nobody was eliminated.</p> : (
          <ol className="space-y-2 text-sm">
            {game.eliminationHistory.map((e, i) => (
              <li key={i} className="rounded-xl border border-white/10 px-3 py-2">
                <span className="text-slate-400">Round {e.round}:</span> <strong>{e.playerName}</strong> ({ROLE_LABEL[e.role]}) · {e.votes} vote{e.votes === 1 ? "" : "s"}{e.byRandomTie && " · random tiebreak"}
                {e.guess !== undefined && <span className="block text-xs text-slate-400">Mr. White guessed “{e.guess}”: {e.guessCorrect ? "correct" : "wrong"}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {game.config.scoring && (
        <section className="card space-y-2">
          <h2 className="h2 flex items-center gap-2"><Crown className="h-5 w-5 text-amber-300" aria-hidden /> Scoreboard</h2>
          <ol className="space-y-1.5 text-sm">{sorted.map((p, i) => <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"><span className="flex items-center gap-2"><Dot on={p.connected} />{i + 1}. {p.name}</span><strong>{p.score}</strong></li>)}</ol>
        </section>
      )}

      {view.me.isHost ? (
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary h-12 text-base" disabled={d.busy} onClick={() => d.run({ type: "playAgain" })}><Play className="h-5 w-5" aria-hidden /> Play again (keep scores)</button>
          <button type="button" className="btn btn-secondary h-12 text-base" disabled={d.busy} onClick={() => d.run({ type: "lobby" })}><Home className="h-5 w-5" aria-hidden /> Back to lobby</button>
        </div>
      ) : <WaitingForHost view={view} run={d.run} busy={d.busy} what="the host to start the next game" />}
    </>
  );
}
