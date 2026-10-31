'use client';
import { useEffect, useState } from 'react';
import { Check, CreditCard, Truck, Wind, Feather, Footprints, ChevronRight, MessageCircle } from 'lucide-react';

/**
 * Configure a genuine 48-hour campaign end timestamp in Cloudflare build variables,
 * e.g. NEXT_PUBLIC_VZ_PROMO_END_AT=2026-11-02T18:00:00+01:00.
 * Never start a visitor-specific fake countdown.
 */
const PROMO_END = process.env.NEXT_PUBLIC_VZ_PROMO_END_AT || '';

/**
 * Add only customer-approved, redacted screenshot URLs here. Never republish
 * screenshots from a competing shop as if they came from VELZARO clients.
 * Example after approval: '/reviews/verified-whatsapp-01.webp'
 */
export const verifiedWhatsappScreenshots: string[] = [];

export function ConversionPromoBar({ lang }: { lang: 'ar' | 'fr' }) {
  return <div className="vz-promo-top" dir={lang==='ar'?'rtl':'ltr'}>
    <strong>{lang==='ar'?'🔥 عرض خاص على Cloudtlite':'🔥 Offre spéciale Cloudtlite'}</strong>
    <span>{lang==='ar'?'🚚 التوصيل مجاني + الدفع عند الاستلام':'🚚 Livraison gratuite · Paiement à la réception'}</span>
  </div>;
}

export function RealCountdown({ lang }: { lang: 'ar' | 'fr' }) {
  const [remaining,setRemaining] = useState<number|null>(null);
  useEffect(() => {
    const deadline = Date.parse(PROMO_END);
    if (!PROMO_END || !Number.isFinite(deadline)) return;
    const update=()=>setRemaining(Math.max(0, Math.floor((deadline-Date.now())/1000)));
    const frame=requestAnimationFrame(update);
    const interval=setInterval(update,1000);
    return ()=>{cancelAnimationFrame(frame);clearInterval(interval);};
  }, []);
  if (remaining===null || remaining<=0) return null;
  const hours=Math.floor(remaining/3600);
  const minutes=Math.floor((remaining%3600)/60);
  const seconds=remaining%60;
  const labels=lang==='ar'?['ساعة','دقيقة','ثانية']:['Heures','Minutes','Secondes'];
  return <div className="vz-countdown" aria-label={lang==='ar'?'الوقت المتبقي للعرض':'Temps restant pour la promotion'} dir={lang==='ar'?'rtl':'ltr'}>
    <strong>{lang==='ar'?'⏱️ العرض ينتهي خلال':'⏱️ Offre valable encore'}</strong>
    <div className="vz-countdown-grid">{[hours,minutes,seconds].map((value,index)=><div key={labels[index]}><b>{String(value).padStart(2,'0')}</b><span>{labels[index]}</span></div>)}</div>
  </div>;
}

export function ProductSellingPoints({ lang, cloudtilt }: {lang:'ar'|'fr';cloudtilt:boolean}) {
  return <section className="vz-selling-points" dir={lang==='ar'?'rtl':'ltr'} aria-label={lang==='ar'?'مميزات المنتج':'Atouts du produit'}>
    <h2>{lang==='ar'?'علاش غادي تعجبك هاد السبرديلة؟':'Pourquoi choisir cette paire ?'}</h2>
    <div className="vz-perks">
      <div><Wind size={22}/><b>{lang==='ar'?'نسيج شبكي':'Maille textile'}</b><span>{lang==='ar'?'تصميم كيساعد على التهوية':'Tige aérée pour un usage quotidien'}</span></div>
      <div><Footprints size={22}/><b>{lang==='ar'?'ستايل مريح':'Confort au quotidien'}</b><span>{lang==='ar'?'نعل بتصميم مناسب للمشي اليومي':'Semelle au profil sculpté pour la marche'}</span></div>
      <div><Feather size={22}/><b>{lang==='ar'?'ستايل عصري':'Style polyvalent'}</b><span>{lang==='ar'?'كتجي مع اللوك الكاجوال والسبور':'Avec vos tenues décontractées'}</span></div>
    </div>
    {cloudtilt && <p className="vz-product-copy">{lang==='ar'?'Cloudtlite — Original: تصميم عصري، نسيج شبكي ونعل بارز. شوف الصور الحقيقية للمنتج واختار اللون والمقاس اللي يناسبك.':'Cloudtlite — Original : silhouette moderne, textile en maille et semelle sculptée. Consultez les photos du coloris choisi pour bien voir les détails.'}</p>}
    <div className="vz-delivery-bar">
      <span><Truck size={21}/><b>{lang==='ar'?'التوصيل مجاني':'Livraison gratuite'}</b></span>
      <span><CreditCard size={21}/><b>{lang==='ar'?'الدفع عند الاستلام':'Paiement à la livraison'}</b></span>
      <span><Check size={21}/><b>{lang==='ar'?'تأكيد الطلب':'Confirmation de commande'}</b></span>
    </div>
  </section>;
}

export function CustomerWhatsAppGallery({ lang }: { lang:'ar'|'fr' }) {
  return <section className="vz-reviews" dir={lang==='ar'?'rtl':'ltr'} aria-labelledby="vz-reviews-title">
    <div className="vz-reviews-heading">
      <span className="vz-review-icon"><MessageCircle size={22}/></span>
      <div><h2 id="vz-reviews-title">{lang==='ar'?'رسائل الزبناء على واتساب':'Messages WhatsApp des clients'}</h2>
      <p>{lang==='ar'?'آراء حقيقية من الزبناء ديالنا':'Des échanges authentiques avec nos clients'}</p></div>
    </div>
    {verifiedWhatsappScreenshots.length ? (
      <div className="vz-review-gallery" aria-label={lang==='ar'?'صور رسائل الزبناء':'Captures des messages clients'}>
        {verifiedWhatsappScreenshots.map((src,i)=><a key={src} href={src} target="_blank" rel="noopener noreferrer" aria-label={(lang==='ar'?'تكبير رسالة الزبون ':'Agrandir le message client ')+(i+1)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} loading="lazy" alt={(lang==='ar'?'رسالة واتساب حقيقية من زبون رقم ':'Capture WhatsApp client n°')+(i+1)}/>
          <span><ChevronRight size={16}/>{lang==='ar'?'تكبير':'Agrandir'}</span>
        </a>)}
      </div>
    ) : <p className="vz-review-empty">{lang==='ar'?'غادي تظهر هنا رسائل الزبناء الحقيقيين من بعد الموافقة على نشرها.':'Les captures de messages clients vérifiées apparaîtront ici après autorisation.'}</p>}
  </section>;
}
