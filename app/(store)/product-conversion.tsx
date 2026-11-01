'use client';
/* eslint-disable @next/next/no-img-element -- catalogue photos (R2) are served as they are. */
import { useEffect, useRef, useState, type ReactNode, type SVGProps } from 'react';
import { Banknote, ChevronDown, ChevronLeft, ChevronRight, Headset, Heart, HelpCircle, ShieldCheck, Tag, Timer, Truck, X, Zap } from 'lucide-react';
import WhatsappIcon from '../../components/whatsapp-icon';
import type { PromoCampaign } from '../../lib/promo';
import { inLang, type ComfortContent } from '../../lib/comfort';

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
    { icon: Truck, title: pick(lang, 'توصيل سريع', 'Livraison rapide'), text: pick(lang, 'لجميع المدن', 'dans toutes les villes') },
    { icon: Banknote, title: pick(lang, 'الدفع عند الاستلام', 'Paiement à la livraison'), text: pick(lang, 'كتخلص ملي توصلك', 'à la réception') },
    { icon: ShieldCheck, title: pick(lang, 'جودة مضمونة', 'Qualité garantie'), text: pick(lang, 'ضمان الجودة 100%', 'garantie 100 %') },
    { icon: Headset, title: pick(lang, 'دعم العملاء', 'Support client'), text: pick(lang, 'طوال الأسبوع', '7 jours sur 7') },
  ];
  return <ul className="vz-trust" aria-label={pick(lang, 'الضمانات', 'Nos engagements')}>
    {items.map(({ icon: Icon, title, text }) => <li key={title}><Icon size={26} strokeWidth={1.8} aria-hidden="true"/><span><b>{title}</b><small>{text}</small></span></li>)}
  </ul>;
}

/* --------------------------------------------------------- comfort section */

/**
 * "Why you will like it": the section of the model written in the dashboard (lib/comfort.ts).
 * Each card shows the photo of the chosen number of the colourway being viewed (its first photo
 * when it has fewer), so every colourway keeps its own pictures.
 */
export function ComfortSection({ lang, content, photos, name }: { lang: Lang; content: ComfortContent; photos: string[]; name: string }) {
  if (!photos.length || !content.cards.length) return null;
  const photo = (n: number) => photos[n - 1] ?? photos[0];
  return <section className="vz-section vz-comfort" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-comfort-title">
    <h2 id="vz-comfort-title" className="vz-center-title"><span>{inLang(content.title, lang)}</span></h2>
    <div className="vz-comfort-grid">
      {content.cards.map((card, i) => {
        const title = inLang(card.title, lang);
        return <article key={i}>
          <div className={'vz-comfort-photo zoom-' + card.zoom}><img src={photo(card.photo)} alt={name + (title ? ' — ' + title : '')} loading="lazy"/></div>
          <div className="vz-comfort-copy">{title && <h3>{title}</h3>}{inLang(card.text, lang) && <p>{inLang(card.text, lang)}</p>}</div>
        </article>;
      })}
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
    <h2 id="vz-reviews-title" className="vz-center-title"><span><span className="vz-wa-badge"><WhatsappIcon/></span>{pick(lang, 'آراء زبائننا على واتساب', 'Avis de nos clients sur WhatsApp')}</span></h2>
    <p className="vz-center-sub">{pick(lang, 'شاهد بعض محادثات زبائننا بعد الشراء', 'Quelques conversations de nos clients après leur achat')}</p>
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
    <h2 id="vz-faq-title" className="vz-faq-title">{pick(lang, 'الأسئلة الشائعة', 'Questions fréquentes')}<HelpCircle size={22} aria-hidden="true"/></h2>
    <div className="vz-faq-list">
      {items.map((item) => <details key={item.q}><summary>{item.q}<ChevronDown size={18} aria-hidden="true"/></summary><p>{item.a}</p></details>)}
    </div>
  </section>;
}

/* -------------------------------------------------------- related products */

export type RelatedItem = { id: string; title: string; name: string; image: string; price: string; old: string | null; discount: number | null; fav: boolean };

/** "You may also like": other models first (one colourway each), then other colourways of this model. */
export function RelatedProducts({ lang, items, onOpen, onFav }: { lang: Lang; items: RelatedItem[]; onOpen: (id: string) => void; onFav: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const scroll = (step: number) => track.current?.scrollBy({ left: step * track.current.clientWidth * 0.8, behavior: 'smooth' });
  return <section className="vz-section vz-related" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-related-title">
    <h2 id="vz-related-title" className="vz-related-title"><Tag size={22} aria-hidden="true"/>{pick(lang, 'منتجات قد تعجبك', 'Vous aimerez aussi')}</h2>
    <div className="vz-related-carousel">
      <button type="button" className="vz-carousel-arrow prev" aria-label={pick(lang, 'السابق', 'Précédent')} onClick={() => scroll(-1)}><ChevronLeft size={20}/></button>
      <div className="vz-related-track" ref={track} dir="ltr">
        {items.map((it) => <article key={it.id} className="vz-related-card" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          {it.discount !== null && <span className="vz-related-badge" dir="ltr">-{it.discount}%</span>}
          <button type="button" className="vz-related-fav" aria-label={pick(lang, 'المفضلة', 'Favoris') + ' — ' + it.title} aria-pressed={it.fav} onClick={() => onFav(it.id)}><Heart size={18} fill={it.fav ? 'currentColor' : 'none'}/></button>
          <button type="button" className="vz-related-open" onClick={() => onOpen(it.id)}>
            <span className="vz-related-photo"><img src={it.image} alt="" loading="lazy"/></span>
            <b><bdi>{it.title}</bdi></b>
            <small>{it.name}</small>
            <span className="vz-related-price"><strong>{it.price}</strong>{it.old && <del>{it.old}</del>}</span>
          </button>
        </article>)}
      </div>
      <button type="button" className="vz-carousel-arrow next" aria-label={pick(lang, 'التالي', 'Suivant')} onClick={() => scroll(1)}><ChevronRight size={20}/></button>
    </div>
  </section>;
}
