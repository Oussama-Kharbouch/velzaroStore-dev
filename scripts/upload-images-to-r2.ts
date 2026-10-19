/**
 * Moves the site pictures from public/assets to Cloudflare R2 (bucket R2_BUCKET).
 *
 *   npm run images:r2 -- --dry-run   shows what would be done, changes nothing
 *   npm run images:r2                uploads, checks each public address, updates the database
 *
 * - Files are uploaded AS IS (byte for byte, already WebP): no re-encoding, the photos and
 *   their framing stay exactly the same. Content-Type image/webp, Cache-Control immutable.
 * - Keys: products/cloudtilt/<colourway>/<n>.webp, banners/hero.webp, categories/<name>.webp
 *   (lib/catalog.mjs). The database (product_images.url) receives the KEY, never a full URL.
 * - public/ is only read, never modified or deleted.
 * - Refuses a real run on the production database unless --production is given.
 * - Can be re-run: files are overwritten with identical content, rows already migrated are skipped.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";
import { legacyToKey, siteImages } from "../lib/catalog.mjs";
import { withVerifiedTls } from "../db/connection.mjs";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
nextEnv.loadEnvConfig(root);

const dryRun = process.argv.includes("--dry-run");
const allowProduction = process.argv.includes("--production");
const PRODUCTION_HOST = "ep-long-flower-b529wx99";
const CACHE = "public, max-age=31536000, immutable";

const env = (name: string) => (process.env[name] ?? "").trim();
const R2_VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT", "R2_PUBLIC_URL"];
const missing = R2_VARS.filter((name) => !env(name));
const dbUrl = env("DATABASE_URL_UNPOOLED") || env("DATABASE_URL");
const onProduction = dbUrl.includes(PRODUCTION_HOST) || env("NEON_BRANCH") === "production";
const host = (url: string) => { try { return new URL(url).host; } catch { return "(invalide)"; } };

console.log(`Mode            : ${dryRun ? "SIMULATION (--dry-run) — rien n'est envoyé ni modifié" : "EXÉCUTION RÉELLE"}`);
console.log(`Base Neon       : branche ${env("NEON_BRANCH") || "?"} (${host(dbUrl.replace(/^postgresql:/, "http:"))})${onProduction ? "  ← PRODUCTION" : ""}`);
console.log(`Bucket R2       : ${env("R2_BUCKET") || "?"} via ${env("R2_ENDPOINT") ? host(env("R2_ENDPOINT")) : "?"}`);
console.log(`Adresse publique: ${env("R2_PUBLIC_URL") || "?"}`);
console.log(`Variables R2    : ${missing.length ? `MANQUANTES → ${missing.join(", ")}` : "6/6 présentes"}`);

if (!dryRun && missing.length) { console.error("\nArrêt : variables R2 manquantes dans .env.local."); process.exit(1); }
if (!dryRun && onProduction && !allowProduction) {
  console.error("\nArrêt : la base visée est la PRODUCTION. Relancez avec --production seulement après accord explicite.");
  process.exit(2);
}

// 1. What to move: every picture of the site, with its source in public/ and its R2 key.
const files = new Map<string, string>(); // key → former public/ path
for (const [legacy, key] of Object.entries(legacyToKey)) files.set(key, legacy);

const db = new pg.Client({ connectionString: withVerifiedTls(dbUrl) });
await db.connect();
const { rows } = await db.query<{ id: number; url: string; slug: string; position: number }>(
  `select pi.id, pi.url, v.slug, pi.position from product_images pi join variants v on v.id = pi.variant_id order by v.position, pi.position`,
);
const toUpdate = rows.filter((r) => r.url.startsWith("/assets/"));
const unknown = toUpdate.filter((r) => !legacyToKey[r.url]);
const alreadyKeys = rows.length - toUpdate.length;

// 2. Local checks: each file exists and really is a WebP.
let totalBytes = 0;
const plan: { key: string; source: string; bytes: Uint8Array }[] = [];
for (const [key, legacy] of files) {
  const bytes = new Uint8Array(await readFile(path.join(root, "public", legacy)));
  const isWebp = Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  if (!isWebp) throw new Error(`${legacy} n'est pas un WebP valide.`);
  totalBytes += bytes.byteLength;
  plan.push({ key, source: `public${legacy}`, bytes });
}

const byFolder = new Map<string, number>();
for (const { key } of plan) byFolder.set(key.split("/").slice(0, -1).join("/"), (byFolder.get(key.split("/").slice(0, -1).join("/")) ?? 0) + 1);
console.log(`\n1) Envois vers R2 : ${plan.length} fichiers, ${(totalBytes / 1e6).toFixed(1)} Mo, tels quels (aucun réencodage)`);
for (const [folder, n] of byFolder) console.log(`   ${folder.padEnd(40)} ${n} fichier(s)`);
console.log("   Exemples :");
for (const p of [plan[0], plan[1], plan.find((x) => x.key.startsWith("banners/")), plan.find((x) => x.key.startsWith("categories/"))]) {
  if (p) console.log(`     ${p.source.padEnd(58)} → ${p.key}  (${(p.bytes.byteLength / 1e3).toFixed(0)} Ko)`);
}

console.log(`\n2) Base (product_images.url) : ${toUpdate.length} ligne(s) à passer de l'adresse public/ à la clé R2${alreadyKeys ? `, ${alreadyKeys} déjà migrée(s)` : ""}`);
for (const r of toUpdate.slice(0, 3)) console.log(`     #${r.id} ${r.url}  →  ${legacyToKey[r.url] ?? "?"}`);
if (toUpdate.length > 3) console.log(`     … et ${toUpdate.length - 3} autres`);
console.log(`   Images d'accueil et de catégories (dans le code, pas en base) : ${siteImages.hero.key}, ${Object.values(siteImages.categories).map((c) => c.key).join(", ")}`);
if (unknown.length) {
  console.log(`   ⚠ ${unknown.length} adresse(s) sans clé connue, laissées telles quelles : ${unknown.map((r) => r.url).join(", ")}`);
}
console.log("\n3) public/ : lu uniquement, aucun fichier modifié ni supprimé.");

if (dryRun) {
  console.log("\nSimulation terminée : rien n'a été envoyé, la base n'a pas changé.");
  await db.end();
  process.exit(0);
}

// 3. Upload, then check each public address answers 200 with the same size.
const s3 = new S3Client({ region: "auto", endpoint: env("R2_ENDPOINT"), credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") } });
const publicBase = env("R2_PUBLIC_URL").replace(/\/+$/, "");
let done = 0;
for (const { key, bytes } of plan) {
  await s3.send(new PutObjectCommand({ Bucket: env("R2_BUCKET"), Key: key, Body: bytes, ContentType: "image/webp", CacheControl: CACHE }));
  const response = await fetch(`${publicBase}/${key}`, { method: "HEAD" });
  const length = Number(response.headers.get("content-length"));
  if (response.status !== 200 || length !== bytes.byteLength) {
    throw new Error(`Vérification échouée pour ${publicBase}/${key} : HTTP ${response.status}, ${length} octets au lieu de ${bytes.byteLength}. La base n'a pas été modifiée.`);
  }
  done++;
  if (done % 10 === 0 || done === plan.length) console.log(`   ${done}/${plan.length} envoyés et vérifiés`);
}

// 4. Database: only once every file is confirmed online, in one transaction.
await db.query("begin");
try {
  let updated = 0;
  for (const r of toUpdate) {
    const key = legacyToKey[r.url];
    if (!key) continue;
    const result = await db.query("update product_images set url = $1 where id = $2 and url = $3", [key, r.id, r.url]);
    updated += result.rowCount ?? 0;
  }
  await db.query("commit");
  console.log(`\nTerminé : ${plan.length} fichiers sur R2 (vérifiés en 200), ${updated} ligne(s) de product_images mises à jour. public/ intact.`);
} catch (error) {
  await db.query("rollback");
  throw error;
} finally {
  await db.end();
}
