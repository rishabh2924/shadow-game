import type { GameSession, Settings, SetupDraft } from "@/types/game";
import { clamp } from "@/lib/utils";
import { loadFromLocalStorage, removeFromLocalStorage, saveToLocalStorage, SCHEMA_VERSION, STORAGE_KEYS, type WriteResult } from "./storage";

export const DEFAULT_SETTINGS: Settings = {
  playerLimit: 20,
  tieRule: "revote",
  survivalRule: "parity",
  timerSeconds: 0,
  scoring: true,
};

export const DEFAULT_SETUP: SetupDraft = { players: [], undercover: 1, white: 0, selectedGroupIds: [], randomGroup: false };

export interface Prefs {
  settings: Settings;
  setup: SetupDraft;
  hasSaved: boolean;
}

export function loadPrefs(): Prefs {
  const r = loadFromLocalStorage<{ settings?: Partial<Settings>; setup?: Partial<SetupDraft> }>(STORAGE_KEYS.prefs);
  if (r.status !== "ok" || !r.value || typeof r.value !== "object") return { settings: DEFAULT_SETTINGS, setup: DEFAULT_SETUP, hasSaved: false };
  const s = r.value.settings ?? {};
  const u = r.value.setup ?? {};
  const settings: Settings = {
    playerLimit: clamp(Math.round(Number(s.playerLimit) || DEFAULT_SETTINGS.playerLimit), 3, 100),
    tieRule: s.tieRule === "random" ? "random" : "revote",
    survivalRule: s.survivalRule === "final-two" ? "final-two" : "parity",
    timerSeconds: clamp(Math.round(Number(s.timerSeconds) || 0), 0, 3600),
    scoring: s.scoring !== false,
  };
  const players = Array.isArray(u.players)
    ? u.players.filter((p) => p && typeof p.id === "string" && typeof p.name === "string").map((p) => ({ id: p.id, name: p.name }))
    : [];
  const setup: SetupDraft = {
    players,
    undercover: Math.max(0, Math.round(Number(u.undercover) || 0)),
    white: Math.max(0, Math.round(Number(u.white) || 0)),
    selectedGroupIds: Array.isArray(u.selectedGroupIds) ? u.selectedGroupIds.filter((x): x is string => typeof x === "string") : [],
    randomGroup: u.randomGroup === true,
  };
  return { settings, setup, hasSaved: true };
}

export const savePrefs = (settings: Settings, setup: SetupDraft): WriteResult =>
  saveToLocalStorage(STORAGE_KEYS.prefs, { version: SCHEMA_VERSION, settings, setup });

export function loadSession(): GameSession | null {
  const r = loadFromLocalStorage<{ session?: GameSession | null }>(STORAGE_KEYS.session);
  if (r.status !== "ok" || !r.value || typeof r.value !== "object") return null;
  const s = r.value.session;
  // Minimal structural check; a malformed session is dropped rather than crashing the UI.
  if (!s || !Array.isArray(s.players) || !s.currentPairSnapshot || typeof s.currentPhase !== "string" || !s.config) return null;
  return s;
}

export const saveSession = (session: GameSession | null): WriteResult => {
  if (!session) {
    removeFromLocalStorage(STORAGE_KEYS.session);
    return { ok: true };
  }
  return saveToLocalStorage(STORAGE_KEYS.session, { version: SCHEMA_VERSION, session });
};

export function loadHistory(): string[] {
  const r = loadFromLocalStorage<{ usedPairKeys?: unknown }>(STORAGE_KEYS.history);
  if (r.status !== "ok" || !r.value || !Array.isArray(r.value.usedPairKeys)) return [];
  return r.value.usedPairKeys.filter((k): k is string => typeof k === "string");
}

export const saveHistory = (usedPairKeys: string[]): WriteResult =>
  saveToLocalStorage(STORAGE_KEYS.history, { version: SCHEMA_VERSION, usedPairKeys });
