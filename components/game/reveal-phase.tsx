"use client";

import { useEffect, useState } from "react";
import { EyeOff, Hand, ShieldAlert } from "lucide-react";
import type { GameSession } from "@/types/game";
import { useApp } from "@/components/providers/app-provider";
import { advanceReveal } from "@/lib/game/engine";

type Stage = "pass" | "ready" | "shown";

export function RevealPhase({ session }: { session: GameSession }) {
  const { dispatchSession } = useApp();
  const player = session.players[session.revealIndex];
  const total = session.players.length;
  const [stage, setStage] = useState<Stage>("pass");
  const [canHide, setCanHide] = useState(false);

  useEffect(() => {
    if (stage !== "shown") return;
    setCanHide(false);
    const t = setTimeout(() => setCanHide(true), 1200); // guards against accidental double taps
    return () => clearTimeout(t);
  }, [stage]);

  if (!player) return null;
  const isWhite = player.role === "white";

  function hideAndPass() {
    setStage("pass"); // the word is cleared from the screen before the next player is shown
    dispatchSession(advanceReveal);
  }

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <p className="text-sm font-medium text-slate-400">Player {session.revealIndex + 1} of {total}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.revealIndex}>
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${(session.revealIndex / total) * 100}%` }} />
      </div>

      {stage === "pass" && (
        <div className="card pop space-y-5 py-8">
          <Hand className="mx-auto h-10 w-10 text-indigo-300" aria-hidden />
          <div>
            <p className="text-slate-400">{session.revealIndex === 0 ? "Hand the device to" : "Pass the device to"}</p>
            <h2 className="mt-1 break-words text-3xl font-extrabold text-white">{player.name}</h2>
          </div>
          <p className="mx-auto flex max-w-xs items-start gap-2 text-left text-xs text-slate-400"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden /> Everyone else: look away. Never peek at another player’s card.</p>
          <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => setStage("ready")}>I’m {player.name}</button>
        </div>
      )}

      {stage === "ready" && (
        <div className="card pop space-y-5 py-8">
          <h2 className="text-xl font-bold">{player.name}, your secret card</h2>
          <div className="mx-auto flex h-44 w-full max-w-xs items-center justify-center rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-900/60 to-violet-900/60 shadow-inner">
            <EyeOff className="h-12 w-12 text-indigo-300/70" aria-hidden />
          </div>
          <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={() => setStage("shown")}>Reveal my word</button>
        </div>
      )}

      {stage === "shown" && (
        <div className="card pop space-y-5 py-8" aria-live="polite">
          <h2 className="text-xl font-bold">{player.name}</h2>
          <div className="mx-auto flex min-h-44 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-2xl border border-sky-400/40 bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-sky-600/40 p-5 shadow-lg shadow-indigo-900/40">
            {isWhite ? (
              <>
                <p className="text-3xl font-extrabold text-white">You are Mr. White</p>
                <p className="text-sm text-slate-200">You have no word. Listen closely, bluff convincingly, and work out the Civilians’ word.</p>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-300">Your secret word</p>
                <p className="break-words text-4xl font-extrabold text-white">{player.assignedWord}</p>
              </>
            )}
          </div>
          <button type="button" className="btn btn-primary h-12 w-full text-base" disabled={!canHide} onClick={hideAndPass}>
            <EyeOff className="h-5 w-5" aria-hidden /> Hide word &amp; pass device
          </button>
        </div>
      )}
    </div>
  );
}
