/**
 * Cloudflare R2 (bucket velzaro-media), via its S3-compatible API.
 *
 * Every image of the site lives in R2 under a key (products/cloudtilt/black/1.webp,
 * banners/hero.webp, categories/homme.webp…). The database stores keys only; public
 * addresses are built here from R2_PUBLIC_URL — the single place to change when the
 * custom domain (https://media.prestigea.shop) replaces the r2.dev address.
 *
 * Variables (.env.local, never in the code): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_URL.
 */
import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { toImageKey } from "./catalog.mjs";

/** Images never change under a given key: browsers and the CDN may keep them a year. */
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

const requireEnv = (name: string) => {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Variable ${name} absente de .env.local : Cloudflare R2 n'est pas configuré.`);
  return value;
};

/** Public base address of the bucket, without trailing slash ("" if not configured). */
export const publicBaseUrl = () => (process.env.R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");

/** Are the write credentials present? (Reading only needs R2_PUBLIC_URL.) */
export const r2Configured = () =>
  ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT"].every((name) => (process.env[name] ?? "").trim());

let client: S3Client | undefined;
const s3 = () => (client ??= new S3Client({
  region: "auto",
  endpoint: requireEnv("R2_ENDPOINT"),
  credentials: { accessKeyId: requireEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY") },
}));

export async function uploadToR2(body: Uint8Array, key: string, contentType: string, cacheControl = IMMUTABLE_CACHE) {
  await s3().send(new PutObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }));
}

export async function deleteFromR2(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key }));
}

/** Public address of a key. */
export const getPublicUrl = (key: string) => `${publicBaseUrl()}/${key}`;

/**
 * Address of a stored image reference. A row still holding a former public/ path
 * (before scripts/upload-images-to-r2.ts has run on this database) keeps that path.
 */
export const imageUrl = (ref: string) => (ref.startsWith("/") ? ref : getPublicUrl(ref));

/**
 * Address of a site picture known by its R2 key and former public/ path (hero, categories,
 * built-in catalogue): R2 once R2_PUBLIC_URL is set, public/ otherwise.
 */
export const siteImageUrl = (image: { key: string; legacy: string }) => (publicBaseUrl() ? getPublicUrl(image.key) : image.legacy);

/** R2 key of a stored image reference (key itself, or the key a former public/ path moves to). */
export const imageKey = (ref: string) => toImageKey(ref);
