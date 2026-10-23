import type { Player, SurvivalRule, Winner } from "@/types/game";

export function countActive(players: readonly Player[]) {
  const active = players.filter((p) => p.active);
  const civilians = active.filter((p) => p.role === "civilian").length;
  return { total: active.length, civilians, infiltrators: active.length - civilians };
}

/**
 * Default rules:
 *  - Civilians win when every Undercover and Mr. White player is eliminated.
 *  - "parity": infiltrators win when they equal or outnumber the remaining Civilians.
 *  - "final-two": infiltrators win only when two players remain and at least one is an infiltrator.
 * (Mr. White's immediate win by guessing the word is handled separately after his elimination.)
 */
export function evaluateWinCondition(players: readonly Player[], rule: SurvivalRule): Winner | null {
  const { total, civilians, infiltrators } = countActive(players);
  if (infiltrators === 0) return "civilians";
  if (civilians === 0) return "infiltrators";
  if (rule === "parity") return infiltrators >= civilians ? "infiltrators" : null;
  return total <= 2 ? "infiltrators" : null;
}
