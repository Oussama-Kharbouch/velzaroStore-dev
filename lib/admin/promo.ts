/**
 * Limited-time offer of the shop, set in the dashboard (Offre page): start, end and the models
 * whose product pages show the countdown. One row (shop_promo, id 1); the shop reads it at every
 * visit (lib/promo.ts), so a change shows at once.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../../db";
import { firstIssue, ko, ok, type Result } from "./respond";

const { shopPromo, products } = schema;

/** Longest offer accepted: 31 days (a countdown is meant for short offers). */
const MAX_DURATION_MS = 31 * 24 * 3600 * 1000;

export type PromoSetting = { startAt: string | null; endAt: string | null; models: string[]; updatedAt: string | null };

/** Current setting (ISO dates) and the models that can be chosen. */
export const getPromoSetting = async () => {
  const db = getDb();
  const [[row], models] = await Promise.all([
    db.select().from(shopPromo).where(eq(shopPromo.id, 1)).limit(1),
    db.select({ slug: products.slug, name: products.name }).from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
  ]);
  const setting: PromoSetting = {
    startAt: row?.startAt?.toISOString() ?? null,
    endAt: row?.endAt?.toISOString() ?? null,
    models: row?.models ?? [],
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
  return { setting, models, saved: !!row };
};

/**
 * Body: { endAt, startAt?, models } — ISO dates; endAt null stops the offer at once.
 * The end must be in the future and after the start; models are slugs of existing models
 * (empty list = every model).
 */
export const savePromo = async (payload: unknown, now = Date.now()): Promise<Result<PromoSetting>> => {
  const date = z.string().datetime({ offset: true, message: "Date invalide." });
  const parsed = z.object({
    startAt: date.nullable().optional(),
    endAt: date.nullable(),
    models: z.array(z.string().trim().min(1).max(80)).max(50),
  }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const { startAt: startText, endAt: endText, models } = parsed.data;
  const startAt = startText ? new Date(startText) : null;
  const endAt = endText ? new Date(endText) : null;

  if (endAt) {
    if (endAt.getTime() <= now) return ko("La fin de l’offre doit être dans le futur.", "endAt");
    if (startAt && startAt >= endAt) return ko("Le début doit être avant la fin.", "startAt");
    if (endAt.getTime() - (startAt?.getTime() ?? now) > MAX_DURATION_MS) return ko("Une offre dure 31 jours au plus.", "endAt");
  }
  const db = getDb();
  const known = new Set((await db.select({ slug: products.slug }).from(products)).map((p) => p.slug));
  const unknown = models.find((m) => !known.has(m));
  if (unknown) return ko(`Modèle inconnu : ${unknown}.`, "models");

  const values = { startAt: endAt ? startAt : null, endAt, models: [...new Set(models)], updatedAt: new Date(now) };
  const [row] = await db.insert(shopPromo).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: shopPromo.id, set: values }).returning();
  return ok({ startAt: row.startAt?.toISOString() ?? null, endAt: row.endAt?.toISOString() ?? null, models: row.models, updatedAt: row.updatedAt.toISOString() });
};
