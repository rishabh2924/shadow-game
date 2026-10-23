import type { Result, WordPair } from "@/types/words";
import { fail, ok } from "@/lib/utils";
import { cleanWord, normalizeWord } from "./normalization";

export const MAX_WORD_LENGTH = 50;

export interface DuplicateHit {
  word: string;
  pair: WordPair;
  existingWord: string;
}

/** Finds the first candidate word that already exists in either column of another pair. */
export function findDuplicateWord(
  pairs: readonly WordPair[],
  candidates: readonly string[],
  excludePairId?: string,
): DuplicateHit | null {
  for (const word of candidates) {
    const n = normalizeWord(word);
    if (!n) continue;
    for (const pair of pairs) {
      if (pair.id === excludePairId) continue;
      if (normalizeWord(pair.civilianWord) === n) return { word, pair, existingWord: pair.civilianWord };
      if (normalizeWord(pair.undercoverWord) === n) return { word, pair, existingWord: pair.undercoverWord };
    }
  }
  return null;
}

/** Validates a candidate pair against the other pairs of its group. */
export function validateWordPair(
  pairs: readonly WordPair[],
  civilianWord: string,
  undercoverWord: string,
  excludePairId?: string,
): Result<{ civilianWord: string; undercoverWord: string }> {
  const c = cleanWord(civilianWord);
  const u = cleanWord(undercoverWord);
  if (!c) return fail("Civilian word is required.", "civilianWord");
  if (!u) return fail("Undercover word is required.", "undercoverWord");
  if (c.length > MAX_WORD_LENGTH) return fail(`Civilian word must be ${MAX_WORD_LENGTH} characters or fewer.`, "civilianWord");
  if (u.length > MAX_WORD_LENGTH) return fail(`Undercover word must be ${MAX_WORD_LENGTH} characters or fewer.`, "undercoverWord");
  if (normalizeWord(c) === normalizeWord(u)) {
    return fail("The Civilian and Undercover words must be different.", "undercoverWord");
  }
  for (const [field, word] of [["civilianWord", c], ["undercoverWord", u]] as const) {
    const hit = findDuplicateWord(pairs, [word], excludePairId);
    if (hit) {
      return fail(
        `"${word}" already exists in this group (pair "${hit.pair.civilianWord} / ${hit.pair.undercoverWord}").`,
        field,
      );
    }
  }
  return ok({ civilianWord: c, undercoverWord: u });
}
