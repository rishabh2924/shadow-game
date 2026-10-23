"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, Loading } from "@/components/ui/common";
import { GroupDetailsDialog } from "@/components/library/group-details-dialog";
import { ImportDialog } from "@/components/library/import-dialog";
import { ExportDialog } from "@/components/library/export-dialog";
import { groupStats } from "@/lib/words/groups";
import { normalizeWord } from "@/lib/words/normalization";
import { MAX_WORD_LENGTH } from "@/lib/words/validation";
import type { WordPair } from "@/types/words";

const PAGE_SIZE = 20;
type FieldError = { field?: string; message: string } | null;

export function PairManager() {
  const { groupId } = useParams<{ groupId: string }>();
  const app = useApp();
  const { toast } = useToast();
  const group = app.groups.find((g) => g.id === groupId);

  const [civ, setCiv] = useState("");
  const [und, setUnd] = useState("");
  const [addError, setAddError] = useState<FieldError>(null);
  const civRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editC, setEditC] = useState("");
  const [editU, setEditU] = useState("");
  const [editError, setEditError] = useState<FieldError>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!group) return [];
    const q = normalizeWord(query);
    return group.pairs.filter((p) => !q || normalizeWord(p.civilianWord).includes(q) || normalizeWord(p.undercoverWord).includes(q));
  }, [group, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query]);
  useEffect(() => { setSelected((s) => { const ids = new Set(group?.pairs.map((p) => p.id)); const n = new Set([...s].filter((i) => ids.has(i))); return n.size === s.size ? s : n; }); }, [group]);

  if (!app.hydrated) return <Loading />;
  if (!group) {
    return <EmptyState icon={<Search className="h-7 w-7" aria-hidden />} title="Group not found" action={<Link href="/library" className="btn btn-primary">Back to library</Link>}>This group may have been deleted.</EmptyState>;
  }
  const stats = groupStats(group);

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const r = app.addPair(group!.id, civ, und);
    if (!r.ok) { setAddError({ field: r.field, message: r.error }); return; }
    setCiv(""); setUnd(""); setAddError(null);
    toast("Word pair added.");
    civRef.current?.focus();
  }

  function startEdit(p: WordPair) { setEditingId(p.id); setEditC(p.civilianWord); setEditU(p.undercoverWord); setEditError(null); }

  function saveEdit() {
    if (!editingId) return;
    const r = app.updatePair(group!.id, editingId, editC, editU);
    if (!r.ok) { setEditError({ field: r.field, message: r.error }); return; } // keep the inputs so the user can correct them
    setEditingId(null); setEditError(null);
    toast("Word pair saved.");
  }

  const pageIds = rows.map((p) => p.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n; });

  function confirmDelete() {
    if (!deleteIds) return;
    const r = app.deletePairs(group!.id, deleteIds);
    if (r.ok) { toast(`Deleted ${deleteIds.length} word pair${deleteIds.length === 1 ? "" : "s"}.`); setSelected(new Set()); if (editingId && deleteIds.includes(editingId)) setEditingId(null); }
    else toast(r.error, "error");
    setDeleteIds(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/library" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Library</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="h1 break-words">{group.name}</h1>
            <p className="mt-1 text-sm text-slate-400">{group.description || "No description"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><span className="badge">{stats.pairs} pairs</span><span className="badge">{stats.uniqueWords} unique words</span><span className="badge">{group.enabled ? "Enabled" : "Disabled"}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailsOpen(true)}><Pencil className="h-4 w-4" aria-hidden /> Edit group</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" aria-hidden /> Import</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" aria-hidden /> Export</button>
          </div>
        </div>
      </div>

      <form onSubmit={submitAdd} className="card" noValidate>
        <h2 className="h2 mb-3">Add word pair</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="add-civ" className="label">Civilian word</label>
            <input id="add-civ" ref={civRef} className="input" value={civ} maxLength={MAX_WORD_LENGTH} placeholder="e.g. Coffee" autoComplete="off"
              aria-invalid={addError?.field === "civilianWord"} onChange={(e) => { setCiv(e.target.value); setAddError(null); }} />
          </div>
          <div>
            <label htmlFor="add-und" className="label">Undercover word</label>
            <input id="add-und" className="input" value={und} maxLength={MAX_WORD_LENGTH} placeholder="e.g. Tea" autoComplete="off"
              aria-invalid={addError?.field === "undercoverWord"} onChange={(e) => { setUnd(e.target.value); setAddError(null); }} />
          </div>
          <div className="flex items-end"><button type="submit" className="btn btn-primary w-full sm:w-auto"><Plus className="h-4 w-4" aria-hidden /> Add pair</button></div>
        </div>
        {addError && <p className="error-text" role="alert">{addError.message}</p>}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input className="input pl-9" type="search" placeholder="Search words in this group" aria-label="Search words in this group" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {selected.size > 0 && (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteIds([...selected])}><Trash2 className="h-4 w-4" aria-hidden /> Delete {selected.size} selected</button>
        )}
      </div>

      {group.pairs.length === 0 ? (
        <EmptyState icon={<Plus className="h-7 w-7" aria-hidden />} title="No word pairs yet">Add your first pair above, or import a CSV/JSON file.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="h-7 w-7" aria-hidden />} title="No matching pairs" action={<button type="button" className="btn btn-secondary" onClick={() => setQuery("")}>Clear search</button>}>Nothing in this group matches “{query}”.</EmptyState>
      ) : (
        <div className="card p-0 sm:p-0">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-sm text-slate-300">
            <input type="checkbox" className="check" checked={allOnPage} onChange={toggleAll} aria-label="Select all pairs on this page" />
            <span>{filtered.length} pair{filtered.length === 1 ? "" : "s"}{query && ` matching`}</span>
          </div>
          <ul className="divide-y divide-white/5">
            {rows.map((p) => (
              <li key={p.id} className="px-4 py-3">
                {editingId === p.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className="input" aria-label="Civilian word" value={editC} maxLength={MAX_WORD_LENGTH} autoFocus aria-invalid={editError?.field === "civilianWord"} onChange={(e) => { setEditC(e.target.value); setEditError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                      <input className="input" aria-label="Undercover word" value={editU} maxLength={MAX_WORD_LENGTH} aria-invalid={editError?.field === "undercoverWord"} onChange={(e) => { setEditU(e.target.value); setEditError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                    </div>
                    {editError && <p className="error-text" role="alert">{editError.message}</p>}
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}><Check className="h-4 w-4" aria-hidden /> Save</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingId(null); setEditError(null); }}><X className="h-4 w-4" aria-hidden /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="check" checked={selected.has(p.id)} aria-label={`Select ${p.civilianWord} / ${p.undercoverWord}`}
                      onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                      <div className="min-w-0"><p className="text-[11px] text-slate-500">Civilian</p><p className="truncate font-medium text-white">{p.civilianWord}</p></div>
                      <div className="min-w-0"><p className="text-[11px] text-slate-500">Undercover</p><p className="truncate font-medium text-violet-200">{p.undercoverWord}</p></div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => startEdit(p)} aria-label={`Edit ${p.civilianWord} / ${p.undercoverWord}`}><Pencil className="h-4 w-4" aria-hidden /></button>
                    <button type="button" className="btn btn-ghost btn-icon text-rose-300" onClick={() => setDeleteIds([p.id])} aria-label={`Delete ${p.civilianWord} / ${p.undercoverWord}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-slate-300">
              <button type="button" className="btn btn-secondary btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="h-4 w-4" aria-hidden /> Prev</button>
              <span>Page {current} of {pages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next <ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          )}
        </div>
      )}

      <GroupDetailsDialog group={detailsOpen ? group : null} onClose={() => setDetailsOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} targetGroupId={group.id} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} groups={[group]} label={`“${group.name}”`} />
      <ConfirmDialog open={!!deleteIds} title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} word pairs?` : "Delete word pair?"} confirmLabel="Delete"
        message="This removes the selected pair(s) from the group. It can’t be undone." onCancel={() => setDeleteIds(null)} onConfirm={confirmDelete} />
    </div>
  );
}
