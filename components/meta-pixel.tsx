"use client";

// Meta (Facebook / Instagram) Pixel of VELZARO. The ID is public by nature (it appears in
// every page), so it is written in the code (lib/meta/normalize.ts) rather than in an environment variable.
// Loaded by the SHOP layout only (app/(store)/layout.tsx), never on the dashboard.
//
// The pixel only starts on the live domains: local development, previews and tests never
// send events to Meta (they would pollute the statistics and the ad optimisation).
// Browsing events carry product ids, amounts and counts only. The purchase also carries the
// customer's name, phone, city and country ("Advanced Matching", see trackPurchase), hashed in
// the browser: Meta only receives fingerprints. The street address has no Meta field: never sent.
//
// Deduplication with the Conversions API (lib/meta/capi.ts): every event has an event_id, given
// to the pixel ({ eventID }) and to the server, which sends the same event to Meta. Meta keeps one.
// ViewContent, AddToCart, InitiateCheckout: event_id made here, server called by trackShopEvent.
// Purchase: event_id made by the server from the order number (sent by the server itself).

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID, matchingFields, sha256, type MetaCustomer } from "../lib/meta/normalize";

export { META_PIXEL_ID };

/** Hosts where the pixel is active. */
const LIVE_HOSTS = /^(www\.)?prestigea\.shop$/;

type FbqParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    /** Events sent before the pixel script ran (e.g. the product viewed on page load). */
    __vzPixelQueue?: unknown[][];
  }
}

/** Sends a standard Meta event (ViewContent, AddToCart, InitiateCheckout, Purchase…). Off the live site it goes nowhere. */
export function trackPixel(event: string, params?: FbqParams, eventId?: string) {
  if (typeof window === "undefined") return;
  const args: unknown[] = eventId ? ["track", event, params ?? {}, { eventID: eventId }] : ["track", event, params ?? {}];
  // Script not run yet: queued, then replayed by the init script (live site only).
  if (window.fbq) window.fbq(...args);
  else (window.__vzPixelQueue ??= []).push(args);
}

/** event_id shared by the pixel and the Conversions API: "AddToCart_1792456978078_9f2c4b1ad03e7a65". */
export function generateEventId(eventName: string) {
  // getRandomValues also works on plain http pages (crypto.randomUUID does not).
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${eventName}_${Date.now()}_${random}`;
}

/**
 * The pixel sets its _fbp (and _fbc) cookies when its script starts: the server call waits for them,
 * 3 s at most, so that the first event of a visit (often the product reached from an ad) carries them too.
 */
const afterPixelCookies = (send: () => void) => {
  const started = Date.now();
  const tick = () => {
    if (/(^|;\s*)_fbp=/.test(document.cookie) || Date.now() - started > 3000) send();
    else setTimeout(tick, 150);
  };
  tick();
};

/** Colourways and quantities of an event: the server reads their prices in the database. */
export type ShopEventItem = { id: string; qty: number };

/**
 * ViewContent, AddToCart or InitiateCheckout, sent twice with the same event_id: by the pixel and,
 * through the server, by the Conversions API. The server call never blocks nor breaks the page.
 */
export function trackShopEvent(event: "ViewContent" | "AddToCart" | "InitiateCheckout", params: FbqParams, items: ShopEventItem[]) {
  if (typeof window === "undefined") return;
  const eventId = generateEventId(event);
  trackPixel(event, params, eventId);
  if (!LIVE_HOSTS.test(location.hostname)) return;
  const url = location.href;
  afterPixelCookies(() => {
    try {
      void fetch("/api/meta/capi", {
        method: "POST", keepalive: true, headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_name: event, event_id: eventId, event_source_url: url, items }),
      }).catch(() => {});
    } catch {
      // Tracking must never break the shop.
    }
  });
}

/** Customer of an order, as typed in the checkout form. */
export type PixelCustomer = MetaCustomer;

/**
 * Matching fields of Meta (fn, ln, ph, ct, country). Hashed here when the page is secure (https);
 * on plain http the browser has no crypto.subtle, so the normalised values go to the pixel, which
 * hashes them itself before sending (Meta never receives them in clear either way).
 */
async function matchingData(customer: PixelCustomer): Promise<Record<string, string>> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(matchingFields(customer))) {
    data[key] = window.crypto?.subtle ? await sha256(value) : value;
  }
  return data;
}

/**
 * Purchase with the customer's matching data. Never throws and never delays the confirmation:
 * if hashing fails or takes more than 1 s, the purchase is sent without the customer data.
 * `eventId` comes from the server (purchase_<order number>), which sends the same Purchase to the Conversions API.
 */
export async function trackPurchase(customer: PixelCustomer, params: FbqParams, eventId: string) {
  if (typeof window === "undefined") return;
  try {
    const data = await Promise.race([
      matchingData(customer),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
    ]);
    // Re-initialising the pixel with the customer data is Meta's "manual Advanced Matching":
    // the events sent after it (this Purchase) carry the data.
    if (data && Object.keys(data).length) {
      const args: unknown[] = ["init", META_PIXEL_ID, data];
      if (window.fbq) window.fbq(...args);
      else (window.__vzPixelQueue ??= []).push(args);
    }
  } catch {
    // Tracking must never break the order.
  }
  trackPixel("Purchase", params, eventId);
}

export default function MetaPixel() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  // PageView on each page change (the first one is sent by the init script). Product pages
  // have their own address (/cloudtilt/<colourway>), so opening a product counts as a page.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`if(${LIVE_HOSTS}.test(location.hostname)){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');
fbq('track','PageView');
(window.__vzPixelQueue||[]).forEach(function(a){fbq.apply(null,a)});window.__vzPixelQueue=[];}`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- Meta's no-JavaScript fallback pixel. */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}/>
      </noscript>
    </>
  );
}
