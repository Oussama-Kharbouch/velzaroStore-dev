/**
 * Meta Pixel / Conversions API: shared by the browser (components/meta-pixel.tsx) and the server
 * (lib/meta/capi.ts), so that both always hash the customer data the same way.
 */

/** Pixel = dataset of the Conversions API. Public by nature (it appears in every page). */
export const META_PIXEL_ID = "991994386540162";

// Normalisation rules of Meta (otherwise the fingerprints match nobody).
/** Names: lowercase, letters only (Arabic letters kept, in UTF-8). */
export const nameKey = (value: string) => value.normalize("NFC").toLowerCase().replace(/[^\p{L}]/gu, "");
/** City: lowercase, no accents, spaces or punctuation ("Béni Mellal" → "benimellal"). */
export const cityKey = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** Phone: digits with the country code, no "+" or leading 0 ("06 11 22 33 44" → "212611223344"). */
export const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("212")) return digits;
  if (digits.length === 10 && digits.startsWith("0")) return "212" + digits.slice(1);
  if (digits.length === 9) return "212" + digits;
  return digits;
};

/** Customer as typed in the checkout form. */
export type MetaCustomer = { name: string; phone: string; city: string };

/** Normalised (not yet hashed) matching fields: fn, ln, ph, ct, country. Empty fields left out. */
export const matchingFields = (customer: MetaCustomer): Record<string, string> => {
  const [first = "", ...rest] = customer.name.trim().split(/\s+/);
  const fields: Record<string, string> = {
    fn: nameKey(first),
    ln: nameKey(rest.join("")),
    ph: phoneKey(customer.phone),
    ct: cityKey(customer.city),
    country: "ma",
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
};

/** SHA-256 in hexadecimal (Web Crypto: browser on https, Node, Cloudflare Workers). */
export const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
