"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}

/** Native <dialog>: focus trapping, Escape to close and aria-modal come for free. Content mounts only while open. */
export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
      className={`m-auto max-h-[90vh] w-[calc(100%-1.5rem)] ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-2xl border border-white/10 bg-[#0e1127] p-0 text-slate-100 shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close dialog" className="btn btn-ghost btn-icon -mr-2 -mt-2">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger = true, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-slate-300">{message}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
