"use client";

import { useState } from "react";
import type { WordGroup } from "@/types/words";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/common";
import { useToast } from "@/components/ui/toast";
import { useApp } from "@/components/providers/app-provider";
import { MAX_DESCRIPTION, MAX_GROUP_NAME } from "@/lib/words/groups";

export function GroupDetailsDialog({ group, onClose }: { group: WordGroup | null; onClose: () => void }) {
  return (
    <Dialog open={!!group} onClose={onClose} title="Edit group" description="Changing details never touches the word pairs.">
      {group && <Form group={group} onClose={onClose} />}
    </Dialog>
  );
}

function Form({ group, onClose }: { group: WordGroup; onClose: () => void }) {
  const { updateGroup } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [enabled, setEnabled] = useState(group.enabled);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = updateGroup(group.id, { name, description, enabled });
    if (!r.ok) { setError({ field: r.field, message: r.error }); setBusy(false); return; }
    toast(`Saved “${r.value.group.name}”.`);
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="gd-name" className="label">Group name</label>
        <input id="gd-name" className="input" value={name} maxLength={MAX_GROUP_NAME} autoFocus onChange={(e) => { setName(e.target.value); setError(null); }}
          aria-invalid={error?.field === "name"} aria-describedby={error?.field === "name" ? "gd-err" : undefined} />
        {error?.field === "name" && <p id="gd-err" className="error-text">{error.message}</p>}
      </div>
      <div>
        <label htmlFor="gd-desc" className="label">Description <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea id="gd-desc" rows={2} className="input py-2" value={description} maxLength={MAX_DESCRIPTION} onChange={(e) => setDescription(e.target.value)} />
        {error?.field === "description" && <p className="error-text">{error.message}</p>}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3">
        <div>
          <p className="text-sm font-medium">Enabled</p>
          <p className="hint mt-0">Disabled groups are skipped when starting a game.</p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} label="Enabled" />
      </div>
      {error && !error.field && <p className="error-text" role="alert">{error.message}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
      </div>
    </form>
  );
}
