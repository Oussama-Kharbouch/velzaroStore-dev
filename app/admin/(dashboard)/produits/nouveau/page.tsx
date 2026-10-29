import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminHeader from "../../../../../components/admin/header";
import VariantForm from "../../../../../components/admin/variant-form";
import { listModels } from "../../../../../lib/admin/queries";
import { ADMIN_PATH } from "../../../../../lib/site";

export const metadata: Metadata = { title: "Nouveau coloris" };

/** New colourway; ?modele=<id> (link of a model page) preselects its model. */
export default async function NewVariantPage({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const models = await listModels();
  const requested = Number((await searchParams).modele);
  const model = models.find((m) => m.id === requested);
  const back = model ? `${ADMIN_PATH}/produits/modeles/${model.id}` : `${ADMIN_PATH}/produits`;

  return (
    <>
      <AdminHeader eyebrow={model?.name ?? "Catalogue"} title="Nouveau coloris"/>
      <div className="ad-content">
        <Link className="ad-back" href={back}><ArrowLeft/> {model ? `Retour à ${model.name}` : "Retour aux produits"}</Link>
        <p className="ord-subtitle">Ajoutez autant de photos que vous voulez (au moins une pour mettre le coloris en ligne).</p>
        <VariantForm models={models} modelId={model?.id}/>
      </div>
    </>
  );
}
