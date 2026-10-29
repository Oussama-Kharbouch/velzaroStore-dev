/**
 * Gestion des coloris depuis le dashboard : création, modification (nom, nom
 * arabe, couleur, prix, mise en ligne, photos, stock par pointure), ordre
 * d'affichage et suppression d'un brouillon. La boutique, rendue à chaque visite,
 * montre chaque modification aussitôt.
 *
 * Règles :
 * — un coloris en ligne a au moins une photo (sa carte sur la boutique), 10 au plus ;
 * — la boutique garde toujours au moins un coloris en ligne ;
 * — un coloris déjà commandé ne peut pas être supprimé, seulement masqué.
 */
import "server-only";
import { and, asc, count, eq, ilike, max, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../../db";
import { SIZES } from "../catalog.mjs";
import { GENDERS } from "../catalog-categories";
import { PHOTOS_MAX, isImageRef, slugify } from "../media/rules";
import { imageUrl } from "../r2";
import { firstIssue, ko, ok, type Result } from "./respond";

const { products, variants, variantSizes, productImages, orderItems } = schema;

const PRICE_MAX = 100000;

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

/** Un coloris en ligne doit avoir au moins une photo. */
const assertPhotosForActive = async (tx: Tx, id: number) => {
  const [{ n }] = await tx.select({ n: count() }).from(productImages).where(eq(productImages.variantId, id));
  if (n < 1) throw new Rejected("Ajoutez au moins une photo du coloris avant de le mettre en ligne.");
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
  // Short codes of the first catalogue (#fff) are accepted and written in full (#ffffff).
  hex: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur : un code comme #a8a297.")
    .transform((v) => (v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v)),
  photos: z.array(z.string().refine(isImageRef, "Référence de photo invalide.")).max(PHOTOS_MAX, `${PHOTOS_MAX} photos maximum.`),
  /** Model of the colourway (products.id). */
  productId: z.number({ invalid_type_error: "Choisissez le modèle." }).int().positive("Choisissez le modèle."),
  /** Gender: homme, femme, unisexe; null = not classified. */
  gender: z.enum(GENDERS, { errorMap: () => ({ message: "Genre inconnu." }) }).nullable(),
  /** Thumbnail on the product page (one of its photos or a dedicated 150×150 image); null = its first photo. */
  thumbnail: z.string().refine(isImageRef, "Vignette invalide.").nullable().default(null),
  ...priceFields,
}).refine(oldPriceRule, oldPriceIssue)
  .refine((v) => !v.active || v.photos.length > 0, {
    message: "Un coloris en ligne doit avoir au moins une photo : ajoutez-en une ou laissez-le masqué.", path: ["photos"],
  });

const writePhotos = async (tx: Tx, id: number, name: string, photos: string[]) => {
  // The list is rewritten as a whole: order on screen = order on the shop.
  await tx.delete(productImages).where(eq(productImages.variantId, id));
  if (photos.length) {
    await tx.insert(productImages).values(photos.map((url, index) => ({ variantId: id, url, alt: `Cloudtilt ${name}`, position: index + 1 })));
  }
};

/** Two colourways of the same model cannot share a name (two models can: Cloudtilt White, Cloudsurfer White). */
const assertUniqueName = async (tx: Tx, name: string, productId: number, exceptId?: number) => {
  const same = await tx.select({ id: variants.id }).from(variants)
    .where(and(eq(variants.productId, productId), ilike(variants.colorName,name.replace(/[%_\\]/g, "\\$&")), exceptId ? ne(variants.id, exceptId) : undefined)).limit(1);
  if (same.length) throw new Rejected(`Ce modèle a déjà un coloris « ${name} ».`);
};

const assertModel = async (tx: Tx, productId: number) => {
  const [model] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!model) throw new Rejected("Ce modèle n'existe pas : rechargez la page.");
};

export const createVariant = async (payload: unknown): Promise<Result<{ id: number; slug: string }>> => {
  const parsed = fullSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  return inTransaction(async (tx) => {
    await assertModel(tx, input.productId);
    await assertUniqueName(tx, input.name, input.productId);
    const product = { id: input.productId };

    // Slug: identifier of the cart and of the product URL (/cloudtilt/<slug>), unique and never reused.
    const base = slugify(input.name) || "coloris";
    let slug = base;
    for (let n = 2; (await tx.select({ id: variants.id }).from(variants).where(eq(variants.slug, slug)).limit(1)).length; n++) slug = `${base}-${n}`;

    const [{ last }] = await tx.select({ last: max(variants.position) }).from(variants);
    const [created] = await tx.insert(variants).values({
      productId: product.id, slug, colorName: input.name, colorNameAr: input.nameAr, colorHex: input.hex.toLowerCase(),
      price: input.price, oldPrice: input.oldPrice, active: input.active, position: (last ?? -1) + 1, gender: input.gender, thumbnail: input.thumbnail,
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
    await assertModel(tx, input.productId);
    await assertUniqueName(tx, input.name, input.productId, id);
    if (variant.active && !input.active) await assertAnotherActive(tx, id);

    await tx.update(variants).set({
      productId: input.productId, gender: input.gender, thumbnail: input.thumbnail,
      colorName: input.name, colorNameAr: input.nameAr, colorHex: input.hex.toLowerCase(),
      price: input.price, oldPrice: input.oldPrice, active: input.active,
    }).where(eq(variants.id, id));
    await writePhotos(tx, id, input.name, input.photos);
    await writeStocks(tx, id, input.stocks);
    return ok({ id });
  });
};

/* --- Ordre d'affichage et suppression ----------------------------------------- */

/* --- Catégories : marque du modèle et genre du coloris ------------------------ */

/** Category of a colourway. Body: { gender: "homme" | "femme" | "unisexe" | null } (null = non classé). */
export const setVariantGender = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = z.object({ gender: z.enum(GENDERS, { errorMap: () => ({ message: "Catégorie inconnue." }) }).nullable() }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const updated = await getDb().update(variants).set({ gender: parsed.data.gender }).where(eq(variants.id, id)).returning({ id: variants.id });
  return updated.length ? ok({ id }) : ko("Ce coloris n'existe pas.");
};

/** Addresses already used by the site: a model slug is the first part of /<model>/<colourway>. */
const RESERVED_SLUGS = new Set(["boutique", "femme", "homme", "promotions", "favoris", "home", "accueil", "admin", "allah", "api", "feed", "assets", "_next"]);

/**
 * New model (« Cloudsurfer Max »). Body: { name, brand }. Its slug (cloudsurfer-max) gives the address
 * of its colourways on the shop: /cloudsurfer-max/<colourway>. Colourways are then added from its page.
 */
export const createModel = async (payload: unknown): Promise<Result<{ id: number; slug: string }>> => {
  const parsed = z.object({
    name: z.string().trim().min(2, "Nom du modèle : 2 caractères minimum.").max(60, "Nom du modèle : 60 caractères maximum."),
    brand: z.string().trim().max(40, "Marque : 40 caractères maximum."),
  }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const { name, brand } = parsed.data;
  const slug = slugify(name);
  if (!slug) return ko("Nom du modèle : utilisez des lettres ou des chiffres.", "name");
  if (RESERVED_SLUGS.has(slug)) return ko(`« ${name} » correspond à une page du site : choisissez un autre nom.`, "name");

  return inTransaction(async (tx) => {
    const same = await tx.select({ id: products.id }).from(products)
      .where(or(eq(products.slug, slug), ilike(products.name, name.replace(/[%_\\]/g, "\\$&")))).limit(1);
    if (same.length) return ko(`Un modèle « ${name} » existe déjà.`, "name");
    const [created] = await tx.insert(products).values({ name, slug, brand: brand || null }).returning({ id: products.id });
    return ok({ id: created.id, slug });
  });
};

/** Brand of a model (« On »). Body: { brand } — empty = no brand. */
/**
 * Name and/or brand of a model. Body: { name?, brand? } — empty brand = no brand.
 * The slug (address /<model>/<colourway>, Meta catalogue ids) never changes: shared links keep working.
 */
export const updateModel = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = z.object({
    name: z.string().trim().min(2, "Nom du modèle : 2 caractères minimum.").max(60, "Nom du modèle : 60 caractères maximum.").optional(),
    brand: z.string().trim().max(40, "Marque : 40 caractères maximum.").optional(),
  }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const { name, brand } = parsed.data;
  if (name === undefined && brand === undefined) return ko("Rien à enregistrer.");

  return inTransaction(async (tx) => {
    if (name !== undefined) {
      const same = await tx.select({ id: products.id }).from(products)
        .where(and(ne(products.id, id), ilike(products.name, name.replace(/[%_\\]/g, "\\$&")))).limit(1);
      if (same.length) return ko(`Un autre modèle s'appelle déjà « ${name} ».`, "name");
    }
    const updated = await tx.update(products).set({
      ...(name !== undefined ? { name } : {}),
      ...(brand !== undefined ? { brand: brand || null } : {}),
    }).where(eq(products.id, id)).returning({ id: products.id });
    return updated.length ? ok({ id }) : ko("Ce modèle n'existe pas.");
  });
};

/**
 * Whole display order of the shop at once. Body: { ids } — every colourway, first shown first.
 * Refused if the list no longer matches the database (colourway added or deleted meanwhile).
 */
export const setVariantOrder = async (payload: unknown): Promise<Result<{ count: number }>> => {
  const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1, "Liste vide.") }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const { ids } = parsed.data;

  return inTransaction(async (tx) => {
    const existing = await tx.select({ id: variants.id }).from(variants);
    const same = new Set(ids).size === ids.length && ids.length === existing.length && existing.every((v) => ids.includes(v.id));
    if (!same) return ko("La liste des coloris a changé entre-temps : rechargez la page avant de réorganiser.");
    // Positions rewritten 0..n.
    for (const [position, id] of ids.entries()) await tx.update(variants).set({ position }).where(eq(variants.id, id));
    return ok({ count: ids.length });
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
  return {
    ...variant, photos: photos.map((p) => ({ ref: p.url, url: imageUrl(p.url) })), sizes, orderLines: n,
    thumbnailUrl: variant.thumbnail ? imageUrl(variant.thumbnail) : null,
  };
};
export type EditableVariant = NonNullable<Awaited<ReturnType<typeof getVariantForEdit>>>;
