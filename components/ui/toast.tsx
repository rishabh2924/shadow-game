"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info";
interface Item { id: number; kind: Kind; message: string }
const Ctx = createContext<{ toast: (message: string, kind?: Kind) => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const counter = useRef(0);
  const toast = useCallback((message: string, kind: Kind = "success") => {
    const id = ++counter.current;
    setItems((i) => [...i.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={cn("pop pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              t.kind === "success" && "border-emerald-400/30 bg-emerald-950/90 text-emerald-100",
              t.kind === "error" && "border-rose-400/40 bg-rose-950/90 text-rose-100",
              t.kind === "info" && "border-sky-400/30 bg-slate-900/90 text-sky-100")}>
              <I className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
