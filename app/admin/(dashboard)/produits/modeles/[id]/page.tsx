import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { EmptyState } from "../../../../../../components/admin/bits";
import AdminHeader from "../../../../../../components/admin/header";
import ModelEditor from "../../../../../../components/admin/model-editor";
import { categoryLabel } from "../../../../../../lib/catalog-categories";
import { formatDH } from "../../../../../../lib/admin/format";
import { listCatalog, listModels, type CatalogVariant } from "../../../../../../lib/admin/queries";
import { numericId } from "../../../../../../lib/admin/respond";
import { ADMIN_PATH } from "../../../../../../lib/site";

export const metadata: Metadata = { title: "Modèle" };

/** Stock of a colourway in a few words: "Non suivi", "12 paires", "3 paires · 2 pointures épuisées". */
const stockSummary = (v: CatalogVariant) => {
  const tracked = v.sizes.filter((s) => s.stock !== null);
  if (!tracked.length) return { text: "Stock non suivi", tone: "" };
  const pairs = tracked.reduce((sum, s) => sum + (s.stock ?? 0), 0);
  const out = tracked.filter((s) => s.stock === 0).length;
  if (pairs === 0 && tracked.length === v.sizes.length) return { text: "Épuisé", tone: " is-out" };
  return { text: `${pairs} paire${pairs > 1 ? "s" : ""}${out ? ` · ${out} pointure${out > 1 ? "s" : ""} épuisée${out > 1 ? "s" : ""}` : ""}`, tone: out ? " is-low" : "" };
};

/** One model (Cloudtilt, Cloudsurfer Max…): its colourways as rows; a row opens the colourway form. */
export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const id = numericId((await params).id);
  if (id === null) notFound();
  const [models, catalog] = await Promise.all([listModels(), listCatalog()]);
  const model = models.find((m) => m.id === id);
  if (!model) notFound();
  const rows = catalog.filter((v) => v.productId === id);
  const online = rows.filter((v) => v.active).length;
  const sold = rows.reduce((sum, v) => sum + v.sold, 0);

  return (
    <>
      <AdminHeader eyebrow={model.brand ? `Modèle · ${model.brand}` : "Modèle"} title={model.name}>
        <Link className="ad-btn ad-btn-primary" href={`${ADMIN_PATH}/produits/nouveau?modele=${model.id}`}><Plus/> Ajouter un coloris</Link>
      </AdminHeader>

      <div className="ad-content">
        <Link className="ad-back" href={`${ADMIN_PATH}/produits`}><ArrowLeft/> Retour aux produits</Link>

        <section className="ad-panel vz-product">
          <div>
            <p className="vz-product-eyebrow">Modèle{model.brand ? ` · ${model.brand}` : ""}</p>
            <h2>{model.name}</h2>
            <p>{rows.length} coloris · {online} en ligne · {sold} paire{sold > 1 ? "s" : ""} vendue{sold > 1 ? "s" : ""}</p>
          </div>
          <ModelEditor id={model.id} name={model.name} brand={model.brand}/>
        </section>

        <section className="ad-panel vz-model-rows-panel" aria-labelledby="vz-rows-title">
          <div className="ad-panel-head">
            <div>
              <h2 id="vz-rows-title">Coloris de {model.name}</h2>
              <p>Cliquez sur une ligne pour ouvrir la fiche du coloris : nom, genre, couleur, photos, prix et stock.</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Aucun coloris pour ce modèle">Ajoutez son premier coloris avec « Ajouter un coloris ».</EmptyState>
          ) : (
            <ul className="vz-model-rows">
              {rows.map((v) => {
                const stock = stockSummary(v);
                return (
                  <li key={v.id}>
                    <Link className={`vz-model-row${v.active ? "" : " is-hidden"}`} href={`${ADMIN_PATH}/produits/${v.id}`} aria-label={`Ouvrir la fiche ${model.name} ${v.name}`}>
                      <span className="vz-model-row-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element -- vignette du catalogue. */}
                        {v.image && <img src={v.image} alt=""/>}
                      </span>
                      <span className="vz-model-row-main">
                        <strong><span className="vz-swatch" style={{ background: v.hex }} aria-hidden="true"/>{v.name}</strong>
                        <small><span className="vz-model-row-hex">{v.hex}</span> · {categoryLabel(model.brand, v.gender)}</small>
                      </span>
                      <span className="vz-model-row-price">
                        <strong>{formatDH(v.price)}</strong>
                        {v.oldPrice !== null && v.oldPrice > v.price && <del>{formatDH(v.oldPrice)}</del>}
                      </span>
                      <span className={`vz-model-row-stock${stock.tone}`}>{stock.text}</span>
                      <span className={`vz-model-row-status${v.active ? " is-on" : ""}`}>{v.active ? "En ligne" : "Masqué"}</span>
                      <ChevronRight className="vz-model-row-go" aria-hidden="true"/>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
