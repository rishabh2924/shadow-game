import type { LobbyConfig } from "@/types/online";
import { clamp } from "@/lib/utils";

export const DEFAULT_LOBBY_CONFIG: LobbyConfig = {
  undercover: 1,
  white: 0,
  selectedGroupIds: [],
  randomGroup: false,
  tieRule: "revote",
  survivalRule: "parity",
  timerSeconds: 0,
  scoring: true,
};

const int = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(Math.round(v), min, max) : fallback;

/** Merges untrusted input over `base`, clamping everything to safe values. */
export function sanitizeConfig(input: unknown, base: LobbyConfig = DEFAULT_LOBBY_CONFIG): LobbyConfig {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    undercover: int(i.undercover, base.undercover, 0, 50),
    white: int(i.white, base.white, 0, 50),
    selectedGroupIds: Array.isArray(i.selectedGroupIds)
      ? i.selectedGroupIds.filter((x): x is string => typeof x === "string").slice(0, 500)
      : base.selectedGroupIds,
    randomGroup: typeof i.randomGroup === "boolean" ? i.randomGroup : base.randomGroup,
    tieRule: i.tieRule === "random" || i.tieRule === "revote" ? i.tieRule : base.tieRule,
    survivalRule: i.survivalRule === "final-two" || i.survivalRule === "parity" ? i.survivalRule : base.survivalRule,
    timerSeconds: int(i.timerSeconds, base.timerSeconds, 0, 3600),
    scoring: typeof i.scoring === "boolean" ? i.scoring : base.scoring,
  };
}
