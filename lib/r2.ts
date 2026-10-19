/**
 * Cloudflare R2 (bucket velzaro-media), via its S3-compatible API, signed with
 * aws4fetch: a few kilobytes instead of the AWS SDK, which would not fit in the
 * Worker size limit. (Local scripts keep @aws-sdk/client-s3.)
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
import { AwsClient } from "aws4fetch";
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

/** Signed request to the bucket (path-style: <endpoint>/<bucket>/<key>). A new client per call. */
const r2Fetch = async (method: "PUT" | "DELETE", key: string, init: { body?: Uint8Array<ArrayBuffer>; headers?: Record<string, string> } = {}) => {
  const client = new AwsClient({
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const url = `${requireEnv("R2_ENDPOINT").replace(/\/+$/, "")}/${requireEnv("R2_BUCKET")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const response = await client.fetch(url, { method, body: init.body, headers: init.headers });
  if (!response.ok) throw new Error(`R2 ${method} ${key} : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
};

export async function uploadToR2(body: Uint8Array<ArrayBuffer>, key: string, contentType: string, cacheControl = IMMUTABLE_CACHE) {
  await r2Fetch("PUT", key, { body, headers: { "Content-Type": contentType, "Cache-Control": cacheControl } });
}

export async function deleteFromR2(key: string) {
  await r2Fetch("DELETE", key);
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
