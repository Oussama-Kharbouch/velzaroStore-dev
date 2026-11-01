import type { Metadata } from "next";
import AdminHeader from "../../../../components/admin/header";
import PromoEditor from "../../../../components/admin/promo-editor";
import { getPromoSetting } from "../../../../lib/admin/promo";

export const metadata: Metadata = { title: "Offre limitée" };

/** Limited-time offer: duration and models of the countdown shown on the product pages. */
export default async function PromoPage() {
  const { setting, models, saved } = await getPromoSetting();
  return (
    <>
      <AdminHeader eyebrow="Boutique" title="Offre limitée"/>
      <div className="ad-content">
        <section className="ad-panel" aria-labelledby="vz-promo-title">
          <div className="ad-panel-head">
            <div>
              <h2 id="vz-promo-title">Bandeau « عرض محدود » et compte à rebours</h2>
              <p>Pendant l’offre, les fiches produit choisies affichent le bandeau avec le temps restant, et la barre noire de la boutique annonce l’offre. Tous les clients voient la même fin. À la fin, tout disparaît seul.</p>
            </div>
          </div>
          <div className="ad-panel-body">
            {!saved && <p className="vz-promo-hint">Aucune offre n’a encore été réglée ici : la boutique utilise les anciennes variables du serveur (VZ_PROMO_START_AT / VZ_PROMO_END_AT) s’il y en a. Le premier enregistrement les remplace.</p>}
            <PromoEditor setting={setting} models={models}/>
          </div>
        </section>
      </div>
    </>
  );
}
