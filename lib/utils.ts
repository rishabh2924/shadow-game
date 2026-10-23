import type { Result } from "@/types/words";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
export const fail = (error: string, field?: string): Result<never> => ({ ok: false, error, field });

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Uniform random integer in [0, max). */
export function randomInt(max: number): number {
  if (max <= 1) return 0;
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return Math.floor((buf[0] / 4294967296) * max);
  }
  return Math.floor(Math.random() * max);
}

export function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
