'use client';
/* eslint-disable @next/next/no-img-element -- catalogue photos (R2) are served as they are. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Banknote, ChevronLeft, ChevronRight, HelpCircle, Plus, Truck, X } from 'lucide-react';
import WhatsappIcon from '../../components/whatsapp-icon';
import type { PromoCampaign } from '../../lib/promo';

type Lang = 'ar' | 'fr';
const pick = (lang: Lang, ar: string, fr: string) => (lang === 'ar' ? ar : fr);

/**
 * Customer WhatsApp screenshots, shown on the product pages only once the customer agreed to it,
 * with name, number and any private detail hidden (e.g. '/reviews/client-01.webp').
 * Empty list: the section is not shown at all. Never put example or other shops' screenshots here.
 */
export const verifiedWhatsappScreenshots: string[] = [];

/** Delivery and exchange conditions, as stated by the shop (product page and FAQ). */
const DELIVERY_DELAY: { ar: string; fr: string } = { ar: 'خلال 24 حتى 72 ساعة', fr: 'sous 24 à 72 h' };
const EXCHANGE_DAYS = 7;

/* ------------------------------------------------------------------ red bar */

/**
 * Red bar above the header of the product pages. With a running campaign (lib/promo.ts): the offer
 * and its countdown, identical for every visitor; otherwise only free delivery and cash on delivery.
 */
export function PromoBar({ lang, promo }: { lang: Lang; promo: PromoCampaign | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!promo) return;
    // The server rendered its own time: the browser's clock takes over at the first frame.
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => { cancelAnimationFrame(first); clearInterval(id); };
  }, [promo]);
  const active = promo !== null && (promo.startAt === null || now >= promo.startAt) && now < promo.endAt;
  const left = active ? Math.max(0, Math.floor((promo.endAt - now) / 1000)) : 0;
  const hours = promo && promo.startAt !== null ? Math.round((promo.endAt - promo.startAt) / 3600000) : null;
  const units = lang === 'ar' ? ['ساعة', 'دقيقة', 'ثانية'] : ['heures', 'min', 'sec'];
  return <div className="vz-promo" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="region" aria-label={pick(lang, 'العرض الحالي', 'Offre en cours')}>
    {active && <strong className="vz-promo-offer">{hours
      ? pick(lang, `🔥 عرض خاص لمدة ${hours} ساعة فقط`, `🔥 Offre spéciale de ${hours} h seulement`)
      : pick(lang, '🔥 عرض خاص لفترة محدودة', '🔥 Offre spéciale à durée limitée')}</strong>}
    <span className="vz-promo-delivery">{pick(lang, '🚚 التوصيل مجاني لجميع أنحاء المغرب + الدفع عند الاستلام', '🚚 Livraison gratuite partout au Maroc + paiement à la livraison')}</span>
    {active && <div className="vz-promo-timer" dir="ltr" role="timer" aria-label={pick(lang, 'الوقت المتبقي للعرض', 'Temps restant avant la fin de l’offre')}>
      {[Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map((value, i) => <div key={i}>
        <b suppressHydrationWarning>{String(value).padStart(2, '0')}</b><small>{units[i]}</small>
      </div>)}
    </div>}
  </div>;
}

/* ------------------------------------------------------------ trust badges */

export function TrustBadges({ lang }: { lang: Lang }) {
  const items = [
    { icon: Truck, title: pick(lang, 'التوصيل مجاني', 'Livraison gratuite'), text: pick(lang, 'لجميع أنحاء المغرب', 'partout au Maroc') },
    { icon: Banknote, title: pick(lang, 'الدفع عند الاستلام', 'Paiement à la livraison'), text: pick(lang, 'كتخلص ملي توصلك', 'à la réception') },
    { icon: BadgeCheck, title: pick(lang, 'تأكيد الطلب', 'Commande confirmée'), text: pick(lang, 'كنتواصلو معاك قبل الإرسال', 'avec vous avant l’envoi') },
  ];
  return <ul className="vz-trust" aria-label={pick(lang, 'الضمانات', 'Nos engagements')}>
    {items.map(({ icon: Icon, title, text }) => <li key={title}><Icon size={22} aria-hidden="true"/><span><b>{title}</b><small>{text}</small></span></li>)}
  </ul>;
}

/* --------------------------------------------------------- comfort section */

/**
 * Four photo cards built from the colourway's own photos (sole, upper, top view, whole shoe).
 * Gallery order of the catalogue: 1 pair, 2 profile, 3 top, 4 sole… (lib/catalog.mjs galleryLabels);
 * a colourway with fewer photos uses its first one.
 */
export function ComfortSection({ lang, photos, name }: { lang: Lang; photos: string[]; name: string }) {
  const photo = (i: number) => photos[i] ?? photos[0];
  const cards = [
    { img: photo(3), zoom: 'sole', title: pick(lang, 'راحة فالمشي', 'Confort de marche'), text: pick(lang, 'تصميم النعل البارز كيعطي للسبرديلة مظهر عصري مناسب للمشي اليومي.', 'Une semelle au profil sculpté, au look moderne, pour la marche au quotidien.') },
    { img: photo(1), zoom: 'mesh', title: pick(lang, 'قماش خفيف ومهوّي', 'Tissu léger et aéré'), text: pick(lang, 'النسيج الشبكي Mesh كيساعد على التهوية وكيعطي إحساس بالخفة.', 'La maille (mesh) aide à l’aération et donne une sensation de légèreté.') },
    { img: photo(2), zoom: 'top', title: pick(lang, 'سهلة فاللبسة', 'Facile à porter'), text: pick(lang, 'تصميم عملي وتفاصيل مدروسة للاستعمال اليومي.', 'Un design pratique et des finitions soignées pour tous les jours.') },
    { img: photo(0), zoom: 'style', title: pick(lang, 'ستايل عصري', 'Style moderne'), text: pick(lang, 'كتجي مع الجينز واللوك الكاجوال والسبور.', 'S’associe au jean et aux tenues casual ou sport.') },
  ];
  if (!photos.length) return null;
  return <section className="vz-section vz-comfort" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-comfort-title">
    <h2 id="vz-comfort-title">{pick(lang, 'علاش غادي تعجبك هاد السبرديلة؟', 'Pourquoi vous allez l’adorer ?')}</h2>
    <div className="vz-comfort-grid">
      {cards.map((card) => <article key={card.zoom}>
        <div className={'vz-comfort-photo zoom-' + card.zoom}><img src={card.img} alt={name + ' — ' + card.title} loading="lazy"/></div>
        <div className="vz-comfort-copy"><h3>{card.title}</h3><p>{card.text}</p></div>
      </article>)}
    </div>
  </section>;
}

/* ------------------------------------------------- WhatsApp screenshots */

export function WhatsAppReviews({ lang }: { lang: Lang }) {
  const track = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const shots = verifiedWhatsappScreenshots;
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % shots.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + shots.length) % shots.length));
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; removeEventListener('keydown', onKey); };
  }, [open, shots.length]);
  if (!shots.length) return null;
  const scroll = (step: number) => track.current?.scrollBy({ left: step * track.current.clientWidth * 0.8, behavior: 'smooth' });
  return <section className="vz-section vz-reviews" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-reviews-title">
    <div className="vz-section-head">
      <span className="vz-wa-badge"><WhatsappIcon/></span>
      <div><h2 id="vz-reviews-title">{pick(lang, 'رسائل الزبناء على واتساب', 'Messages de nos clients sur WhatsApp')}</h2>
        <p>{pick(lang, 'شوف تجارب الزبناء ديالنا.', 'Découvrez l’expérience de nos clients.')}</p></div>
    </div>
    <div className="vz-reviews-carousel">
      <button type="button" className="vz-carousel-arrow prev" aria-label={pick(lang, 'السابق', 'Précédent')} onClick={() => scroll(-1)}><ChevronLeft size={20}/></button>
      <div className="vz-reviews-track" ref={track} dir="ltr">
        {shots.map((src, i) => <button type="button" key={src} onClick={() => setOpen(i)} aria-label={pick(lang, 'تكبير رسالة الزبون ', 'Agrandir le message client ') + (i + 1)}>
          <img src={src} alt={pick(lang, 'رسالة واتساب من زبون ', 'Message WhatsApp client ') + (i + 1)} loading="lazy"/>
        </button>)}
      </div>
      <button type="button" className="vz-carousel-arrow next" aria-label={pick(lang, 'التالي', 'Suivant')} onClick={() => scroll(1)}><ChevronRight size={20}/></button>
    </div>
    {open !== null && <div className="vz-lightbox" role="dialog" aria-modal="true" aria-label={pick(lang, 'رسالة الزبون', 'Message client')} onClick={() => setOpen(null)}>
      <button type="button" className="vz-lightbox-close" aria-label={pick(lang, 'إغلاق', 'Fermer')} onClick={() => setOpen(null)}><X size={24}/></button>
      <img src={shots[open]} alt="" onClick={(e) => e.stopPropagation()}/>
      {shots.length > 1 && <>
        <button type="button" className="vz-carousel-arrow prev" aria-label={pick(lang, 'السابق', 'Précédent')} onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + shots.length) % shots.length); }}><ChevronLeft size={22}/></button>
        <button type="button" className="vz-carousel-arrow next" aria-label={pick(lang, 'التالي', 'Suivant')} onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % shots.length); }}><ChevronRight size={22}/></button>
      </>}
    </div>}
  </section>;
}

/* --------------------------------------------------------------------- FAQ */

export function ProductFaq({ lang, whatsappHref }: { lang: Lang; whatsappHref: string | null }) {
  const contact = whatsappHref
    ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer">{pick(lang, 'تواصل معانا على واتساب', 'Écrivez-nous sur WhatsApp')}</a>
    : null;
  const items: { q: string; a: ReactNode }[] = [
    { q: pick(lang, 'هل التوصيل مجاني؟', 'La livraison est-elle gratuite ?'), a: pick(lang, 'نعم، التوصيل مجاني لجميع أنحاء المغرب.', 'Oui, la livraison est gratuite partout au Maroc.') },
    { q: pick(lang, 'واش نخلص قبل ما توصلني الطلبية؟', 'Dois-je payer avant de recevoir ma commande ?'), a: pick(lang, 'لا، كتخلص غير ملي توصلك الطلبية.', 'Non, vous payez uniquement à la réception de votre commande.') },
    { q: pick(lang, 'كيفاش نختار القياس المناسب؟', 'Comment choisir ma pointure ?'), a: <>{pick(lang, 'اختار القياس اللي كتلبس عادة، وإلى كنتي متردد تواصل معانا.', 'Choisissez votre pointure habituelle ; en cas de doute, contactez-nous.')}{contact && <> {contact}</>}</> },
    { q: pick(lang, 'شحال كتحتاج الطلبية باش توصل؟', 'Quel est le délai de livraison ?'), a: pick(lang, `كتوصلك الطلبية عادة ${DELIVERY_DELAY.ar} من بعد تأكيد الطلب.`, `Votre commande arrive en général ${DELIVERY_DELAY.fr} après sa confirmation.`) },
    { q: pick(lang, 'واش يمكن نبدل القياس؟', 'Puis-je échanger la pointure ?'), a: <>{pick(lang, `إيه، تقدر تبدل القياس خلال ${EXCHANGE_DAYS} أيام من الاستلام.`, `Oui, l’échange est possible sous ${EXCHANGE_DAYS} jours après réception.`)}{contact && <> {contact}</>}</> },
  ];
  return <section className="vz-section vz-faq" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-faq-title">
    <div className="vz-section-head"><span className="vz-faq-badge"><HelpCircle size={22}/></span><h2 id="vz-faq-title">{pick(lang, 'الأسئلة الشائعة', 'Questions fréquentes')}</h2></div>
    <div className="vz-faq-list">
      {items.map((item) => <details key={item.q}><summary>{item.q}<Plus size={18} aria-hidden="true"/></summary><p>{item.a}</p></details>)}
    </div>
  </section>;
}
