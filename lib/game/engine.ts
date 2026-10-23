import type { GameConfig, GameSession, Player, Winner } from "@/types/game";
import type { Result, WordGroup } from "@/types/words";
import { fail, ok, randomInt, uid } from "@/lib/utils";
import { normalizeWord } from "@/lib/words/normalization";
import { assignRoles, validatePlayerNames, validateRoleCounts, type PlayerInput } from "./roles";
import { getEligibleWordPairs, selectNextWordPair } from "./selection";
import { resolveVote } from "./voting";
import { countActive, evaluateWinCondition } from "./win-conditions";

export const POINTS = { civilianWin: 2, infiltratorWin: 3, whiteGuess: 5 };

export const activePlayers = (s: GameSession) => s.players.filter((p) => p.active);
export const eliminatedPlayers = (s: GameSession) => s.players.filter((p) => !p.active);
export const playerById = (s: GameSession, id: string) => s.players.find((p) => p.id === id);

const touch = (s: GameSession, patch: Partial<GameSession>): GameSession => ({ ...s, ...patch, updatedAt: Date.now() });

export interface NewGameInput {
  players: PlayerInput[];
  selectedGroupIds: string[];
  randomGroup: boolean;
  config: GameConfig;
  groups: WordGroup[];
  usedPairKeys: string[];
  playerLimit: number;
}

/** Validates setup, picks a non-repeating pair, assigns roles and snapshots everything the game needs. */
export function createSession(input: NewGameInput): Result<{ session: GameSession; usedPairKeys: string[]; cycleReset: boolean }> {
  const { players, config } = input;
  if (players.length > input.playerLimit) return fail(`The player limit is ${input.playerLimit}.`);
  if (Object.keys(validatePlayerNames(players)).length) return fail("Fix the player names before starting.");
  const roleErrors = validateRoleCounts(players.length, config.undercoverCount, config.whiteCount);
  if (roleErrors.length) return fail(roleErrors[0]);

  const pool = getEligibleWordPairs(input.groups, input.selectedGroupIds, input.randomGroup);
  const selection = selectNextWordPair(pool, input.usedPairKeys);
  if (!selection) return fail("Select at least one enabled group that contains a valid word pair.");

  const snapshot = {
    civilianWord: selection.pair.civilianWord,
    undercoverWord: selection.pair.undercoverWord,
    key: selection.pair.key,
    groupNames: [...selection.pair.groupNames],
  };
  const assigned = assignRoles(players, config.undercoverCount, config.whiteCount, snapshot);
  if (!assigned.ok) return assigned;
  if (evaluateWinCondition(assigned.value, config.survivalRule)) {
    return fail("Too many Undercover / Mr. White players: they would win immediately. Reduce them or add players.");
  }
  const now = Date.now();
  const session: GameSession = {
    id: uid(),
    players: assigned.value,
    selectedGroupIds: [...input.selectedGroupIds],
    randomGroup: input.randomGroup,
    config: { ...config },
    currentPairSnapshot: snapshot,
    currentPhase: "reveal",
    currentRound: 1,
    revealIndex: 0,
    startingPlayerId: assigned.value[randomInt(assigned.value.length)].id,
    votes: {},
    voteAttempt: 0,
    revoteCandidates: null,
    lastOutcome: null,
    eliminationHistory: [],
    usedPairKeys: selection.usedPairKeys,
    winner: null,
    pointsAwarded: {},
    createdAt: now,
    updatedAt: now,
  };
  return ok({ session, usedPairKeys: selection.usedPairKeys, cycleReset: selection.cycleReset });
}

type R = Result<GameSession>;

export function advanceReveal(s: GameSession): R {
  if (s.currentPhase !== "reveal") return fail("The reveal phase is over.");
  const next = s.revealIndex + 1;
  return ok(touch(s, next >= s.players.length ? { revealIndex: next, currentPhase: "clue" } : { revealIndex: next }));
}

/** Active players in speaking order, starting from the starter (or the next active player after them). */
export function speakingOrder(s: GameSession): Player[] {
  const all = s.players;
  const start = Math.max(0, all.findIndex((p) => p.id === s.startingPlayerId));
  const rotated = [...all.slice(start), ...all.slice(0, start)];
  return rotated.filter((p) => p.active);
}

export const startDiscussion = (s: GameSession): R => (s.currentPhase === "clue" ? ok(touch(s, { currentPhase: "discussion" })) : fail("Not in the clue phase."));
export const startVoting = (s: GameSession): R =>
  s.currentPhase === "discussion" ? ok(touch(s, { currentPhase: "voting", votes: {}, voteAttempt: 0, revoteCandidates: null })) : fail("Not in the discussion phase.");

export function castVote(s: GameSession, voterId: string, targetId: string): R {
  if (s.currentPhase !== "voting") return fail("Voting is not open.");
  const voter = playerById(s, voterId);
  const target = playerById(s, targetId);
  if (!voter?.active) return fail("Eliminated players cannot vote.");
  if (!target?.active) return fail("You can only vote for active players.");
  if (voterId === targetId) return fail("You cannot vote for yourself.");
  if (s.votes[voterId]) return fail("This player has already voted.");
  if (s.revoteCandidates && !s.revoteCandidates.includes(targetId)) return fail("In a revote you must choose one of the tied players.");
  return ok(touch(s, { votes: { ...s.votes, [voterId]: targetId } }));
}

export function finishVoting(s: GameSession): R {
  if (s.currentPhase !== "voting") return fail("Voting is not open.");
  if (!Object.keys(s.votes).length) return fail("At least one vote is needed.");
  const res = resolveVote(s.votes, activePlayers(s), s.config.tieRule, s.voteAttempt);
  if (res.type === "tie") return ok(touch(s, { currentPhase: "elimination", lastOutcome: { kind: "tie", tied: res.tied, tally: res.tally } }));
  const victim = playerById(s, res.playerId)!;
  return ok(
    touch(s, {
      currentPhase: "elimination",
      players: s.players.map((p) => (p.id === victim.id ? { ...p, active: false } : p)),
      lastOutcome: { kind: "eliminated", playerId: victim.id, tally: res.tally, byRandomTie: res.byRandomTie },
      eliminationHistory: [
        ...s.eliminationHistory,
        { round: s.currentRound, playerId: victim.id, playerName: victim.name, role: victim.role, votes: res.tally[victim.id] ?? 0, byRandomTie: res.byRandomTie },
      ],
    }),
  );
}

export function startRevote(s: GameSession): R {
  if (s.lastOutcome?.kind !== "tie") return fail("There is no tie to resolve.");
  return ok(touch(s, { currentPhase: "voting", votes: {}, voteAttempt: s.voteAttempt + 1, revoteCandidates: s.lastOutcome.tied, lastOutcome: null }));
}

function finish(s: GameSession, winner: Winner, whiteId?: string): GameSession {
  const points: Record<string, number> = {};
  if (s.config.scoring) {
    for (const p of s.players) {
      if (winner === "civilians" && p.role === "civilian") points[p.id] = POINTS.civilianWin;
      if (winner === "infiltrators" && p.role !== "civilian") points[p.id] = POINTS.infiltratorWin;
      if (winner === "white" && p.id === whiteId) points[p.id] = POINTS.whiteGuess;
    }
  }
  return touch(s, {
    winner,
    currentPhase: "results",
    pointsAwarded: points,
    players: s.players.map((p) => ({ ...p, score: p.score + (points[p.id] ?? 0) })),
  });
}

function checkVictory(s: GameSession): GameSession {
  const winner = evaluateWinCondition(s.players, s.config.survivalRule);
  if (winner) return finish(s, winner);
  return touch(s, { currentRound: s.currentRound + 1, currentPhase: "clue", votes: {}, voteAttempt: 0, revoteCandidates: null, lastOutcome: null });
}

export function continueAfterElimination(s: GameSession): R {
  if (s.currentPhase !== "elimination" || s.lastOutcome?.kind !== "eliminated") return fail("There is nothing to continue from.");
  const victim = playerById(s, s.lastOutcome.playerId);
  if (victim?.role === "white") return ok(touch(s, { currentPhase: "mrwhite" }));
  return ok(checkVictory(s));
}

export function submitWhiteGuess(s: GameSession, guess: string): R {
  if (s.currentPhase !== "mrwhite" || s.lastOutcome?.kind !== "eliminated") return fail("No guess is expected right now.");
  const g = guess.trim();
  if (!g) return fail("Type a guess first.");
  const correct = normalizeWord(g) === normalizeWord(s.currentPairSnapshot.civilianWord);
  const id = s.lastOutcome.playerId;
  const withGuess = touch(s, {
    eliminationHistory: s.eliminationHistory.map((e, i) => (i === s.eliminationHistory.length - 1 ? { ...e, guess: g, guessCorrect: correct } : e)),
  });
  return ok(correct ? finish(withGuess, "white", id) : checkVictory(withGuess));
}

export { countActive };
