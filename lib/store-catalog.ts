/**
 * Catalogue affiché par la boutique, lu dans la base : coloris en ligne, prix,
 * prix barré, pointures disponibles et photos. La page est rendue à chaque visite :
 * une modification du dashboard est visible aussitôt.
 */
import "server-only";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { EXTRA_MODELS, OLD_PRICE, PRICE, PRODUCT, SIZES, galleryLabels, legacyPhotoPaths, photoKeys, products as staticProducts, siteImages } from "./catalog.mjs";
import { imageKey, imageUrl, siteImageUrl } from "./r2";
import { CLOSING_STATUSES } from "./orders/status";
import { resolveComfort, type ComfortContent } from "./comfort";
import { productContent } from "./product-content";

const { products, variants, variantSizes, productImages, orders, orderItems } = schema;

export type StoreProduct = {
  /** Slug du coloris : identifiant du panier et de l’adresse du produit (/<model>/<id>). */
  id: string;
  /** Model name ("Cloudtilt", "Cloudsurfer Max") and slug (first part of the product address). */
  model: string;
  modelSlug: string;
  /** Brand of the model (« New Balance »), shown above its name on the product page; null = none. */
  brand: string | null;
  name: string;
  /** Nom arabe saisi dans le dashboard ; null = traduction intégrée (translations.ts). */
  nameAr: string | null;
  color: string;
  category: string;
  promotion: boolean;
  /** Gender chosen in the dashboard (homme, femme, unisexe); null = not classified (shown to everyone). */
  gender: string | null;
  /** Pairs sold (orders not deleted, nor cancelled, refused or returned): order of the "best sellers" of the home page. */
  sold: number;
  price: number;
  oldPrice: number | null;
  sizes: { size: number; available: boolean }[];
  /** Public addresses, in gallery order. */
  photos: string[];
  /** Matching R2 keys: the framing of each photo (app/(store)/*-framing.ts) is looked up by key. */
  photoKeys: string[];
  /** Colourway thumbnail of the product page: the one chosen in the dashboard, or its first photo. */
  thumbnail: string;
  /** "Why you will like it" section of the colourway (dashboard, with its photos), or the built-in wording of its model. */
  comfort: ComfortContent;
};

/** Catalogue intégré au code, utilisé si la base ne répond pas : la boutique reste en ligne. */
const fallbackCatalog = (): StoreProduct[] => staticProducts.map((p) => ({
  ...p, comfort: resolveComfort(null, productContent(PRODUCT.slug).comfort), model: PRODUCT.name, modelSlug: PRODUCT.slug, brand: null, nameAr: null, gender: null, sold: 0, price: PRICE, oldPrice: OLD_PRICE, sizes: SIZES.map((size) => ({ size, available: true })),
  photos: photoKeys[p.id].map((key, i) => siteImageUrl({ key, legacy: legacyPhotoPaths[p.id][i] })),
  photoKeys: photoKeys[p.id],
  thumbnail: siteImageUrl({ key: photoKeys[p.id][0], legacy: legacyPhotoPaths[p.id][0] }),
}));

/**
 * Creates the models of EXTRA_MODELS (lib/catalog.mjs) that are missing from the database:
 * product, one colourway (Cloudtilt price, sizes without stock tracking), its 6 photos in
 * public/assets. Done once per Worker instance; an existing row is never modified, so the
 * dashboard stays in charge of price, stock, photos and visibility.
 */
let extraModelsReady = false;
async function ensureExtraModels(db: ReturnType<typeof getDb>) {
  if (extraModelsReady) return;
  const existing = await db.select({ slug: variants.slug }).from(variants)
    .where(inArray(variants.slug, EXTRA_MODELS.map((m) => m.variant.slug)));
  const missing = EXTRA_MODELS.filter((m) => !existing.some((e) => e.slug === m.variant.slug));
  for (const m of missing) {
    await db.transaction(async (tx) => {
      await tx.insert(products).values({ name: m.name, slug: m.slug, brand: m.brand }).onConflictDoNothing({ target: products.slug });
      const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, m.slug));
      const v = m.variant;
      const [variant] = await tx.insert(variants).values({
        productId: product.id, slug: v.slug, colorName: v.name, colorNameAr: v.nameAr, colorHex: v.hex,
        price: PRICE, oldPrice: OLD_PRICE, active: true, position: v.position,
      }).onConflictDoNothing({ target: variants.slug }).returning({ id: variants.id });
      if (!variant) return;
      await tx.insert(productImages).values(galleryLabels.map((label, i) => ({
        variantId: variant.id, url: `/assets/${v.folder}/${i + 1}.webp`, alt: `${m.name} ${v.name} — ${label}`, position: i + 1,
      })));
      await tx.insert(variantSizes).values(SIZES.map((size) => ({ variantId: variant.id, size, stock: null })));
    });
  }
  extraModelsReady = true;
}

export async function getStoreCatalog(): Promise<StoreProduct[]> {
  try {
    const db = getDb();
    try {
      await ensureExtraModels(db);
    } catch (error) {
      console.error("Nouveaux modèles non créés :", error);
    }
    const rows = await db.select({
      model: products.name, modelSlug: products.slug, brand: products.brand,
      id: variants.id, slug: variants.slug, name: variants.colorName, nameAr: variants.colorNameAr, color: variants.colorHex,
      price: variants.price, oldPrice: variants.oldPrice, thumbnail: variants.thumbnail, gender: variants.gender,
    }).from(variants).innerJoin(products, eq(variants.productId, products.id))
      .where(and(eq(variants.active, true), eq(products.active, true)))
      .orderBy(asc(variants.position), asc(variants.id));
    if (!rows.length) return fallbackCatalog();

    const ids = rows.map((r) => r.id);
    const [sizes, images, sales] = await Promise.all([
      db.select().from(variantSizes).where(inArray(variantSizes.variantId, ids)).orderBy(asc(variantSizes.size)),
      db.select().from(productImages).where(inArray(productImages.variantId, ids)).orderBy(asc(productImages.position)),
      db.select({ variantId: orderItems.variantId, sold: sql<number>`sum(${orderItems.quantity})::int` })
        .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(inArray(orderItems.variantId, ids), isNull(orders.deletedAt), notInArray(orders.status, [...CLOSING_STATUSES])))
        .groupBy(orderItems.variantId),
    ]);
    const soldBy = new Map(sales.map((s) => [s.variantId, Number(s.sold)]));
    // Section written in the dashboard, per colourway. Read apart: if it fails (column not created yet),
    // the shop keeps its built-in wording instead of falling back to the built-in catalogue.
    let savedComfort = new Map<number, ComfortContent | null>();
    try {
      const saved = await db.select({ id: variants.id, comfort: variants.comfort }).from(variants).where(inArray(variants.id, ids));
      savedComfort = new Map(saved.map((v) => [v.id, v.comfort]));
    } catch (error) {
      console.error("Section « Pourquoi vous allez l'adorer » illisible, texte intégré utilisé :", error);
    }
    // Rayon et promotion ne sont pas (encore) en base : ceux du catalogue intégré.
    const extra = new Map(staticProducts.map((p) => [p.id, p]));

    return rows.map((r) => ({
      id: r.slug,
      model: r.model,
      modelSlug: r.modelSlug,
      brand: r.brand,
      name: r.name,
      nameAr: r.nameAr,
      color: r.color,
      category: extra.get(r.slug)?.category ?? "mixte",
      promotion: extra.get(r.slug)?.promotion ?? false,
      gender: r.gender,
      sold: soldBy.get(r.id) ?? 0,
      comfort: resolveComfort(savedComfort.get(r.id) ?? null, productContent(r.modelSlug).comfort),
      price: r.price,
      oldPrice: r.oldPrice !== null && r.oldPrice > r.price ? r.oldPrice : null,
      sizes: sizes.filter((s) => s.variantId === r.id).map((s) => ({ size: s.size, available: s.stock === null || s.stock > 0 })),
      ...(() => {
        const refs = images.filter((i) => i.variantId === r.id).map((i) => i.url);
        const photos = refs.map(imageUrl);
        return { photos, photoKeys: refs.map(imageKey), thumbnail: r.thumbnail ? imageUrl(r.thumbnail) : photos[0] ?? "" };
      })(),
    }));
  } catch (error) {
    console.error("Catalogue indisponible, catalogue intégré utilisé :", error);
    return fallbackCatalog();
  }
}

/** Hero and category pictures: addresses built from R2_PUBLIC_URL (lib/r2.ts). */
export const getStoreMedia = () => ({
  hero: siteImageUrl(siteImages.hero),
  categories: Object.fromEntries(Object.entries(siteImages.categories).map(([id, image]) => [id, siteImageUrl(image)])),
  categoryPhotos: Object.fromEntries(Object.entries(siteImages.categoryPhotos).map(([id, image]) => [id, siteImageUrl(image)])),
});
