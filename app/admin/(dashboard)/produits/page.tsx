import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Alert } from "../../../../components/admin/bits";
import AdminHeader from "../../../../components/admin/header";
import VariantEditor from "../../../../components/admin/variant-editor";
import { listCatalog } from "../../../../lib/admin/queries";
import { ADMIN_PATH } from "../../../../lib/site";

export const metadata: Metadata = { title: "Produits" };

export default async function ProductsPage() {
  const variants = await listCatalog();
  const online = variants.filter((v) => v.active).length;
  const sold = variants.reduce((sum, v) => sum + v.sold, 0);

  return (
    <>
      <AdminHeader eyebrow="Catalogue" title="Produits">
        <a className="ad-btn" href="/" target="_blank" rel="noopener"><ExternalLink/> Voir la boutique</a>
        <Link className="ad-btn ad-btn-primary" href={`${ADMIN_PATH}/produits/nouveau`}><Plus/> Ajouter un coloris</Link>
      </AdminHeader>

      <div className="ad-content">
        <section className="ad-panel vz-product">
          <div>
            <p className="vz-product-eyebrow">Modèle</p>
            <h2>Cloudtilt</h2>
            <p>{variants.length} coloris · {online} en ligne · {sold} paire{sold > 1 ? "s" : ""} vendue{sold > 1 ? "s" : ""} · pointures 40 à 44</p>
          </div>
        </section>

        <div style={{ margin: "18px 0" }}>
          <Alert tone="info">
            Modifiez ici le prix, la mise en ligne et le stock d’un coloris ; « Modifier la fiche » donne accès à son nom,
            son nom arabe, sa couleur et ses 6 photos. Chaque enregistrement met la boutique à jour aussitôt. Les flèches
            changent l’ordre d’affichage sur la boutique.
          </Alert>
        </div>

        <div className="vz-variants">
          {variants.map((variant, index) => (
            <VariantEditor key={variant.id} variant={variant} first={index === 0} last={index === variants.length - 1}/>
          ))}
        </div>
      </div>
    </>
  );
}
