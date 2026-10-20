/**
 * Gestion des coloris depuis le dashboard : création, modification (nom, nom
 * arabe, couleur, prix, mise en ligne, 6 photos, stock par pointure), ordre
 * d'affichage et suppression d'un brouillon. La boutique, rendue à chaque visite,
 * montre chaque modification aussitôt.
 *
 * Règles :
 * — un coloris en ligne a exactement 6 photos (la galerie de la boutique en montre 6) ;
 * — la boutique garde toujours au moins un coloris en ligne ;
 * — un coloris déjà commandé ne peut pas être supprimé, seulement masqué.
 */
import "server-only";
import { and, asc, count, eq, ilike, max, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../../db";
import { SIZES } from "../catalog.mjs";
import { isImageRef, slugify } from "../media/rules";
import { imageUrl } from "../r2";
import { firstIssue, ko, ok, type Result } from "./respond";

const { products, variants, variantSizes, productImages, orderItems } = schema;

const PRICE_MAX = 100000;
export const PHOTOS_PER_VARIANT = 6;

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

class Rejected extends Error {}

/** Runs `fn` in a transaction; a thrown Rejected rolls everything back and becomes a clean refusal. */
const inTransaction = async <T>(fn: (tx: Tx) => Promise<Result<T>>): Promise<Result<T>> => {
  try {
    return await getDb().transaction(fn);
  } catch (error) {
    if (error instanceof Rejected) return ko(error.message);
    throw error;
  }
};

const priceFields = {
  price: z.number({ invalid_type_error: "Prix invalide." }).int("Prix en dirhams entiers.")
    .min(1, "Le prix doit être supérieur à 0.").max(PRICE_MAX, "Prix trop élevé."),
  /** Prix barré ; null = pas de prix barré. */
  oldPrice: z.number({ invalid_type_error: "Prix barré invalide." }).int("Prix barré en dirhams entiers.").max(PRICE_MAX).nullable(),
  active: z.boolean(),
  /** Stock par pointure ; null = non suivi (toujours commandable). */
  stocks: z.array(z.object({
    size: z.number().int(),
    stock: z.number({ invalid_type_error: "Stock invalide." }).int("Stock en nombre entier.").min(0, "Le stock ne peut pas être négatif.").max(100000).nullable(),
  })).max(20),
};
const oldPriceRule = (v: { price: number; oldPrice: number | null }) => v.oldPrice === null || v.oldPrice > v.price;
const oldPriceIssue = { message: "Le prix barré doit être supérieur au prix de vente (ou vide).", path: ["oldPrice"] };

/** Un coloris en ligne doit avoir ses 6 photos. */
const assertPhotosForActive = async (tx: Tx, id: number) => {
  const [{ n }] = await tx.select({ n: count() }).from(productImages).where(eq(productImages.variantId, id));
  if (n < PHOTOS_PER_VARIANT) throw new Rejected(`Ajoutez les ${PHOTOS_PER_VARIANT} photos du coloris avant de le mettre en ligne (${n} pour l'instant).`);
};

/** La boutique a besoin d'au moins un coloris en ligne. */
const assertAnotherActive = async (tx: Tx, id: number) => {
  const others = await tx.select({ id: variants.id }).from(variants).where(and(ne(variants.id, id), eq(variants.active, true))).limit(1);
  if (!others.length) throw new Rejected("Impossible de masquer le dernier coloris en ligne : la boutique serait vide.");
};

const writeStocks = async (tx: Tx, id: number, stocks: { size: number; stock: number | null }[]) => {
  for (const { size, stock } of stocks) {
    const updated = await tx.update(variantSizes).set({ stock })
      .where(and(eq(variantSizes.variantId, id), eq(variantSizes.size, size))).returning({ id: variantSizes.id });
    if (!updated.length) throw new Rejected(`Pointure ${size} inconnue pour ce coloris.`);
  }
};

/* --- Modification rapide depuis la liste : prix, mise en ligne, stock -------- */

const quickSchema = z.object(priceFields).refine(oldPriceRule, oldPriceIssue);

export const updateVariant = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = quickSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const { price, oldPrice, active, stocks } = parsed.data;

  return inTransaction(async (tx) => {
    const [variant] = await tx.select({ id: variants.id, active: variants.active }).from(variants).where(eq(variants.id, id)).limit(1);
    if (!variant) return ko("Ce coloris n'existe pas.");
    if (variant.active && !active) await assertAnotherActive(tx, id);
    if (!variant.active && active) await assertPhotosForActive(tx, id);

    await tx.update(variants).set({ price, oldPrice, active }).where(eq(variants.id, id));
    await writeStocks(tx, id, stocks);
    return ok({ id });
  });
};

/* --- Fiche complète : création et modification ------------------------------ */

const fullSchema = z.object({
  name: z.string().trim().min(2, "Nom du coloris : 2 caractères minimum.").max(60, "Nom du coloris : 60 caractères maximum."),
  /** Nom arabe ; vide = traduction intégrée à la boutique (ou le nom français). */
  nameAr: z.string().trim().max(60, "Nom arabe : 60 caractères maximum.").transform((v) => v || null),
  hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur : un code comme #a8a297."),
  photos: z.array(z.string().refine(isImageRef, "Référence de photo invalide.")).max(PHOTOS_PER_VARIANT, `${PHOTOS_PER_VARIANT} photos maximum.`),
  ...priceFields,
}).refine(oldPriceRule, oldPriceIssue)
  .refine((v) => !v.active || v.photos.length === PHOTOS_PER_VARIANT, {
    message: `Un coloris en ligne doit avoir ses ${PHOTOS_PER_VARIANT} photos : ajoutez-les ou laissez-le masqué.`, path: ["photos"],
  });

const writePhotos = async (tx: Tx, id: number, name: string, photos: string[]) => {
  // The list is rewritten as a whole: order on screen = order on the shop.
  await tx.delete(productImages).where(eq(productImages.variantId, id));
  if (photos.length) {
    await tx.insert(productImages).values(photos.map((url, index) => ({ variantId: id, url, alt: `Cloudtilt ${name}`, position: index + 1 })));
  }
};

const assertUniqueName = async (tx: Tx, name: string, exceptId?: number) => {
  const same = await tx.select({ id: variants.id }).from(variants)
    .where(and(ilike(variants.colorName, name.replace(/[%_\\]/g, "\\$&")), exceptId ? ne(variants.id, exceptId) : undefined)).limit(1);
  if (same.length) throw new Rejected(`Un coloris s'appelle déjà « ${name} ».`);
};

export const createVariant = async (payload: unknown): Promise<Result<{ id: number; slug: string }>> => {
  const parsed = fullSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  return inTransaction(async (tx) => {
    await assertUniqueName(tx, input.name);
    const [product] = await tx.select({ id: products.id }).from(products).orderBy(asc(products.id)).limit(1);
    if (!product) return ko("Produit Cloudtilt introuvable : lancez npm run db:seed.");

    // Slug: identifier of the cart and of the product URL (/cloudtilt/<slug>), unique and never reused.
    const base = slugify(input.name) || "coloris";
    let slug = base;
    for (let n = 2; (await tx.select({ id: variants.id }).from(variants).where(eq(variants.slug, slug)).limit(1)).length; n++) slug = `${base}-${n}`;

    const [{ last }] = await tx.select({ last: max(variants.position) }).from(variants);
    const [created] = await tx.insert(variants).values({
      productId: product.id, slug, colorName: input.name, colorNameAr: input.nameAr, colorHex: input.hex.toLowerCase(),
      price: input.price, oldPrice: input.oldPrice, active: input.active, position: (last ?? -1) + 1,
    }).returning({ id: variants.id });

    await tx.insert(variantSizes).values(SIZES.map((size) => ({
      variantId: created.id, size, stock: input.stocks.find((s) => s.size === size)?.stock ?? null,
    })));
    await writePhotos(tx, created.id, input.name, input.photos);
    return ok({ id: created.id, slug });
  });
};

export const saveVariant = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = fullSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  return inTransaction(async (tx) => {
    const [variant] = await tx.select({ id: variants.id, active: variants.active }).from(variants).where(eq(variants.id, id)).limit(1);
    if (!variant) return ko("Ce coloris n'existe pas.");
    await assertUniqueName(tx, input.name, id);
    if (variant.active && !input.active) await assertAnotherActive(tx, id);

    await tx.update(variants).set({
      colorName: input.name, colorNameAr: input.nameAr, colorHex: input.hex.toLowerCase(),
      price: input.price, oldPrice: input.oldPrice, active: input.active,
    }).where(eq(variants.id, id));
    await writePhotos(tx, id, input.name, input.photos);
    await writeStocks(tx, id, input.stocks);
    return ok({ id });
  });
};

/* --- Ordre d'affichage et suppression ----------------------------------------- */

export const moveVariant = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = z.object({ direction: z.enum(["haut", "bas"], { errorMap: () => ({ message: "Direction inconnue." }) }) }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);

  return inTransaction(async (tx) => {
    const list = await tx.select({ id: variants.id }).from(variants).orderBy(asc(variants.position), asc(variants.id));
    const index = list.findIndex((v) => v.id === id);
    if (index < 0) return ko("Ce coloris n'existe pas.");
    const target = parsed.data.direction === "haut" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return ok({ id });
    [list[index], list[target]] = [list[target], list[index]];
    // Positions rewritten 0..n: ties left by older data disappear.
    for (const [position, v] of list.entries()) await tx.update(variants).set({ position }).where(eq(variants.id, v.id));
    return ok({ id });
  });
};

export const deleteVariant = async (id: number): Promise<Result<{ id: number }>> => inTransaction(async (tx) => {
  const [variant] = await tx.select({ id: variants.id, active: variants.active, name: variants.colorName }).from(variants).where(eq(variants.id, id)).limit(1);
  if (!variant) return ko("Ce coloris n'existe pas.");
  const [{ n }] = await tx.select({ n: count() }).from(orderItems).where(eq(orderItems.variantId, id));
  if (n > 0) return ko(`« ${variant.name} » figure dans ${n} ligne(s) de commande : il ne peut pas être supprimé. Masquez-le plutôt.`);
  if (variant.active) await assertAnotherActive(tx, id);
  // Sizes and image rows go with it (ON DELETE CASCADE); uploaded files stay in storage.
  await tx.delete(variants).where(eq(variants.id, id));
  return ok({ id });
});

/* --- Lecture pour la fiche ---------------------------------------------------- */

export const getVariantForEdit = async (id: number) => {
  const db = getDb();
  const [variant] = await db.select().from(variants).where(eq(variants.id, id)).limit(1);
  if (!variant) return null;
  const [photos, sizes, [{ n }]] = await Promise.all([
    db.select({ url: productImages.url }).from(productImages).where(eq(productImages.variantId, id)).orderBy(asc(productImages.position)),
    db.select({ size: variantSizes.size, stock: variantSizes.stock }).from(variantSizes).where(eq(variantSizes.variantId, id)).orderBy(asc(variantSizes.size)),
    db.select({ n: count() }).from(orderItems).where(eq(orderItems.variantId, id)),
  ]);
  // Each photo: stored reference (R2 key) and public address for the preview.
  return { ...variant, photos: photos.map((p) => ({ ref: p.url, url: imageUrl(p.url) })), sizes, orderLines: n };
};
export type EditableVariant = NonNullable<Awaited<ReturnType<typeof getVariantForEdit>>>;
