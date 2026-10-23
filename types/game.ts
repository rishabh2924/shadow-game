export type Role = "civilian" | "undercover" | "white";
export type Phase = "reveal" | "clue" | "discussion" | "voting" | "elimination" | "mrwhite" | "results";
export type TieRule = "revote" | "random";
export type SurvivalRule = "parity" | "final-two";
export type Winner = "civilians" | "infiltrators" | "white";

export interface Player {
  id: string;
  name: string;
  role: Role;
  assignedWord: string | null;
  active: boolean;
  score: number;
}

export interface GameConfig {
  undercoverCount: number;
  whiteCount: number;
  tieRule: TieRule;
  survivalRule: SurvivalRule;
  timerSeconds: number;
  scoring: boolean;
}

export interface PairSnapshot {
  civilianWord: string;
  undercoverWord: string;
  key: string;
  groupNames: string[];
}

export interface EliminationRecord {
  round: number;
  playerId: string;
  playerName: string;
  role: Role;
  votes: number;
  byRandomTie: boolean;
  guess?: string;
  guessCorrect?: boolean;
}

export type RoundOutcome =
  | { kind: "eliminated"; playerId: string; tally: Record<string, number>; byRandomTie: boolean }
  | { kind: "tie"; tied: string[]; tally: Record<string, number> };

export interface GameSession {
  id: string;
  players: Player[]; // `active` flag separates activePlayers / eliminatedPlayers
  selectedGroupIds: string[];
  randomGroup: boolean;
  config: GameConfig;
  currentPairSnapshot: PairSnapshot;
  currentPhase: Phase;
  currentRound: number;
  revealIndex: number;
  startingPlayerId: string;
  votes: Record<string, string>; // voterId -> targetId
  voteAttempt: number;
  revoteCandidates: string[] | null;
  lastOutcome: RoundOutcome | null;
  eliminationHistory: EliminationRecord[];
  usedPairKeys: string[];
  winner: Winner | null;
  pointsAwarded: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  playerLimit: number;
  tieRule: TieRule;
  survivalRule: SurvivalRule;
  timerSeconds: number;
  scoring: boolean;
}

export interface SetupDraft {
  players: { id: string; name: string }[];
  undercover: number;
  white: number;
  selectedGroupIds: string[];
  randomGroup: boolean;
}
