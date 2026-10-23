"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Home, Play, Trophy } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { EmptyState, Loading } from "@/components/ui/common";
import { ROLE_LABEL } from "@/lib/game/roles";
import { cn } from "@/lib/utils";

const WINNER = {
  civilians: { title: "Civilians win!", sub: "Every Undercover and Mr. White player was found." },
  infiltrators: { title: "The Undercover team wins!", sub: "They blended in until the Civilians could no longer outvote them." },
  white: { title: "Mr. White wins!", sub: "A correct guess at the Civilians’ word." },
} as const;

export function ResultsView() {
  const { hydrated, session, playAgain } = useApp();
  const { toast } = useToast();
  const router = useRouter();
  if (!hydrated) return <Loading />;
  if (!session || session.currentPhase !== "results" || !session.winner) {
    return <EmptyState icon={<Trophy className="h-7 w-7" aria-hidden />} title="No finished game"
      action={<><Link href="/game/setup" className="btn btn-primary">New game</Link>{session && <Link href="/game/play" className="btn btn-secondary">Resume game</Link>}</>}>Results appear here when a game ends.</EmptyState>;
  }
  const w = WINNER[session.winner];
  const snap = session.currentPairSnapshot;
  const sorted = [...session.players].sort((a, b) => b.score - a.score);

  function again() {
    const r = playAgain();
    if (!r.ok) { toast(r.error, "error"); return; }
    router.push("/game/play");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-violet-700/20 to-sky-600/25 p-6 text-center sm:p-8">
        <Trophy className="mx-auto h-12 w-12 text-amber-300" aria-hidden />
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{w.title}</h1>
        <p className="mt-1 text-slate-300">{w.sub}</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card text-center"><p className="text-xs text-slate-400">Civilian word</p><p className="mt-1 break-words text-xl font-bold text-sky-200">{snap.civilianWord}</p></div>
        <div className="card text-center"><p className="text-xs text-slate-400">Undercover word</p><p className="mt-1 break-words text-xl font-bold text-violet-200">{snap.undercoverWord}</p></div>
      </section>

      <section className="card space-y-2" aria-labelledby="pl-h">
        <h2 id="pl-h" className="h2">Players &amp; roles</h2>
        <ul className="space-y-2">
          {session.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", !p.active && "text-slate-400 line-through decoration-slate-600")}>{p.name}</p>
                <p className="text-xs text-slate-400">{p.assignedWord ?? "No word"}</p>
              </div>
              <span className={cn("badge", p.role === "civilian" && "border-sky-400/30 text-sky-200", p.role === "undercover" && "border-violet-400/40 text-violet-200", p.role === "white" && "border-amber-400/40 text-amber-200")}>{ROLE_LABEL[p.role]}</span>
              {session.pointsAwarded[p.id] ? <span className="text-sm font-semibold text-emerald-300">+{session.pointsAwarded[p.id]}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2" aria-labelledby="eh-h">
        <h2 id="eh-h" className="h2">Elimination history</h2>
        {session.eliminationHistory.length === 0 ? <p className="text-sm text-slate-400">Nobody was eliminated.</p> : (
          <ol className="space-y-2 text-sm">
            {session.eliminationHistory.map((e, i) => (
              <li key={i} className="rounded-xl border border-white/10 px-3 py-2">
                <span className="text-slate-400">Round {e.round}:</span> <strong>{e.playerName}</strong> ({ROLE_LABEL[e.role]}) · {e.votes} vote{e.votes === 1 ? "" : "s"}{e.byRandomTie && " · random tiebreak"}
                {e.guess !== undefined && <span className="block text-xs text-slate-400">Mr. White guessed “{e.guess}” — {e.guessCorrect ? "correct" : "wrong"}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {session.config.scoring && (
        <section className="card space-y-2" aria-labelledby="sc-h">
          <h2 id="sc-h" className="h2 flex items-center gap-2"><Crown className="h-5 w-5 text-amber-300" aria-hidden /> Scoreboard</h2>
          <ol className="space-y-1.5 text-sm">{sorted.map((p, i) => <li key={p.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-2"><span>{i + 1}. {p.name}</span><strong>{p.score}</strong></li>)}</ol>
          <p className="hint">Civilians win: +2 each. Undercover team wins: +3 each. Mr. White’s correct guess: +5.</p>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn btn-primary h-12 flex-1 text-base" onClick={again}><Play className="h-5 w-5" aria-hidden /> Play again</button>
        <Link href="/" className="btn btn-secondary h-12 flex-1 text-base"><Home className="h-5 w-5" aria-hidden /> Return home</Link>
      </div>
    </div>
  );
}
