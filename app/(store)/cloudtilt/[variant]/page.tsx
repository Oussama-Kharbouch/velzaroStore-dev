import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Store from "../../store";
import { getStoreCatalog, getStoreMedia } from "../../../../lib/store-catalog";
import { shopLang } from "../../../../lib/shop-lang";

/**
 * Product page: /cloudtilt/<colourway> (e.g. /cloudtilt/white-black). The folder name is
 * the model slug (PRODUCT.slug in lib/catalog.mjs). Rendered on the server with the
 * product already open; the shop keeps working as a single page from there.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ variant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { variant } = await params;
  const product = (await getStoreCatalog()).find((p) => p.id === variant);
  return product ? { title: `Cloudtilt ${product.name} — VELZARO.store` } : {};
}

export default async function ProductPage({ params }: { params: Params }) {
  const { variant } = await params;
  const catalog = await getStoreCatalog();
  // Unknown or hidden colourway (old link): back to the shop rather than an error page.
  if (!catalog.some((p) => p.id === variant)) redirect("/boutique");
  return <Store catalog={catalog} media={getStoreMedia()} initialLang={await shopLang()} initialProductId={variant}/>;
}
