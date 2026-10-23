"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import type { RawPair, WordPair } from "@/types/words";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { Loading, Switch } from "@/components/ui/common";
import { MAX_DESCRIPTION, MAX_GROUP_NAME, validateGroupName } from "@/lib/words/groups";
import { MAX_WORD_LENGTH, validateWordPair } from "@/lib/words/validation";

export function NewGroupForm() {
  const { hydrated, groups, createGroup } = useApp();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [pairs, setPairs] = useState<RawPair[]>([]);
  const [civ, setCiv] = useState("");
  const [und, setUnd] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [pairError, setPairError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const civRef = useRef<HTMLInputElement>(null);

  if (!hydrated) return <Loading />;

  const asPairs = (): WordPair[] => pairs.map((p, i) => ({ id: String(i), ...p, createdAt: 0, updatedAt: 0 }));

  function addPair() {
    const v = validateWordPair(asPairs(), civ, und);
    if (!v.ok) { setPairError({ field: v.field, message: v.error }); return; }
    setPairs((p) => [...p, v.value]);
    setCiv(""); setUnd(""); setPairError(null);
    civRef.current?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = validateGroupName(groups, name);
    if (!n.ok) { setNameError(n.error); return; }
    setBusy(true);
    const r = createGroup({ name, description, enabled, pairs });
    if (!r.ok) { setBusy(false); if (r.field === "name") setNameError(r.error); else setPairError({ field: r.field, message: r.error }); return; }
    toast(`Created “${r.value.group.name}”.`);
    router.push(`/library/${r.value.group.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/library" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Library</Link>
        <h1 className="h1">Create word group</h1>
        <p className="mt-1 text-sm text-slate-400">Add as many pairs as you like now. You can edit them any time.</p>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="card space-y-4">
          <div>
            <label htmlFor="ng-name" className="label">Group name</label>
            <input id="ng-name" className="input" value={name} maxLength={MAX_GROUP_NAME} autoFocus aria-invalid={!!nameError} aria-describedby={nameError ? "ng-name-err" : undefined}
              onChange={(e) => { setName(e.target.value); setNameError(null); }} placeholder="e.g. Office life" />
            {nameError && <p id="ng-name-err" className="error-text">{nameError}</p>}
          </div>
          <div>
            <label htmlFor="ng-desc" className="label">Description <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea id="ng-desc" rows={2} className="input py-2" value={description} maxLength={MAX_DESCRIPTION} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Enabled for games</span>
            <Switch checked={enabled} onChange={setEnabled} label="Enabled for games" />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="h2">Word pairs <span className="text-sm font-normal text-slate-400">({pairs.length})</span></h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="ng-civ" className="label">Civilian word</label>
              <input id="ng-civ" ref={civRef} className="input" value={civ} maxLength={MAX_WORD_LENGTH} autoComplete="off" aria-invalid={pairError?.field === "civilianWord"}
                onChange={(e) => { setCiv(e.target.value); setPairError(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPair(); } }} />
            </div>
            <div>
              <label htmlFor="ng-und" className="label">Undercover word</label>
              <input id="ng-und" className="input" value={und} maxLength={MAX_WORD_LENGTH} autoComplete="off" aria-invalid={pairError?.field === "undercoverWord"}
                onChange={(e) => { setUnd(e.target.value); setPairError(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPair(); } }} />
            </div>
            <div className="flex items-end"><button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={addPair}><Plus className="h-4 w-4" aria-hidden /> Add</button></div>
          </div>
          {pairError && <p className="error-text" role="alert">{pairError.message}</p>}
          {pairs.length > 0 && (
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
              {pairs.map((p, i) => (
                <li key={`${p.civilianWord}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate"><strong className="text-white">{p.civilianWord}</strong> <span className="text-slate-500">/</span> <span className="text-violet-200">{p.undercoverWord}</span></span>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setPairs((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${p.civilianWord} / ${p.undercoverWord}`}><X className="h-4 w-4" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/library" className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>Create group</button>
        </div>
      </form>
    </div>
  );
}
