import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Alert, EmptyState } from "../../../../components/admin/bits";
import AdminHeader from "../../../../components/admin/header";
import ModelCard from "../../../../components/admin/model-card";
import ModelCreate from "../../../../components/admin/model-create";
import VariantEditor from "../../../../components/admin/variant-editor";
import VariantOrder from "../../../../components/admin/variant-order";
import { CATEGORY_FILTERS, categoryLabel, isCategoryFilter, type CategoryFilter } from "../../../../lib/catalog-categories";
import { listCatalog, listModels, type CatalogVariant } from "../../../../lib/admin/queries";
import { ADMIN_PATH } from "../../../../lib/site";

export const metadata: Metadata = { title: "Produits" };

type Params = Promise<{ categorie?: string; statut?: string }>;
const STATUS_FILTERS = { "en-ligne": "En ligne", masques: "Masqués" } as const;
type StatusFilter = keyof typeof STATUS_FILTERS;
const isStatusFilter = (value: unknown): value is StatusFilter => typeof value === "string" && value in STATUS_FILTERS;

const inCategory = (v: CatalogVariant, c: CategoryFilter) => (c === "non-classe" ? v.gender === null : v.gender === c);
const inStatus = (v: CatalogVariant, s: StatusFilter) => (s === "en-ligne" ? v.active : !v.active);

export default async function ProductsPage({ searchParams }: { searchParams: Params }) {
  const raw = await searchParams;
  const category = isCategoryFilter(raw.categorie) ? raw.categorie : undefined;
  const status = isStatusFilter(raw.statut) ? raw.statut : undefined;

  const [variants, models] = await Promise.all([listCatalog(), listModels()]);
  const brandOf = new Map(models.map((m) => [m.id, m.brand]));
  // Filter labels carry the brand only when every model has the same one (On Homme); otherwise Homme.
  const brand = new Set(models.map((m) => m.brand)).size === 1 ? models[0]?.brand ?? null : null;
  const unclassified = variants.filter((v) => v.gender === null).length;

  // Counts of each category follow the status filter, and the other way round.
  const byStatus = status ? variants.filter((v) => inStatus(v, status)) : variants;
  const byCategory = category ? variants.filter((v) => inCategory(v, category)) : variants;
  const shown = byCategory.filter((v) => !status || inStatus(v, status));
  const href = (next: { categorie?: string; statut?: string }) => {
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `${ADMIN_PATH}/produits${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <AdminHeader eyebrow="Catalogue" title="Produits">
        <a className="ad-btn" href="/" target="_blank" rel="noopener"><ExternalLink/> Voir la boutique</a>
        <Link className="ad-btn ad-btn-primary" href={`${ADMIN_PATH}/produits/nouveau`}><Plus/> Ajouter un coloris</Link>
      </AdminHeader>

      <div className="ad-content">
        <section className="ad-panel vz-models" aria-labelledby="vz-models-title">
          <div className="ad-panel-head">
            <div>
              <h2 id="vz-models-title">Modèles</h2>
              <p>Cliquez sur un modèle pour voir ses coloris, en ajouter ou en modifier un.</p>
            </div>
            <ModelCreate/>
          </div>
          <ul className="vz-model-cards">
            {models.map((model) => {
              const own = variants.filter((v) => v.productId === model.id);
              const sold = own.reduce((sum, v) => sum + v.sold, 0);
              return (
                <li key={model.id}>
                  <ModelCard id={model.id} name={model.name} brand={model.brand} images={own.map((v) => v.image)}
                    summary={`${own.length} coloris · ${own.filter((v) => v.active).length} en ligne · ${sold} paire${sold > 1 ? "s" : ""} vendue${sold > 1 ? "s" : ""}`}/>
                </li>
              );
            })}
          </ul>
        </section>

        <div style={{ margin: "18px 0" }}>
          <Alert tone="info">
            Modifiez ici le prix, la mise en ligne, le stock et la catégorie d’un coloris ; « Modifier la fiche » donne accès à
            son nom, son nom arabe, sa couleur et ses photos. Chaque enregistrement met la boutique à jour aussitôt.
            L’ordre d’affichage sur la boutique se règle dans « Ordre sur la boutique » ci-dessous.
            {unclassified > 0 && <> <strong>{unclassified} coloris non classé{unclassified > 1 ? "s" : ""}</strong> : choisissez leur catégorie
              ({categoryLabel(brand, "homme")}, {categoryLabel(brand, "femme")} ou Unisexe) — rien n’est classé automatiquement.</>}
          </Alert>
        </div>

        <VariantOrder variants={variants}/>

        <nav className="vz-filters" aria-label="Filtrer les coloris">
          <div className="vz-filter-group" role="group" aria-label="Catégorie">
            <Link href={href({ statut: status })} className={`vz-chip${category ? "" : " is-active"}`} aria-current={category ? undefined : "true"}>
              Toutes <span>{byStatus.length}</span>
            </Link>
            {CATEGORY_FILTERS.map((c) => (
              <Link key={c} href={href({ categorie: c, statut: status })} className={`vz-chip${category === c ? " is-active" : ""}`}
                aria-current={category === c ? "true" : undefined}>
                {c === "non-classe" ? "Non classés" : categoryLabel(brand, c)} <span>{byStatus.filter((v) => inCategory(v, c)).length}</span>
              </Link>
            ))}
          </div>
          <div className="vz-filter-group" role="group" aria-label="Statut">
            <Link href={href({ categorie: category })} className={`vz-chip${status ? "" : " is-active"}`} aria-current={status ? undefined : "true"}>
              Tous les statuts
            </Link>
            {(Object.keys(STATUS_FILTERS) as StatusFilter[]).map((s) => (
              <Link key={s} href={href({ categorie: category, statut: s })} className={`vz-chip${status === s ? " is-active" : ""}`}
                aria-current={status === s ? "true" : undefined}>
                {STATUS_FILTERS[s]} <span>{byCategory.filter((v) => inStatus(v, s)).length}</span>
              </Link>
            ))}
          </div>
        </nav>

        {shown.length === 0 ? (
          <EmptyState title="Aucun coloris dans ce filtre">Choisissez une autre catégorie ou retirez les filtres.</EmptyState>
        ) : (
          <div className="vz-variants">
            {shown.map((variant) => (
              <VariantEditor key={variant.id} variant={variant} brand={brandOf.get(variant.productId) ?? null}/>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
