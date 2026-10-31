/**
 * Promotional campaign shown in the red bar of the product pages (countdown).
 *
 * Read on the server at every request, from the Worker variables (Cloudflare → Workers →
 * velzaro-store → Settings → Variables), so a campaign is changed without touching the code:
 *   VZ_PROMO_START_AT=2026-11-01T18:00:00+01:00   (optional)
 *   VZ_PROMO_END_AT=2026-11-03T18:00:00+01:00
 * Every visitor sees the same end. No variable, or a campaign already over: no countdown and no
 * "limited time" wording, never a fake timer restarting at each visit.
 * NEXT_PUBLIC_VZ_PROMO_END_AT (first version of the page) is still accepted as the end.
 */
export type PromoCampaign = {
  /** Start and end, in milliseconds since 1970; start null when not configured. */
  startAt: number | null;
  endAt: number;
};

const instant = (value: string | undefined) => {
  const time = Date.parse((value ?? "").trim());
  return Number.isFinite(time) ? time : null;
};

export function getPromoCampaign(now = Date.now()): PromoCampaign | null {
  const endAt = instant(process.env.VZ_PROMO_END_AT) ?? instant(process.env.NEXT_PUBLIC_VZ_PROMO_END_AT);
  if (endAt === null || endAt <= now) return null;
  const startAt = instant(process.env.VZ_PROMO_START_AT);
  return { startAt: startAt !== null && startAt < endAt ? startAt : null, endAt };
}
