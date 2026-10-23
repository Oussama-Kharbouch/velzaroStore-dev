/**
 * Image upload from the dashboard (admin only).
 * Form: fichier (image prepared by the browser), nom (colourway name, for the folder).
 *
 * The browser converts the photo before sending it (components/admin/prepare-image.ts):
 * WebP 1600 px quality 80 through a WASM encoder that works everywhere, JPEG quality 85
 * as a fallback. The server only checks and stores it: native image libraries (sharp)
 * cannot run on Cloudflare Workers.
 *
 * Stored in Cloudflare R2 under products/cloudtilt/<colourway>/photo-<n>.webp|.jpg. The
 * "photo-" prefix keeps uploads apart from the migrated pictures (1.webp … 6.webp): a new
 * colourway named like an existing one can never overwrite them.
 */
import { eq, like } from "drizzle-orm";
import { getDb, schema } from "../../../db";
import { requireAdminApi } from "../../../lib/admin/guard";
import { STORED_IMAGE_TYPES, UPLOAD_MAX_BYTES, VIGNETTE_MAX_BYTES, humanSize, slugify } from "../../../lib/media/rules";
import { getPublicUrl, r2Configured, uploadToR2 } from "../../../lib/r2";

const { media } = schema;

const refuse = (erreur: string, status = 422) => Response.json({ ok: false, erreur }, { status });

/** Real file type from its first bytes: the declared type is not trusted. */
const sniff = (bytes: Uint8Array): keyof typeof STORED_IMAGE_TYPES | null => {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
};

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  if (!r2Configured()) return refuse("Stockage Cloudflare R2 non configuré : renseignez les variables R2_*.", 503);

  let file: unknown;
  let name: unknown;
  let kind: unknown;
  try {
    const form = await request.formData();
    file = form.get("fichier");
    name = form.get("nom");
    kind = form.get("type");
  } catch {
    return refuse("Requête illisible (fichier trop lourd ?).", 400);
  }
  // type=vignette: colourway thumbnail (150×150 WebP made by the browser), stored as vignette-<n>.webp.
  const vignette = kind === "vignette";
  if (!(file instanceof File) || file.size === 0) return refuse("Aucune image reçue.", 400);
  if (vignette && file.size > VIGNETTE_MAX_BYTES) return refuse(`Vignette trop lourde (${humanSize(file.size)}) : 5 Mo maximum.`);
  if (file.size > UPLOAD_MAX_BYTES) return refuse(`Image trop lourde (${humanSize(file.size)}) : 10 Mo maximum.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return refuse("Seules les images WebP ou JPEG préparées par le dashboard sont acceptées.");
  if (vignette && type !== "image/webp") return refuse("La vignette doit être préparée en WebP par le dashboard.");
  const prefix = vignette ? "vignette" : "photo";

  const db = getDb();
  const sha256 = toHex(await crypto.subtle.digest("SHA-256", bytes));
  // Same picture already stored: its key is returned, nothing is uploaded twice.
  const [existing] = await db.select().from(media).where(eq(media.sha256, sha256)).limit(1);
  if (existing) return Response.json({ ok: true, key: existing.id, url: getPublicUrl(existing.id), size: existing.size }, { status: 201 });

  const folder = `products/cloudtilt/${slugify(typeof name === "string" ? name : "") || "coloris"}`;
  const extension = STORED_IMAGE_TYPES[type];
  for (let attempt = 0; attempt < 5; attempt++) {
    // Next free number in the folder; a removed number is never reused.
    const taken = await db.select({ id: media.id }).from(media).where(like(media.id, `${folder}/%`));
    const numbered = new RegExp(`/${prefix}-(\\d+)\\.[a-z]+$`);
    const highest = taken.reduce((max, row) => Math.max(max, Number(numbered.exec(row.id)?.[1] ?? 0)), 0);
    const key = `${folder}/${prefix}-${highest + 1}.${extension}`;

    const inserted = await db.insert(media).values({ id: key, sha256, size: bytes.byteLength }).onConflictDoNothing().returning({ id: media.id });
    if (!inserted.length) {
      const [same] = await db.select().from(media).where(eq(media.sha256, sha256)).limit(1);
      if (same) return Response.json({ ok: true, key: same.id, url: getPublicUrl(same.id), size: same.size }, { status: 201 });
      continue;
    }
    try {
      await uploadToR2(bytes, key, type);
    } catch (error) {
      console.error("Envoi vers R2 impossible :", error);
      await db.delete(media).where(eq(media.id, key)); // no row without its file
      return refuse("Envoi vers Cloudflare R2 impossible : vérifiez les clés R2.", 502);
    }
    return Response.json({ ok: true, key, url: getPublicUrl(key), size: bytes.byteLength }, { status: 201 });
  }
  return refuse("Nom de fichier indisponible, réessayez.", 409);
}
