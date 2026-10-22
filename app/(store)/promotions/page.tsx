import Store from "../store";
import { getStoreCatalog, getStoreMedia } from "../../../lib/store-catalog";
import { shopLang } from "../../../lib/shop-lang";

/** Shop section at /promotions, rendered on the server with the section already open (same data as the home page). */
export const dynamic = "force-dynamic";

export default async function Page() {
  return <Store catalog={await getStoreCatalog()} media={getStoreMedia()} initialLang={await shopLang()} initialPage="promotions"/>;
}
