// Catalogue VELZARO : source unique pour la page (affichage) et pour `npm run db:seed`
// (tables products, variants, product_images, variant_sizes dans PostgreSQL).
// Plain JS so the Node scripts can import it without a build step.

export const PRODUCT = { name: 'Cloudtilt', slug: 'cloudtilt' };
export const PRICE = 649;
export const OLD_PRICE = 799;
export const SIZES = [40, 41, 42, 43, 44];

/** @typedef {{id:string,name:string,color:string,category:string,promotion:boolean}} Product */

/** Coloris, dans l'ordre d'affichage. `id` est le slug de la variante (panier, URL, base). */
/** @type {Product[]} */
export const products = [{ id: 'white-black', name: 'Black | Ivory', color: '#eee', category: 'mixte', promotion: false }, { id: 'eclipse', name: 'Clove Sand', color: '#a8a297', category: 'mixte', promotion: false }, { id: 'black', name: 'Eclipse | Black', color: '#202020', category: 'mixte', promotion: false }, { id: 'ivory-tempest', name: 'Ivory | Tempest', color: '#315d7e', category: 'mixte', promotion: false }, { id: 'white', name: 'White', color: '#fff', category: 'mixte', promotion: false }, { id: 'navy-turquoise', name: 'Bleu marine | Turquoise', color: '#24394e', category: 'mixte', promotion: false }, { id: 'gris-orange', name: 'Gris clair | Orange', color: '#e2dfd4', category: 'mixte', promotion: false }, { id: 'blanc-gris', name: 'Blanc | Gris', color: '#b1b2b4', category: 'mixte', promotion: false }, { id: 'rose-blanc', name: 'Rose | Blanc', color: '#de85de', category: 'mixte', promotion: false }, { id: 'lilas-blanc', name: 'Lilas | Blanc', color: '#c7b7df', category: 'mixte', promotion: false }, { id: 'noir-blanc', name: 'Noir | Blanc', color: '#161616', category: 'mixte', promotion: false }];

/*
 * Images. The database stores Cloudflare R2 KEYS (products/cloudtilt/black/1.webp), never
 * full URLs: the public address is built from R2_PUBLIC_URL (lib/r2.ts), so a domain
 * change is one line in .env.local.
 *
 * Six views per colourway, in gallery order (pair, profile, top, soles, other profile, back).
 */
export const PRODUCT_KEY_PREFIX = 'products/cloudtilt';
/** @type {Record<string,string[]>} */
export const photoKeys=Object.fromEntries(products.map((p)=>[p.id,Array.from({length:6},(_,i)=>`${PRODUCT_KEY_PREFIX}/${p.id}/${i+1}.webp`)]));

/** Hero banner and category pictures: R2 key, and former location in public/. */
export const siteImages = {
  hero: { key: 'banners/hero.webp', legacy: '/assets/hero.webp' },
  categories: {
    homme: { key: 'categories/homme.webp', legacy: '/assets/category-homme-silhouette-v5.webp' },
    femme: { key: 'categories/femme.webp', legacy: '/assets/category-femme-silhouette-v5.webp' },
    promotions: { key: 'categories/promotions.webp', legacy: '/assets/category-promotions-silhouette-v5.webp' },
  },
};

// Former locations in public/assets, kept to migrate them (scripts/upload-images-to-r2.ts)
// and to keep rendering rows that still hold them until the migration has run.
/** @type {Record<string,string>} */
const legacyFolders={'white-black':'cloudtilt-standard-white-black','eclipse':'cloudtilt-sand-black','black':'cloudtilt-black','ivory-tempest':'cloudtilt-ivory-tempest-navy','white':'cloudtilt-template-white-v2','navy-turquoise':'cloudtilt-template-navy-v2','gris-orange':'cloudtilt-standard-gris-orange','blanc-gris':'cloudtilt-standard-blanc-gris','rose-blanc':'cloudtilt-template-pink-v3','lilas-blanc':'cloudtilt-template-lilas-blanc-v2','noir-blanc':'cloudtilt-template-noir-blanc-v2'};
/** @type {Record<string,string[]>} */
export const legacyPhotoPaths=Object.fromEntries(Object.entries(legacyFolders).map(([id,folder])=>[id,Array.from({length:6},(_,i)=>'/assets/'+folder+'/'+(i+1)+'.webp')]));
/** Former public/ path → R2 key, for every picture of the site. @type {Record<string,string>} */
export const legacyToKey=Object.fromEntries([
  ...Object.entries(legacyPhotoPaths).flatMap(([id,paths])=>paths.map((path,i)=>[path,photoKeys[id][i]])),
  [siteImages.hero.legacy, siteImages.hero.key],
  ...Object.values(siteImages.categories).map((c)=>[c.legacy,c.key]),
]);
/** R2 key of a stored picture reference (key, or a former public/ path). @param {string} ref */
export const toImageKey=(ref)=>legacyToKey[ref]??ref;

export const galleryLabels=['Vue de la paire','Vue de profil','Vue du dessus','Semelles','Autre profil','Vue arrière'];
