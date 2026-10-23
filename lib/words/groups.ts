import type { RawPair, Result, WordGroup, WordPair } from "@/types/words";
import { fail, ok, uid } from "@/lib/utils";
import { cleanWord, normalizeWord } from "./normalization";
import { validateWordPair } from "./validation";

export const MAX_GROUP_NAME = 60;
export const MAX_DESCRIPTION = 240;

type Next = Result<{ groups: WordGroup[]; group: WordGroup }>;

export function validateGroupName(groups: readonly WordGroup[], name: string, excludeId?: string): Result<string> {
  const n = cleanWord(name);
  if (!n) return fail("Group name is required.", "name");
  if (n.length > MAX_GROUP_NAME) return fail(`Group name must be ${MAX_GROUP_NAME} characters or fewer.`, "name");
  const dup = groups.find((g) => g.id !== excludeId && normalizeWord(g.name) === normalizeWord(n));
  if (dup) return fail(`A group named "${dup.name}" already exists.`, "name");
  return ok(n);
}

export function uniqueGroupName(groups: readonly WordGroup[], base: string, suffix = "copy"): string {
  const taken = new Set(groups.map((g) => normalizeWord(g.name)));
  const root = cleanWord(base).slice(0, MAX_GROUP_NAME - 14);
  if (!taken.has(normalizeWord(root))) return root;
  for (let i = 1; i < 10000; i++) {
    const candidate = i === 1 ? `${root} (${suffix})` : `${root} (${suffix} ${i})`;
    if (!taken.has(normalizeWord(candidate))) return candidate;
  }
  return `${root} ${uid().slice(0, 6)}`;
}

export function buildPairs(raw: readonly RawPair[]): Result<WordPair[]> {
  const now = Date.now();
  const pairs: WordPair[] = [];
  for (const r of raw) {
    const v = validateWordPair(pairs, r.civilianWord, r.undercoverWord);
    if (!v.ok) return fail(`${r.civilianWord} / ${r.undercoverWord}: ${v.error}`, v.field);
    pairs.push({ id: uid(), ...v.value, createdAt: now, updatedAt: now });
  }
  return ok(pairs);
}

export interface GroupInput {
  name: string;
  description?: string;
  enabled?: boolean;
  pairs?: RawPair[];
}

export function createWordGroup(groups: readonly WordGroup[], input: GroupInput): Next {
  const name = validateGroupName(groups, input.name);
  if (!name.ok) return name;
  const description = cleanWord(input.description ?? "");
  if (description.length > MAX_DESCRIPTION) return fail(`Description must be ${MAX_DESCRIPTION} characters or fewer.`, "description");
  const pairs = buildPairs(input.pairs ?? []);
  if (!pairs.ok) return pairs;
  const now = Date.now();
  const group: WordGroup = {
    id: uid(),
    name: name.value,
    description,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
    pairs: pairs.value,
  };
  return ok({ groups: [...groups, group], group });
}

function withGroup(groups: readonly WordGroup[], id: string, fn: (g: WordGroup) => Result<WordGroup>): Next {
  const existing = groups.find((g) => g.id === id);
  if (!existing) return fail("That group no longer exists.");
  const r = fn(existing);
  if (!r.ok) return r;
  return ok({ groups: groups.map((g) => (g.id === id ? r.value : g)), group: r.value });
}

/** Updates metadata only; `pairs` and the group id are always preserved. */
export function updateWordGroup(
  groups: readonly WordGroup[],
  id: string,
  patch: { name?: string; description?: string; enabled?: boolean },
): Next {
  return withGroup(groups, id, (g) => {
    let name = g.name;
    if (patch.name !== undefined) {
      const v = validateGroupName(groups, patch.name, id);
      if (!v.ok) return v;
      name = v.value;
    }
    const description = patch.description !== undefined ? cleanWord(patch.description) : g.description;
    if (description.length > MAX_DESCRIPTION) return fail(`Description must be ${MAX_DESCRIPTION} characters or fewer.`, "description");
    return ok({ ...g, name, description, enabled: patch.enabled ?? g.enabled, updatedAt: Date.now() });
  });
}

export function deleteWordGroup(groups: readonly WordGroup[], id: string): Result<{ groups: WordGroup[] }> {
  if (!groups.some((g) => g.id === id)) return fail("That group no longer exists.");
  return ok({ groups: groups.filter((g) => g.id !== id) });
}

/** Deep copy with a brand-new group id and brand-new pair ids. */
export function duplicateWordGroup(groups: readonly WordGroup[], id: string): Next {
  const src = groups.find((g) => g.id === id);
  if (!src) return fail("That group no longer exists.");
  const now = Date.now();
  const copy: WordGroup = {
    ...src,
    id: uid(),
    name: uniqueGroupName(groups, src.name),
    createdAt: now,
    updatedAt: now,
    pairs: src.pairs.map((p) => ({ ...p, id: uid(), createdAt: now, updatedAt: now })),
  };
  return ok({ groups: [...groups, copy], group: copy });
}

export function addWordPair(groups: readonly WordGroup[], groupId: string, civ: string, und: string): Next {
  return withGroup(groups, groupId, (g) => {
    const v = validateWordPair(g.pairs, civ, und);
    if (!v.ok) return v;
    const now = Date.now();
    return ok({ ...g, updatedAt: now, pairs: [...g.pairs, { id: uid(), ...v.value, createdAt: now, updatedAt: now }] });
  });
}

export function updateWordPair(groups: readonly WordGroup[], groupId: string, pairId: string, civ: string, und: string): Next {
  return withGroup(groups, groupId, (g) => {
    const current = g.pairs.find((p) => p.id === pairId);
    if (!current) return fail("That word pair no longer exists.");
    const v = validateWordPair(g.pairs, civ, und, pairId); // current pair excluded from duplicate checks
    if (!v.ok) return v;
    const unchanged = v.value.civilianWord === current.civilianWord && v.value.undercoverWord === current.undercoverWord;
    if (unchanged) return ok(g);
    const now = Date.now();
    return ok({ ...g, updatedAt: now, pairs: g.pairs.map((p) => (p.id === pairId ? { ...p, ...v.value, updatedAt: now } : p)) });
  });
}

export function deleteWordPairs(groups: readonly WordGroup[], groupId: string, pairIds: readonly string[]): Next {
  return withGroup(groups, groupId, (g) => {
    const ids = new Set(pairIds);
    return ok({ ...g, updatedAt: Date.now(), pairs: g.pairs.filter((p) => !ids.has(p.id)) });
  });
}

export function groupStats(g: WordGroup) {
  const words = new Set<string>();
  for (const p of g.pairs) {
    words.add(normalizeWord(p.civilianWord));
    words.add(normalizeWord(p.undercoverWord));
  }
  return { pairs: g.pairs.length, uniqueWords: words.size };
}
