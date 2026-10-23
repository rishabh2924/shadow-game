"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Hourglass } from "lucide-react";
import type { RoomAction, RoomView } from "@/types/online";
import type { RoomHandle } from "./use-room";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Runs a room action with a busy flag and an error toast. */
export function useDo(room: RoomHandle) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async (action: RoomAction): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    const r = await room.send(action);
    lock.current = false;
    setBusy(false);
    if (!r.ok) toast(r.error, "error");
    return r.ok;
  }, [room, toast]);
  return { busy, run };
}

export function Dot({ on }: { on: boolean }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", on ? "bg-emerald-400" : "bg-slate-600")} title={on ? "Connected" : "Offline"} aria-label={on ? "Connected" : "Offline"} />;
}

/** Shown to everyone except the host, where the host has a button. */
export function WaitingForHost({ view, run, busy, what = "the host" }: { view: RoomView; run: (a: RoomAction) => Promise<boolean>; busy: boolean; what?: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-slate-300">
      <p className="flex items-center justify-center gap-2"><Hourglass className="h-4 w-4" aria-hidden /> Waiting for {what}…</p>
      {!view.hostConnected && (
        <>
          <p className="text-xs text-amber-200">The host seems to be offline.</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run({ type: "claimHost" })}>Take over as host</button>
        </>
      )}
    </div>
  );
}

/** Tap-to-peek at your own word during any phase; hides itself after a few seconds. */
export function WordPeek({ word, white }: { word: string | null; white: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <div className="relative">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShow((s) => !s)} aria-expanded={show}>
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />} My word
      </button>
      {show && (
        <div className="pop absolute right-0 top-11 z-30 w-56 rounded-2xl border border-sky-400/40 bg-slate-900/95 p-4 text-center shadow-2xl backdrop-blur" role="status">
          {white ? <p className="font-bold">You are Mr. White<span className="mt-1 block text-xs font-normal text-slate-300">No word. Bluff!</span></p>
            : <><p className="text-xs text-slate-400">Your secret word</p><p className="break-words text-2xl font-extrabold text-white">{word}</p></>}
        </div>
      )}
    </div>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-md space-y-4", className)}>{children}</div>;
}
