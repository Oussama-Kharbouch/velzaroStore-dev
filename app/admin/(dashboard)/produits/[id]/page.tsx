import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Alert } from "../../../../../components/admin/bits";
import AdminHeader from "../../../../../components/admin/header";
import VariantForm from "../../../../../components/admin/variant-form";
import { getVariantForEdit } from "../../../../../lib/admin/catalog";
import { numericId } from "../../../../../lib/admin/respond";
import { ADMIN_PATH } from "../../../../../lib/site";

export const metadata: Metadata = { title: "Fiche coloris" };

type Params = Promise<{ id: string }>;

export default async function EditVariantPage({ params, searchParams }: { params: Params; searchParams: Promise<{ cree?: string }> }) {
  const id = numericId((await params).id);
  if (id === null) notFound();
  const variant = await getVariantForEdit(id);
  if (!variant) notFound();
  const created = (await searchParams).cree === "1";

  return (
    <>
      <AdminHeader eyebrow="Cloudtilt" title={variant.colorName}>
        {variant.active && <a className="ad-btn" href={`/#produit/${variant.slug}`} target="_blank" rel="noopener"><ExternalLink/> Voir sur la boutique</a>}
      </AdminHeader>
      <div className="ad-content">
        <Link className="ad-back" href={`${ADMIN_PATH}/produits`}><ArrowLeft/> Retour aux produits</Link>
        {created && <div style={{ marginBottom: 16 }}><Alert tone="success">Coloris créé{variant.active ? " et mis en ligne." : ". Il reste masqué jusqu’à sa mise en ligne."}</Alert></div>}
        <VariantForm key={variant.id} variant={variant}/>
      </div>
    </>
  );
}
