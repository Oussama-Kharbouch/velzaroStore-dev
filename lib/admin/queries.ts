/** Lectures du dashboard : indicateurs, ventes par coloris, stocks, clients, catalogue. */
import "server-only";
import { asc, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "../../db";
import { LOST_STATUSES } from "../orders/status";
import { imageUrl } from "../r2";
import { LOW_STOCK_THRESHOLD } from "./thresholds";

const { orders, products, variants, variantSizes } = schema;

/** Commandes qui comptent dans les ventes : ni annulées, ni refusées, ni retournées. */
const counted = notInArray(orders.status, [...LOST_STATUSES]);
/** Orders deleted from the dashboard (soft deletion) are left out of every figure. */
const visible = isNull(orders.deletedAt);

/**
 * Paires vendues d'un coloris (commandes comptées). Table names are explicit: Drizzle leaves
 * columns unqualified in single-table selects, which makes correlated subqueries ambiguous.
 */
const lost = sql.raw(LOST_STATUSES.map((s) => `'${s}'`).join(", "));
const pairsSold = sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id
  where oi.variant_id = "variants"."id" and o.status not in (${lost}) and o.deleted_at is null), 0)::int`;
const firstImage = sql<string | null>`(select pi.url from product_images pi where pi.variant_id = "variants"."id" order by pi.position limit 1)`;

/** Téléphone réduit à ses chiffres significatifs : « 06 12… » et « +212 6 12… » sont le même client. */
const phoneKey = sql<string>`right(regexp_replace(${orders.phone}, '\\D', '', 'g'), 9)`;

export const getDashboardStats = async () => {
  const [row] = await getDb().select({
    commandes: sql<number>`count(*)::int`,
    commandesComptees: sql<number>`(count(*) filter (where ${counted}))::int`,
    enAttente: sql<number>`(count(*) filter (where ${orders.status} = 'en-attente'))::int`,
    enCours: sql<number>`(count(*) filter (where ${orders.status} in ('confirmee', 'en-preparation', 'expediee')))::int`,
    chiffreAffaires: sql<number>`coalesce(sum(${orders.total}) filter (where ${counted}), 0)::int`,
    aEncaisser: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'livree' and ${orders.paymentStatus} = 'a-encaisser'), 0)::int`,
    encaisse: sql<number>`coalesce(sum(coalesce(${orders.amountReceived}, ${orders.total})) filter (where ${orders.paymentStatus} = 'encaisse'), 0)::int`,
    clients: sql<number>`count(distinct ${phoneKey})::int`,
  }).from(orders).where(visible);
  const panierMoyen = row.commandesComptees > 0 ? Math.round(row.chiffreAffaires / row.commandesComptees) : 0;
  return { ...row, panierMoyen };
};

export const getRecentOrders = (limit: number) => getDb().select({
  id: orders.id, number: orders.orderNumber, customerName: orders.customerName, city: orders.city,
  createdAt: orders.createdAt, status: orders.status, total: orders.total,
}).from(orders).where(visible).orderBy(desc(orders.createdAt), desc(orders.id)).limit(limit);

/** Paires vendues par coloris (commandes comptées), tous coloris affichés même à zéro. */
export const getSalesByVariant = () => getDb().select({
  slug: variants.slug, name: variants.colorName, hex: variants.colorHex,
  pairs: pairsSold,
}).from(variants).orderBy(asc(variants.position));

/** Pointures dont le stock est suivi et bas (épuisées en premier). */
export const getLowStock = () => getDb().select({
  variantId: variants.id, name: variants.colorName, size: variantSizes.size, stock: variantSizes.stock,
}).from(variantSizes).innerJoin(variants, eq(variants.id, variantSizes.variantId))
  .where(sql`${variantSizes.stock} is not null and ${variantSizes.stock} <= ${LOW_STOCK_THRESHOLD}`)
  .orderBy(asc(variantSizes.stock), asc(variants.position), asc(variantSizes.size));

export const CUSTOMERS_PER_PAGE = 25;

/**
 * Clients, reconnus par leur numéro de téléphone (pas de compte client sur le
 * site). Nom, ville et numéro affichés : ceux de la dernière commande.
 */
export const listCustomers = async ({ q, page }: { q?: string; page: number }) => {
  const db = getDb();
  const grouped = db.select({
    key: sql<string>`${phoneKey}`.as("key"),
    name: sql<string>`(array_agg(${orders.customerName} order by ${orders.createdAt} desc))[1]`.as("name"),
    phone: sql<string>`(array_agg(${orders.phone} order by ${orders.createdAt} desc))[1]`.as("phone"),
    city: sql<string>`(array_agg(${orders.city} order by ${orders.createdAt} desc))[1]`.as("city"),
    commandes: sql<number>`count(*)::int`.as("commandes"),
    commandesComptees: sql<number>`(count(*) filter (where ${counted}))::int`.as("commandes_comptees"),
    total: sql<number>`coalesce(sum(${orders.total}) filter (where ${counted}), 0)::int`.as("total"),
    premiere: sql<Date>`min(${orders.createdAt})`.as("premiere"),
    derniere: sql<Date>`max(${orders.createdAt})`.as("derniere"),
  }).from(orders).where(visible).groupBy(phoneKey).as("c");

  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const digits = q?.replace(/\D/g, "") ?? "";
  const where = like
    ? sql`${grouped.name} ilike ${like} or ${grouped.city} ilike ${like}${digits.length >= 3 ? sql` or ${grouped.key} like ${`%${digits.slice(-9)}%`}` : sql``}`
    : sql`true`;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(grouped).where(where);
  const pages = Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE));
  const current = Math.min(page, pages);
  const rows = await db.select().from(grouped).where(where)
    .orderBy(desc(grouped.derniere)).limit(CUSTOMERS_PER_PAGE).offset((current - 1) * CUSTOMERS_PER_PAGE);
  return { rows, total, page: current, pages };
};

/** Coloris pour l'écran Catalogue : prix, statut, stock par pointure, paires vendues. */
export const listCatalog = async () => {
  const db = getDb();
  const [rows, sizes] = await Promise.all([
    db.select({
      id: variants.id, slug: variants.slug, name: variants.colorName, hex: variants.colorHex,
      price: variants.price, oldPrice: variants.oldPrice, active: variants.active, position: variants.position,
      gender: variants.gender, productId: variants.productId,
      image: firstImage,
      photoCount: sql<number>`(select count(*) from product_images pi where pi.variant_id = "variants"."id")::int`,
      sold: pairsSold,
    }).from(variants).orderBy(asc(variants.position), asc(variants.id)),
    db.select().from(variantSizes).orderBy(asc(variantSizes.size)),
  ]);
  return rows.map((row) => ({
    ...row,
    image: row.image ? imageUrl(row.image) : null,
    sizes: sizes.filter((s) => s.variantId === row.id).map((s) => ({ size: s.size, stock: s.stock })),
  }));
};
export type CatalogVariant = Awaited<ReturnType<typeof listCatalog>>[number];

/** Models (Cloudtilt…) with their brand, for the categories of the Products page. */
export const listModels = () => getDb().select({ id: products.id, name: products.name, brand: products.brand })
  .from(products).orderBy(asc(products.id));
export type CatalogModel = Awaited<ReturnType<typeof listModels>>[number];
