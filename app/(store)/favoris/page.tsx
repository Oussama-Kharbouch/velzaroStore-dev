import Store from "../store";
import { getStoreCatalog, getStoreMedia } from "../../../lib/store-catalog";
import { getPromoCampaign } from "../../../lib/promo";
import { shopLang } from "../../../lib/shop-lang";

/** Shop section at /favoris, rendered on the server with the section already open (same data as the home page). */
export const dynamic = "force-dynamic";

export default async function Page() {
  return <Store catalog={await getStoreCatalog()} media={getStoreMedia()} promo={getPromoCampaign()} initialLang={await shopLang()} initialPage="favoris"/>;
}
