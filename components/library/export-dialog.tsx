"use client";

import type { WordGroup } from "@/types/words";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { downloadText, exportCsv, exportJson, slug } from "@/lib/words/exports";
import { FileJson, FileSpreadsheet } from "lucide-react";

/** Exports one or many groups. Files are generated in the browser; nothing is uploaded anywhere. */
export function ExportDialog({ open, onClose, groups, label }: { open: boolean; onClose: () => void; groups: WordGroup[]; label: string }) {
  const { toast } = useToast();
  const base = groups.length === 1 ? slug(groups[0].name) : "shadow-words-library";
  const pairs = groups.reduce((n, g) => n + g.pairs.length, 0);
  function go(kind: "json" | "csv") {
    if (kind === "json") downloadText(`${base}.json`, exportJson(groups), "application/json");
    else downloadText(`${base}.csv`, exportCsv(groups), "text/csv");
    toast(`Exported ${label} as ${kind.toUpperCase()}.`);
    onClose();
  }
  return (
    <Dialog open={open} onClose={onClose} title={`Export ${label}`} description={`${groups.length} group${groups.length === 1 ? "" : "s"}, ${pairs} word pairs. The file is created in your browser.`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn btn-secondary h-auto flex-col gap-1 py-4" onClick={() => go("json")} disabled={!groups.length}>
          <FileJson className="h-6 w-6 text-indigo-300" aria-hidden /> JSON
          <span className="text-xs font-normal text-slate-400">Keeps every detail</span>
        </button>
        <button type="button" className="btn btn-secondary h-auto flex-col gap-1 py-4" onClick={() => go("csv")} disabled={!groups.length}>
          <FileSpreadsheet className="h-6 w-6 text-sky-300" aria-hidden /> CSV
          <span className="text-xs font-normal text-slate-400">Opens in Excel or Sheets</span>
        </button>
      </div>
    </Dialog>
  );
}
