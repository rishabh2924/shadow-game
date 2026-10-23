/** Low-level, SSR-safe localStorage helpers. Never call these during server rendering. */
export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  library: "shadow-words:library",
  prefs: "shadow-words:prefs",
  session: "shadow-words:session",
  history: "shadow-words:history",
} as const;

export type ReadResult<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "corrupt"; raw: string }
  | { status: "unavailable" };

export type WriteResult = { ok: true } | { ok: false; error: string };

export function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const k = "__shadow_words_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocalStorage<T = unknown>(key: string): ReadResult<T> {
  if (!isStorageAvailable()) return { status: "unavailable" };
  const raw = window.localStorage.getItem(key);
  if (raw === null) return { status: "missing" };
  try {
    return { status: "ok", value: JSON.parse(raw) as T };
  } catch {
    return { status: "corrupt", raw };
  }
}

export function saveToLocalStorage(key: string, value: unknown): WriteResult {
  if (!isStorageAvailable()) return { ok: false, error: "Browser storage is unavailable, so changes will be lost when you close this tab." };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return { ok: false, error: quota ? "Browser storage is full. Export or delete some data to free space." : "Could not save to browser storage." };
  }
}

export function removeFromLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Keeps a copy of unreadable data so it is never silently destroyed. */
export function backupCorrupt(key: string, raw: string) {
  try {
    window.localStorage.setItem(`${key}:corrupt-backup`, raw);
  } catch {
    /* ignore */
  }
}
