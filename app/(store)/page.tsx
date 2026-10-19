import Store from "./store";
import { siteImages } from "../../lib/catalog.mjs";
import { siteImageUrl } from "../../lib/r2";
import { getStoreCatalog } from "../../lib/store-catalog";

/**
 * Rendue à chaque visite (catalogue lu dans la base) : une modification faite dans le
 * dashboard est visible aussitôt, sans cache à configurer sur Cloudflare Workers.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  // Hero and category pictures: addresses built from R2_PUBLIC_URL (lib/r2.ts).
  const media = {
    hero: siteImageUrl(siteImages.hero),
    categories: Object.fromEntries(Object.entries(siteImages.categories).map(([id, image]) => [id, siteImageUrl(image)])),
  };
  return <Store catalog={await getStoreCatalog()} media={media}/>;
}
