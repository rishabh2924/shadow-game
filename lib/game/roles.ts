import type { PairSnapshot, Player, Role, SurvivalRule } from "@/types/game";
import type { Result } from "@/types/words";
import { fail, ok, shuffle } from "@/lib/utils";
import { normalizeWord } from "@/lib/words/normalization";

export interface PlayerInput {
  id: string;
  name: string;
  score?: number;
}

/** Returns id -> error for players with missing or duplicate names (case and whitespace-insensitive). */
export function validatePlayerNames(players: readonly { id: string; name: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const p of players) {
    const n = normalizeWord(p.name);
    if (!n) { errors[p.id] = "Enter a name."; continue; }
    const first = seen.get(n);
    if (first) { errors[p.id] = "Names must be unique."; errors[first] ??= "Names must be unique."; }
    else seen.set(n, p.id);
  }
  return errors;
}

export function validateRoleCounts(total: number, undercover: number, white: number): string[] {
  const errors: string[] = [];
  if (total < 3) errors.push("Add at least 3 players.");
  if (undercover < 0 || white < 0) errors.push("Role counts cannot be negative.");
  if (undercover + white < 1) errors.push("Assign at least one Undercover or Mr. White.");
  if (total - undercover - white < 1) errors.push("At least one Civilian must remain.");
  return errors;
}

/** Shuffles roles (not names) and gives every remaining player the Civilian role. */
export function assignRoles(
  players: readonly PlayerInput[],
  undercover: number,
  white: number,
  pair: Pick<PairSnapshot, "civilianWord" | "undercoverWord">,
): Result<Player[]> {
  const civilians = players.length - undercover - white;
  if (undercover < 0 || white < 0 || civilians < 1) return fail("Invalid role counts: at least one Civilian is required.");
  const roles: Role[] = shuffle([
    ...Array<Role>(undercover).fill("undercover"),
    ...Array<Role>(white).fill("white"),
    ...Array<Role>(civilians).fill("civilian"),
  ]);
  return ok(
    players.map((p, i) => ({
      id: p.id,
      name: p.name.trim(),
      role: roles[i],
      assignedWord: roles[i] === "civilian" ? pair.civilianWord : roles[i] === "undercover" ? pair.undercoverWord : null,
      active: true,
      score: p.score ?? 0,
    })),
  );
}

export const ROLE_LABEL: Record<Role, string> = { civilian: "Civilian", undercover: "Undercover", white: "Mr. White" };
export type { SurvivalRule };
