import Store from "./store";
import { siteImages } from "../../lib/catalog.mjs";
import { siteImageUrl } from "../../lib/r2";
import { getStoreCatalog } from "../../lib/store-catalog";

/**
 * Page servie en statique et régénérée au plus tard toutes les 5 minutes ; le
 * dashboard la régénère aussitôt après une modification du catalogue ou du stock.
 */
export const revalidate = 300;

export default async function Page() {
  // Hero and category pictures: addresses built from R2_PUBLIC_URL (lib/r2.ts).
  const media = {
    hero: siteImageUrl(siteImages.hero),
    categories: Object.fromEntries(Object.entries(siteImages.categories).map(([id, image]) => [id, siteImageUrl(image)])),
  };
  return <Store catalog={await getStoreCatalog()} media={media}/>;
}
