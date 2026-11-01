'use client';
/* eslint-disable @next/next/no-img-element -- catalogue photos (R2) are served as they are. */
import { useEffect, useRef, useState, type ReactNode, type SVGProps } from 'react';
import { BadgeCheck, Banknote, ChevronLeft, ChevronRight, HelpCircle, Plus, Timer, Truck, X, Zap } from 'lucide-react';
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

/* ------------------------------------------------------------- offer band */

/**
 * "Limited offer" band above the header of the Cloudtilt product pages, only while a campaign runs
 * (lib/promo.ts): time left until its end, identical for every visitor; no campaign, no band.
 */
export function PromoBar({ lang, promo }: { lang: Lang; promo: PromoCampaign | null }) {
  // Browser time, known once the page is interactive: until then the boxes show -- (no jump in the count).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!promo) return;
    // The server rendered its own time: the browser's clock takes over right after hydration.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [promo]);
  const active = promo !== null && (now === null || ((promo.startAt === null || now >= promo.startAt) && now < promo.endAt));
  const left = active && now !== null ? Math.max(0, Math.floor((promo.endAt - now) / 1000)) : null;
  const units = lang === 'ar' ? ['ساعة', 'دقيقة', 'ثانية'] : ['h', 'min', 'sec'];
  // Without a running campaign there is nothing to announce: no bar at all.
  if (!active) return null;
  const values = left === null ? [null, null, null] : [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60];
  // Black band: stopwatch, time left (hours first in the reading direction), "ends in", red "limited offer" block.
  return <div className="vz-flash" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="region" aria-label={pick(lang, 'العرض الحالي', 'Offre en cours')}>
    <Timer className="vz-flash-icon" size={26} strokeWidth={2} aria-hidden="true"/>
    <div className="vz-flash-timer" role="timer" aria-label={pick(lang, 'الوقت المتبقي للعرض', 'Temps restant avant la fin de l’offre')}>
      {values.map((value, i) => <div key={i} className="vz-flash-unit">
        {i > 0 && <i aria-hidden="true">:</i>}
        <span><b>{value === null ? '--' : String(value).padStart(2, '0')}</b><small>{units[i]}</small></span>
      </div>)}
    </div>
    <span className="vz-flash-ends">{pick(lang, 'ينتهي خلال:', 'Fin dans :')}</span>
    <strong className="vz-flash-offer"><span>{pick(lang, 'عرض محدود', 'Offre limitée')}</span><Zap size={22} fill="currentColor" strokeWidth={0} aria-hidden="true"/></strong>
  </div>;
}

/** Sneaker outline (shop category buttons), drawn like the lucide icons. */
export function SneakerIcon({ size = 20, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M2.5 17.5v-4.2c0-.6.5-1 1-1h2.3l2.4-3.4c.3-.4.9-.5 1.3-.2l1.7 1.3 1.5-1.1 1.7 1.8c1.5 1.6 3.4 2.4 5.6 2.8 1 .2 1.6 1 1.6 2v2z"/>
    <path d="M2.5 17.5h19M8.6 11.6l1.4 1M10.8 10.4l1.2 1"/>
  </svg>;
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
