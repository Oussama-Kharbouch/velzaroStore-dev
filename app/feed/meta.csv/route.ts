/**
 * Product feed of the Meta catalogue: https://prestigea.shop/feed/meta.csv, CSV in the
 * "Commerce Manager" format, fetched by Meta once a day.
 *
 * Built from getStoreCatalog(), the same data as the product pages: a colourway hidden in
 * the dashboard leaves the feed, prices and stock follow the dashboard. One line per
 * colourway; `id` is the content_id sent by the pixel (catalogId, lib/catalog.mjs).
 * No customer data: the catalogue only.
 */
import { PRODUCT, catalogId } from "../../../lib/catalog.mjs";
import { SITE_URL } from "../../../lib/site";
import { getStoreCatalog, type StoreProduct } from "../../../lib/store-catalog";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "id", "item_group_id", "title", "description", "availability", "condition", "price", "sale_price",
  "link", "image_link", "additional_image_link", "brand", "color", "gender", "age_group", "google_product_category",
] as const;

/** Same wording as the "Description" panel of the product page (app/(store)/store.tsx), colours written the Meta way. */
const description = (p: StoreProduct) =>
  p.id === "white-black"
    ? "Une tige en maille ivoire contrastée par une languette et des lacets noirs. La semelle blanche sculptée souligne une silhouette moderne, facile à associer au quotidien."
    : `${PRODUCT.name}, coloris ${metaColor(p.name)}. Une silhouette contemporaine, une tige en maille et une semelle sculptée pour compléter vos tenues du quotidien.`;

const GENDER: Record<string, string> = { homme: "male", femme: "female" };
/** Colourway in Meta's style: "Black | Ivory" → "Black/Ivory" (Meta expects "/" between colours, no "|"). */
const metaColor = (name: string) => name.split("|").map((part) => part.trim()).join("/");
const money = (value: number) => `${value.toFixed(2)} MAD`;
/** Photos still served from public/ (/assets/…) get the shop's address. */
const absolute = (url: string) => new URL(url, SITE_URL).href;

function row(p: StoreProduct): Record<(typeof COLUMNS)[number], string> {
  const photos = p.photos.map(absolute);
  // A promotion: Meta wants the regular price in `price` and the discounted one in `sale_price`.
  const onSale = p.oldPrice !== null;
  return {
    id: catalogId(p.id),
    item_group_id: PRODUCT.slug,
    title: `${PRODUCT.name} – ${metaColor(p.name)}`,
    description: description(p),
    availability: p.sizes.some((s) => s.available) ? "in stock" : "out of stock",
    condition: "new",
    price: money(onSale ? p.oldPrice! : p.price),
    sale_price: onSale ? money(p.price) : "",
    link: `${SITE_URL}/${PRODUCT.slug}/${p.id}`,
    image_link: photos[0] ?? "",
    additional_image_link: photos.slice(1).join(","),
    brand: "Velzaro",
    color: metaColor(p.name),
    gender: GENDER[p.category] ?? "unisex",
    age_group: "adult",
    google_product_category: "Apparel & Accessories > Shoes",
  };
}

/** RFC 4180: a field with a comma, a quote or a line break is quoted, quotes doubled. */
const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/**
 * Optional HTTP Basic protection, for the "username / password" fields of the Meta data source.
 * Credentials come from the FEED_USER and FEED_PASSWORD secrets (Cloudflare, never in the code);
 * while either is missing, the feed stays open so that Meta keeps reading it.
 */
const feedCredentials = () => {
  const user = process.env.FEED_USER, password = process.env.FEED_PASSWORD;
  return user && password ? { user, password } : null;
};

const sha256 = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

/** Constant-time comparison: both sides are hashed to 32 bytes, then every byte is compared. */
async function same(a: string, b: string) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function authorized(request: Request, expected: { user: string; password: string }) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0)));
  } catch {
    return false; // not base64
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  // Both are always compared: the response time does not tell which one was wrong.
  const [user, password] = await Promise.all([
    same(decoded.slice(0, colon), expected.user),
    same(decoded.slice(colon + 1), expected.password),
  ]);
  return user && password;
}

export async function GET(request: Request) {
  const expected = feedCredentials();
  if (expected && !(await authorized(request, expected))) {
    return new Response("Authentification requise.\n", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="feed"', "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  // A line without a photo would be rejected by Meta: such a colourway is left out.
  const lines = (await getStoreCatalog()).filter((p) => p.photos.length).map(row);
  const csv = [COLUMNS.join(","), ...lines.map((line) => COLUMNS.map((c) => cell(line[c])).join(","))].join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Protected: never kept by a shared cache, which could hand it out without the password.
      "Cache-Control": expected ? "private, no-store" : "public, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
