import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { withVerifiedTls } from "./db/connection.mjs";

// Same .env files as Next.js (.env.local holds the Neon URLs pulled by `neon deploy`).
loadEnvConfig(process.cwd());

// Migrations need a direct connection: Neon's pooler (PgBouncer, transaction mode)
// does not support the session features migration tools rely on.
const url = process.env.DATABASE_URL_UNPOOLED ?? "";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: withVerifiedTls(url) },
});
