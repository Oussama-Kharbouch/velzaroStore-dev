'use client';
/* eslint-disable @next/next/no-img-element -- shop photos (R2) are served as they are. */
/* eslint-disable @next/next/no-html-link-for-pages -- section links are opened inside the page by the shop's click handler (store.tsx), which keeps the cart and the open panels. */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, ChevronLeft, ChevronRight, Feather, Flame, Gem, Headset, Layers, Search, ShieldCheck, Truck, Zap } from 'lucide-react';
import type { PromoCampaign } from '../../lib/promo';

type Lang = 'ar' | 'fr';
const pick = (lang: Lang, ar: string, fr: string) => (lang === 'ar' ? ar : fr);

/**
 * Black information bar above the header of the shop pages: cash on delivery, free delivery and,
 * only while a campaign runs (lib/promo.ts), the limited-time offer.
 */
export function TopInfoBar({ lang, promo }: { lang: Lang; promo: PromoCampaign | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!promo) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [promo]);
  const active = promo !== null && (promo.startAt === null || now >= promo.startAt) && now < promo.endAt;
  const hours = promo && promo.startAt !== null ? Math.round((promo.endAt - promo.startAt) / 3600000) : null;
  const items = [
    { icon: Banknote, text: pick(lang, 'الدفع عند الاستلام', 'Paiement à la livraison') },
    { icon: Truck, text: pick(lang, 'التوصيل مجاني لجميع أنحاء المغرب', 'Livraison gratuite partout au Maroc') },
    ...(active ? [{ icon: Zap, text: hours ? pick(lang, `عرض خاص لمدة ${hours} ساعة فقط`, `Offre spéciale de ${hours} h seulement`) : pick(lang, 'عرض خاص لفترة محدودة', 'Offre spéciale à durée limitée') }] : []),
  ];
  const row = (hidden: boolean) => <ul className="vz-topbar-row" aria-hidden={hidden || undefined}>
    {items.map(({ icon: Icon, text }) => <li key={text}><Icon size={16} aria-hidden="true"/><span>{text}</span></li>)}
  </ul>;
  return <div className="vz-topbar" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="region" aria-label={pick(lang, 'خدماتنا', 'Nos services')}>
    <div className="vz-topbar-track">{row(false)}{row(true)}</div>
  </div>;
}

/** Home banner: the shop photo on a dark background with a red stripe, title, three strengths and the call to action. */
export function HomeHero({ lang, image }: { lang: Lang; image: string }) {
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const perks = [
    { icon: Gem, text: pick(lang, 'تصاميم عصرية', 'Design moderne') },
    { icon: Layers, text: pick(lang, 'جودة عالية', 'Haute qualité') },
    { icon: Feather, text: pick(lang, 'راحة فائقة', 'Confort absolu') },
  ];
  return <section className="vz-hero" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-hero-title">
    <img className="vz-hero-photo" src={image} alt={pick(lang, 'شاب كيربط سبرديلة Cloudtilt', 'Un homme lace ses sneakers Cloudtilt')}/>
    <span className="vz-hero-shade" aria-hidden="true"/>
    <span className="vz-hero-stripe" aria-hidden="true"/>
    <div className="vz-hero-copy">
      <p className="vz-hero-eyebrow">VELZARO</p>
      <h1 id="vz-hero-title"><span>{pick(lang, 'أحذية عصرية', 'Des sneakers modernes')}</span><em>{pick(lang, 'لجميع الأذواق', 'pour tous les styles')}</em></h1>
      <ul className="vz-hero-perks">{perks.map(({ icon: Icon, text }) => <li key={text}><Icon size={26} strokeWidth={1.6} aria-hidden="true"/><span>{text}</span></li>)}</ul>
      <a className="vz-hero-cta" href="/boutique">{pick(lang, 'اكتشف التشكيلة', 'Découvrir la collection')}<Arrow size={20} aria-hidden="true"/></a>
    </div>
  </section>;
}

/** Four reassurance items under the banner (wording confirmed by the shop owner). */
export function TrustStrip({ lang }: { lang: Lang }) {
  const items = [
    { icon: Headset, title: pick(lang, 'دعم العملاء', 'Support client'), text: pick(lang, 'طوال الأسبوع', '7 jours sur 7') },
    { icon: Banknote, title: pick(lang, 'الدفع عند', 'Paiement à'), text: pick(lang, 'الاستلام', 'la livraison') },
    { icon: ShieldCheck, title: pick(lang, 'ضمان الجودة', 'Qualité'), text: pick(lang, '100%', 'garantie 100 %') },
    { icon: Truck, title: pick(lang, 'توصيل سريع', 'Livraison rapide'), text: pick(lang, 'لجميع المدن', 'dans toutes les villes') },
  ];
  return <ul className="vz-trust-strip" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={pick(lang, 'ضماناتنا', 'Nos engagements')}>
    {items.map(({ icon: Icon, title, text }) => <li key={title}><Icon size={30} strokeWidth={1.6} aria-hidden="true"/><span><b>{title}</b><small>{text}</small></span></li>)}
  </ul>;
}

export type CategoryTile = { id: string; label: string; image: string | null; tone: string };

/** Category tiles (men, women, offers, all) illustrated with photos of the catalogue. */
export function CategoryTiles({ lang, tiles }: { lang: Lang; tiles: CategoryTile[] }) {
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  return <nav className="vz-tiles" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={pick(lang, 'الفئات', 'Catégories')}>
    {tiles.map((tile) => <a key={tile.id} href={'/' + tile.id} className={'vz-tile tone-' + tile.tone}>
      <b>{tile.label}</b>
      {tile.image && <img src={tile.image} alt="" loading="lazy"/>}
      <span className="vz-tile-go" aria-hidden="true"><Chevron size={18}/></span>
    </a>)}
  </nav>;
}

export type SearchResult = { id: string; title: string; name: string; image: string; price: string };

/**
 * Search panel opened by the magnifier: field, suggestions (model and brand names of the catalogue)
 * and the matching colourways as you type. Enter shows every result in the shop grid.
 */
export function SearchPanel({ lang, query, onQuery, onClose, onSubmit, onPick, results, suggestions }: {
  lang: Lang; query: string; onQuery: (q: string) => void; onClose: () => void; onSubmit: () => void;
  onPick: (id: string) => void; results: SearchResult[]; suggestions: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    // Opened just under the header, wherever the page is scrolled.
    const header = document.querySelector('.main-header');
    if (header && panel.current) panel.current.style.top = Math.max(8, header.getBoundingClientRect().bottom + 8) + 'px';
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const typed = query.trim();
  return <div className="vz-search-layer" onClick={onClose}>
    <div className="vz-search-panel" ref={panel} role="dialog" aria-label={pick(lang, 'البحث', 'Recherche')} dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
      <form className="vz-search-field" role="search" onSubmit={(e) => { e.preventDefault(); if (typed) onSubmit(); }}>
        <Search size={21} aria-hidden="true"/>
        <input ref={input} type="search" value={query} onChange={(e) => onQuery(e.target.value)} enterKeyHint="search"
          placeholder={pick(lang, 'موديل، لون، ماركة…', 'Modèle, couleur, marque…')} aria-label={pick(lang, 'ابحث في المتجر', 'Rechercher dans la boutique')}/>
        <button type="button" className="vz-search-close" onClick={onClose}>{pick(lang, 'إغلاق', 'Échap')}</button>
      </form>
      {typed
        ? results.length
          ? <ul className="vz-search-results">
              {results.map((r) => <li key={r.id}><button type="button" onClick={() => onPick(r.id)}>
                <img src={r.image} alt="" loading="lazy"/><span><b>{r.title}</b><small>{r.name}</small></span><strong>{r.price}</strong>
              </button></li>)}
              <li><button type="button" className="vz-search-all" onClick={onSubmit}>{pick(lang, 'عرض كل النتائج', 'Voir tous les résultats')}</button></li>
            </ul>
          : <p className="vz-search-empty">{pick(lang, 'ما لقينا حتى موديل بهاد الاسم.', 'Aucun modèle trouvé pour cette recherche.')}</p>
        : <>
            <p className="vz-search-label">{pick(lang, 'اقتراحات', 'Suggestions')}</p>
            <div className="vz-search-chips">{suggestions.map((s) => <button type="button" key={s} onClick={() => onQuery(s)}><bdi>{s}</bdi></button>)}</div>
          </>}
    </div>
  </div>;
}

/** Section title with its "see all" link (home page best sellers). */
export function SectionHead({ lang, title, hot }: { lang: Lang; title: string; hot: boolean }) {
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return <div className="vz-section-title" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h2>{hot && <Flame size={26} aria-hidden="true"/>}<span>{title}</span></h2>
    <a href="/boutique">{pick(lang, 'عرض الكل', 'Voir tout')}<Arrow size={20} aria-hidden="true"/></a>
  </div>;
}
