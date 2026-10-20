"use client";

// Meta (Facebook / Instagram) Pixel of VELZARO. The ID is public by nature (it appears in
// every page), so it is written here rather than in an environment variable.
// Loaded by the SHOP layout only (app/(store)/layout.tsx), never on the dashboard.
//
// The pixel only starts on the live domains: local development, previews and tests never
// send events to Meta (they would pollute the statistics and the ad optimisation).
// Browsing events carry product ids, amounts and counts only. The purchase also carries the
// customer's name, phone, city and country ("Advanced Matching", see trackPurchase), hashed in
// the browser: Meta only receives fingerprints. The street address has no Meta field: never sent.

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const META_PIXEL_ID = "991994386540162";

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

/** Customer of an order, as typed in the checkout form. */
export type PixelCustomer = { name: string; phone: string; city: string };

// Normalisation rules of Meta (otherwise the fingerprints match nobody).
/** Names: lowercase, letters only (Arabic letters kept, in UTF-8). */
const nameKey = (value: string) => value.normalize("NFC").toLowerCase().replace(/[^\p{L}]/gu, "");
/** City: lowercase, no accents, spaces or punctuation ("Béni Mellal" → "benimellal"). */
const cityKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** Phone: digits with the country code, no "+" or leading 0 ("06 11 22 33 44" → "212611223344"). */
const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("212")) return digits;
  if (digits.length === 10 && digits.startsWith("0")) return "212" + digits.slice(1);
  if (digits.length === 9) return "212" + digits;
  return digits;
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Matching fields of Meta (fn, ln, ph, ct, country). Hashed here when the page is secure (https);
 * on plain http the browser has no crypto.subtle, so the normalised values go to the pixel, which
 * hashes them itself before sending (Meta never receives them in clear either way).
 */
async function matchingData(customer: PixelCustomer): Promise<Record<string, string>> {
  const [first = "", ...rest] = customer.name.trim().split(/\s+/);
  const fields: Record<string, string> = {
    fn: nameKey(first),
    ln: nameKey(rest.join("")),
    ph: phoneKey(customer.phone),
    ct: cityKey(customer.city),
    country: "ma",
  };
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value) data[key] = window.crypto?.subtle ? await sha256(value) : value;
  }
  return data;
}

/**
 * Purchase with the customer's matching data. Never throws and never delays the confirmation:
 * if hashing fails or takes more than 1 s, the purchase is sent without the customer data.
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
