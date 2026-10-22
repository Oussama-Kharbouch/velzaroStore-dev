/**
 * Conversions API relay of the shop: ViewContent, AddToCart, InitiateCheckout.
 * Body: { event_name, event_id, event_source_url, items: [{ id, qty }] } — sent by the browser right
 * after the pixel (components/meta-pixel.tsx, same event_id). Prices and amounts are read in the
 * database, never taken from the browser. Answers at once (202); Meta is called in the background.
 * (Purchase is sent by the order itself: app/api/orders/route.ts.)
 */
import { z } from "zod";
import { dispatchMetaEvent } from "../../../../lib/meta/capi";
import { customData, priceLines } from "../../../../lib/meta/shop-events";
import { SITE_URL } from "../../../../lib/site";

const EVENTS = ["ViewContent", "AddToCart", "InitiateCheckout"] as const;

const schema = z.object({
  event_name: z.enum(EVENTS),
  event_id: z.string().regex(/^[A-Za-z]+_\d{10,16}_[a-f0-9]{16}$/).max(80),
  event_source_url: z.string().url().max(2000),
  items: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,80}$/), qty: z.number().int().min(1).max(10) })).min(1).max(20),
});

/** The shop's own pages only (live domain, or this server). */
const ownHost = (url: string, request: Request) => {
  try {
    const host = new URL(url).host;
    const site = new URL(SITE_URL).host;
    return host === site || host === `www.${site}` || host === new URL(request.url).host;
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ownHost(origin, request)) return Response.json({ ok: false }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { event_name, event_id, event_source_url, items } = parsed.data;
  if (!event_id.startsWith(`${event_name}_`) || !ownHost(event_source_url, request)) return Response.json({ ok: false }, { status: 400 });

  const lines = await priceLines(items);
  if (!lines) return Response.json({ ok: false }, { status: 400 });

  dispatchMetaEvent({ eventName: event_name, eventId: event_id, eventSourceUrl: event_source_url, customData: customData(lines) }, request.headers);
  return Response.json({ ok: true }, { status: 202 });
}
