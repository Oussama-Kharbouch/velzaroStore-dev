import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Store from "../../store";
import { getStoreCatalog, getStoreMedia } from "../../../../lib/store-catalog";
import { getPromoCampaign } from "../../../../lib/promo";
import { shopLang } from "../../../../lib/shop-lang";

/**
 * Product page: /<model>/<colourway> (e.g. /cloudtilt/white-black, /cloudsurfer-max/gris-bleu).
 * Rendered on the server with the product already open; the shop keeps working as a single
 * page from there.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ model: string; variant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { variant } = await params;
  const product = (await getStoreCatalog()).find((p) => p.id === variant);
  return product ? { title: `${product.model} ${product.name} — VELZARO.store` } : {};
}

export default async function ProductPage({ params }: { params: Params }) {
  const { model, variant } = await params;
  const catalog = await getStoreCatalog();
  const product = catalog.find((p) => p.id === variant);
  // Unknown or hidden colourway (old link): back to the shop rather than an error page.
  if (!product) redirect("/boutique");
  // Right colourway under another model's address: the proper one.
  if (model !== product.modelSlug) redirect(`/${product.modelSlug}/${variant}`);
  return <Store catalog={catalog} media={getStoreMedia()} promo={await getPromoCampaign()} initialLang={await shopLang()} initialProductId={variant}/>;
}
