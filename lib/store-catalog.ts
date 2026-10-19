/**
 * Catalogue affiché par la boutique, lu dans la base : coloris en ligne, prix,
 * prix barré, pointures disponibles et photos. La page est rendue à chaque visite :
 * une modification du dashboard est visible aussitôt.
 */
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import { OLD_PRICE, PRICE, SIZES, legacyPhotoPaths, photoKeys, products as staticProducts } from "./catalog.mjs";
import { imageKey, imageUrl, siteImageUrl } from "./r2";

const { products, variants, variantSizes, productImages } = schema;

export type StoreProduct = {
  /** Slug du coloris : identifiant du panier et des URL (#produit/<id>). */
  id: string;
  name: string;
  /** Nom arabe saisi dans le dashboard ; null = traduction intégrée (translations.ts). */
  nameAr: string | null;
  color: string;
  category: string;
  promotion: boolean;
  price: number;
  oldPrice: number | null;
  sizes: { size: number; available: boolean }[];
  /** Public addresses, in gallery order. */
  photos: string[];
  /** Matching R2 keys: the framing of each photo (app/(store)/*-framing.ts) is looked up by key. */
  photoKeys: string[];
};

/** Catalogue intégré au code, utilisé si la base ne répond pas : la boutique reste en ligne. */
const fallbackCatalog = (): StoreProduct[] => staticProducts.map((p) => ({
  ...p, nameAr: null, price: PRICE, oldPrice: OLD_PRICE, sizes: SIZES.map((size) => ({ size, available: true })),
  photos: photoKeys[p.id].map((key, i) => siteImageUrl({ key, legacy: legacyPhotoPaths[p.id][i] })),
  photoKeys: photoKeys[p.id],
}));

export async function getStoreCatalog(): Promise<StoreProduct[]> {
  try {
    const db = getDb();
    const rows = await db.select({
      id: variants.id, slug: variants.slug, name: variants.colorName, nameAr: variants.colorNameAr, color: variants.colorHex,
      price: variants.price, oldPrice: variants.oldPrice,
    }).from(variants).innerJoin(products, eq(variants.productId, products.id))
      .where(and(eq(variants.active, true), eq(products.active, true)))
      .orderBy(asc(variants.position), asc(variants.id));
    if (!rows.length) return fallbackCatalog();

    const ids = rows.map((r) => r.id);
    const [sizes, images] = await Promise.all([
      db.select().from(variantSizes).where(inArray(variantSizes.variantId, ids)).orderBy(asc(variantSizes.size)),
      db.select().from(productImages).where(inArray(productImages.variantId, ids)).orderBy(asc(productImages.position)),
    ]);
    // Rayon et promotion ne sont pas (encore) en base : ceux du catalogue intégré.
    const extra = new Map(staticProducts.map((p) => [p.id, p]));

    return rows.map((r) => ({
      id: r.slug,
      name: r.name,
      nameAr: r.nameAr,
      color: r.color,
      category: extra.get(r.slug)?.category ?? "mixte",
      promotion: extra.get(r.slug)?.promotion ?? false,
      price: r.price,
      oldPrice: r.oldPrice !== null && r.oldPrice > r.price ? r.oldPrice : null,
      sizes: sizes.filter((s) => s.variantId === r.id).map((s) => ({ size: s.size, available: s.stock === null || s.stock > 0 })),
      ...(() => {
        const refs = images.filter((i) => i.variantId === r.id).map((i) => i.url);
        return { photos: refs.map(imageUrl), photoKeys: refs.map(imageKey) };
      })(),
    }));
  } catch (error) {
    console.error("Catalogue indisponible, catalogue intégré utilisé :", error);
    return fallbackCatalog();
  }
}
