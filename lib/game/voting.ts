import type { Player, TieRule } from "@/types/game";
import { randomInt } from "@/lib/utils";

export const MAX_REVOTES = 2;

export type VoteResolution =
  | { type: "eliminated"; playerId: string; tally: Record<string, number>; byRandomTie: boolean }
  | { type: "tie"; tied: string[]; tally: Record<string, number> };

export function tallyVotes(votes: Record<string, string>): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) tally[target] = (tally[target] ?? 0) + 1;
  return tally;
}

/**
 * Resolves a finished voting round. Ties follow the configured rule; "revote" falls back to a random
 * pick after MAX_REVOTES consecutive ties so a game can never get stuck.
 */
export function resolveVote(
  votes: Record<string, string>,
  active: readonly Player[],
  tieRule: TieRule,
  attempt: number,
  rng: (max: number) => number = randomInt,
): VoteResolution {
  const tally = tallyVotes(votes);
  const max = Math.max(0, ...Object.values(tally));
  const leaders = max === 0 ? active.map((p) => p.id) : Object.keys(tally).filter((id) => tally[id] === max);
  if (leaders.length === 1) return { type: "eliminated", playerId: leaders[0], tally, byRandomTie: false };
  if (tieRule === "random" || attempt >= MAX_REVOTES) {
    return { type: "eliminated", playerId: leaders[rng(leaders.length)], tally, byRandomTie: true };
  }
  return { type: "tie", tied: leaders, tally };
}
