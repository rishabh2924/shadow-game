"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Ghost, ListPlus, Play, Plus, RotateCcw, Smartphone, Trophy } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Loading } from "@/components/ui/common";
import { groupStats } from "@/lib/words/groups";
import { formatDate } from "@/lib/utils";
import { MAX_WORD_LENGTH } from "@/lib/words/validation";

export function Dashboard() {
  const app = useApp();
  const { toast } = useToast();
  const [quickOpen, setQuickOpen] = useState(false);
  const recent = useMemo(() => [...app.groups].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [app.groups]);

  if (!app.hydrated) return <Loading />;
  const totalPairs = app.groups.reduce((n, g) => n + g.pairs.length, 0);
  const enabled = app.groups.filter((g) => g.enabled).length;
  const s = app.session;
  const inProgress = s && s.currentPhase !== "results";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/25 via-violet-700/15 to-sky-600/20 p-6 sm:p-10">
        <Ghost className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-white/[0.04]" aria-hidden />
        <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">One word apart.<br />Who’s the impostor?</h1>
        <p className="mt-3 max-w-lg text-slate-300">Everyone joins from their own phone, or pass one device around the table. Everyone describes a secret word, but someone has a different one, and someone has none at all.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/online" className="btn btn-primary h-12 px-6 text-base"><Smartphone className="h-5 w-5" aria-hidden /> Play on phones</Link>
          <Link href="/game/setup" className="btn btn-secondary h-12 px-6 text-base"><Play className="h-5 w-5" aria-hidden /> Pass &amp; play</Link>
          {inProgress && <Link href="/game/play" className="btn btn-secondary h-12 px-6 text-base">Resume game</Link>}
          {s && s.currentPhase === "results" && <Link href="/game/results" className="btn btn-secondary h-12 px-6 text-base"><Trophy className="h-5 w-5" aria-hidden /> Last results</Link>}
        </div>
      </section>

      <section aria-label="Library summary" className="grid grid-cols-3 gap-3">
        {[["Groups", app.groups.length], ["Word pairs", totalPairs], ["Enabled groups", enabled]].map(([label, n]) => (
          <div key={label} className="card text-center"><p className="text-2xl font-bold text-white sm:text-3xl">{n}</p><p className="mt-1 text-xs text-slate-400 sm:text-sm">{label}</p></div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Word library</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/library/new" className="btn btn-secondary btn-sm"><Plus className="h-4 w-4" aria-hidden /> New group</Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickOpen(true)} disabled={!app.groups.length}><ListPlus className="h-4 w-4" aria-hidden /> Add word pairs</button>
            <Link href="/library" className="btn btn-ghost btn-sm"><BookOpen className="h-4 w-4" aria-hidden /> Open library</Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-7 w-7" aria-hidden />} title="No word groups yet"
            action={<>
              <Link href="/library/new" className="btn btn-primary">Create a group</Link>
              <button type="button" className="btn btn-secondary" onClick={() => toast(`Restored ${app.restoreStarterGroups()} starter groups.`)}><RotateCcw className="h-4 w-4" aria-hidden /> Restore starter groups</button>
            </>}>
            You need at least one group with a word pair to start a game.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((g) => (
              <Link key={g.id} href={`/library/${g.id}`} className="card block transition hover:border-indigo-400/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                <div className="flex items-center justify-between gap-2"><h3 className="truncate font-semibold text-white">{g.name}</h3>{!g.enabled && <span className="badge">Disabled</span>}</div>
                <p className="mt-1 text-sm text-slate-400">{groupStats(g).pairs} pairs · updated {formatDate(g.updatedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <QuickAdd open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
}

function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} title="Add word pairs" description="Pick a group and add as many pairs as you like.">{open && <QuickAddForm />}</Dialog>;
}

function QuickAddForm() {
  const { groups, addPair } = useApp();
  const { toast } = useToast();
  const sorted = useMemo(() => [...groups].sort((a, b) => b.updatedAt - a.updatedAt), [groups]);
  const [gid, setGid] = useState(sorted[0]?.id ?? "");
  const [civ, setCiv] = useState("");
  const [und, setUnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = addPair(gid, civ, und);
    if (!r.ok) { setError(r.error); return; }
    setCiv(""); setUnd(""); setError(null); setCount((c) => c + 1);
    toast("Word pair added.");
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div><label htmlFor="qa-g" className="label">Group</label>
        <select id="qa-g" className="input" value={gid} onChange={(e) => { setGid(e.target.value); setError(null); }}>{sorted.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="qa-c" className="label">Civilian word</label><input id="qa-c" className="input" autoFocus value={civ} maxLength={MAX_WORD_LENGTH} onChange={(e) => { setCiv(e.target.value); setError(null); }} /></div>
        <div><label htmlFor="qa-u" className="label">Undercover word</label><input id="qa-u" className="input" value={und} maxLength={MAX_WORD_LENGTH} onChange={(e) => { setUnd(e.target.value); setError(null); }} /></div>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-sm text-slate-400">{count > 0 && `${count} added`}</span>
        <button type="submit" className="btn btn-primary">Add pair</button>
      </div>
    </form>
  );
}
