'use client';
/* eslint-disable @next/next/no-img-element -- shop photos (R2) are served as they are. */
/* eslint-disable @next/next/no-html-link-for-pages -- section links are opened inside the page by the shop's click handler (store.tsx), which keeps the cart and the open panels. */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowRight, Banknote, ChevronLeft, ChevronRight, Flame, Headset, LayoutGrid, Search, ShieldCheck, Truck, X, Zap } from 'lucide-react';
import WhatsappIcon from '../../components/whatsapp-icon';
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

/** On/off language switch (FR ○ العربية), in the header on computers and in the menu on phones. */
export function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return <div className="language-control">
    <span className={lang === 'fr' ? 'current' : ''}>FR</span>
    <button type="button" className="language-switch" role="switch" aria-checked={lang === 'ar'} aria-label="العربية / Français" onClick={() => onChange(lang === 'fr' ? 'ar' : 'fr')}><span/></button>
    <span lang="ar" dir="rtl" className={'language-arabic ' + (lang === 'ar' ? 'current' : '')}>العربية</span>
  </div>;
}

/**
 * Home banner: the photo of the athlete lacing his shoes (he stays on the left of the picture),
 * the title and the call to action on the dark wall on the right.
 */
export function HomeHero({ lang, image }: { lang: Lang; image: string }) {
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return <section className="vz-hero" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="vz-hero-title">
    <img className="vz-hero-photo" src={image} alt={pick(lang, 'رياضي كيربط سبرديلتو', 'Un sportif lace ses baskets')} fetchPriority="high"/>
    <span className="vz-hero-shade" aria-hidden="true"/>
    <div className="vz-hero-copy">
      <h1 id="vz-hero-title"><span>{pick(lang, 'أداء عالي', 'Performance')}</span><em>{pick(lang, 'بدون تنازل', 'sans compromis')}</em></h1>
      <p>{pick(lang, 'اكتشف تشكيلتنا من الأحذية الرياضية التي تجمع بين الراحة والأناقة والابتكار.', 'Découvrez notre sélection de baskets alliant confort, style et innovation.')}</p>
      <a className="vz-hero-cta" href="/boutique">{pick(lang, 'تسوق الآن', 'Acheter maintenant')}<Arrow size={19} aria-hidden="true"/></a>
    </div>
  </section>;
}

/** Four reassurance items under the banner (wording confirmed by the shop owner). */
export function TrustStrip({ lang }: { lang: Lang }) {
  const items = [
    { icon: Truck, title: pick(lang, 'توصيل سريع', 'Livraison rapide'), text: pick(lang, 'لجميع المدن', 'dans toutes les villes') },
    { icon: ShieldCheck, title: pick(lang, 'ضمان الجودة', 'Qualité'), text: pick(lang, '100%', 'garantie 100 %') },
    { icon: Banknote, title: pick(lang, 'الدفع عند', 'Paiement à'), text: pick(lang, 'الاستلام', 'la livraison') },
    { icon: Headset, title: pick(lang, 'دعم العملاء', 'Support client'), text: pick(lang, 'طوال الأسبوع', '7 jours sur 7') },
  ];
  return <ul className="vz-trust-strip" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={pick(lang, 'ضماناتنا', 'Nos engagements')}>
    {items.map(({ icon: Icon, title, text }) => <li key={title}><Icon size={30} strokeWidth={1.5} aria-hidden="true"/><span><b>{title}</b><small>{text}</small></span></li>)}
  </ul>;
}

/* Category pictograms (line drawings, not product photos). */
const ManIcon = () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M22.5 22.5c0-6.6 4.3-11 9.5-11s9.5 4.4 9.5 11c0 6.8-4.2 12.5-9.5 12.5s-9.5-5.7-9.5-12.5Z"/>
  <path d="M23 18.5c2.5-4.2 6.2-6.5 10.5-5.8 3.3.5 6 2.6 7.6 5.8"/>
  <path d="M12 56c0-9.6 5.8-15 13-17l7 6 7-6c7.2 2 13 7.4 13 17"/>
</svg>;
const WomanIcon = () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M23.5 24c0-6.5 3.8-10.5 8.5-10.5s8.5 4 8.5 10.5c0 6.3-3.8 11-8.5 11s-8.5-4.7-8.5-11Z"/>
  <path d="M21 36c-2.5-4-3.2-9-2.6-14.5C19.4 13 25 8 32 8s12.6 5 13.6 13.5c.6 5.5-.1 10.5-2.6 14.5"/>
  <path d="M24.5 21c4.5-.4 9-2.6 11.5-6.5 1.2 2.7 2.7 4.8 4.5 6"/>
  <path d="M12 57c.5-9 5.6-14.5 12.5-16.6L32 46l7.5-5.6C46.4 42.5 51.5 48 52 57"/>
</svg>;
const OfferIcon = () => <svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M33 9h17.5a4.5 4.5 0 0 1 4.5 4.5V31a4.5 4.5 0 0 1-1.3 3.2L32.2 55.7a4.5 4.5 0 0 1-6.4 0L8.3 38.2a4.5 4.5 0 0 1 0-6.4L29.8 10.3A4.5 4.5 0 0 1 33 9Z" fill="#e50924"/>
  <circle cx="45" cy="19" r="3.6" fill="#fff"/>
  <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round"><path d="m23 41 14-14"/><circle cx="24.5" cy="29.5" r="3"/><circle cx="35.5" cy="40.5" r="3"/></g>
  <g stroke="#e50924" strokeWidth="2.6" strokeLinecap="round"><path d="M56 6.5 59 3"/><path d="M60 13h3.5"/><path d="M49.5 3.5 50 0"/></g>
</svg>;
const tileIcons = { homme: ManIcon, femme: WomanIcon, promotions: OfferIcon };

export type CategoryTile = { id: keyof typeof tileIcons; label: string; tone: string; image?: string };

/* Red gift box with its ribbon and a "%" tag: picture of the offers tile (drawn, sharp at every size). */
const GiftArt = () => <svg className="vz-tile-gift" viewBox="0 0 160 140" aria-hidden="true">
  <defs>
    <linearGradient id="vz-gift-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#e9e4e4"/></linearGradient>
    <linearGradient id="vz-gift-ribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff3048"/><stop offset="1" stopColor="#b8001a"/></linearGradient>
  </defs>
  <ellipse cx="74" cy="128" rx="58" ry="8" fill="#5a0010" opacity=".35"/>
  <rect x="26" y="60" width="96" height="66" rx="5" fill="url(#vz-gift-box)"/>
  <rect x="18" y="44" width="112" height="22" rx="5" fill="#fff"/>
  <rect x="64" y="44" width="20" height="82" fill="url(#vz-gift-ribbon)"/>
  <path d="M74 44c-6-16-30-26-36-12-5 11 16 14 36 12Z" fill="url(#vz-gift-ribbon)"/>
  <path d="M74 44c6-16 30-26 36-12 5 11-16 14-36 12Z" fill="url(#vz-gift-ribbon)"/>
  <circle cx="74" cy="44" r="6" fill="#c4001b"/>
  <g transform="rotate(-18 128 92)">
    <path d="M112 74h26a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6h-26l-12-19Z" fill="#fff"/>
    <circle cx="108" cy="93" r="3" fill="#e50924"/>
    <text x="126" y="101" textAnchor="middle" fontSize="22" fontWeight="800" fill="#e50924" fontFamily="Arial, sans-serif">%</text>
  </g>
</svg>;

/**
 * Three category tiles of the home page: photo (men, women) or the drawn gift (offers), name at the
 * top and an arrow at the bottom. Without a photo, the tile shows its pictogram.
 */
export function CategoryTiles({ lang, tiles }: { lang: Lang; tiles: CategoryTile[] }) {
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  return <nav className="vz-tiles" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={pick(lang, 'الفئات', 'Catégories')}>
    {tiles.map((tile) => {
      const Icon = tileIcons[tile.id];
      const art = tile.id === 'promotions' ? 'gift' : tile.image ? 'photo' : 'icon';
      return <a key={tile.id} href={'/' + tile.id} className={'vz-tile tone-' + tile.tone + ' vz-tile-' + art + ' vz-tile-' + tile.id}>
        {art === 'photo' ? <img className="vz-tile-photo" src={tile.image} alt="" loading="lazy"/> : art === 'gift' ? <GiftArt/> : <span className="vz-tile-icon"><Icon/></span>}
        <b>{tile.label}</b>
        <span className="vz-tile-go" aria-hidden="true"><Chevron size={18}/></span>
      </a>;
    })}
  </nav>;
}

export type SearchResult = { id: string; title: string; name: string; image: string; price: string };

/** Name of each category in the other language, shown under the tile name of the search panel. */
const otherLabel: Record<CategoryTile['id'], { ar: string; fr: string }> = {
  homme: { ar: 'رجال', fr: 'Homme' }, femme: { ar: 'نساء', fr: 'Femme' }, promotions: { ar: 'عروض', fr: 'Offres' },
};

/**
 * Search window opened by the magnifier (centred card over the dimmed page): language, field,
 * suggestions (model names of the catalogue, most ordered first, and its brands), categories and
 * the search button. While typing, the matching colourways replace the suggestions; the button or
 * Enter shows every result in the shop grid. The field is 16 px (no automatic zoom on phones), is
 * focused without scrolling, and the page behind does not move while the window is open.
 */
export function SearchPanel({ lang, onLang, query, onQuery, onClose, onSubmit, onPick, results, suggestions, suggestionsTitle, categories }: {
  lang: Lang; onLang: (lang: Lang) => void; query: string; onQuery: (q: string) => void; onClose: () => void; onSubmit: () => void;
  onPick: (id: string) => void; results: SearchResult[]; suggestions: string[]; suggestionsTitle: string; categories: CategoryTile[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; removeEventListener('keydown', onKey); };
  }, []);
  const typed = query.trim();
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  // A category link leaves the search (the shop's click handler opens the section).
  const leave = (e: MouseEvent<HTMLElement>) => { if ((e.target as Element).closest('a[href^="/"]')) onClose(); };
  return <div className="vz-search-layer" onClick={onClose}>
    <div className="vz-search-panel" role="dialog" aria-modal="true" aria-labelledby="vz-search-title" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()} onClickCapture={leave}>
      <div className="vz-search-top">
        <div className="vz-search-lang" dir="ltr" role="group" aria-label="Langue / اللغة">
          <button type="button" aria-pressed={lang === 'fr'} onClick={() => onLang('fr')}>FR</button>
          <button type="button" aria-pressed={lang === 'ar'} onClick={() => onLang('ar')}>AR</button>
        </div>
        <h2 id="vz-search-title"><Search size={24} aria-hidden="true"/>{pick(lang, 'البحث عن المنتجات', 'Rechercher un produit')}</h2>
        <button type="button" className="vz-search-close" aria-label={pick(lang, 'إغلاق البحث', 'Fermer la recherche')} onClick={onClose}><X size={26}/></button>
      </div>
      <form className="vz-search-form" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label className="vz-search-box">
          <input ref={input} type="search" value={query} onChange={(e) => onQuery(e.target.value)} enterKeyHint="search" autoComplete="off"
            placeholder={pick(lang, 'ابحث عن منتج، موديل، أو ماركة…', 'Produit, modèle ou marque…')} aria-label={pick(lang, 'ابحث في المتجر', 'Rechercher dans la boutique')}/>
          {query
            ? <button type="button" className="vz-search-clear" aria-label={pick(lang, 'مسح', 'Effacer')} onClick={() => { onQuery(''); input.current?.focus({ preventScroll: true }); }}><X size={15}/></button>
            : <Search size={22} aria-hidden="true"/>}
        </label>
        <div className="vz-search-body">
          {typed
            ? results.length
              ? <ul className="vz-search-results">
                  {results.map((r) => <li key={r.id}><button type="button" onClick={() => onPick(r.id)}>
                    <img src={r.image} alt="" loading="lazy"/><span><b>{r.title}</b><small>{r.name}</small></span><strong>{r.price}</strong>
                  </button></li>)}
                </ul>
              : <p className="vz-search-empty">{pick(lang, 'ما لقينا حتى موديل بهاد الاسم.', 'Aucun modèle trouvé pour cette recherche.')}</p>
            : <>
                <h3 className="vz-search-label"><Flame size={22} aria-hidden="true"/>{suggestionsTitle}</h3>
                <div className="vz-search-chips">{suggestions.map((s) => <button type="button" key={s} onClick={() => onQuery(s)}><Search size={17} aria-hidden="true"/><bdi>{s}</bdi></button>)}</div>
                <h3 className="vz-search-label"><LayoutGrid size={22} aria-hidden="true"/>{pick(lang, 'تصفح حسب الفئة', 'Parcourir par catégorie')}</h3>
                <nav className="vz-search-cats" aria-label={pick(lang, 'الفئات', 'Catégories')}>
                  {categories.map((c) => {
                    const Icon = tileIcons[c.id];
                    return <a key={c.id} href={'/' + c.id} className={'tone-' + c.tone}>
                      <span className="vz-tile-icon"><Icon/></span>
                      <b>{c.label}</b>
                      <small>{lang === 'ar' ? otherLabel[c.id].fr : otherLabel[c.id].ar}</small>
                      <span className="vz-tile-go" aria-hidden="true"><Chevron size={17}/></span>
                    </a>;
                  })}
                </nav>
              </>}
        </div>
        <button type="submit" className="vz-search-submit">
          <Search size={23} aria-hidden="true"/><span lang="ar">بحث</span><i aria-hidden="true"/><span lang="fr">Rechercher</span>
        </button>
      </form>
    </div>
  </div>;
}

/** Section title with a red mark and its "see all" link. */
export function SectionHead({ lang, title }: { lang: Lang; title: string }) {
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return <div className="vz-section-title" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h2>{title}</h2>
    <a href="/boutique">{pick(lang, 'عرض الكل', 'Voir tout')}<Arrow size={19} aria-hidden="true"/></a>
  </div>;
}

/**
 * Black footer: only what the shop really offers (links of the shop, WhatsApp of lib/site.ts,
 * free delivery, cash on delivery). No social network, address or card payment is configured.
 */
export function ShopFooter({ lang, whatsapp }: { lang: Lang; whatsapp: { href: string; label: string } | null }) {
  const links = [
    { href: '/', label: pick(lang, 'الرئيسية', 'Accueil') },
    { href: '/boutique', label: pick(lang, 'المتجر', 'Boutique') },
    { href: '/homme', label: pick(lang, 'رجال', 'Homme') },
    { href: '/femme', label: pick(lang, 'نساء', 'Femme') },
    { href: '/promotions', label: pick(lang, 'عروض', 'Offres') },
    { href: '/favoris', label: pick(lang, 'المفضلة', 'Favoris') },
  ];
  return <footer className="vz-footer" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="vz-footer-grid">
      <div className="vz-footer-brand">
        <a className="logo" href="/">VELZARO<small>.store</small></a>
        <p>{pick(lang, 'متجرك للأحذية الرياضية بالمغرب: موديلات مختارة، توصيل مجاني والدفع عند الاستلام.', 'Votre boutique de sneakers au Maroc : une sélection soignée, livrée gratuitement et payée à la livraison.')}</p>
      </div>
      <nav className="vz-footer-col" aria-label={pick(lang, 'روابط المتجر', 'Liens de la boutique')}>
        <h2>{pick(lang, 'المتجر', 'Boutique')}</h2>
        <ul>{links.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul>
      </nav>
      <div className="vz-footer-col">
        <h2>{pick(lang, 'خدمة العملاء', 'Service client')}</h2>
        <ul>
          {whatsapp && <li><a className="vz-footer-wa" href={whatsapp.href} target="_blank" rel="noopener noreferrer"><WhatsappIcon/><span><bdi dir="ltr">{whatsapp.label}</bdi></span></a></li>}
          <li><Headset size={18} aria-hidden="true"/><span>{pick(lang, 'دعم العملاء طوال الأسبوع', 'Support client 7 jours sur 7')}</span></li>
        </ul>
      </div>
      <div className="vz-footer-col">
        <h2>{pick(lang, 'التوصيل والدفع', 'Livraison et paiement')}</h2>
        <ul>
          <li><Truck size={18} aria-hidden="true"/><span>{pick(lang, 'توصيل مجاني لجميع أنحاء المغرب', 'Livraison gratuite partout au Maroc')}</span></li>
          <li><Banknote size={18} aria-hidden="true"/><span>{pick(lang, 'الدفع عند الاستلام', 'Paiement à la livraison')}</span></li>
        </ul>
      </div>
    </div>
    <div className="vz-footer-bottom">
      <small>© {new Date().getFullYear()} VELZARO.store — {pick(lang, 'جميع الحقوق محفوظة', 'Tous droits réservés')}</small>
      <span className="vz-footer-pay"><Banknote size={18} aria-hidden="true"/>{pick(lang, 'الدفع نقداً عند الاستلام', 'Paiement en espèces à la livraison')}</span>
    </div>
  </footer>;
}
