"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileUp } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useApp } from "@/components/providers/app-provider";
import { addPairsToGroup, parseImportFile, type ConflictMode, type ParsedImport } from "@/lib/words/imports";
import { downloadText, SAMPLE_CSV } from "@/lib/words/exports";
import { normalizeWord } from "@/lib/words/normalization";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, pairs are added to this single group instead of creating groups. */
  targetGroupId?: string;
}

export function ImportDialog({ open, onClose, targetGroupId }: Props) {
  return (
    <Dialog open={open} onClose={onClose} wide title={targetGroupId ? "Import word pairs" : "Import groups"}
      description="Choose a CSV or JSON file. You can review everything before anything is saved.">
      {open && <Body onClose={onClose} targetGroupId={targetGroupId} />}
    </Dialog>
  );
}

function Body({ onClose, targetGroupId }: { onClose: () => void; targetGroupId?: string }) {
  const { groups, importGroups, importPairs } = useApp();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [mode, setMode] = useState<ConflictMode>("skip");
  const target = targetGroupId ? groups.find((g) => g.id === targetGroupId) : undefined;

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) { setParsed({ groups: [], issues: [{ where: "File", message: "File is larger than 5 MB." }] }); setFileName(f.name); return; }
    setFileName(f.name);
    try {
      const text = await f.text();
      setParsed(parseImportFile(f.name, text, targetGroupId ? { defaultGroupName: "Imported" } : {}));
    } catch {
      setParsed({ groups: [], issues: [{ where: "File", message: "The file could not be read." }] });
    }
  }

  const rawPairs = useMemo(() => (parsed ? parsed.groups.flatMap((g) => g.pairs) : []), [parsed]);
  // Dry run for single-group mode: which pairs would conflict with words already in the group?
  const dry = useMemo(() => (target ? addPairsToGroup(groups, target.id, rawPairs) : null), [groups, target, rawPairs]);
  const conflicts = parsed && !target ? parsed.groups.filter((g) => groups.some((x) => normalizeWord(x.name) === normalizeWord(g.name))) : [];
  const totalPairs = parsed ? parsed.groups.reduce((n, g) => n + g.pairs.length, 0) : 0;
  const canImport = target ? (dry?.added ?? 0) > 0 : !!parsed && parsed.groups.length > 0;

  function confirm() {
    if (!parsed) return;
    if (target) {
      const r = importPairs(target.id, rawPairs);
      toast(`Added ${r.added} pair${r.added === 1 ? "" : "s"}${r.failures.length ? `, skipped ${r.failures.length}` : ""}.`);
    } else {
      const r = importGroups(parsed, mode);
      toast(`Imported ${r.groupsAdded} group${r.groupsAdded === 1 ? "" : "s"} (${r.pairsAdded} pairs)${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}.`, r.groupsAdded ? "success" : "info");
    }
    onClose();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" id="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor="import-file" className="btn btn-secondary cursor-pointer focus-within:ring-2"><FileUp className="h-4 w-4" aria-hidden /> Choose file</label>
        <button type="button" className="btn btn-ghost" onClick={() => downloadText("shadow-words-template.csv", SAMPLE_CSV, "text/csv")}>
          <Download className="h-4 w-4" aria-hidden /> Sample template
        </button>
        {fileName && <span className="truncate text-sm text-slate-400">{fileName}</span>}
      </div>
      {!parsed && <p className="hint">CSV columns: <code>groupName,civilianWord,undercoverWord,description</code> (optional <code>enabled</code>).</p>}

      {parsed && (
        <>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            {target ? (
              <p><strong>{dry?.added ?? 0}</strong> pair{dry?.added === 1 ? "" : "s"} can be added to “{target.name}”.
                {dry && dry.failures.length > 0 && <> <strong>{dry.failures.length}</strong> conflict with existing words and will be skipped.</>}</p>
            ) : (
              <p><strong>{parsed.groups.length}</strong> group{parsed.groups.length === 1 ? "" : "s"} · <strong>{totalPairs}</strong> valid pairs{parsed.issues.length > 0 && <> · <span className="text-amber-300">{parsed.issues.length} invalid</span></>}</p>
            )}
          </div>

          {!target && parsed.groups.length > 0 && (
            <ul className="max-h-48 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10 text-sm">
              {parsed.groups.map((g) => {
                const clash = conflicts.includes(g);
                return (
                  <li key={g.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate">{g.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                      {clash && <span className="badge border-amber-400/30 text-amber-200">Name exists</span>}
                      {g.pairs.length} pairs
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {conflicts.length > 0 && (
            <fieldset className="space-y-2 text-sm">
              <legend className="label">{conflicts.length} group name{conflicts.length === 1 ? "" : "s"} already exist{conflicts.length === 1 ? "s" : ""}. What should happen?</legend>
              {([["skip", "Skip those groups (keep my existing ones)"], ["rename", "Import them as separately named groups"]] as const).map(([v, text]) => (
                <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3">
                  <input type="radio" name="conflict" className="h-4 w-4 accent-indigo-500" checked={mode === v} onChange={() => setMode(v)} /> {text}
                </label>
              ))}
            </fieldset>
          )}

          {target && dry && dry.failures.length > 0 && (
            <IssueList title="Conflicts (skipped)" items={dry.failures.map((f) => ({ where: `${f.pair.civilianWord} / ${f.pair.undercoverWord}`, message: f.error }))} />
          )}
          {parsed.issues.length > 0 && <IssueList title="Invalid rows (skipped)" items={parsed.issues} />}
        </>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={!canImport} onClick={confirm}>
          {parsed?.issues.length ? "Skip invalid & import" : "Import"}
        </button>
      </div>
    </div>
  );
}

function IssueList({ title, items }: { title: string; items: { where: string; message: string }[] }) {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-3 text-sm">
      <p className="mb-1 flex items-center gap-2 font-medium text-amber-200"><AlertTriangle className="h-4 w-4" aria-hidden /> {title}</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-amber-100/90">
        {items.slice(0, 100).map((i, n) => <li key={n}><strong>{i.where}:</strong> {i.message}</li>)}
        {items.length > 100 && <li>…and {items.length - 100} more.</li>}
      </ul>
    </div>
  );
}
