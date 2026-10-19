// Helpers shared by the database scripts. Environment is read from .env* like Next.js does.
import nextEnv from "@next/env";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { withVerifiedTls } from "../db/connection.mjs";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
process.chdir(projectRoot);
nextEnv.loadEnvConfig(projectRoot, process.env.NODE_ENV !== "production");

/** One-shot scripts use the direct (unpooled) Neon connection, as migrations do. */
export async function openClient() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED absente : lancez `neon env pull` ou renseignez .env.local (voir .env.example).");
  const client = new pg.Client({ connectionString: withVerifiedTls(url) });
  await client.connect();
  return client;
}

/** Runs `fn` inside a transaction: everything is written, or nothing. */
export async function transaction(client, fn) {
  await client.query("BEGIN");
  try {
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
