import type { EliminationRecord, GameConfig, Phase, RoundOutcome, Role, SurvivalRule, TieRule, Winner } from "./game";

export const MAX_ROOM_PLAYERS = 20;

/** Everything the host can tweak in the lobby; stored with the room in MariaDB. */
export interface LobbyConfig {
  undercover: number;
  white: number;
  selectedGroupIds: string[];
  randomGroup: boolean;
  tieRule: TieRule;
  survivalRule: SurvivalRule;
  timerSeconds: number;
  scoring: boolean;
}

export interface LobbyPlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

export interface GamePlayerView {
  id: string;
  name: string;
  active: boolean;
  connected: boolean;
  score: number;
  /** Only revealed once a player is eliminated (or the game is over). */
  role: Role | null;
  /** Only revealed on the results screen. */
  word: string | null;
}

/** What ONE player is allowed to know about the running game. Secrets of other players never appear here. */
export interface GameView {
  id: string;
  phase: Phase;
  round: number;
  config: GameConfig;
  players: GamePlayerView[];
  myWord: string | null;
  iAmWhite: boolean;
  amActive: boolean;
  startingPlayerId: string;
  speakingOrder: string[];
  readyIds: string[];
  votedIds: string[];
  myVote: string | null;
  voteAttempt: number;
  revoteCandidates: string[] | null;
  lastOutcome: RoundOutcome | null;
  eliminationHistory: EliminationRecord[];
  winner: Winner | null;
  pointsAwarded: Record<string, number>;
  words: { civilianWord: string; undercoverWord: string } | null;
  phaseStartedAt: number;
}

export interface RoomView {
  code: string;
  version: number;
  serverTime: number;
  status: "lobby" | "playing";
  me: { id: string; name: string; isHost: boolean };
  hostId: string;
  hostConnected: boolean;
  players: LobbyPlayerView[];
  config: LobbyConfig;
  game: GameView | null;
}

export type RoomAction =
  | { type: "config"; config: Partial<LobbyConfig> }
  | { type: "kick"; playerId: string }
  | { type: "start" }
  | { type: "ready" }
  | { type: "skipReveal" }
  | { type: "startDiscussion" }
  | { type: "startVoting" }
  | { type: "vote"; targetId: string }
  | { type: "finishVoting" }
  | { type: "revote" }
  | { type: "continue" }
  | { type: "guess"; guess: string }
  | { type: "playAgain" }
  | { type: "lobby" }
  | { type: "leave" }
  | { type: "claimHost" }
  | { type: "resetHistory" };
