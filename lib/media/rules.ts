/**
 * Image rules shared by the browser and the server (no dependency: client components
 * may import them).
 */

/** Largest file accepted by the upload route. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** New uploads are converted to WebP, at most 1600 px wide, quality 80. */
export const UPLOAD_MAX_WIDTH = 1600;
export const UPLOAD_WEBP_QUALITY = 80;

/** Image types accepted at upload (SVG excluded: it can carry scripts). */
export const ALLOWED_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/heic", "image/heif"];
export const ALLOWED_ACCEPT = ALLOWED_INPUT_TYPES.join(",");

/** R2 key of a product photo: products/cloudtilt/<colourway>/<name>.webp */
export const PRODUCT_PHOTO_KEY = /^products\/cloudtilt\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/;

/** A stored photo reference: R2 key, or a former public/assets path (rows not yet migrated). */
export const isImageRef = (ref: string) =>
  PRODUCT_PHOTO_KEY.test(ref) || /^\/assets\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/.test(ref);

/**
 * File-name base from free text: lowercase, no accents, dashes.
 * « Sable | Noir » → `sable-noir`.
 */
export const slugify = (text: string) =>
  text.toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/&/g, " et ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

export const humanSize = (bytes: number) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
    : `${Math.max(1, Math.round(bytes / 1000))} Ko`;
