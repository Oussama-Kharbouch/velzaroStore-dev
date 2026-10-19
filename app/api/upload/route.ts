/**
 * Image upload from the dashboard (admin only).
 * Form: fichier (the image, 10 MB max), nom (colourway name, for the storage folder).
 * The image is converted to WebP (1600 px wide max, quality 80), stored in Cloudflare R2
 * under products/cloudtilt/<colourway>/photo-<n>.webp, and its key and public address returned.
 * The "photo-" prefix keeps uploads apart from the migrated pictures (1.webp … 6.webp):
 * a new colourway named like an existing one can never overwrite them.
 */
import { createHash } from "node:crypto";
import { eq, like } from "drizzle-orm";
import sharp from "sharp";
import { getDb, schema } from "../../../db";
import { requireAdminApi } from "../../../lib/admin/guard";
import {
  ALLOWED_INPUT_TYPES, UPLOAD_MAX_BYTES, UPLOAD_MAX_WIDTH, UPLOAD_WEBP_QUALITY, humanSize, slugify,
} from "../../../lib/media/rules";
import { getPublicUrl, r2Configured, uploadToR2 } from "../../../lib/r2";

const { media } = schema;

const refuse = (erreur: string, status = 422) => Response.json({ ok: false, erreur }, { status });

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  if (!r2Configured()) return refuse("Stockage Cloudflare R2 non configuré : renseignez les variables R2_* dans .env.local.", 503);

  let file: unknown;
  let name: unknown;
  try {
    const form = await request.formData();
    file = form.get("fichier");
    name = form.get("nom");
  } catch {
    return refuse("Requête illisible (fichier trop lourd ?).", 400);
  }
  if (!(file instanceof File) || file.size === 0) return refuse("Aucune image reçue.", 400);
  if (!ALLOWED_INPUT_TYPES.includes(file.type)) return refuse("Seules les images sont acceptées (JPEG, PNG, WebP, AVIF, GIF, HEIC).");
  if (file.size > UPLOAD_MAX_BYTES) return refuse(`Image trop lourde (${humanSize(file.size)}) : 10 Mo maximum.`);

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" })
      .rotate() // honours the EXIF orientation of phone photos
      .resize({ width: UPLOAD_MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // no transparency: white, like the existing photos
      .webp({ quality: UPLOAD_WEBP_QUALITY })
      .toBuffer();
  } catch {
    return refuse("Ce fichier n’est pas une image lisible.");
  }

  const db = getDb();
  const sha256 = createHash("sha256").update(webp).digest("hex");
  // Same picture already stored: its key is returned, nothing is uploaded twice.
  const [existing] = await db.select().from(media).where(eq(media.sha256, sha256)).limit(1);
  if (existing) return Response.json({ ok: true, key: existing.id, url: getPublicUrl(existing.id), size: existing.size }, { status: 201 });

  const folder = `products/cloudtilt/${slugify(typeof name === "string" ? name : "") || "coloris"}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    // Next free number in the folder; a removed number is never reused.
    const taken = await db.select({ id: media.id }).from(media).where(like(media.id, `${folder}/%`));
    const highest = taken.reduce((max, row) => Math.max(max, Number(/\/photo-(\d+)\.webp$/.exec(row.id)?.[1] ?? 0)), 0);
    const key = `${folder}/photo-${highest + 1}.webp`;

    const inserted = await db.insert(media).values({ id: key, sha256, size: webp.byteLength }).onConflictDoNothing().returning({ id: media.id });
    if (!inserted.length) {
      const [same] = await db.select().from(media).where(eq(media.sha256, sha256)).limit(1);
      if (same) return Response.json({ ok: true, key: same.id, url: getPublicUrl(same.id), size: same.size }, { status: 201 });
      continue;
    }
    try {
      await uploadToR2(webp, key, "image/webp");
    } catch (error) {
      console.error("Envoi vers R2 impossible :", error);
      await db.delete(media).where(eq(media.id, key)); // no row without its file
      return refuse("Envoi vers Cloudflare R2 impossible : vérifiez les clés R2.", 502);
    }
    return Response.json({ ok: true, key, url: getPublicUrl(key), size: webp.byteLength }, { status: 201 });
  }
  return refuse("Nom de fichier indisponible, réessayez.", 409);
}
