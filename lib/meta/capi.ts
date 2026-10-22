/**
 * Meta Conversions API (server side): the same events as the pixel, with the same event_id,
 * so that Meta deduplicates them. Events blocked in the browser (ad blockers, iOS) still arrive.
 *
 * Settings (Cloudflare secrets, never in the code nor in the browser):
 *   META_CAPI_TOKEN       access token of the dataset; absent = nothing is sent.
 *   META_TEST_EVENT_CODE  optional: events go to "Test events" of the Events Manager.
 * Sending runs in the background (waitUntil on Cloudflare), with a short timeout: a slow or
 * failing Meta never delays nor breaks the page or the order. Errors are logged.
 */
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { META_PIXEL_ID, matchingFields, sha256, type MetaCustomer } from "./normalize";

/** Latest stable Graph API version (v26.0, 29 July 2026). */
export const GRAPH_API_VERSION = "v26.0";
const TIMEOUT_MS = 4000;

export type MetaEventName = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export type MetaServerEvent = {
  eventName: MetaEventName;
  /** Same value as the pixel's eventID. */
  eventId: string;
  eventSourceUrl: string;
  customData: {
    content_ids: string[];
    content_type: "product";
    contents: { id: string; quantity: number; item_price: number }[];
    value: number;
    currency: "MAD";
    num_items: number;
    order_id?: string;
  };
  /** Purchase only: customer typed in the checkout form (hashed before sending). */
  customer?: MetaCustomer;
};

/** Visitor's address: Cloudflare gives it in cf-connecting-ip; otherwise the first X-Forwarded-For hop. */
const clientIp = (headers: Headers) =>
  headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? undefined;

const cookie = (headers: Headers, name: string) => {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
};

/** fbc: the _fbc cookie set by the pixel, or built from ?fbclid= of the page (ad click). */
const clickId = (headers: Headers, sourceUrl: string) => {
  const fromCookie = cookie(headers, "_fbc");
  if (fromCookie) return fromCookie;
  try {
    const fbclid = new URL(sourceUrl).searchParams.get("fbclid");
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined;
  } catch {
    return undefined;
  }
};

/** Payload of one event (exported for the tests). */
export async function buildPayload(event: MetaServerEvent, headers: Headers, testEventCode?: string) {
  const hashed: Record<string, string> = {};
  if (event.customer) for (const [key, value] of Object.entries(matchingFields(event.customer))) hashed[key] = await sha256(value);
  const userData = Object.fromEntries(Object.entries({
    client_ip_address: clientIp(headers),
    client_user_agent: headers.get("user-agent") ?? undefined,
    fbp: cookie(headers, "_fbp"),
    fbc: clickId(headers, event.eventSourceUrl),
    ...hashed,
  }).filter(([, v]) => v));
  return {
    data: [{
      event_name: event.eventName,
      event_id: event.eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: event.eventSourceUrl,
      user_data: userData,
      custom_data: event.customData,
    }],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

/** Sends one event to the Conversions API. Never throws: failures are logged. */
export async function sendMetaEvent(event: MetaServerEvent, headers: Headers): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  try {
    const payload = await buildPayload(event, headers, process.env.META_TEST_EVENT_CODE || undefined);
    // META_GRAPH_BASE: tests only (local imitation of the Graph API).
    const base = process.env.META_GRAPH_BASE || "https://graph.facebook.com";
    const response = await fetch(`${base}/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.error(`Meta CAPI ${event.eventName} ${event.eventId}: ${response.status}`, (await response.text()).slice(0, 500));
  } catch (error) {
    console.error(`Meta CAPI ${event.eventName} ${event.eventId}: not sent`, error instanceof Error ? error.message : error);
  }
}

/** Sends in the background: the response to the visitor does not wait for Meta. */
export function dispatchMetaEvent(event: MetaServerEvent, headers: Headers) {
  const sending = sendMetaEvent(event, headers);
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    try {
      getCloudflareContext().ctx.waitUntil(sending);
      return;
    } catch {
      // No request context: the promise simply runs on.
    }
  }
  void sending;
}
