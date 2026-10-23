
import "server-only";
import {
  createConnection,
  createPool,
  type Pool,
  type PoolConnection,
} from "mariadb";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tls from "node:tls";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Globals = {
  __swPool?: Pool;
  __swSchema?: Promise<void>;
};

const g = globalThis as typeof globalThis & Globals;

const cfg = () => ({
  // DB_HOST remains the real hostname for TLS verification.
  host: process.env.DB_HOST ?? "127.0.0.1",
  // Temporary workaround if connecting by hostname times out.
  connectHost: process.env.DB_CONNECT_HOST || process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "shadow",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "shadow_words",
});

function getSslConfig() {
  const { host } = cfg();

  const ca = process.env.DB_SSL_CA;

  if (!ca) {
    throw new Error("Missing DB_SSL_CA environment variable");
  }

  return {
    ca: ca.replace(/\\n/g, "\n"),
    rejectUnauthorized: true,
    servername: host,
    checkServerIdentity: (_servername: string, cert: tls.PeerCertificate) =>
      tls.checkServerIdentity(host, cert),
  };
}
function connectionOptions(includeDatabase = true) {
  const { connectHost, port, user, password, database } = cfg();

  return {
    host: connectHost,
    port,
    user,
    password,
    ...(includeDatabase ? { database } : {}),
    connectTimeout: 15000,
    ssl: getSslConfig(),
  };
}

export function getPool(): Pool {
  if (!g.__swPool) {
    g.__swPool = createPool({
      ...connectionOptions(),
      connectionLimit: 5,
      acquireTimeout: 15000,
      connectTimeout: 15000,
      bigIntAsNumber: true,
      insertIdAsNumber: true,
      charset: "utf8mb4",
    });
  }

  return g.__swPool;
}

const TABLES = [
  `CREATE TABLE IF NOT EXISTS sw_kv (
     k VARCHAR(64) NOT NULL PRIMARY KEY,
     v LONGTEXT NOT NULL,
     updated_at BIGINT NOT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sw_rooms (
     code CHAR(4) NOT NULL PRIMARY KEY,
     status VARCHAR(10) NOT NULL DEFAULT 'lobby',
     config LONGTEXT NOT NULL,
     session LONGTEXT NULL,
     ready LONGTEXT NOT NULL,
     version INT NOT NULL DEFAULT 1,
     created_at BIGINT NOT NULL,
     updated_at BIGINT NOT NULL,
     KEY idx_rooms_updated (updated_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sw_room_players (
     room_code CHAR(4) NOT NULL,
     player_id CHAR(36) NOT NULL,
     name VARCHAR(24) NOT NULL,
     name_key VARCHAR(100) NOT NULL,
     token CHAR(48) NOT NULL,
     is_host TINYINT(1) NOT NULL DEFAULT 0,
     joined_at BIGINT NOT NULL,
     last_seen BIGINT NOT NULL,
     PRIMARY KEY (room_code, player_id),
     UNIQUE KEY uq_room_name (room_code, name_key),
     UNIQUE KEY uq_token (token),
     CONSTRAINT fk_sw_room
       FOREIGN KEY (room_code) REFERENCES sw_rooms (code)
       ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function createTables(): Promise<void> {
  const conn = await getPool().getConnection();

  try {
    for (const sql of TABLES) {
      await conn.query(sql);
    }
  } finally {
    conn.release();
  }
}

/**
 * Creates the database only if the configured account has permission.
 * Aiven's existing defaultdb normally does not need this fallback.
 */
async function tryCreateDatabase(): Promise<void> {
  const conn = await createConnection({
    ...connectionOptions(false),
  });

  try {
    const database = cfg().database.replace(/`/g, "");
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`
    );
  } finally {
    await conn.end();
  }
}

type DbErr = {
  errno?: number;
  code?: string;
  message?: string;
  cause?: unknown;
};

function rootCause(error: unknown): DbErr {
  let current = error as DbErr;
  const seen = new Set<unknown>();

  while (
    current?.cause &&
    typeof current.cause === "object" &&
    !seen.has(current.cause)
  ) {
    seen.add(current);
    current = current.cause as DbErr;
  }

  return current ?? {};
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const err = rootCause(error);
  const { host, port, user, database } = cfg();

  if (
    [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ER_CONNECTION_TIMEOUT",
      "ENOTFOUND",
      "EHOSTUNREACH",
      "ER_GET_CONNECTION_TIMEOUT",
    ].includes(err.code ?? "")
  ) {
    return new ApiError(
      503,
      `Cannot connect to the database at ${host}:${port}. Check the database endpoint and network access.`
    );
  }

  if (err.errno === 1045) {
    return new ApiError(
      503,
      `Database login rejected for user "${user}". Check DB_USER and DB_PASSWORD.`
    );
  }

  if (err.errno === 1049) {
    return new ApiError(
      503,
      `Database "${database}" does not exist. Check DB_NAME.`
    );
  }

  if (err.errno === 1044) {
    return new ApiError(
      503,
      `User "${user}" does not have access to database "${database}".`
    );
  }

  console.error("[shadow-words] database error:", error);
  return new ApiError(500, "Unexpected server error.");
}

/** Creates tables on first use; shares initialization across warm instances. */
export function ensureSchema(): Promise<void> {
  if (!g.__swSchema) {
    g.__swSchema = (async () => {
      try {
        await createTables();
      } catch (error) {
        if (rootCause(error).errno !== 1049) throw error;

        await tryCreateDatabase();
        await g.__swPool?.end().catch(() => undefined);
        g.__swPool = undefined;

        await createTables();
      }
    })().catch((error) => {
      g.__swSchema = undefined;
      throw toApiError(error);
    });
  }

  return g.__swSchema;
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  await ensureSchema();

  try {
    return (await getPool().query(sql, params)) as T;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function withTx<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  await ensureSchema();

  let conn: PoolConnection;

  try {
    conn = await getPool().getConnection();
  } catch (error) {
    throw toApiError(error);
  }

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // Preserve the original error.
    }

    throw toApiError(error);
  } finally {
    conn.release();
  }
}

export const isDuplicate = (error: unknown) =>
  (error as { errno?: number })?.errno === 1062;
