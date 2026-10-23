"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { AppProvider } from "./app-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppProvider>{children}</AppProvider>
    </ToastProvider>
  );
}
