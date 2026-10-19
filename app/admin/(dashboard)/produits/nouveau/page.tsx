import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminHeader from "../../../../../components/admin/header";
import VariantForm from "../../../../../components/admin/variant-form";
import { ADMIN_PATH } from "../../../../../lib/site";

export const metadata: Metadata = { title: "Nouveau coloris" };

export default function NewVariantPage() {
  return (
    <>
      <AdminHeader eyebrow="Cloudtilt" title="Nouveau coloris"/>
      <div className="ad-content">
        <Link className="ad-back" href={`${ADMIN_PATH}/produits`}><ArrowLeft/> Retour aux produits</Link>
        <p className="ord-subtitle">Le coloris est créé masqué tant que ses 6 photos ne sont pas ajoutées ; mettez-le en ligne quand il est prêt.</p>
        <VariantForm/>
      </div>
    </>
  );
}
