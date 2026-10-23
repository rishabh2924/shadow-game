"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Download, Plus, RotateCcw, Search, Upload } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, Loading } from "@/components/ui/common";
import { GroupCard } from "./group-card";
import { GroupDetailsDialog } from "./group-details-dialog";
import { ImportDialog } from "./import-dialog";
import { ExportDialog } from "./export-dialog";
import { groupStats } from "@/lib/words/groups";
import { normalizeWord } from "@/lib/words/normalization";
import type { WordGroup } from "@/types/words";

type Filter = "all" | "enabled" | "disabled";
type Sort = "name" | "count" | "updated";

export function LibraryView() {
  const app = useApp();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [editing, setEditing] = useState<WordGroup | null>(null);
  const [deleting, setDeleting] = useState<WordGroup | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const visible = useMemo(() => {
    const q = normalizeWord(query);
    return app.groups
      .filter((g) => (!q || normalizeWord(g.name).includes(q)) && (filter === "all" || (filter === "enabled") === g.enabled))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        : sort === "count" ? groupStats(b).pairs - groupStats(a).pairs || a.name.localeCompare(b.name)
        : b.updatedAt - a.updatedAt);
  }, [app.groups, query, filter, sort]);

  if (!app.hydrated) return <Loading />;

  const selected = new Set(app.setup.selectedGroupIds);
  const toggleSelect = (id: string, on: boolean) =>
    app.updateSetup((s) => ({ selectedGroupIds: on ? [...new Set([...s.selectedGroupIds, id])] : s.selectedGroupIds.filter((x) => x !== id) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Word library</h1>
          <p className="mt-1 text-sm text-slate-400">{app.groups.length} group{app.groups.length === 1 ? "" : "s"} saved in this browser.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" aria-hidden /> Import</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExportOpen(true)} disabled={!app.groups.length}><Download className="h-4 w-4" aria-hidden /> Export all</button>
          <Link href="/library/new" className="btn btn-primary btn-sm"><Plus className="h-4 w-4" aria-hidden /> Create group</Link>
        </div>
      </div>

      {app.groups.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-7 w-7" aria-hidden />} title="Your library is empty"
          action={<>
            <Link href="/library/new" className="btn btn-primary">Create a group</Link>
            <button type="button" className="btn btn-secondary" onClick={() => toast(`Restored ${app.restoreStarterGroups()} starter groups.`)}>Restore starter groups</button>
          </>}>
          Create your own word groups, import a file, or restore the built-in starter groups.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input className="input pl-9" type="search" placeholder="Search groups" aria-label="Search groups by name" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input" aria-label="Filter groups" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All groups</option><option value="enabled">Enabled only</option><option value="disabled">Disabled only</option>
            </select>
            <select className="input" aria-label="Sort groups" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="updated">Recently updated</option><option value="name">Alphabetical</option><option value="count">Most word pairs</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={<Search className="h-7 w-7" aria-hidden />} title="No groups match"
              action={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}>
              Try a different search or filter.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((g) => (
                <GroupCard key={g.id} group={g} selected={selected.has(g.id)} onSelect={(on) => toggleSelect(g.id, on)}
                  onToggleEnabled={(enabled) => { const r = app.updateGroup(g.id, { enabled }); if (r.ok) toast(`${g.name} ${enabled ? "enabled" : "disabled"}.`); }}
                  onEdit={() => setEditing(g)}
                  onDuplicate={() => { const r = app.duplicateGroup(g.id); toast(r.ok ? `Duplicated as “${r.value.group.name}”.` : r.error, r.ok ? "success" : "error"); }}
                  onDelete={() => setDeleting(g)} />
              ))}
            </div>
          )}
          <div className="pt-4 text-center">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" aria-hidden /> Reset library to starter groups</button>
          </div>
        </>
      )}

      <GroupDetailsDialog group={editing} onClose={() => setEditing(null)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} groups={app.groups} label="library" />
      <ConfirmDialog open={!!deleting} title="Delete group?" confirmLabel="Delete group"
        message={<>“{deleting?.name}” and its {deleting?.pairs.length ?? 0} word pairs will be removed from this browser. This can’t be undone.</>}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) { const r = app.deleteGroup(deleting.id); toast(r.ok ? `Deleted “${deleting.name}”.` : r.error, r.ok ? "success" : "error"); } setDeleting(null); }} />
      <ConfirmDialog open={resetOpen} title="Reset the whole library?" confirmLabel="Reset library"
        message="Every custom group, edit and import will be erased and the starter groups restored. Export first if you want a backup."
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { app.resetLibrary(); setResetOpen(false); toast("Library reset to the starter groups."); }} />
    </div>
  );
}
