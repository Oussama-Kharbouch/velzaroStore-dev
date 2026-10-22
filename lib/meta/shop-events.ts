/**
 * custom_data of the Conversions API events, from the catalogue in the database: the browser
 * only says which colourways and how many, never a price nor an amount.
 */
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../../db";
import { catalogId } from "../catalog.mjs";
import type { MetaServerEvent } from "./capi";

const { products, variants } = schema;

export type PricedLine = { slug: string; qty: number; price: number };

/** Lines priced from the database (colourways on sale only); null if one is unknown or hidden. */
export async function priceLines(items: { id: string; qty: number }[]): Promise<PricedLine[] | null> {
  const slugs = [...new Set(items.map((i) => i.id))];
  const rows = await getDb().select({ slug: variants.slug, price: variants.price })
    .from(variants).innerJoin(products, eq(variants.productId, products.id))
    .where(and(inArray(variants.slug, slugs), eq(variants.active, true), eq(products.active, true)));
  const price = new Map(rows.map((r) => [r.slug, r.price]));
  if (slugs.some((s) => !price.has(s))) return null;
  return items.map((i) => ({ slug: i.id, qty: i.qty, price: price.get(i.id)! }));
}

/** content_ids are the ids of the Meta catalogue feed (cloudtilt-<colourway>), as in the pixel. */
export function customData(lines: PricedLine[], value?: number, orderId?: string): MetaServerEvent["customData"] {
  const quantity = new Map<string, { qty: number; price: number }>();
  for (const l of lines) {
    const current = quantity.get(l.slug);
    quantity.set(l.slug, { qty: (current?.qty ?? 0) + l.qty, price: l.price });
  }
  return {
    content_ids: [...quantity.keys()].map(catalogId),
    content_type: "product",
    contents: [...quantity].map(([slug, { qty, price }]) => ({ id: catalogId(slug), quantity: qty, item_price: price })),
    value: value ?? lines.reduce((sum, l) => sum + l.qty * l.price, 0),
    currency: "MAD",
    num_items: lines.reduce((sum, l) => sum + l.qty, 0),
    ...(orderId ? { order_id: orderId } : {}),
  };
}
