import Store from "./store";
import { getStoreCatalog, getStoreMedia } from "../../lib/store-catalog";
import { shopLang } from "../../lib/shop-lang";

/**
 * Rendue à chaque visite (catalogue lu dans la base) : une modification faite dans le
 * dashboard est visible aussitôt, sans cache à configurer sur Cloudflare Workers.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  return <Store catalog={await getStoreCatalog()} media={getStoreMedia()} initialLang={await shopLang()}/>;
}
