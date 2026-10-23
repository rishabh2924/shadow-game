"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Gamepad2, Ghost, Home, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/app-provider";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/game/setup", label: "Pass & play", icon: Gamepad2 },
  { href: "/online", label: "Online", icon: Smartphone },
  { href: "/library", label: "Library", icon: BookOpen },
];

export function AppHeader() {
  const pathname = usePathname();
  const { storageError } = useApp();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070816]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50">
              <Ghost className="h-5 w-5 text-white" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">Shadow Words</span>
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:px-3",
                    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="hidden min-[400px]:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {storageError && (
        <div role="alert" className="border-b border-amber-400/30 bg-amber-950/60 px-4 py-2 text-center text-sm text-amber-100">
          {storageError}
        </div>
      )}
    </>
  );
}
