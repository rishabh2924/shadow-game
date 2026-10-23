"use client";

import Link from "next/link";
import { Copy, ListPlus, Pencil, Trash2 } from "lucide-react";
import type { WordGroup } from "@/types/words";
import { groupStats } from "@/lib/words/groups";
import { formatDate } from "@/lib/utils";
import { Switch } from "@/components/ui/common";

interface Props {
  group: WordGroup;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function GroupCard({ group, selected, onSelect, onToggleEnabled, onEdit, onDuplicate, onDelete }: Props) {
  const stats = groupStats(group);
  return (
    <article className={`card flex flex-col gap-3 ${group.enabled ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{group.name}</h3>
          <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-slate-400">{group.description || "No description"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch checked={group.enabled} onChange={onToggleEnabled} label={`${group.name} enabled`} />
          <span className="text-[11px] text-slate-400">{group.enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="badge">{stats.pairs} pair{stats.pairs === 1 ? "" : "s"}</span>
        <span className="badge">{stats.uniqueWords} unique words</span>
        <span className="badge">Updated {formatDate(group.updatedAt)}</span>
      </div>
      <label className={`flex min-h-[44px] items-center gap-3 rounded-xl border border-white/10 px-3 text-sm ${group.enabled ? "cursor-pointer" : "cursor-not-allowed text-slate-500"}`}>
        <input type="checkbox" className="check" checked={selected && group.enabled} disabled={!group.enabled} onChange={(e) => onSelect(e.target.checked)} />
        Use in next game
      </label>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link href={`/library/${group.id}`} className="btn btn-primary btn-sm flex-1"><ListPlus className="h-4 w-4" aria-hidden /> Manage words</Link>
        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={onEdit} aria-label={`Edit ${group.name}`} title="Edit group"><Pencil className="h-4 w-4" aria-hidden /></button>
        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={onDuplicate} aria-label={`Duplicate ${group.name}`} title="Duplicate group"><Copy className="h-4 w-4" aria-hidden /></button>
        <button type="button" className="btn btn-secondary btn-sm btn-icon text-rose-300" onClick={onDelete} aria-label={`Delete ${group.name}`} title="Delete group"><Trash2 className="h-4 w-4" aria-hidden /></button>
      </div>
    </article>
  );
}
