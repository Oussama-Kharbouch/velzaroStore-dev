/**
 * Image rules shared by the browser and the server (no dependency: client components
 * may import them).
 */

/** Largest file accepted by the upload route. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** New uploads: at most 1600 px wide; WebP quality 80, or JPEG quality 85 as a fallback. */
export const UPLOAD_MAX_WIDTH = 1600;
export const UPLOAD_WEBP_QUALITY = 80;
export const UPLOAD_JPEG_QUALITY = 0.85;

/** Photos the dashboard can read before conversion (SVG excluded: it can carry scripts). */
export const ALLOWED_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/heic", "image/heif"];
export const ALLOWED_ACCEPT = ALLOWED_INPUT_TYPES.join(",");

/** Colourway thumbnail (product page): uploaded JPG/PNG/WebP up to 5 MB, stored as a 150×150 WebP. */
export const VIGNETTE_SIZE = 150;
export const VIGNETTE_MAX_BYTES = 5 * 1024 * 1024;
export const VIGNETTE_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Formats stored in R2, with their file extension. */
export const STORED_IMAGE_TYPES = { "image/webp": "webp", "image/jpeg": "jpg" } as const;

/** R2 key of a product photo: products/cloudtilt/<colourway>/<name>.webp|.jpg */
export const PRODUCT_PHOTO_KEY = /^products\/cloudtilt\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpg)$/;

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
