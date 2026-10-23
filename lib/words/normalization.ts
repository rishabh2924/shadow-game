/** Canonical form used for all comparisons (never for display). */
export function normalizeWord(word: string): string {
  return word.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Display form: trims and collapses whitespace but keeps the user's spelling/case. */
export function cleanWord(word: string): string {
  return word.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Order-independent key: "Coffee/Tea" and "tea/COFFEE" produce the same key. */
export function pairKey(a: string, b: string): string {
  const x = normalizeWord(a);
  const y = normalizeWord(b);
  return x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`;
}
