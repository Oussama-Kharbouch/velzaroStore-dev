import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Alert } from "../../../../../components/admin/bits";
import AdminHeader from "../../../../../components/admin/header";
import VariantForm from "../../../../../components/admin/variant-form";
import { getVariantForEdit } from "../../../../../lib/admin/catalog";
import { numericId } from "../../../../../lib/admin/respond";
import { listModels } from "../../../../../lib/admin/queries";
import { ADMIN_PATH } from "../../../../../lib/site";
import { productPath } from "../../../../../lib/catalog.mjs";

export const metadata: Metadata = { title: "Fiche coloris" };

type Params = Promise<{ id: string }>;

export default async function EditVariantPage({ params, searchParams }: { params: Params; searchParams: Promise<{ cree?: string }> }) {
  const id = numericId((await params).id);
  if (id === null) notFound();
  const [variant, models] = await Promise.all([getVariantForEdit(id), listModels()]);
  if (!variant) notFound();
  const model = models.find((m) => m.id === variant.productId);
  const created = (await searchParams).cree === "1";

  return (
    <>
      <AdminHeader eyebrow={model?.name ?? "Coloris"} title={variant.colorName}>
        {variant.active && <a className="ad-btn" href={productPath(variant.slug)} target="_blank" rel="noopener"><ExternalLink/> Voir sur la boutique</a>}
      </AdminHeader>
      <div className="ad-content">
        <Link className="ad-back" href={model ? `${ADMIN_PATH}/produits/modeles/${model.id}` : `${ADMIN_PATH}/produits`}><ArrowLeft/> {model ? `Retour à ${model.name}` : "Retour aux produits"}</Link>
        {created && <div style={{ marginBottom: 16 }}><Alert tone="success">Coloris créé{variant.active ? " et mis en ligne." : ". Il reste masqué jusqu’à sa mise en ligne."}</Alert></div>}
        <VariantForm key={variant.id} variant={variant} models={models}/>
      </div>
    </>
  );
}
