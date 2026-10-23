import "server-only";
import crypto from "node:crypto";
import type { PoolConnection } from "mariadb";
import type { GameSession } from "@/types/game";
import type { Result, WordGroup } from "@/types/words";
import { MAX_ROOM_PLAYERS, type GameView, type LobbyConfig, type RoomAction, type RoomView } from "@/types/online";
import { sanitizeConfig } from "@/lib/online/config";
import {
  activePlayers, castVote, continueAfterElimination, createSession, finishVoting, speakingOrder, startDiscussion, startRevote, startVoting, submitWhiteGuess,
} from "@/lib/game/engine";
import { buildStarterGroups, sanitizeGroups } from "@/lib/storage/groups";
import { cleanWord, normalizeWord } from "@/lib/words/normalization";
import { randomInt, uid } from "@/lib/utils";
import { ApiError, isDuplicate, query, withTx } from "./db";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O: harder to misread on a phone
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const CONNECTED_MS = 20_000;
const HEARTBEAT_MS = 4_000;
const MAX_NAME = 24;

interface RoomRow { code: string; status: string; config: string; session: string | null; ready: string; version: number }
interface PlayerRow { room_code: string; player_id: string; name: string; name_key: string; token: string; is_host: number; joined_at: number; last_seen: number }

interface Room { code: string; status: "lobby" | "playing"; config: LobbyConfig; session: GameSession | null; ready: string[]; version: number }
interface Ctx { conn: PoolConnection; room: Room; players: PlayerRow[]; me: PlayerRow; now: number }

const isConnected = (p: PlayerRow, now: number) => now - p.last_seen < CONNECTED_MS;
const newToken = () => crypto.randomBytes(24).toString("hex");
const newCode = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

function parseCode(raw: unknown): string {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) throw new ApiError(404, "Room not found. Check the 4-letter code.");
  return code;
}

function cleanName(raw: unknown): string {
  const name = cleanWord(String(raw ?? ""));
  if (!name) throw new ApiError(400, "Enter your name.");
  if (name.length > MAX_NAME) throw new ApiError(400, `Names can be at most ${MAX_NAME} characters.`);
  return name;
}

function parseRoom(row: RoomRow): Room {
  const safe = <T,>(raw: string | null, fallback: T): T => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };
  return {
    code: row.code,
    status: row.status === "playing" ? "playing" : "lobby",
    config: sanitizeConfig(safe(row.config, {})),
    session: safe<GameSession | null>(row.session, null),
    ready: safe<string[]>(row.ready, []),
    version: row.version,
  };
}

/* ------------------------------------------------------------------ views */

function buildView(room: Room, players: PlayerRow[], me: PlayerRow, now: number): RoomView {
  const host = players.find((p) => p.is_host === 1);
  const byId = new Map(players.map((p) => [p.player_id, p]));
  return {
    code: room.code,
    version: room.version,
    serverTime: now,
    status: room.status,
    me: { id: me.player_id, name: me.name, isHost: me.is_host === 1 },
    hostId: host?.player_id ?? "",
    hostConnected: host ? isConnected(host, now) : false,
    players: players.map((p) => ({ id: p.player_id, name: p.name, isHost: p.is_host === 1, connected: isConnected(p, now) })),
    config: room.config,
    game: room.session ? buildGameView(room, room.session, me, byId, now) : null,
  };
}

/** The privacy boundary: roles and words of other players are only added once the rules reveal them. */
function buildGameView(room: Room, s: GameSession, me: PlayerRow, byId: Map<string, PlayerRow>, now: number): GameView {
  const over = s.currentPhase === "results";
  const self = s.players.find((p) => p.id === me.player_id);
  return {
    id: s.id,
    phase: s.currentPhase,
    round: s.currentRound,
    config: s.config,
    players: s.players.map((p) => {
      const row = byId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        active: p.active,
        connected: row ? isConnected(row, now) : false,
        score: p.score,
        role: !p.active || over ? p.role : null,
        word: over ? p.assignedWord : null,
      };
    }),
    myWord: self?.assignedWord ?? null,
    iAmWhite: self?.role === "white",
    amActive: !!self?.active,
    startingPlayerId: s.startingPlayerId,
    speakingOrder: speakingOrder(s).map((p) => p.id),
    readyIds: room.ready,
    votedIds: Object.keys(s.votes), // who voted, never for whom
    myVote: s.votes[me.player_id] ?? null,
    voteAttempt: s.voteAttempt,
    revoteCandidates: s.revoteCandidates,
    lastOutcome: s.lastOutcome,
    eliminationHistory: s.eliminationHistory,
    winner: s.winner,
    pointsAwarded: s.pointsAwarded,
    words: over ? { civilianWord: s.currentPairSnapshot.civilianWord, undercoverWord: s.currentPairSnapshot.undercoverWord } : null,
    phaseStartedAt: s.updatedAt,
  };
}

/* ------------------------------------------------------------- create/join */

export async function createRoom(rawName: unknown, rawConfig: unknown) {
  const name = cleanName(rawName);
  const config = sanitizeConfig(rawConfig);
  const now = Date.now();
  const playerId = uid();
  const token = newToken();
  await query("DELETE FROM sw_rooms WHERE updated_at < ?", [now - ROOM_TTL_MS]);
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = newCode();
    try {
      await withTx(async (c) => {
        await c.query("INSERT INTO sw_rooms (code, status, config, session, ready, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
          [code, "lobby", JSON.stringify(config), null, "[]", 1, now, now]);
        await c.query("INSERT INTO sw_room_players (room_code, player_id, name, name_key, token, is_host, joined_at, last_seen) VALUES (?,?,?,?,?,?,?,?)",
          [code, playerId, name, normalizeWord(name), token, 1, now, now]);
      });
      return { code, playerId, token };
    } catch (e) {
      if (isDuplicate(e)) continue;
      throw e;
    }
  }
  throw new ApiError(500, "Could not allocate a room code. Try again.");
}

export async function joinRoom(rawCode: unknown, rawName: unknown) {
  const code = parseCode(rawCode);
  const name = cleanName(rawName);
  const key = normalizeWord(name);
  const now = Date.now();
  return withTx(async (c) => {
    const room = await lockRoom(c, code);
    const players = await loadPlayers(c, code);
    const same = players.find((p) => p.name_key === key);
    const token = newToken();
    if (same) {
      // Same name: allowed only to take over a seat whose phone went away (lost token, new browser, ...).
      if (isConnected(same, now)) throw new ApiError(409, "That name is taken by a player who is still connected. Pick another name.");
      await c.query("UPDATE sw_room_players SET token=?, last_seen=? WHERE room_code=? AND player_id=?", [token, now, code, same.player_id]);
      await bump(c, code, now);
      return { code, playerId: same.player_id, token, rejoined: true };
    }
    if (room.status !== "lobby") throw new ApiError(409, "This game has already started. Only existing players can rejoin (use your exact name).");
    if (players.length >= MAX_ROOM_PLAYERS) throw new ApiError(409, `This room is full (${MAX_ROOM_PLAYERS} players).`);
    const playerId = uid();
    await c.query("INSERT INTO sw_room_players (room_code, player_id, name, name_key, token, is_host, joined_at, last_seen) VALUES (?,?,?,?,?,?,?,?)",
      [code, playerId, name, key, token, 0, now, now]);
    await bump(c, code, now);
    return { code, playerId, token, rejoined: false };
  });
}

const bump = (c: PoolConnection, code: string, now: number) => c.query("UPDATE sw_rooms SET version = version + 1, updated_at = ? WHERE code = ?", [now, code]);

async function lockRoom(c: PoolConnection, code: string): Promise<Room> {
  const rows = (await c.query("SELECT * FROM sw_rooms WHERE code = ? FOR UPDATE", [code])) as RoomRow[];
  if (!rows.length) throw new ApiError(404, "Room not found. It may have expired.");
  return parseRoom(rows[0]);
}

async function loadPlayers(c: PoolConnection, code: string): Promise<PlayerRow[]> {
  return (await c.query("SELECT * FROM sw_room_players WHERE room_code = ? ORDER BY joined_at, player_id", [code])) as PlayerRow[];
}

/* ------------------------------------------------------------------ state */

export async function getRoomView(rawCode: unknown, token: string): Promise<RoomView> {
  const code = parseCode(rawCode);
  const rows = await query<RoomRow[]>("SELECT * FROM sw_rooms WHERE code = ?", [code]);
  if (!rows.length) throw new ApiError(404, "Room not found. It may have expired.");
  const players = await query<PlayerRow[]>("SELECT * FROM sw_room_players WHERE room_code = ? ORDER BY joined_at, player_id", [code]);
  const me = token ? players.find((p) => p.token === token) : undefined;
  if (!me) throw new ApiError(401, "You are not in this room (or you were removed).");
  const now = Date.now();
  if (now - me.last_seen > HEARTBEAT_MS) {
    await query("UPDATE sw_room_players SET last_seen = ? WHERE room_code = ? AND player_id = ?", [now, code, me.player_id]);
    me.last_seen = now;
  }
  return buildView(parseRoom(rows[0]), players, me, now);
}

/* ---------------------------------------------------------------- actions */

export async function runAction(rawCode: unknown, token: string, action: RoomAction): Promise<{ view: RoomView | null }> {
  const code = parseCode(rawCode);
  const gone = await withTx(async (conn) => {
    const room = await lockRoom(conn, code);
    const players = await loadPlayers(conn, code);
    const me = token ? players.find((p) => p.token === token) : undefined;
    if (!me) throw new ApiError(401, "You are not in this room (or you were removed).");
    const now = Date.now();
    me.last_seen = now;
    await conn.query("UPDATE sw_room_players SET last_seen = ? WHERE room_code = ? AND player_id = ?", [now, code, me.player_id]);
    const ctx: Ctx = { conn, room, players, me, now };
    const result = await perform(ctx, action);
    if (result === "room-deleted") return true;
    await conn.query("UPDATE sw_rooms SET status=?, config=?, session=?, ready=?, version=version+1, updated_at=? WHERE code=?",
      [room.status, JSON.stringify(room.config), room.session ? JSON.stringify(room.session) : null, JSON.stringify(room.ready), now, code]);
    return false;
  });
  if (gone || action.type === "leave") return { view: null };
  return { view: await getRoomView(code, token) };
}

const requireHost = (ctx: Ctx) => { if (ctx.me.is_host !== 1) throw new ApiError(403, "Only the host can do that."); };
const sessionOf = (ctx: Ctx): GameSession => { if (!ctx.room.session) throw new ApiError(409, "There is no game in progress."); return ctx.room.session; };
function run(ctx: Ctx, fn: (s: GameSession) => Result<GameSession>) {
  const r = fn(sessionOf(ctx));
  if (!r.ok) throw new ApiError(400, r.error);
  ctx.room.session = r.value;
}

async function perform(ctx: Ctx, a: RoomAction): Promise<"room-deleted" | void> {
  const { room, me, conn, players, now } = ctx;
  switch (a.type) {
    case "config": {
      requireHost(ctx);
      if (room.status !== "lobby") throw new ApiError(409, "Settings can only be changed in the lobby.");
      room.config = sanitizeConfig(a.config, room.config);
      return;
    }
    case "kick": {
      requireHost(ctx);
      if (room.status !== "lobby") throw new ApiError(409, "Players can only be removed in the lobby.");
      if (a.playerId === me.player_id) throw new ApiError(400, "You can't remove yourself.");
      await conn.query("DELETE FROM sw_room_players WHERE room_code = ? AND player_id = ?", [room.code, String(a.playerId)]);
      return;
    }
    case "leave": {
      if (room.status !== "lobby") throw new ApiError(409, "You can't leave while a game is running; just close the page and rejoin later.");
      await conn.query("DELETE FROM sw_room_players WHERE room_code = ? AND player_id = ?", [room.code, me.player_id]);
      const rest = players.filter((p) => p.player_id !== me.player_id);
      if (!rest.length) { await conn.query("DELETE FROM sw_rooms WHERE code = ?", [room.code]); return "room-deleted"; }
      if (me.is_host === 1) await conn.query("UPDATE sw_room_players SET is_host = 1 WHERE room_code = ? AND player_id = ?", [room.code, rest[0].player_id]);
      return;
    }
    case "claimHost": {
      if (me.is_host === 1) return;
      const host = players.find((p) => p.is_host === 1);
      if (host && isConnected(host, now)) throw new ApiError(409, "The host is still connected.");
      await conn.query("UPDATE sw_room_players SET is_host = (player_id = ?) WHERE room_code = ?", [me.player_id, room.code]);
      return;
    }
    case "resetHistory": {
      requireHost(ctx);
      await conn.query("DELETE FROM sw_kv WHERE k = 'used_pairs'");
      return;
    }
    case "start": {
      requireHost(ctx);
      if (room.status !== "lobby") throw new ApiError(409, "The game has already started.");
      await beginGame(ctx, null);
      return;
    }
    case "playAgain": {
      requireHost(ctx);
      const prev = sessionOf(ctx);
      if (prev.currentPhase !== "results") throw new ApiError(409, "The current game isn't finished yet.");
      await beginGame(ctx, prev);
      return;
    }
    case "lobby": {
      requireHost(ctx);
      room.status = "lobby";
      room.session = null;
      room.ready = [];
      return;
    }
    case "ready": {
      const s = sessionOf(ctx);
      if (s.currentPhase !== "reveal") return; // late tap: harmless
      if (!room.ready.includes(me.player_id)) room.ready.push(me.player_id);
      if (s.players.every((p) => room.ready.includes(p.id))) toClue(ctx);
      return;
    }
    case "skipReveal": {
      requireHost(ctx);
      if (sessionOf(ctx).currentPhase === "reveal") toClue(ctx);
      return;
    }
    case "startDiscussion": requireHost(ctx); return run(ctx, startDiscussion);
    case "startVoting": requireHost(ctx); return run(ctx, startVoting);
    case "finishVoting": requireHost(ctx); return run(ctx, finishVoting);
    case "revote": requireHost(ctx); return run(ctx, startRevote);
    case "continue": requireHost(ctx); return run(ctx, continueAfterElimination);
    case "vote": {
      run(ctx, (s) => castVote(s, me.player_id, String(a.targetId)));
      const s = sessionOf(ctx);
      if (Object.keys(s.votes).length >= activePlayers(s).length) run(ctx, finishVoting);
      return;
    }
    case "guess": {
      const s = sessionOf(ctx);
      if (s.lastOutcome?.kind !== "eliminated" || s.lastOutcome.playerId !== me.player_id) throw new ApiError(403, "Only the eliminated Mr. White can guess.");
      return run(ctx, (x) => submitWhiteGuess(x, String(a.guess ?? "").slice(0, 80)));
    }
    default:
      throw new ApiError(400, "Unknown action.");
  }
}

function toClue(ctx: Ctx) {
  const s = sessionOf(ctx);
  ctx.room.session = { ...s, currentPhase: "clue", revealIndex: s.players.length, updatedAt: Date.now() };
}

/* -------------------------------------------------------------- game start */

async function readKv(c: PoolConnection, k: string): Promise<string | null> {
  const rows = (await c.query("SELECT v FROM sw_kv WHERE k = ?", [k])) as { v: string }[];
  return rows.length ? rows[0].v : null;
}

async function loadLibrary(c: PoolConnection): Promise<WordGroup[]> {
  const raw = await readKv(c, "library");
  if (raw) {
    try {
      const groups = sanitizeGroups((JSON.parse(raw) as { groups?: unknown }).groups);
      if (groups.length) return groups;
    } catch { /* fall through to starter groups */ }
  }
  return buildStarterGroups();
}

async function beginGame(ctx: Ctx, prev: GameSession | null) {
  const { conn, room, players, now } = ctx;
  const usedRaw = await readKv(conn, "used_pairs");
  let used: string[] = [];
  try { used = usedRaw ? (JSON.parse(usedRaw) as string[]) : []; } catch { /* start fresh */ }
  const cfg = room.config;
  const inRoom = new Set(players.map((p) => p.player_id));
  const r = createSession({
    players: prev
      ? prev.players.filter((p) => inRoom.has(p.id)).map((p) => ({ id: p.id, name: p.name, score: p.score }))
      : players.map((p) => ({ id: p.player_id, name: p.name, score: 0 })),
    selectedGroupIds: prev ? prev.selectedGroupIds : cfg.selectedGroupIds,
    randomGroup: prev ? prev.randomGroup : cfg.randomGroup,
    config: prev
      ? prev.config
      : { undercoverCount: cfg.undercover, whiteCount: cfg.white, tieRule: cfg.tieRule, survivalRule: cfg.survivalRule, timerSeconds: cfg.timerSeconds, scoring: cfg.scoring },
    groups: await loadLibrary(conn),
    usedPairKeys: used,
    playerLimit: MAX_ROOM_PLAYERS,
  });
  if (!r.ok) throw new ApiError(400, r.error);
  await conn.query("INSERT INTO sw_kv (k, v, updated_at) VALUES ('used_pairs', ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)",
    [JSON.stringify(r.value.usedPairKeys), now]);
  room.session = r.value.session;
  room.status = "playing";
  room.ready = [];
}

/* ---------------------------------------------------------------- library */

export async function getLibrary(): Promise<{ groups: unknown[] | null }> {
  const rows = await query<{ v: string }[]>("SELECT v FROM sw_kv WHERE k = 'library'");
  if (!rows.length) return { groups: null };
  try {
    const parsed = JSON.parse(rows[0].v) as { groups?: unknown };
    return { groups: Array.isArray(parsed.groups) ? parsed.groups : null };
  } catch {
    return { groups: null };
  }
}

export async function saveLibrary(groups: unknown) {
  if (!Array.isArray(groups)) throw new ApiError(400, "Expected { groups: [...] }.");
  const json = JSON.stringify({ groups });
  if (json.length > 8_000_000) throw new ApiError(413, "The library is too large to store.");
  await query("INSERT INTO sw_kv (k, v, updated_at) VALUES ('library', ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)", [json, Date.now()]);
  return { saved: groups.length };
}
