"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GameSession, Settings, SetupDraft } from "@/types/game";
import type { Result, WordGroup } from "@/types/words";
import { fail, ok } from "@/lib/utils";
import { createSession } from "@/lib/game/engine";
import { addPairsToGroup, applyImport, type ConflictMode, type ParsedImport } from "@/lib/words/imports";
import {
  addWordPair, createWordGroup, deleteWordGroup, deleteWordPairs, duplicateWordGroup, updateWordGroup, updateWordPair, type GroupInput,
} from "@/lib/words/groups";
import { buildStarterGroups, loadLibrary, sanitizeGroups, saveLibrary } from "@/lib/storage/groups";
import { DEFAULT_SETTINGS, DEFAULT_SETUP, loadHistory, loadPrefs, loadSession, saveHistory, savePrefs, saveSession } from "@/lib/storage/sessions";
import { useToast } from "@/components/ui/toast";

type GroupResult = Result<{ groups: WordGroup[]; group: WordGroup }>;

export type DbStatus = "unknown" | "connected" | "offline";

interface AppCtx {
  hydrated: boolean;
  storageError: string | null;
  /** MariaDB connection state: the word library is mirrored there so online rooms can use it. */
  dbStatus: DbStatus;
  retryDb: () => Promise<void>;
  /** Resolves true once every library change has reached MariaDB. */
  flushLibrary: () => Promise<boolean>;
  groups: WordGroup[];
  settings: Settings;
  setup: SetupDraft;
  session: GameSession | null;
  usedPairKeys: string[];
  setSettings: (patch: Partial<Settings>) => void;
  updateSetup: (patch: Partial<SetupDraft> | ((s: SetupDraft) => Partial<SetupDraft>)) => void;
  createGroup: (input: GroupInput) => GroupResult;
  updateGroup: (id: string, patch: { name?: string; description?: string; enabled?: boolean }) => GroupResult;
  deleteGroup: (id: string) => Result<{ groups: WordGroup[] }>;
  duplicateGroup: (id: string) => GroupResult;
  addPair: (groupId: string, civ: string, und: string) => GroupResult;
  updatePair: (groupId: string, pairId: string, civ: string, und: string) => GroupResult;
  deletePairs: (groupId: string, ids: string[]) => GroupResult;
  importGroups: (parsed: ParsedImport, mode: ConflictMode) => ReturnType<typeof applyImport>;
  importPairs: (groupId: string, pairs: { civilianWord: string; undercoverWord: string }[]) => ReturnType<typeof addPairsToGroup>;
  restoreStarterGroups: () => number;
  resetLibrary: () => void;
  resetHistory: () => void;
  startGame: () => Result<GameSession>;
  playAgain: () => Result<GameSession>;
  dispatchSession: (fn: (s: GameSession) => Result<GameSession>) => Result<GameSession>;
  quitGame: () => void;
}

const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [setup, setSetup] = useState<SetupDraft>(DEFAULT_SETUP);
  const [session, setSessionState] = useState<GameSession | null>(null);
  const [usedPairKeys, setUsed] = useState<string[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>("unknown");

  const groupsRef = useRef<WordGroup[]>([]);
  const sessionRef = useRef<GameSession | null>(null);
  const loadNotice = useRef(false);
  const writeError = useRef<string | null>(null);
  const lastSynced = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const report = useCallback((r: { ok: true } | { ok: false; error: string }) => {
    if (r.ok) {
      if (writeError.current) { writeError.current = null; setStorageError(null); }
    } else if (writeError.current !== r.error) {
      writeError.current = r.error;
      setStorageError(r.error);
    }
  }, []);

  const commit = useCallback((next: WordGroup[]) => { groupsRef.current = next; setGroups(next); }, []);
  const commitSession = useCallback((s: GameSession | null) => { sessionRef.current = s; setSessionState(s); }, []);
  const apply = useCallback((r: GroupResult): GroupResult => { if (r.ok) commit(r.value.groups); return r; }, [commit]);

  /** Sends the current library to MariaDB (no-op when nothing changed). */
  const pushLibrary = useCallback(async (): Promise<boolean> => {
    const json = JSON.stringify(groupsRef.current);
    if (json === lastSynced.current) return true;
    try {
      const res = await fetch("/api/library", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups: groupsRef.current }) });
      if (!res.ok) throw new Error(String(res.status));
      lastSynced.current = json;
      setDbStatus("connected");
      return true;
    } catch {
      setDbStatus("offline");
      return false;
    }
  }, []);

  /** MariaDB is the source of truth when it has a library; otherwise the local one is uploaded to it. */
  const connectDb = useCallback(async () => {
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { groups: unknown[] | null };
      if (Array.isArray(data.groups)) {
        const g = sanitizeGroups(data.groups);
        lastSynced.current = JSON.stringify(g);
        commit(g);
        setSetup((s) => (s.selectedGroupIds.some((id) => g.some((x) => x.id === id)) ? s : { ...s, selectedGroupIds: g.filter((x) => x.enabled).map((x) => x.id) }));
        setDbStatus("connected");
      } else {
        lastSynced.current = "";
        setDbStatus((await pushLibrary()) ? "connected" : "offline");
      }
    } catch {
      setDbStatus("offline");
    }
  }, [commit, pushLibrary]);

  const flushLibrary = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    return pushLibrary();
  }, [pushLibrary]);

  // Load once on the client. Idempotent, so React Strict Mode's double effect is harmless.
  useEffect(() => {
    const lib = loadLibrary();
    const prefs = loadPrefs();
    const s = loadSession();
    groupsRef.current = lib.groups;
    sessionRef.current = s;
    setGroups(lib.groups);
    setSettingsState(prefs.settings);
    setSetup(prefs.hasSaved ? prefs.setup : { ...prefs.setup, selectedGroupIds: lib.groups.filter((g) => g.enabled).map((g) => g.id) });
    setSessionState(s);
    setUsed(loadHistory());
    if (lib.status === "unavailable") setStorageError("Browser storage is unavailable (private mode or blocked). You can still play, but nothing will be saved.");
    if (lib.status === "recovered" && !loadNotice.current) {
      loadNotice.current = true;
      setTimeout(() => toast("Saved library data was unreadable. A backup was kept and starter groups were restored.", "error"), 0);
    }
    setHydrated(true);
    void connectDb();
  }, [toast, connectDb]);

  useEffect(() => { if (hydrated) report(saveLibrary(groups)); }, [groups, hydrated, report]);
  useEffect(() => {
    if (!hydrated || dbStatus !== "connected") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void pushLibrary(); }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [groups, hydrated, dbStatus, pushLibrary]);
  useEffect(() => { if (hydrated) report(savePrefs(settings, setup)); }, [settings, setup, hydrated, report]);
  useEffect(() => { if (hydrated) report(saveSession(session)); }, [session, hydrated, report]);
  useEffect(() => { if (hydrated) report(saveHistory(usedPairKeys)); }, [usedPairKeys, hydrated, report]);

  const value = useMemo<AppCtx>(() => ({
    hydrated, storageError, dbStatus, retryDb: connectDb, flushLibrary, groups, settings, setup, session, usedPairKeys,
    setSettings: (patch) => setSettingsState((s) => ({ ...s, ...patch })),
    updateSetup: (patch) => setSetup((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })),
    createGroup: (input) => apply(createWordGroup(groupsRef.current, input)),
    updateGroup: (id, patch) => apply(updateWordGroup(groupsRef.current, id, patch)),
    deleteGroup: (id) => {
      const r = deleteWordGroup(groupsRef.current, id);
      if (r.ok) { commit(r.value.groups); setSetup((s) => ({ ...s, selectedGroupIds: s.selectedGroupIds.filter((x) => x !== id) })); }
      return r;
    },
    duplicateGroup: (id) => apply(duplicateWordGroup(groupsRef.current, id)),
    addPair: (gid, c, u) => apply(addWordPair(groupsRef.current, gid, c, u)),
    updatePair: (gid, pid, c, u) => apply(updateWordPair(groupsRef.current, gid, pid, c, u)),
    deletePairs: (gid, ids) => apply(deleteWordPairs(groupsRef.current, gid, ids)),
    importGroups: (parsed, mode) => {
      const r = applyImport(groupsRef.current, parsed, mode);
      if (r.groupsAdded) commit(r.groups);
      return r;
    },
    importPairs: (gid, pairs) => {
      const r = addPairsToGroup(groupsRef.current, gid, pairs);
      if (r.added) commit(r.groups);
      return r;
    },
    restoreStarterGroups: () => {
      const next = buildStarterGroups(groupsRef.current);
      const added = next.length - groupsRef.current.length;
      if (added) commit(next);
      return added;
    },
    resetLibrary: () => {
      const next = buildStarterGroups([]);
      commit(next);
      setSetup((s) => ({ ...s, selectedGroupIds: next.map((g) => g.id) }));
      setUsed([]);
    },
    resetHistory: () => setUsed([]),
    startGame: () => {
      const r = createSession({
        players: setup.players.map((p) => ({ id: p.id, name: p.name, score: 0 })),
        selectedGroupIds: setup.selectedGroupIds,
        randomGroup: setup.randomGroup,
        config: { undercoverCount: setup.undercover, whiteCount: setup.white, tieRule: settings.tieRule, survivalRule: settings.survivalRule, timerSeconds: settings.timerSeconds, scoring: settings.scoring },
        groups: groupsRef.current,
        usedPairKeys,
        playerLimit: settings.playerLimit,
      });
      if (!r.ok) return r;
      commitSession(r.value.session);
      setUsed(r.value.usedPairKeys);
      return ok(r.value.session);
    },
    playAgain: () => {
      const prev = sessionRef.current;
      if (!prev) return fail("There is no previous game to repeat.");
      const r = createSession({
        players: prev.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
        selectedGroupIds: prev.selectedGroupIds,
        randomGroup: prev.randomGroup,
        config: prev.config,
        groups: groupsRef.current,
        usedPairKeys,
        playerLimit: 1000,
      });
      if (!r.ok) return r;
      commitSession(r.value.session);
      setUsed(r.value.usedPairKeys);
      return ok(r.value.session);
    },
    dispatchSession: (fn) => {
      const cur = sessionRef.current;
      if (!cur) return fail("There is no active game.");
      const r = fn(cur);
      if (r.ok) commitSession(r.value);
      return r;
    },
    quitGame: () => commitSession(null),
  }), [hydrated, storageError, dbStatus, connectDb, flushLibrary, groups, settings, setup, session, usedPairKeys, apply, commit, commitSession]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
