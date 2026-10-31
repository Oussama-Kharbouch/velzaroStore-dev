'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- section links (/, /boutique…) are opened inside the page by the router's click handler, which keeps the cart and the open panels; next/link would reload the section from the server. */
import { useState, useEffect, useRef } from 'react';
import { translate } from './translations';
import { shippingFee } from '../../lib/shipping';
import { imageFraming } from './image-framing';
import { galleryPhotoFraming } from './gallery-photo-framing';
import { ShoppingCart, ShoppingBag, Search, Heart, ArrowRight, ArrowLeft, Menu, X, Minus, Plus, Check, Truck, ShieldCheck, Home, LayoutGrid, Tag, Store as StoreIcon, ChevronLeft, ChevronRight, BadgePercent, CreditCard, Trash2, UserRound, Phone, MapPin } from 'lucide-react';
import { catalogId, galleryLabels, productPath } from '../../lib/catalog.mjs';
import type { StoreProduct } from '../../lib/store-catalog';
import { trackPixel, trackPurchase, trackShopEvent } from '../../components/meta-pixel';
import WhatsappIcon from '../../components/whatsapp-icon';
import { PromoBar, SneakerIcon, TrustBadges, ComfortSection, WhatsAppReviews, ProductFaq } from './product-conversion';
import { productContent } from '../../lib/product-content';
import type { PromoCampaign } from '../../lib/promo';
import { SHOP_WHATSAPP, SITE_URL } from '../../lib/site';
type Item = {
    id: string;
    size: number;
    qty: number;
};
// One key per checkout (the server stores a resubmitted order once). crypto.randomUUID only exists on
// HTTPS pages: fall back to getRandomValues, available everywhere, so checkout also works over plain HTTP.
const newOrderKey=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
// Product pages have their own address: /<model>/<colourway> (productPath, lib/catalog.mjs).
/** Shop sections, each at its own address (/boutique, /femme…); the home page is /. */
const SECTIONS=['boutique','femme','homme','promotions','favoris'];
const sectionPath=(page:string)=>page==='home'?'/':'/'+page;
// Pixel content_ids = ids of the Meta catalogue feed (app/feed/meta.csv), once per colourway.
const catalogIds=(items:{id:string}[])=>[...new Set(items.map(i=>catalogId(i.id)))];
export default function Store({ catalog, promo = null, initialProductId, initialPage, initialLang }: { catalog: StoreProduct[]; media: { hero: string; categories: Record<string, string> }; promo?: PromoCampaign | null; initialProductId?: string; initialPage?: string; initialLang?: 'fr' | 'ar' }) {
    // Coloris en ligne, prix et pointures disponibles : lus dans la base par page.tsx.
    const products=catalog;
    const byId=(id:string)=>products.find(p=>p.id===id);
    // Every size at 0 (stock from the dashboard): shown in grey, cannot be bought.
    const soldOut=(p:{sizes:{available:boolean}[]})=>!p.sizes.some(s=>s.available);
    const imageFor=(id:string)=>byId(id)?.photos[0]??'';
    
    const priceOf=(id:string)=>byId(id)?.price??0;
    // Framing of each photo (*-framing.ts) is looked up by its R2 key, not by its address.
    const imageKeyFor=(id:string)=>byId(id)?.photoKeys[0]??'';
    
    // Arabic by default; the server already rendered the language of the cookie (lib/shop-lang.ts).
    const [lang, setLang] = useState<'fr' | 'ar'>(initialLang ?? 'ar');
    // Arabic colourway names entered in the dashboard take precedence over the built-in translations.
    const arabicNames:Record<string,string>=Object.fromEntries(products.filter(p=>p.nameAr).map(p=>[p.name,p.nameAr as string]));
    const t = (s: string) => lang === 'ar' && arabicNames[s] ? arabicNames[s] : translate(s, lang);
    useEffect(() => { const stored = localStorage.getItem('vz-language'); if (stored === 'ar' || stored === 'fr')
        // eslint-disable-next-line react-hooks/set-state-in-effect -- saved language is applied after hydration (the server rendered the cookie language)
        setLang(stored); }, []);
    // Choice kept in the browser and in a cookie (one year), read by the server on the next visit.
    useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; localStorage.setItem('vz-language', lang); document.cookie = 'vz-language=' + lang + '; path=/; max-age=31536000; samesite=lax'; }, [lang]);
    const [cityChoice,setCityChoice]=useState(''),[otherCity,setOtherCity]=useState('');
    const [quickSize,setQuickSize]=useState<string|null>(null);
    const [menuOpen,setMenuOpen]=useState(false),[colorFilter,setColorFilter]=useState('all');
    useEffect(()=>{if(!menuOpen)return;const previous=document.activeElement as HTMLElement;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const el=document.getElementById('site-menu');const focusable=()=>Array.from(el?.querySelectorAll<HTMLElement>('a,button')||[]);focusable()[0]?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenuOpen(false);if(e.key==='Tab'){const f=focusable(),first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};addEventListener('keydown',key);return()=>{document.body.style.overflow=oldOverflow;removeEventListener('keydown',key);previous?.focus()}},[menuOpen]);
    const [page, setPage] = useState(initialProductId ? 'detail' : initialPage ?? 'home'), [product, setProduct] = useState(byId(initialProductId ?? '') ?? products[0]), [size, setSize] = useState<number | null>(null), [cart, setCart] = useState<Item[]>([]), [favorites, setFavorites] = useState<string[]>([]), [drawer, setDrawer] = useState(false), [checkout, setCheckout] = useState(false), [query, setQuery] = useState(''), [search, setSearch] = useState(false), [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState(''), [key, setKey] = useState('');
    const [directBuy,setDirectBuy]=useState<{id:string;size:number|null;qty:number}|null>(null);
    const checkoutPanel=useRef<HTMLElement>(null),checkoutBusy=useRef(false);
    useEffect(()=>{checkoutBusy.current=busy},[busy]);
    const [galleryIndex,setGalleryIndex]=useState(0);
    const galleryTrack=useRef<HTMLDivElement>(null);
    const galleryDrag=useRef<{x:number;left:number}|null>(null);
    const [quantity,setQuantity]=useState(1);
    const [sizeError,setSizeError]=useState(false);
    // Bumped at each attempt without a size: replays the highlight of the size block.
    const [sizeNudge,setSizeNudge]=useState(0);
    const inlineSizeRef=useRef<HTMLDivElement>(null);
    /** No size yet: no checkout, the page scrolls to the sizes and highlights them. */
    const needSize=()=>{
        if(size!==null)return false;
        setSizeError(true);setSizeNudge(n=>n+1);
        inlineSizeRef.current?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        return true;
    };
    const buyFromProduct=()=>{
        if(soldOut(product)||needSize()||size===null)return;
        openPurchase(product,size,quantity);
    };
    const [quickQuantity,setQuickQuantity]=useState(1);
    const sizePanel=useRef<HTMLElement>(null);
    const quickProduct=products.find(p=>p.id===quickSize);
    useEffect(()=>{if(!quickSize)return;const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";const panel=sizePanel.current;panel?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setQuickSize(null);return}if(e.key!=="Tab")return;const f=Array.from(panel?.querySelectorAll<HTMLElement>("button:not(:disabled)")||[]),first=f[0],last=f[f.length-1];if(!first){e.preventDefault();return}if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel)){e.preventDefault();first.focus()}};addEventListener("keydown",onKey);return()=>{document.body.style.overflow=overflow;removeEventListener("keydown",onKey);if(previous?.isConnected)previous.focus()}},[quickSize]);
    const galleryImages=product.photos;
    // Meta Pixel: product viewed (ids and amounts only, never personal data).
    useEffect(()=>{if(page==='detail')trackShopEvent('ViewContent',{content_ids:[catalogId(product.id)],content_name:product.model+' '+product.name,content_type:'product',value:product.price,currency:'MAD'},[{id:product.id,qty:1}])},[page,product]);
    const showPhoto=(index:number)=>{const track=galleryTrack.current;if(!track)return;const slide=track.querySelectorAll<HTMLElement>('[data-gallery-slide]')[index];if(slide)track.scrollTo({left:slide.offsetLeft,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})};
    const changePhoto=(step:number)=>showPhoto((galleryIndex+step+galleryImages.length)%galleryImages.length);
    const closestPhoto=(track:HTMLDivElement)=>{const slides=Array.from(track.querySelectorAll<HTMLElement>('[data-gallery-slide]'));return slides.reduce((nearest,slide,i)=>Math.abs(slide.offsetLeft-track.scrollLeft)<Math.abs(slides[nearest].offsetLeft-track.scrollLeft)?i:nearest,0)};
    const finishGalleryDrag=(track:HTMLDivElement)=>{if(!galleryDrag.current)return;galleryDrag.current=null;delete track.dataset.dragging;showPhoto(closestPhoto(track))};
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new colourway starts on its first photo, without size or note
    useEffect(()=>{setGalleryIndex(0);galleryTrack.current?.scrollTo({left:0,behavior:'instant'});setQuantity(1);setSize(null);setSizeError(false);setNote('')},[product.id]);
    useEffect(() => { try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- saved cart and favourites are read after hydration (localStorage does not exist on the server)
        setCart((JSON.parse(localStorage.getItem('vz-cart') || '[]') as Item[]).filter(i => products.some(p => p.id === i.id)));
        setFavorites(JSON.parse(localStorage.getItem('vz-fav') || '[]'));
    }
    catch { } const h = () => {setQuery('');setColorFilter('all');window.scrollTo(0,0);const hash = location.hash.slice(1);
        // Product: /<model>/<id>; sections: /boutique, /femme… Old links with a hash
        // (/#produit/<id>, /#boutique, /#home) are moved to the clean address.
        const legacy = hash.startsWith('produit/') ? hash.split('/')[1] : null;
        const onPath = /^\/[a-z0-9-]+\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1] ?? null;
        const p = products.find(p => p.id === (legacy ?? (hash ? null : onPath)));
        if (p) {
            if (location.pathname !== productPath(p.id) || legacy) history.replaceState(null, '', productPath(p.id));
            setProduct(p);
            setPage('detail');
        }
        else {
            const path = location.pathname.length > 1 && location.pathname.endsWith('/') ? location.pathname.slice(0, -1) : location.pathname;
            const section = hash ? (SECTIONS.includes(hash) ? hash : 'home') : SECTIONS.find(s => path === '/' + s) ?? 'home';
            if (location.pathname !== sectionPath(section) || location.hash) history.replaceState(null, '', sectionPath(section));
            setPage(section);
        } }; h(); addEventListener('hashchange', h); addEventListener('popstate', h);
        // Section links (<a href="/boutique">…) open in the page, without reloading it; a new tab still works.
        const onClick = (e: MouseEvent) => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = (e.target as Element | null)?.closest?.('a'); if (!a || a.target || a.origin !== location.origin || a.hash) return;
            const section = a.pathname === '/' ? 'home' : a.pathname.slice(1); if (section !== 'home' && !SECTIONS.includes(section)) return;
            e.preventDefault(); navigate(section); };
        document.addEventListener('click', onClick);
        return () => { removeEventListener('hashchange', h); removeEventListener('popstate', h); document.removeEventListener('click', onClick); }; }, []);
    function navigate(p: string) {const s = p === 'accueil' ? 'home' : p;setQuery('');setColorFilter('all');if (location.pathname !== sectionPath(s) || location.hash) history.pushState(null, '', sectionPath(s)); setPage(s); window.scrollTo(0, 0); }
    function detail(p: typeof products[0], buy = false) { setProduct(p); setSize(null); setSizeError(false); setPage('detail'); if (location.pathname !== productPath(p.id) || location.hash) history.pushState(null, '', productPath(p.id)); setQuery(''); setColorFilter('all'); window.scrollTo(0, 0); if (buy)
        setNote(t("Choisissez votre pointure pour continuer.")); }
    function save(c: Item[]) { setCart(c); localStorage.setItem('vz-cart', JSON.stringify(c)); }
    function fav(id: string) { const f = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id]; setFavorites(f); localStorage.setItem('vz-fav', JSON.stringify(f)); }
    function openPurchase(p=product, selectedSize:number|null=null, qty=1){trackShopEvent('InitiateCheckout',{content_ids:[catalogId(p.id)],content_type:'product',value:p.price*qty,currency:'MAD',num_items:qty},[{id:p.id,qty}]);setDirectBuy({id:p.id,size:selectedSize,qty});setSuccess('');setError('');setDrawer(false);setKey(newOrderKey());setCheckout(true)}
    function closeCheckout(){if(checkoutBusy.current)return;setCheckout(false);setSuccess('');setDirectBuy(null);setError('')}
    function add(buy = false, selectedProduct = product, selectedSize = size, selectedQuantity = 1) { if(soldOut(selectedProduct))return; if(buy){openPurchase(selectedProduct,selectedSize,selectedQuantity);return} if (!selectedSize) {
        setQuickQuantity(selectedQuantity);setQuickSize(selectedProduct.id);
        return;
    } const c = [...cart], i = c.findIndex(i => i.id === selectedProduct.id && i.size === selectedSize); if (i >= 0)
        c[i] = { ...c[i], qty: Math.min(c[i].qty + selectedQuantity, 10) };
    else
        c.push({ id: selectedProduct.id, size: selectedSize, qty: selectedQuantity }); save(c); trackShopEvent('AddToCart', { content_ids: [catalogId(selectedProduct.id)], content_type: 'product', value: selectedProduct.price * selectedQuantity, currency: 'MAD' }, [{ id: selectedProduct.id, qty: selectedQuantity }]); setNote(''); setQuickSize(null); setDrawer(true); }
    /** Offers: colourways flagged as promotion or sold below their former price. */
    const isPromo=(p:typeof products[0])=>p.promotion||p.oldPrice!==null;
    // Men / women: their gender plus unisex and not yet classified colourways.
    const genderOk=(p:typeof products[0])=>page==='homme'?p.gender!=='femme':page==='femme'?p.gender!=='homme':true;
    const shopChips=[{id:'boutique',ar:'الكل',fr:'Tout',icon:LayoutGrid},{id:'homme',ar:'رجال',fr:'Homme',icon:SneakerIcon},{id:'femme',ar:'نساء',fr:'Femme',icon:SneakerIcon},{id:'promotions',ar:'عروض',fr:'Offres',icon:Tag}];
    const matches=(p:typeof products[0])=>(page!=='favoris'||favorites.includes(p.id))&&(page!=='promotions'||isPromo(p))&&genderOk(p)&&(colorFilter==='all'||p.id===colorFilter)&&(p.model+' '+p.name+' '+t(p.name)).toLowerCase().includes(query.toLowerCase());
    const city=cityChoice==='other'?otherCity.trim():cityChoice;
    const delivery=shippingFee(city);
    const money=(value:number)=>value.toLocaleString('fr-FR')+' '+(lang==='ar'?'درهم':'DH');
    useEffect(()=>{if(!drawer)return;const previous=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const panel=document.getElementById('cart-drawer');const focusable=()=>Array.from(panel?.querySelectorAll<HTMLElement>('a,button:not(:disabled)')||[]);panel?.querySelector<HTMLElement>('.cart-close')?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setDrawer(false);if(e.key==='Tab'){const f=focusable(),first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};addEventListener('keydown',onKey);return()=>{document.body.style.overflow=overflow;removeEventListener('keydown',onKey);previous?.focus()}},[drawer]);
    const total = cart.reduce((s, i) => s + i.qty * priceOf(i.id), 0), count = cart.reduce((s, i) => s + i.qty, 0);
    const checkoutItems:Item[]=directBuy?(directBuy.size?[{...directBuy,size:directBuy.size}]:[]):cart;
    const checkoutPreview=directBuy?[directBuy]:cart;
    const checkoutSubtotal=checkoutPreview.reduce((sum,item)=>sum+item.qty*priceOf(item.id),0);
    useEffect(()=>{if(!checkout)return;const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const panel=checkoutPanel.current;panel?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(!checkoutBusy.current){setCheckout(false);setSuccess('');setDirectBuy(null);setError('')}return}if(e.key!=='Tab')return;const elements=Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')||[]);const first=elements[0],last=elements[elements.length-1];if(!first){e.preventDefault();return}if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel)){e.preventDefault();first.focus()}};addEventListener('keydown',onKey);return()=>{document.body.style.overflow=overflow;removeEventListener('keydown',onKey);if(previous?.isConnected)previous.focus()}},[checkout]);
    async function send(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if(!checkoutItems.length){setError(t('Veuillez choisir votre pointure.'));return} // Same rule as the server (06/07 or +212): a mistyped number is pointed out before sending.
    const typedPhone=String(new FormData(e.currentTarget).get('phone')??'').replace(/[\s().-]/g,'');
    if(!/^(?:(?:\+212|00212)[67]\d{8}|0[67]\d{8})$/.test(typedPhone)){setError(t('Vérifiez votre numéro de téléphone marocain (06 ou 07).'));return}
    setBusy(true); setError(''); const f = new FormData(e.currentTarget); try {
        const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), address: f.get('address'), phone: f.get('phone'), city, items: checkoutItems, key }) });
        const d = await r.json() as { id: string; eventId?: string; total?: number; error?: string };
        if (!r.ok)
            throw Error(d.error);
        setSuccess(d.id);
        void trackPurchase({ name: String(f.get('name') ?? ''), phone: String(f.get('phone') ?? ''), city }, { content_ids: catalogIds(checkoutItems), content_type: 'product', value: d.total, currency: 'MAD', num_items: checkoutItems.reduce((n, i) => n + i.qty, 0) }, d.eventId ?? 'purchase_' + d.id);
        if(!directBuy)save([]);
    }
    catch (e) {
        setError((e instanceof Error && e.message) || t("Veuillez r\u00E9essayer."));
    }
    finally {
        setBusy(false);
    } }
    /** Product card of the home page and shop sections: photo, name, prices, one buy button. */
    function card(p: typeof products[0]) {
      const title=productContent(p.modelSlug).title?.[lang]??p.model;
      return <article key={p.id} className={'card compact-card vz-card'+(p.id==='white-black'?' white-sole-card':p.id==='navy-turquoise'?' navy-card':p.id==='gris-orange'?' cream-card':p.id==='blanc-gris'?' gray-card':p.id==='white'?' allwhite-card':'')+(soldOut(p)?' sold-out':'')}>
        <div className="picture"><button className="photo-button" onClick={()=>detail(p)} aria-label={title+' '+t(p.name)}><img src={imageFor(p.id)} style={imageFraming[imageKeyFor(p.id)]} alt={title+' '+t(p.name)}/></button>{soldOut(p)?<span className="vz-card-badge vz-card-soldout">{t('Épuisé')}</span>:p.oldPrice!==null&&<span className="vz-card-badge" dir="ltr">-{Math.round((p.oldPrice-p.price)/p.oldPrice*100)}%</span>}<button className={'vz-card-fav'+(favorites.includes(p.id)?' selected':'')} aria-label={t('Ajouter aux favoris')} aria-pressed={favorites.includes(p.id)} onClick={()=>fav(p.id)}><Heart size={21} fill={favorites.includes(p.id)?'currentColor':'none'}/></button></div>
        <button className="vz-card-name" onClick={()=>detail(p)}><h3><bdi>{title}</bdi></h3><span>{t(p.name).replace(' | ',' / ')}</span></button>
        <p className="vz-card-price">{p.oldPrice!==null&&<del>{money(p.oldPrice)}</del>}<strong>{money(p.price)}</strong>{p.oldPrice!==null&&<span className="vz-card-saving">{lang==='ar'?'وفر ':'−'}{money(p.oldPrice-p.price)}</span>}</p>
        <button className="vz-card-buy" disabled={soldOut(p)||undefined} onClick={()=>openPurchase(p)}><ShoppingCart size={21} aria-hidden="true"/><span>{soldOut(p)?t('Épuisé'):lang==='ar'?'اشتري الآن':'Acheter'}</span></button>
      </article>;
    }
    // Product page: wording of the model (lib/product-content.ts); everything else from the catalogue.
    const content=productContent(product.modelSlug);
    const productTitle=content.title?content.title[lang]:product.model;
    const discount=product.oldPrice!==null?Math.round((product.oldPrice-product.price)/product.oldPrice*100):null;
    const colourways=products.filter(p=>p.modelSlug===product.modelSlug);
    const whatsappHref=SHOP_WHATSAPP?'https://wa.me/'+SHOP_WHATSAPP+'?text='+encodeURIComponent(page==='detail'?t('Bonjour, j’ai une question sur')+' '+product.model+' '+t(product.name)+' : '+SITE_URL+productPath(product.id):t('Bonjour, j’ai une question.')):null;
    return <><PromoBar lang={lang} promo={promo} variant={page==='detail'?'product':'shop'}/><header className={'main-header vz-header'+(page==='detail'?' product-header':'')}>
      <div className="vz-header-side vz-header-start"><button type="button" className="vz-icon-btn" aria-label={t("Menu")} aria-expanded={menuOpen} aria-controls="site-menu" onClick={()=>setMenuOpen(true)}><Menu size={27}/></button><div className="vz-lang" role="group" aria-label="العربية / Français"><button type="button" lang="ar" aria-pressed={lang==='ar'} onClick={()=>setLang('ar')}>العربية</button><span aria-hidden="true">|</span><button type="button" lang="fr" aria-pressed={lang==='fr'} onClick={()=>setLang('fr')}>FR</button></div></div>
      <a className="logo vz-logo" href="/" onClick={()=>setMenuOpen(false)}>VELZARO<small>.store</small></a>
      <div className="vz-header-side vz-header-end"><nav className="header-pages" aria-label={t("Navigation principale")}><a className={page==='home'?'active':''} href="/">{t('Accueil')}</a><a className={page==='boutique'?'active':''} href="/boutique">{t('Boutique')}</a></nav><button type="button" className="vz-icon-btn header-search" aria-label={t("Rechercher")} aria-expanded={search} onClick={() => setSearch(!search)}><Search size={25}/></button><button type="button" className="vz-icon-btn vz-cart-btn" aria-label={t("Ouvrir le panier")+(count?' ('+count+')':'')} onClick={() => setDrawer(true)}><ShoppingCart size={27}/><b aria-hidden="true">{count}</b></button></div>
    </header>{search && <div className="search"><Search size={18}/><input autoFocus value={query} onChange={e => { setQuery(e.target.value); setPage('boutique'); }} placeholder={t("Rechercher un mod\u00E8le, une couleur\u2026")}/><button aria-label={t("Fermer la recherche")} onClick={() => { setSearch(false); setQuery(''); }}><X /></button></div>}
    {page === 'detail' ? <main className="detail prestige-detail vz-pdp">
      <div className="breadcrumb vz-breadcrumb"><button onClick={()=>navigate('boutique')}><ArrowLeft size={15}/>{t('Boutique')}</button><span>/ {product.model}</span></div>
      <div className="vz-pdp-top">
        <div className={'vz-pdp-media'+(soldOut(product)?' sold-out':'')}>
          <div className="gallery-viewport vz-main-photo">
            <div className="gallery-track" ref={galleryTrack} tabIndex={0} aria-label={t('Galerie produit')} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();changePhoto(1)}if(e.key==='ArrowLeft'){e.preventDefault();changePhoto(-1)}}} onScroll={e=>setGalleryIndex(closestPhoto(e.currentTarget))} onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0)return;e.preventDefault();galleryDrag.current={x:e.clientX,left:e.currentTarget.scrollLeft};e.currentTarget.dataset.dragging='true';e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const drag=galleryDrag.current;if(!drag)return;e.currentTarget.scrollLeft=drag.left+drag.x-e.clientX}} onPointerUp={e=>finishGalleryDrag(e.currentTarget)} onPointerCancel={e=>finishGalleryDrag(e.currentTarget)} onLostPointerCapture={e=>finishGalleryDrag(e.currentTarget)}>
              {galleryImages.map((src,i)=><div key={src} data-gallery-slide className={'gallery original-photos '+(['white-black','navy-turquoise','gris-orange','blanc-gris','white'].includes(product.id)?'portrait-photos ':'')+([0,1,4,5].includes(i)?'wide-view':'tall-view')} role="group" aria-label={(i+1)+' / '+galleryImages.length}>
                <img draggable={false} style={galleryPhotoFraming[product.photoKeys[i]]} src={src} alt={product.model+' '+t(product.name)+' — '+t(galleryLabels[i]??'Galerie produit')} loading={i===0?'eager':'lazy'}/>
              </div>)}
            </div>
            {soldOut(product)?<span className="vz-discount vz-discount-soldout">{t('Épuisé')}</span>:discount!==null&&<span className="vz-discount" dir="ltr">-{discount}%</span>}
            <button type="button" className="vz-fav" aria-label={t('Favoris')} aria-pressed={favorites.includes(product.id)} onClick={()=>fav(product.id)}><Heart size={21} fill={favorites.includes(product.id)?'currentColor':'none'}/></button>
            {galleryImages.length>1&&<><button type="button" className="vz-photo-arrow prev" aria-label={t('Photo précédente')} onClick={()=>changePhoto(-1)}><ChevronLeft size={22}/></button><button type="button" className="vz-photo-arrow next" aria-label={t('Photo suivante')} onClick={()=>changePhoto(1)}><ChevronRight size={22}/></button></>}
          </div>
          {galleryImages.length>1&&<div className="vz-thumbs" dir="ltr" aria-label={t('Galerie produit')}>{galleryImages.map((src,i)=><button key={src} type="button" aria-label={t('Choisir une photo')+' '+(i+1)} aria-pressed={i===galleryIndex} onClick={()=>showPhoto(i)}><img src={src} alt="" loading="lazy"/></button>)}</div>}
        </div>
        <div className="vz-pdp-info">
          {product.brand&&<p className="vz-brand">{product.brand}</p>}
          <h1 className="vz-title"><bdi>{productTitle}</bdi></h1>
          <p className="vz-tagline">{content.tagline[lang]}</p>
          {content.description&&<p className="vz-description">{content.description[lang]}</p>}
          <div className="vz-price-row"><strong className="vz-price">{money(product.price)}</strong>{product.oldPrice!==null&&<><del className="vz-old-price">{money(product.oldPrice)}</del><span className="vz-saving">{lang==='ar'?'وفّر ':'Économisez '}{money(product.oldPrice-product.price)}</span></>}</div>
          {soldOut(product)&&<p role="status" className="vz-soldout-note">{t('Ce coloris est épuisé.')}</p>}
          <div className="vz-block">
            <div className="vz-block-head"><h2>{lang==='ar'?'اختار اللون':'Choisissez votre coloris'}</h2><span>{t(product.name)}</span></div>
            <div className="vz-colours">{colourways.map(p=><button key={p.id} type="button" title={t(p.name)} aria-label={t(p.name)+(soldOut(p)?' — '+t('Épuisé'):'')} aria-pressed={p.id===product.id} className={[p.id===product.id&&'chosen',soldOut(p)&&'sold-out'].filter(Boolean).join(' ')} onClick={()=>{if(p.id===product.id)return;setProduct(p);history.pushState(null,'',productPath(p.id));setQuery('');setColorFilter('all')}}><img src={p.thumbnail} alt="" loading="lazy"/>{soldOut(p)&&<small>{t('Épuisé')}</small>}</button>)}</div>
          </div>
          <div key={sizeNudge} ref={inlineSizeRef} className={'vz-block vz-sizes'+(sizeError?' vz-attention':'')}>
            <div className="vz-block-head"><h2>{lang==='ar'?'اختار المقاس':'Choisissez votre pointure'}</h2>{size!==null&&<span>{t('Pointure')} {size}</span>}</div>
            <div className="vz-size-grid" role="group" aria-label={t('Pointure')} dir="ltr">{product.sizes.map(({size:n,available})=><button key={n} type="button" disabled={!available} aria-pressed={size===n} aria-label={t('Pointure')+' '+n+(available?'':' — '+t('Épuisé'))} onClick={()=>{setSize(n);setSizeError(false)}}>{n}</button>)}</div>
            {sizeError&&<p className="vz-size-error" role="alert">{lang==='ar'?'اختار المقاس ديالك باش تكمل الطلب':'Choisissez votre pointure pour continuer votre commande.'}</p>}
          </div>
          <button type="button" className="vz-buy" disabled={soldOut(product)} onClick={buyFromProduct}>{soldOut(product)?t('Épuisé'):<><span>{lang==='ar'?'اشتري الآن':'Acheter maintenant'}</span><span className="vz-buy-price">{money(product.price)}</span><ChevronRight size={20} className="vz-chevron"/></>}</button>
          <button type="button" className="vz-add-cart" disabled={soldOut(product)} onClick={()=>{if(!needSize()&&size!==null)add(false,product,size,1)}}><ShoppingCart size={18}/>{t('Ajouter au panier')}</button>
          <TrustBadges lang={lang}/>
        </div>
      </div>
      {content.comfort&&<ComfortSection lang={lang} photos={product.photos} name={productTitle}/>}
      <WhatsAppReviews lang={lang}/>
      <ProductFaq lang={lang} whatsappHref={whatsappHref}/>
    </main> : <main className="vz-shop">
      <h1 className={page==='favoris'?'vz-shop-title':'vz-visually-hidden'}>{page === 'favoris' ? t("Vos favoris") : page === 'femme' ? t("Sélection femme") : page === 'homme' ? t("Sélection homme") : page === 'promotions' ? t('Promotions') : t("Nos essentiels")}</h1>
      <nav className="vz-chips" aria-label={t('Nos catégories')}>{shopChips.map(c=>{const on=c.id==='boutique'?(page==='home'||page==='boutique'):page===c.id;const Icon=c.icon;return <a key={c.id} href={'/'+c.id} className={'vz-chip'+(on?' active':'')+(c.id==='promotions'?' vz-chip-offer':'')} aria-current={on?'page':undefined}><Icon size={20} aria-hidden="true"/><span>{lang==='ar'?c.ar:c.fr}</span></a>})}</nav>
      <div className="vz-grid">{products.filter(matches).map(p => card(p))}</div>
      {page==='promotions'&&!products.some(isPromo)&&<div className="empty"><BadgePercent size={38}/><h2>{t('Les offres arrivent bientôt')}</h2><p>{t('Retrouvez ici nos prochaines promotions.')}</p><a className="btn" href="/boutique">{t('Explorer la boutique')}</a></div>}
      {page === 'favoris' && !favorites.length && <div className="empty"><Heart size={35}/><h2>{t("Votre sélection commence ici.")}</h2><p>{t("Retrouvez ici les modèles que vous aimez.")}</p><a className="btn" href="/boutique">{t("Explorer la boutique")}</a></div>}
      {query && !products.some(matches) && <p className="vz-empty-search">{t("Aucun modèle trouvé. Essayez une autre couleur.")}</p>}
    </main>}
    <footer><a className="logo" href="/">VELZARO<small>.store</small></a><p>{t("Le style \u00E0 chaque pas.")}</p><div><a href="/boutique">{t("Boutique")}</a><a href="/femme">{t("Femme")}</a><a href="/homme">{t("Homme")}</a></div><small>© {new Date().getFullYear()} VELZARO Store</small></footer>{whatsappHref&&<a className={'whatsapp-float'+(page!=='detail'?' vz-float-shop':'')} href={whatsappHref} target="_blank" rel="noopener noreferrer" title={t('Une question ? Écrivez-nous sur WhatsApp')} aria-label={t('Une question ? Écrivez-nous sur WhatsApp')} onClick={()=>trackPixel('Contact')}><WhatsappIcon/></a>}<nav className={'mobile-nav vz-bottom-nav'+(page==='detail'?' nav-on-product':'')} aria-label={t("Navigation principale")}><a className={page==='home'?'active':''} href="/" aria-current={page==='home'?'page':undefined}><Home size={25}/><small>{t("Accueil")}</small></a><a className={['boutique','femme','homme','promotions'].includes(page)?'active':''} href="/boutique"><LayoutGrid size={25}/><small>{lang==='ar'?'التصنيفات':'Catégories'}</small></a><a className={'nav-fav'+(page==='favoris'?' active':'')} href="/favoris" aria-label={favorites.length?t("Favoris")+' ('+favorites.length+')':undefined}><span><Heart size={25}/>{favorites.length>0&&<b>{favorites.length}</b>}</span><small>{t("Favoris")}</small></a><button type="button" onClick={()=>setDrawer(true)} className="nav-cart"><span><ShoppingCart size={25}/>{count>0&&<b>{count}</b>}</span><small>{t("Panier")}</small></button>{whatsappHref&&<a className="vz-nav-wa" href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={()=>trackPixel('Contact')}><WhatsappIcon/><small>{lang==='ar'?'واتساب':'WhatsApp'}</small></a>}</nav>
    {page==='detail'&&!checkout&&!drawer&&!quickSize&&!menuOpen&&<div className="vz-sticky-buy" role="region" aria-label={lang==='ar'?'شراء المنتج':'Achat produit'}><button type="button" disabled={soldOut(product)} onClick={buyFromProduct}><span className="vz-sticky-price">{money(product.price)}</span><span className="vz-sticky-sep" aria-hidden="true"/><span className="vz-sticky-label">{soldOut(product)?t('Épuisé'):lang==='ar'?'اشتري الآن':'Acheter maintenant'}</span><ChevronRight size={20} className="vz-chevron"/></button></div>}{menuOpen&&<div className="menu-overlay" onClick={()=>setMenuOpen(false)}><section id="site-menu" className="site-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title" onClick={e=>e.stopPropagation()}><div className="menu-top"><span id="menu-title">{t("Menu")}</span><button aria-label={t("Fermer")} onClick={()=>setMenuOpen(false)}><X size={23}/></button></div><p className="menu-eyebrow">VELZARO STORE</p><h2>{t("À chaque pas.")}</h2><div className="menu-links">{[{id:'home',label:'Accueil',icon:Home},{id:'boutique',label:'Toute la boutique',icon:StoreIcon},{id:'femme',label:'Femme',icon:ArrowRight},{id:'homme',label:'Homme',icon:ArrowRight},{id:'promotions',label:'Promotions',icon:BadgePercent},{id:'favoris',label:'Favoris',icon:Heart}].map(({id,label,icon:Icon})=><a key={id} href={'/'+id} onClick={()=>{setMenuOpen(false);navigate(id)}}><Icon size={20}/><span>{t(label)}</span><ChevronRight size={18}/></a>)}<button onClick={()=>{setMenuOpen(false);setDrawer(true)}}><ShoppingBag size={20}/><span>{t("Panier")}{count>0&&` (${count})`}</span><ChevronRight size={18}/></button></div><div className="menu-bottom"><Truck size={19}/><p>{t("Livraison partout au Maroc")}<small>{t("Paiement à la livraison")}</small></p></div></section></div>}

    {drawer && <div className="overlay cart-overlay" onClick={() => setDrawer(false)}><aside id="cart-drawer" className="drawer prestige-cart" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={e => e.stopPropagation()}><div className="cart-header"><div className="cart-brand-row"><a className="logo" href="/" onClick={()=>setDrawer(false)}>VELZARO<small>.store</small></a><button className="cart-close" aria-label={t("Fermer")} onClick={() => setDrawer(false)}><X size={25}/></button></div><h2 id="cart-title">{t("Mon panier")} <span>{count}</span></h2></div><div className="cart-scroll">{!cart.length ? <div className="empty"><ShoppingBag size={40}/><h3>{t("Votre panier vous attend.")}</h3><button className="btn" onClick={() => { setDrawer(false); navigate('boutique'); }}>{t("Découvrir la collection")}</button></div> : <><div className="cart-lines">{cart.map((i,k)=>{const p=products.find(p=>p.id===i.id);if(!p)return null;return <div className="cart-line" key={p.id+'-'+i.size}><img src={imageFor(p.id)} alt={p.model+' '+t(p.name)}/><div className="cart-item-info"><h3>{p.model}</h3><p>{t(p.name)}</p><p>{t("Pointure")} {i.size}</p><b className="cart-item-price">{money(i.qty*p.price)}</b><div className="cart-item-actions"><div className="quantity"><button aria-label={t("Diminuer")+' '+p.model+' '+t(p.name)} onClick={()=>save(cart.map((v,j)=>j===k?{...v,qty:v.qty-1}:v).filter(v=>v.qty>0))}><Minus size={15}/></button><span aria-live="polite">{i.qty}</span><button aria-label={t("Augmenter")+' '+p.model+' '+t(p.name)} disabled={i.qty>=10} onClick={()=>save(cart.map((v,j)=>j===k?{...v,qty:Math.min(v.qty+1,10)}:v))}><Plus size={15}/></button></div><button className="cart-remove" aria-label={t("Retirer")+' '+p.model+' '+t(p.name)} onClick={()=>save(cart.filter((_,j)=>j!==k))}><Trash2 size={18}/></button></div></div></div>})}</div><button className="cart-continue" onClick={()=>setDrawer(false)}><ArrowLeft size={20}/>{t("Continuer mes achats")}</button></>}</div>{!!cart.length&&<div className="cart-summary"><div className="cart-summary-row"><span>{t("Sous-total")}</span><span>{money(total)}</span></div><div className="cart-summary-row cart-shipping" aria-live="polite"><span>{t("Livraison")}</span><span>{delivery===null?t("Gratuite"):t(city)+" · "+(delivery===0?t("Gratuite"):money(delivery))}</span></div><div className="cart-grand-total"><strong>{t(delivery===null?"Total articles":"Total")}</strong><strong>{money(total+(delivery??0))}</strong></div><button className="btn cart-checkout" onClick={()=>{trackShopEvent('InitiateCheckout',{content_ids:catalogIds(cart),content_type:'product',value:total,currency:'MAD',num_items:count},cart.map(i=>({id:i.id,qty:i.qty})));setKey(newOrderKey());setDirectBuy(null);setSuccess('');setError('');setDrawer(false);setCheckout(true)}}>{t("Passer commande")}<ArrowRight size={22}/></button><p className="secure"><ShieldCheck size={19}/>{t("Paiement à la livraison")}</p></div>}</aside></div>}

    {quickProduct&&<div className="overlay size-overlay" onClick={()=>setQuickSize(null)}><section id="size-dialog" ref={sizePanel} className="size-popup" role="dialog" aria-modal="true" aria-labelledby="size-title" aria-describedby="size-description" tabIndex={-1} onClick={e=>e.stopPropagation()}><div className="size-popup-heading"><h2 id="size-title">{t('Choisir votre pointure')}</h2><button aria-label={t('Fermer')} onClick={()=>setQuickSize(null)}><X size={23}/></button></div><div className="size-product"><img src={imageFor(quickProduct.id)} alt={quickProduct.model+' '+t(quickProduct.name)}/><div><h3>{quickProduct.model}</h3><p>{t(quickProduct.name)}</p><strong>{money(quickProduct.price)}</strong>{quickQuantity>1&&<small>{t('Quantité')} : {quickQuantity}</small>}</div></div><p id="size-description">{t('Sélectionnez votre pointure pour ajouter au panier.')}</p><div className="popup-sizes">{quickProduct.sizes.map(({size:n,available})=><button key={n} disabled={!available||undefined} aria-label={t('Ajouter au panier')+' — '+t('Pointure')+' '+n} onClick={()=>add(false,quickProduct,n,quickQuantity)}>{n}</button>)}</div><p className="size-popup-note"><ShoppingCart size={16}/>{t('Ajouter au panier')}</p></section></div>}

    {checkout && <div className="overlay checkout-overlay" onClick={closeCheckout}><section ref={checkoutPanel} className="checkout purchase-popup" role="dialog" aria-modal="true" aria-labelledby="checkout-title" aria-describedby="checkout-description" tabIndex={-1} onClick={e=>e.stopPropagation()}>
      <div className="purchase-top"><span>VELZARO<span>.store</span></span><div><button className={lang==='fr'?'active':''} onClick={()=>setLang('fr')} aria-pressed={lang==='fr'}>FR</button><button className={lang==='ar'?'active':''} onClick={()=>setLang('ar')} aria-pressed={lang==='ar'}>AR</button><button className="purchase-close" aria-label={t('Fermer')} disabled={busy} onClick={closeCheckout}><X size={22}/></button></div></div>
      <div className="purchase-heading"><CreditCard size={24}/><h2 id="checkout-title">{success?t('Merci pour votre commande'):t('Paiement à la livraison')}</h2><p id="checkout-description">{t('Payez à la réception de votre commande')}</p></div>
      {success?<div className="success"><Check size={44}/><h3>{t('Commande enregistrée.')}</h3><p>{t('Votre référence :')}<strong>{success.slice(0,15).toUpperCase()}</strong></p><p className="vz-thanks">{t('Merci pour votre confiance ❤️ Nous avons bien reçu votre commande et nous vous contacterons pour confirmer les informations.')}</p><button className="btn" onClick={()=>{closeCheckout();navigate('boutique')}}>{t('Continuer mes achats')}</button></div>:<form onSubmit={send}>
        <div className="purchase-items">{checkoutPreview.map(item=>{const p=products.find(p=>p.id===item.id);if(!p)return null;return <div className="purchase-item" key={item.id+'-'+item.size}><div className="purchase-photo"><img src={imageFor(p.id)} alt={p.model+' '+t(p.name)}/><span>{item.qty}</span></div><div><strong>{p.model}</strong><p>{t(p.name)}</p>{item.size&&<small>{t('Pointure')} {item.size}</small>}</div><b>{money(item.qty*p.price)}</b></div>})}</div>
        <div className="purchase-totals" aria-live="polite"><p><span>{t('Sous-total')}</span><b>{money(checkoutSubtotal)}</b></p><p><span>{t('Livraison')}</span><span>{delivery===null?t('Gratuite'):delivery===0?t('Gratuite'):money(delivery)}</span></p><p className="purchase-total"><strong>{t(delivery===null?'Total articles':'Total')}</strong><strong>{money(checkoutSubtotal+(delivery??0))}</strong></p></div>
        {directBuy&&<label className="purchase-size">{t('Pointure')} *<select name="size" required value={directBuy.size??''} onChange={e=>{setDirectBuy({...directBuy,size:Number(e.target.value)});setError('')}}><option value="" disabled>{t('Choisir votre pointure')}</option>{(byId(directBuy.id)?.sizes??[]).map(({size:n,available})=><option key={n} value={n} disabled={!available||undefined}>{n}</option>)}</select></label>}
        {directBuy&&<div className="purchase-qty"><span>{t('Quantité')}</span><div className="quantity"><button type="button" disabled={directBuy.qty<=1} aria-label={t('Diminuer')} onClick={()=>setDirectBuy({...directBuy,qty:Math.max(1,directBuy.qty-1)})}><Minus size={18}/></button><span aria-live="polite">{directBuy.qty}</span><button type="button" disabled={directBuy.qty>=10} aria-label={t('Augmenter')} onClick={()=>setDirectBuy({...directBuy,qty:Math.min(10,directBuy.qty+1)})}><Plus size={18}/></button></div></div>}
        <div className="purchase-fields"><label>{t('Nom complet')} *<div className="purchase-input"><UserRound size={19}/><input name="name" required minLength={3} maxLength={100} autoComplete="name" placeholder={t('Votre prénom et nom')}/></div></label><label>{t('Téléphone')} *<div className="purchase-input"><Phone size={19}/><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder={t('06 ou 07 XX XX XX XX')}/></div></label>
        <label>{t('Ville')} *<div className="purchase-input"><MapPin size={19}/><select name="cityChoice" autoComplete="address-level2" value={cityChoice} onChange={e=>{setCityChoice(e.target.value);setError('')}} required><option value="" disabled>{t('Choisissez votre ville.')}</option>{['Casablanca','Rabat','Salé','Marrakech','Tanger','Fès','Meknès','Agadir','Tétouan','Oujda','Kénitra','Mohammédia','El Jadida','Safi','Béni Mellal','Nador','Settat','Berrechid'].map(c=><option key={c} value={c}>{t(c)}</option>)}<option value="other">{t('Autre ville')}</option></select></div></label>
        {cityChoice==='other'&&<label>{t('Précisez votre ville')} *<div className="purchase-input"><MapPin size={19}/><input name="otherCity" value={otherCity} onChange={e=>setOtherCity(e.target.value)} required minLength={2} maxLength={80} autoComplete="address-level2"/></div></label>}
        <label className="purchase-address">{t('Adresse complète')} *<div className="purchase-input"><MapPin size={19}/><textarea name="address" required minLength={10} maxLength={500} autoComplete="street-address" placeholder={t('Ville, quartier, rue, immeuble, appartement…')} rows={2}/></div></label></div>
        <p className="fine">{t('Vos coordonnées sont utilisées pour traiter et livrer votre commande.')}</p>{error&&<p role="alert" className="error">{t(error)}</p>}
        <button disabled={busy||!checkoutItems.length||delivery===null} className="btn purchase-submit" type="submit"><Check size={20}/><span>{busy?t('Envoi en cours…'):t('Je confirme ma commande')}{delivery!==null&&<small>{t('Total à payer')} : {money(checkoutSubtotal+delivery)}</small>}</span></button><p className="secure"><ShieldCheck size={17}/>{t('Paiement à la livraison')}</p>
      </form>}
    </section></div>}</>;
}
