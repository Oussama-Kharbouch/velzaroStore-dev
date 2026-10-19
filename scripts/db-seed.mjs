// Fills the catalogue tables from lib/catalog.mjs (product, colourways, images, sizes).
// Only inserts what is missing: rows already in the database (prices, stock, active…)
// are never overwritten, so the script can be re-run safely.
// Usage: npm run db:seed
import { openClient, transaction } from "./db.mjs";
import { PRODUCT, PRICE, OLD_PRICE, SIZES, products, photoKeys, galleryLabels } from "../lib/catalog.mjs";

const client = await openClient();
const added = { products: 0, variants: 0, images: 0, sizes: 0 };

await transaction(client, async () => {
  const p = await client.query(
    "INSERT INTO products (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING",
    [PRODUCT.name, PRODUCT.slug],
  );
  added.products += p.rowCount;
  const { rows: [{ id: productId }] } = await client.query("SELECT id FROM products WHERE slug = $1", [PRODUCT.slug]);

  for (const [position, v] of products.entries()) {
    const r = await client.query(
      `INSERT INTO variants (product_id, slug, color_name, color_hex, price, old_price, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (slug) DO NOTHING`,
      [productId, v.id, v.name, v.color, PRICE, OLD_PRICE, position],
    );
    added.variants += r.rowCount;
    const { rows: [{ id: variantId }] } = await client.query("SELECT id FROM variants WHERE slug = $1", [v.id]);

    // R2 keys (products/cloudtilt/<colourway>/<n>.webp), never full addresses.
    for (const [i, url] of photoKeys[v.id].entries()) {
      const img = await client.query(
        `INSERT INTO product_images (variant_id, url, alt, position) VALUES ($1, $2, $3, $4)
         ON CONFLICT (variant_id, position) DO NOTHING`,
        [variantId, url, `${PRODUCT.name} ${v.name} — ${galleryLabels[i]}`, i + 1],
      );
      added.images += img.rowCount;
    }
    for (const size of SIZES) {
      const s = await client.query(
        "INSERT INTO variant_sizes (variant_id, size, stock) VALUES ($1, $2, NULL) ON CONFLICT (variant_id, size) DO NOTHING",
        [variantId, size],
      );
      added.sizes += s.rowCount;
    }
  }
});

const { rows: [count] } = await client.query(`SELECT
  (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM variants)::int AS variants,
  (SELECT count(*) FROM product_images)::int AS images, (SELECT count(*) FROM variant_sizes)::int AS sizes`);
await client.end();
console.log(`Ajoutés : ${added.products} produit(s), ${added.variants} coloris, ${added.images} image(s), ${added.sizes} pointure(s).`);
console.log(`En base : ${count.products} produit(s), ${count.variants} coloris, ${count.images} image(s), ${count.sizes} pointure(s).`);
