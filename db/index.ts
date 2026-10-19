// Opens PostgreSQL connections: must never end up in a browser bundle.
import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Drizzle on Neon's serverless driver (Postgres over WebSocket), with the pooled
 * URL (DATABASE_URL, `-pooler` host). Transactions are supported. `pg` is only used
 * by local scripts and migrations, never by the app: it cannot run on Workers.
 *
 * — Cloudflare Workers (production): a connection opened during a request cannot
 *   serve another one, so each request gets its own pool (React `cache` shares it
 *   within one render). Neon asks for connections to be closed: each one closes after
 *   1 s idle, and `ctx.waitUntil` keeps the Worker alive until then without delaying
 *   the response (same approach as Deco Prestigea).
 * — Node (local `next dev` / `next start`): one pool for the process, kept on
 *   globalThis so hot reloads don't pile up connections. Node 20 needs the
 *   --experimental-websocket flag (set in the npm scripts); Node 22+ has WebSocket.
 */
type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Read directly from the environment (Cloudflare secret in production, .env.local locally). */
const databaseUrl = () => {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) throw new Error("DATABASE_URL absente : la définir dans .env.local, ou dans les secrets du Worker en production.");
  return url;
};

/** workerd, the Workers runtime, announces itself under this name. */
const onWorkers = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const requestDb = cache((): Db => {
  const pool = new Pool({ connectionString: databaseUrl(), max: 1, idleTimeoutMillis: 1000 });
  const { ctx } = getCloudflareContext();
  pool.on("connect", () => {
    ctx.waitUntil(new Promise<void>((resolve) => pool.once("remove", () => resolve())));
  });
  return drizzle(pool, { schema });
});

const POOL = Symbol.for("velzaro.db");
type Global = typeof globalThis & { [POOL]?: Db };

const localDb = (): Db => {
  const global = globalThis as Global;
  return (global[POOL] ??= drizzle(new Pool({ connectionString: databaseUrl(), max: 10, idleTimeoutMillis: 30_000 }), { schema }));
};

export function getDb(): Db {
  return onWorkers() ? requestDb() : localDb();
}

export { schema };
