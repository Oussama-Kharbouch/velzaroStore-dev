/** Lectures des commandes pour le dashboard. */
import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "../../db";
import { imageUrl } from "../r2";
import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from "./status";

const { orders, orderItems, orderEvents } = schema;

export const ORDERS_PER_PAGE = 20;

export const ORDER_PERIODS = {
  jour: "Aujourd’hui",
  semaine: "7 derniers jours",
  mois: "30 derniers jours",
} as const;
export type OrderPeriod = keyof typeof ORDER_PERIODS;
export const isOrderPeriod = (value: unknown): value is OrderPeriod => typeof value === "string" && value in ORDER_PERIODS;

const periodCondition = (period: OrderPeriod): SQL => {
  switch (period) {
    // Début du jour à l'heure du Maroc.
    case "jour": return sql`${orders.createdAt} >= (date_trunc('day', now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca')`;
    case "semaine": return sql`${orders.createdAt} >= now() - interval '7 days'`;
    case "mois": return sql`${orders.createdAt} >= now() - interval '30 days'`;
  }
};

/** Recherche sur la référence, le nom, le téléphone (chiffres seuls) ou la ville. */
const searchCondition = (q: string): SQL | undefined => {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  // A full number (06…, +212 6…, 00212 6…) is compared on its last 9 digits, the part
  // every format shares; a shorter input is matched as typed.
  const typed = q.replace(/\D/g, "");
  const digits = typed.length >= 9 ? typed.slice(-9) : typed;
  return or(
    ilike(orders.orderNumber, like),
    ilike(orders.customerName, like),
    ilike(orders.city, like),
    ...(digits.length >= 3 ? [sql`regexp_replace(${orders.phone}, '\\D', '', 'g') like ${`%${digits}%`}`] : []),
  );
};

export type OrderRow = {
  id: number; number: string; customerName: string; phone: string; city: string;
  createdAt: Date; articles: number; total: number; status: OrderStatus; paymentStatus: PaymentStatus;
};

export const listOrders = async ({ q, status, period, page }: {
  q?: string; status?: OrderStatus; period?: OrderPeriod; page: number;
}) => {
  const db = getDb();
  // Orders deleted from the dashboard (soft deletion) are never listed nor counted.
  const base = [isNull(orders.deletedAt), q ? searchCondition(q) : undefined, period ? periodCondition(period) : undefined].filter(Boolean) as SQL[];
  const where = and(...base, status ? eq(orders.status, status) : undefined);

  const [countRows, [{ total }]] = await Promise.all([
    // Compteurs par statut avec la recherche et la période en cours (pas le filtre de statut).
    db.select({ status: orders.status, n: count() }).from(orders).where(and(...base)).groupBy(orders.status),
    db.select({ total: count() }).from(orders).where(where),
  ]);
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const row of countRows) counts[row.status] = row.n;

  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  const current = Math.min(page, pages);
  const rows: OrderRow[] = await db.select({
    id: orders.id, number: orders.orderNumber, customerName: orders.customerName, phone: orders.phone, city: orders.city,
    createdAt: orders.createdAt, total: orders.total, status: orders.status, paymentStatus: orders.paymentStatus,
    // Correlated subqueries use explicit table names: Drizzle leaves columns unqualified
    // in single-table selects, which would make "id" resolve to the inner table.
    articles: sql<number>`coalesce((select sum(oi.quantity) from order_items oi where oi.order_id = "orders"."id"), 0)::int`,
  }).from(orders).where(where).orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(ORDERS_PER_PAGE).offset((current - 1) * ORDERS_PER_PAGE);

  return { rows, counts, total, page: current, pages };
};

export type OrderEvent = typeof orderEvents.$inferSelect;

export const getOrderDetail = async (id: number) => {
  const db = getDb();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
  if (!order) return null;

  const [lines, events] = await Promise.all([
    db.select({
      id: orderItems.id, variantId: orderItems.variantId, productName: orderItems.productName, colorName: orderItems.colorName,
      size: orderItems.size, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice,
      image: sql<string | null>`(select pi.url from product_images pi where pi.variant_id = "order_items"."variant_id" order by pi.position limit 1)`,
    }).from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)),
  ]);
  return { ...order, lines: lines.map((line) => ({ ...line, image: line.image ? imageUrl(line.image) : null })), events };
};
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Commandes « À confirmer » : pastille du menu. */
export const countPendingOrders = async () => {
  const [row] = await getDb().select({ n: count() }).from(orders).where(and(inArray(orders.status, ["en-attente"]), isNull(orders.deletedAt)));
  return row?.n ?? 0;
};
