/**
 * Limited-time offer shown on the product pages (« عرض محدود » band with its countdown) and in the
 * black information bar of the shop.
 *
 * Set in the dashboard (Offre page, table shop_promo): start, end and the models concerned. Every
 * visitor sees the same end. No end, or an end already passed: no countdown and no "limited time"
 * wording, never a fake timer restarting at each visit.
 * Until the dashboard has saved an offer once (no row yet), the Worker variables of the first
 * version are still read: VZ_PROMO_START_AT, VZ_PROMO_END_AT (or NEXT_PUBLIC_VZ_PROMO_END_AT).
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";

export type PromoCampaign = {
  /** Start and end, in milliseconds since 1970; start null when not configured. */
  startAt: number | null;
  endAt: number;
  /** Models (products.slug) whose product pages show the countdown; empty = every model. */
  models: string[];
};

const instant = (value: string | undefined) => {
  const time = Date.parse((value ?? "").trim());
  return Number.isFinite(time) ? time : null;
};

/** Campaign from its dates, or null when it has no end or is already over. */
export const campaignFrom = (startAt: number | null, endAt: number | null, models: string[], now = Date.now()): PromoCampaign | null => {
  if (endAt === null || endAt <= now) return null;
  return { startAt: startAt !== null && startAt < endAt ? startAt : null, endAt, models };
};

/** Campaign of the Worker variables (first version, before the dashboard setting). */
export const envCampaign = (now = Date.now()) => campaignFrom(
  instant(process.env.VZ_PROMO_START_AT),
  instant(process.env.VZ_PROMO_END_AT) ?? instant(process.env.NEXT_PUBLIC_VZ_PROMO_END_AT),
  [],
  now,
);

/** Offer currently configured, read at every request. A database error never breaks the shop. */
export async function getPromoCampaign(now = Date.now()): Promise<PromoCampaign | null> {
  try {
    const [row] = await getDb().select().from(schema.shopPromo).where(eq(schema.shopPromo.id, 1)).limit(1);
    if (row) return campaignFrom(row.startAt?.getTime() ?? null, row.endAt?.getTime() ?? null, row.models, now);
  } catch (error) {
    console.error("Offre illisible, variables du Worker utilisées :", error);
  }
  return envCampaign(now);
}
