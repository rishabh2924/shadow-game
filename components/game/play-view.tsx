"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gamepad2, LogOut } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, Loading } from "@/components/ui/common";
import { RevealPhase } from "./reveal-phase";
import { CluePhase, DiscussionPhase, EliminationPhase, VotingPhase, WhiteGuessPhase } from "./round-phases";
import { activePlayers } from "@/lib/game/engine";

const LABEL = { reveal: "Secret words", clue: "Clues", discussion: "Discussion", voting: "Voting", elimination: "Elimination", mrwhite: "Mr. White’s guess", results: "Results" } as const;

export function PlayView() {
  const { hydrated, session, quitGame } = useApp();
  const router = useRouter();
  const [quitOpen, setQuitOpen] = useState(false);
  const phase = session?.currentPhase;

  useEffect(() => { if (hydrated && phase === "results") router.replace("/game/results"); }, [hydrated, phase, router]);

  if (!hydrated) return <Loading />;
  if (!session) return <EmptyState icon={<Gamepad2 className="h-7 w-7" aria-hidden />} title="No game in progress" action={<Link href="/game/setup" className="btn btn-primary">Set up a game</Link>}>Start a new game to begin playing.</EmptyState>;
  if (session.currentPhase === "results") return <Loading label="Opening results…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{session.currentPhase === "reveal" ? "Setting up" : `Round ${session.currentRound} · ${activePlayers(session).length} players left`}</p>
          <h1 className="text-xl font-bold">{LABEL[session.currentPhase]}</h1>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuitOpen(true)}><LogOut className="h-4 w-4" aria-hidden /> Quit</button>
      </div>

      {session.currentPhase === "reveal" && <RevealPhase key={session.id} session={session} />}
      {session.currentPhase === "clue" && <CluePhase session={session} />}
      {session.currentPhase === "discussion" && <DiscussionPhase session={session} />}
      {session.currentPhase === "voting" && <VotingPhase key={`${session.currentRound}-${session.voteAttempt}`} session={session} />}
      {session.currentPhase === "elimination" && <EliminationPhase key={`${session.currentRound}-${session.voteAttempt}-${session.lastOutcome?.kind}`} session={session} />}
      {session.currentPhase === "mrwhite" && <WhiteGuessPhase session={session} />}

      <ConfirmDialog open={quitOpen} title="Quit this game?" confirmLabel="Quit game" message="The current game and its roles will be discarded. Your player list and word groups are kept."
        onCancel={() => setQuitOpen(false)} onConfirm={() => { quitGame(); setQuitOpen(false); router.push("/"); }} />
    </div>
  );
}
