import type { WordGroup } from "@/types/words";
import { randomInt } from "@/lib/utils";
import { normalizeWord, pairKey } from "@/lib/words/normalization";

export interface EligiblePair {
  key: string;
  civilianWord: string;
  undercoverWord: string;
  groupNames: string[];
}

/**
 * Collects valid pairs from the selected, enabled groups.
 * Identical pairs (including reversed ones such as Coffee/Tea vs Tea/Coffee) are merged into one entry.
 * With `randomGroup`, a single eligible group is picked at random and only its pairs are returned.
 */
export function getEligibleWordPairs(
  groups: readonly WordGroup[],
  selectedIds: readonly string[],
  randomGroup = false,
  rng: (max: number) => number = randomInt,
): EligiblePair[] {
  let chosen = groups.filter((g) => g.enabled && selectedIds.includes(g.id));
  if (randomGroup) {
    const candidates = chosen.filter((g) => g.pairs.some(isValid));
    chosen = candidates.length ? [candidates[rng(candidates.length)]] : [];
  }
  const map = new Map<string, EligiblePair>();
  for (const g of chosen) {
    for (const p of g.pairs) {
      if (!isValid(p)) continue;
      const key = pairKey(p.civilianWord, p.undercoverWord);
      const hit = map.get(key);
      if (hit) {
        if (!hit.groupNames.includes(g.name)) hit.groupNames.push(g.name);
      } else map.set(key, { key, civilianWord: p.civilianWord, undercoverWord: p.undercoverWord, groupNames: [g.name] });
    }
  }
  return [...map.values()];
}

function isValid(p: { civilianWord: string; undercoverWord: string }) {
  const a = normalizeWord(p.civilianWord);
  const b = normalizeWord(p.undercoverWord);
  return !!a && !!b && a !== b;
}

export interface Selection {
  pair: EligiblePair;
  usedPairKeys: string[];
  cycleReset: boolean;
}

/**
 * Picks a random pair that has not been used in the current cycle. When every pair in the pool
 * has been used, a new cycle starts (avoiding an immediate repeat of the most recent pair).
 * Keys that belong to other pools (e.g. other groups) are kept untouched.
 */
export function selectNextWordPair(
  pool: readonly EligiblePair[],
  usedKeys: readonly string[],
  rng: (max: number) => number = randomInt,
): Selection | null {
  if (!pool.length) return null;
  const poolKeys = new Set(pool.map((p) => p.key));
  const outside = usedKeys.filter((k) => !poolKeys.has(k));
  let usedInPool = usedKeys.filter((k) => poolKeys.has(k));
  const usedSet = new Set(usedInPool);
  let unused = pool.filter((p) => !usedSet.has(p.key));
  let cycleReset = false;
  if (!unused.length) {
    cycleReset = true;
    const last = usedInPool[usedInPool.length - 1];
    usedInPool = [];
    unused = pool.length > 1 && last ? pool.filter((p) => p.key !== last) : [...pool];
  }
  const pair = unused[rng(unused.length)];
  return { pair, usedPairKeys: [...outside, ...usedInPool, pair.key], cycleReset };
}
