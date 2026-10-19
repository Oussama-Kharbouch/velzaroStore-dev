// Opens PostgreSQL connections: must never end up in a browser bundle.
import "server-only";
import { parseEnv } from "@neon/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import neonConfig from "../neon";
import * as schema from "./schema";
import { withVerifiedTls } from "./connection.mjs";

/**
 * Drizzle on node-postgres, as Neon recommends for a long-running Node server
 * (`next start`) and for Vercel Fluid compute. The app uses the pooled URL
 * (DATABASE_URL, `-pooler` host); migrations use DATABASE_URL_UNPOOLED.
 *
 * One pool per server process, kept on globalThis: each hot reload re-evaluates
 * this module in development, and new pools would otherwise pile up connections.
 */
const POOL = Symbol.for("velzaro.db");
type Db = ReturnType<typeof drizzle<typeof schema>>;
type Global = typeof globalThis & { [POOL]?: Db };

export function getDb(): Db {
  const global = globalThis as Global;
  if (!global[POOL]) {
    const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
    const pool = new Pool({
      connectionString: withVerifiedTls(postgres.databaseUrl),
      max: 10,
      // Neon scales to zero: release idle connections instead of holding them open.
      idleTimeoutMillis: 30_000,
    });
    global[POOL] = drizzle(pool, { schema });
  }
  return global[POOL];
}

export { schema };
