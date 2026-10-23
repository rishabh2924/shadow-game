import { STARTER_GROUPS } from "@/data/starter-groups";
import type { WordGroup, WordPair } from "@/types/words";
import { uid } from "@/lib/utils";
import { createWordGroup, MAX_GROUP_NAME } from "@/lib/words/groups";
import { cleanWord, normalizeWord } from "@/lib/words/normalization";
import { validateWordPair } from "@/lib/words/validation";
import { backupCorrupt, loadFromLocalStorage, saveToLocalStorage, SCHEMA_VERSION, STORAGE_KEYS, type WriteResult } from "./storage";

export function buildStarterGroups(existing: WordGroup[] = []): WordGroup[] {
  let groups = existing;
  for (const s of STARTER_GROUPS) {
    if (groups.some((g) => normalizeWord(g.name) === normalizeWord(s.name))) continue;
    const r = createWordGroup(groups, {
      name: s.name,
      description: s.description,
      pairs: s.pairs.map(([civilianWord, undercoverWord]) => ({ civilianWord, undercoverWord })),
    });
    if (r.ok) groups = r.value.groups;
  }
  return groups;
}

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Rebuilds a trustworthy list of groups from unknown data; malformed records are dropped, never thrown on. */
export function sanitizeGroups(input: unknown): WordGroup[] {
  if (!Array.isArray(input)) return [];
  const groups: WordGroup[] = [];
  const usedIds = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? cleanWord(r.name).slice(0, MAX_GROUP_NAME) : "";
    if (!name) continue;
    let id = typeof r.id === "string" && r.id ? r.id : uid();
    if (usedIds.has(id)) id = uid();
    usedIds.add(id);
    const now = Date.now();
    const pairs: WordPair[] = [];
    if (Array.isArray(r.pairs)) {
      for (const p of r.pairs) {
        const pr = (p ?? {}) as Record<string, unknown>;
        if (typeof pr.civilianWord !== "string" || typeof pr.undercoverWord !== "string") continue;
        const v = validateWordPair(pairs, pr.civilianWord, pr.undercoverWord);
        if (!v.ok) continue;
        pairs.push({
          id: typeof pr.id === "string" && pr.id && !pairs.some((x) => x.id === pr.id) ? pr.id : uid(),
          ...v.value,
          createdAt: num(pr.createdAt, now),
          updatedAt: num(pr.updatedAt, now),
        });
      }
    }
    groups.push({
      id,
      name,
      description: typeof r.description === "string" ? r.description : "",
      enabled: r.enabled !== false,
      createdAt: num(r.createdAt, now),
      updatedAt: num(r.updatedAt, now),
      pairs,
    });
  }
  return groups;
}

export type LibraryLoad = {
  groups: WordGroup[];
  status: "loaded" | "seeded" | "recovered" | "unavailable";
};

/** Loads the library. Seeds starter groups only when nothing has ever been saved. */
export function loadLibrary(): LibraryLoad {
  const r = loadFromLocalStorage<{ version?: number; groups?: unknown } | unknown[]>(STORAGE_KEYS.library);
  if (r.status === "unavailable") return { groups: buildStarterGroups(), status: "unavailable" };
  if (r.status === "missing") return { groups: buildStarterGroups(), status: "seeded" };
  if (r.status === "corrupt") {
    backupCorrupt(STORAGE_KEYS.library, r.raw);
    return { groups: buildStarterGroups(), status: "recovered" };
  }
  const v = r.value;
  const list = Array.isArray(v) ? v : v && typeof v === "object" ? (v as { groups?: unknown }).groups : undefined;
  if (!Array.isArray(list)) {
    backupCorrupt(STORAGE_KEYS.library, JSON.stringify(v));
    return { groups: buildStarterGroups(), status: "recovered" };
  }
  return { groups: sanitizeGroups(list), status: "loaded" };
}

export function saveLibrary(groups: WordGroup[]): WriteResult {
  return saveToLocalStorage(STORAGE_KEYS.library, { version: SCHEMA_VERSION, groups });
}
