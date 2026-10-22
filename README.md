# VELZARO.store

Boutique en ligne VELZARO (sneakers Cloudtilt) : catalogue de 11 coloris, pointures 40 à 44, favoris, panier, commande avec paiement à la livraison, interface en français et en arabe (RTL).

- **Framework** : Next.js 16 (App Router), React 19, TypeScript
- **Base de données** : PostgreSQL sur [Neon](https://neon.com), via [Drizzle ORM](https://orm.drizzle.team) et le pilote `@neondatabase/serverless`
- **Hébergement** : Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare) (Worker `velzaro-store`, domaine `prestigea.shop`)
- **Images** : Cloudflare R2 (bucket `velzaro-media`) ; la base ne stocke que leurs clés

## Prérequis

- Node.js **22 recommandé** (wrangler, la prévisualisation du Worker et `neon skills` l'exigent). Avec Node 20, `npm run dev` fonctionne grâce à l'option `--experimental-websocket` des scripts.
- npm (fourni avec Node.js)
- Le CLI Neon pour gérer la base : `npm i -g neon@latest`, puis `neon login`

## Installation et lancement

```sh
npm install
neon env pull               # écrit DATABASE_URL et DATABASE_URL_UNPOOLED dans .env.local
npm run dev                 # http://localhost:3000
```

Sans le CLI Neon, copiez [.env.example](.env.example) en `.env.local` et collez les deux URL données par la console Neon (« Connect »).

Production :

```sh
npm run build
npm start                   # http://localhost:3000 (port modifiable : npm start -- -p 8080, ou PORT=8080)
```

## Base de données

Projet Neon `steep-cherry-94560228`, branche `production` (lien local dans `.neon`, configuration dans [neon.ts](neon.ts)).

| Table | Contenu |
| --- | --- |
| `products` | Produits (Cloudtilt) : nom, slug, description, actif |
| `variants` | Coloris : `slug` (identifiant du panier et des URL, ex. `rose-blanc`), nom, couleur, prix, prix barré, actif, ordre d'affichage |
| `product_images` | 6 images par coloris : URL, texte alternatif, position 1 à 6 |
| `variant_sizes` | Pointures 40 à 44 par coloris, avec `stock` (vide = non suivi) |
| `orders` | Commandes : numéro `VZ-…`, client, téléphone, ville, adresse, sous-total, livraison, total, statut et motif, livreur et n° de suivi, encaissement (frais retenus, montant reçu) |
| `order_items` | Lignes de commande : coloris, pointure, quantité, prix unitaire (copiés au moment de la commande) |
| `order_events` | Historique de chaque commande : création, changements de statut, corrections, notes internes, encaissement |

Statuts de commande ([lib/orders/status.ts](lib/orders/status.ts)) : `en-attente` (À confirmer, par défaut) → `confirmee` → `en-preparation` → `expediee` (En livraison) → `livree`, ou `annulee` / `refusee` / `retournee` avec un motif obligatoire. Paiement : `a-encaisser` ou `encaisse`.

**La boutique lit son catalogue dans la base** : coloris en ligne, prix, prix barré (et badge de remise), pointures épuisées et photos. La page est rendue à chaque visite : une modification du dashboard est visible aussitôt ; si la base ne répond pas, la boutique affiche le catalogue intégré à [lib/catalog.mjs](lib/catalog.mjs). Les prix et pointures sont aussi vérifiés côté serveur à chaque commande. **Stock** : laissé vide, une pointure est toujours commandable ; renseigné, chaque commande le décrémente, la commande est refusée (« Cette pointure n'est plus disponible ») quand il ne suffit plus, et une commande annulée, refusée ou retournée remet ses paires en stock.

**Dates** : toutes les dates des commandes viennent de l'horloge de la base (`now()`), pas de celle du serveur.

## Images (Cloudflare R2)

Toutes les images sont dans le bucket R2 `velzaro-media` :

| Dossier | Contenu |
| --- | --- |
| `products/cloudtilt/<coloris>/1.webp … 6.webp` | Photos d'origine des coloris (envoyées telles quelles) |
| `products/cloudtilt/<coloris>/photo-<n>.webp` (ou `.jpg`) | Photos ajoutées depuis le dashboard (WebP 1600 px qualité 80, JPEG qualité 85 en secours) |
| `banners/hero.webp` | Image d'accueil |
| `categories/homme.webp`, `femme.webp`, `promotions.webp` | Cercles des catégories |

La base (`product_images.url`) stocke la **clé** (`products/cloudtilt/black/1.webp`), jamais l'adresse complète : les adresses sont construites par [lib/r2.ts](lib/r2.ts) à partir de `R2_PUBLIC_URL`. Passer au domaine `https://media.prestigea.shop` = changer cette seule variable. Le cadrage de chaque photo (`app/(store)/*-framing.ts`) est indexé par clé.

- **Envoi depuis le dashboard** : le navigateur prépare la photo (1600 px, WebP qualité 80 par l'encodeur WebAssembly `@jsquash/webp`, qui fonctionne partout y compris Safari/iPhone ; JPEG qualité 85 si l'encodeur ne peut pas tourner), puis `POST /api/upload` (admin seulement, WebP/JPEG vérifiés sur leurs octets, 10 Mo max) la range dans R2. Aucune bibliothèque d'image native côté serveur : elles ne tournent pas sur Workers.
- **Migration des images de `public/`** : `npm run images:r2 -- --dry-run` montre ce qui sera fait ; `npm run images:r2` envoie les fichiers tels quels, vérifie chaque adresse publique (200 et taille), puis met à jour la base. Refusé sur la production sans `--production`. `public/` n'est jamais modifié.
- Une ligne qui contient encore `/assets/…` (base pas encore migrée) reste affichée depuis `public/`.

## Dashboard

Adresse : **`/ALLAH`** (définie par `ADMIN_PATH` dans [lib/site.ts](lib/site.ts) ; `/admin` renvoie à l'accueil). Connexion par le mot de passe `ADMIN_PASSWORD`, session de 12 h dans un cookie signé (HttpOnly, SameSite=Lax). Les pages et les routes `/api/admin/*` refusent toute requête sans session.

| Page | Contenu |
| --- | --- |
| Tableau de bord | Chiffre d'affaires, panier moyen, commandes, à confirmer, à encaisser, clients, dernières commandes, ventes par coloris, stocks à surveiller |
| Commandes | Compteurs par statut, recherche (référence, nom, téléphone sous tous ses formats, ville), filtres par statut et par période, pagination, contact WhatsApp, suppression (corbeille, avec confirmation) |
| Fiche commande | Frise d'avancement, étape suivante en un clic, livreur et n° de suivi, encaissement avec frais du livreur, annulation / refus / retour avec motif, correction manuelle du statut, historique et notes internes, message WhatsApp prérempli selon l'étape |
| Produits | Marque du modèle ; filtres par catégorie (On Homme, On Femme, Unisexe, Non classés) et par statut ; par coloris : catégorie, prix, prix barré, en ligne / masqué, stock par pointure, paires vendues, ordre d'affichage ; fiche complète (nom, nom arabe, couleur, 6 photos), ajout et suppression d'un brouillon |
| Clients | Clients regroupés par téléphone : commandes, total dépensé, dernière commande, accès à leurs commandes et à WhatsApp |

Une vente qui n'aboutit pas est annulée, refusée ou retournée : elle reste dans l'historique et les statistiques. La **corbeille** de la liste des commandes (essai, doublon, fausse commande) ouvre une fenêtre de confirmation, puis fait une **suppression logique** : la commande reçoit une date `deleted_at` et disparaît de la liste, des compteurs, du tableau de bord, des statistiques et des clients, mais ses lignes, son historique et ses notes restent en base (avec une entrée « suppression » dans l'historique) ; elle ne peut plus être modifiée. Si elle n'était pas annulée, ses paires suivies en stock y retournent. La suppression envoie la référence affichée à l'écran : une autre commande ne peut pas partir à sa place. Les changements de statut sont protégés contre le double clic (refusés si la commande a changé entre-temps).

**Catégories** : la marque se saisit sur le modèle (« On »), la catégorie sur chaque coloris (Homme, Femme, Unisexe ; vide = « Non classé »). Rien n'est classé automatiquement. Ces catégories servent au dashboard ; la boutique n'en dépend pas.

**Ordre d'affichage** : panneau « Ordre sur la boutique » en haut de la page Produits — glisser-déposer (ordinateur) ou flèches (téléphone), puis « Enregistrer l'ordre ». L'ordre vaut pour l'accueil, la boutique et les vignettes de coloris.

**Connexions** : l'application utilise l'URL **poolée** (`DATABASE_URL`) ; les migrations et les scripts `db:*` utilisent l'URL **directe** (`DATABASE_URL_UNPOOLED`), comme le recommande Neon.

## Meta Pixel

[components/meta-pixel.tsx](components/meta-pixel.tsx), chargé par la boutique seulement (jamais par le dashboard), et **actif uniquement sur `prestigea.shop` / `www.prestigea.shop`** : en local et en test, aucun événement ne part chez Meta.

| Événement | Moment | Données |
| --- | --- | --- |
| PageView | Chaque page : accueil, rubriques (`/boutique`, `/femme`…) et fiches produit `/cloudtilt/<coloris>` | — |
| ViewContent | Ouverture d'une fiche produit | coloris, prix, MAD |
| AddToCart | Ajout au panier | coloris, prix, quantité, MAD |
| InitiateCheckout | Ouverture du formulaire (« Acheter maintenant » ou « Passer commande ») | coloris, montant, nombre d'articles, MAD |
| Purchase | Commande enregistrée ; `eventID` = n° de commande (VZ-…) | coloris, total livraison comprise, MAD + données client |

Les `content_ids` sont les identifiants du catalogue Meta (`cloudtilt-<coloris>`, `catalogId` dans [lib/catalog.mjs](lib/catalog.mjs)), avec `content_type: 'product'`.

**Flux du catalogue Meta** : [`/feed/meta.csv`](app/feed/meta.csv/route.ts), format CSV « Gestionnaire des ventes », une ligne par coloris en ligne (`id` = `cloudtilt-<coloris>`, `item_group_id` = `cloudtilt`). Construit à chaque lecture à partir des mêmes données que les fiches produit : prix, prix barré (→ `sale_price`), stock (→ `availability`), photos R2 et coloris masqués suivent le dashboard. Aucune donnée client. À programmer dans le Gestionnaire de catalogue avec une mise à jour quotidienne. Protection facultative par authentification HTTP Basic : quand les secrets `FEED_USER` et `FEED_PASSWORD` sont définis, le flux répond `401` sans ces identifiants (à reporter dans les paramètres de la source de données Meta) ; sans eux, il reste ouvert.

Données client de l'achat (« Advanced Matching ») : prénom, nom, téléphone (`212…`), ville et pays (`ma`), normalisés selon les règles Meta puis **hachés en SHA-256** dans le navigateur : Meta ne reçoit que les empreintes. L'adresse n'est jamais envoyée (Meta n'a pas de champ pour la rue).

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Build de production |
| `npm start` | Serveur de production (après `build`) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run db:generate` | Génère une migration SQL dans `drizzle/` après une modification de [db/schema.ts](db/schema.ts) |
| `npm run db:migrate` | Applique les migrations en attente (jamais automatiquement au démarrage) |
| `npm run db:seed` | Remplit le catalogue depuis `lib/catalog.mjs` ; n'ajoute que ce qui manque, n'écrase rien |
| `npm run db:import -- <fichier>` | Importe les commandes de l'ancien site (`.sql`, `.json` ou `.csv`) |
| `npm run db:export` | Exporte toutes les commandes dans `exports/` (JSON + CSV lisible par Excel) |
| `npm run db:studio` | Explorateur de la base (Drizzle Studio) |
| `npm run images:r2 -- --dry-run` | Migration des images de `public/` vers R2 (simulation, puis sans `--dry-run`) |
| `npm run preview` | Build OpenNext puis Worker en local (workerd), comme sur Cloudflare — Node 22 |
| `npm run deploy` | Build et déploiement depuis l'ordinateur — **à éviter** : voir Hébergement |

Avant d'appliquer une migration en production, testez-la sur une branche Neon : `neon branches create --name essai --parent production`, puis lancez `db:migrate` avec les URL de cette branche (`neon connection-string essai`).

## Reprendre les commandes de l'ancien site

Les commandes de l'ancien hébergement sont dans sa base Cloudflare D1 (table `orders` : `id, name, address, phone, items, total, created_at`).

1. Exportez cette table : dump SQL (format `wrangler d1 export`), JSON (`wrangler d1 execute … --json`, ou tableau de lignes) ou CSV avec ces colonnes.
2. `npm run db:import -- chemin/vers/export.sql`

Chaque ancienne commande devient une ligne `orders` (ville, adresse et frais de livraison sont séparés à partir de l'ancienne adresse) et une ligne `order_items` par article ; numéro et date d'origine sont conservés, le statut est `en-attente` (À confirmer) et l'historique note l'import. L'import n'écrase et ne supprime jamais rien : une commande dont le numéro existe déjà est ignorée, il peut donc être relancé, par exemple avec un dernier export au moment de basculer le nom de domaine.

## Hébergement (Cloudflare Workers)

Worker **`velzaro-store`** ([wrangler.jsonc](wrangler.jsonc)), connecté au dépôt GitHub : **chaque push sur `main` déclenche un déploiement** (Workers Builds : `npx opennextjs-cloudflare build` puis `npx opennextjs-cloudflare deploy`). Routes Workers `prestigea.shop/*` et `www.prestigea.shop/*` sur la zone `prestigea.shop`. `keep_vars: true` : un déploiement n'efface pas les variables du tableau de bord.

Variables à définir dans Cloudflare (Workers → velzaro-store → Settings) :

| Variable | Build | Exécution | Type |
| --- | --- | --- | --- |
| `R2_PUBLIC_URL` | ✔ (`next.config.ts`) | ✔ | Texte |
| `DATABASE_URL` (poolée) | — | ✔ | Secret |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | — | ✔ | Secret |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | — | ✔ | Secret |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT` | — | ✔ | Texte |
| `FEED_USER`, `FEED_PASSWORD` (facultatifs) | — | ✔ | Secret |

`DATABASE_URL_UNPOOLED` et `NEON_BRANCH` ne servent qu'aux migrations et scripts lancés depuis l'ordinateur.

- **Ne déployez pas depuis l'ordinateur** (`npm run deploy`) : OpenNext recopie dans le Worker le contenu des fichiers `.env*` présents au moment du build, donc les secrets de `.env.local`. Sur Cloudflare, ce fichier n'existe pas : les secrets viennent du tableau de bord.
- **Base** : une connexion par requête (pilote `@neondatabase/serverless`), fermée après 1 s d'inactivité. **R2** : requêtes S3 signées par `aws4fetch`. Le Worker pèse environ 1,6 Mio compressé (limite du plan gratuit : 3 Mio).

Neon gère les sauvegardes (restauration à un instant donné, branche `backup-avant-0002`) ; `npm run db:export` produit en plus une copie lisible des commandes.

## Structure

```
app/
  (store)/                  boutique (styles propres au groupe)
    page.tsx                accueil (/) : lit le catalogue dans la base et le passe à la boutique
    boutique/ femme/ homme/ promotions/ favoris/
                            une adresse par rubrique (/boutique…), rendue avec la rubrique ouverte ;
                            /home et /accueil → / ; les anciens liens « /#boutique » sont convertis
    cloudtilt/[variant]/    fiche produit /cloudtilt/<coloris>
    store.tsx               boutique (client) : catalogue, fiche produit, panier, favoris, popups, commande
    translations.ts         textes français → arabe
    *-framing.ts            cadrage de chaque photo (vignette, coloris, galerie)
    globals.css             styles du site
  admin/                    dashboard, servi sous /ALLAH (admin.css, orders.css : styles du dashboard)
    connexion/              page de connexion
    (dashboard)/            pages protégées : accueil, commandes, catalogue, clients
  api/orders/route.ts       POST /api/orders : validation (dans la base) et enregistrement d'une commande
  api/admin/                session, statut / notes / encaissement d'une commande, modification d'un coloris
components/admin/           interface du dashboard (menu, cartes de la fiche commande, éditeur de coloris…)
lib/admin/                  authentification, garde d'accès, requêtes et modifications du dashboard
lib/orders/                 statuts, requêtes, modifications et messages WhatsApp des commandes
lib/store-catalog.ts        catalogue de la boutique lu dans la base
lib/catalog.mjs             catalogue intégré (secours), clés R2 des images, source de `npm run db:seed`
lib/r2.ts                   client Cloudflare R2 : envoi, suppression, adresses publiques
lib/site.ts                 adresse du dashboard (ADMIN_PATH)
lib/shipping.ts             frais de livraison (Casablanca 25 DH, autres villes 35 DH)
db/                         schéma Drizzle et pool PostgreSQL
drizzle/                    migrations SQL — ne pas supprimer
scripts/                    amorçage, import et export
neon.ts                     configuration Neon (services, politique des branches)
public/assets/              copie d'origine des images (servies désormais par R2)
```

Le panier, les favoris et la langue sont conservés dans le navigateur (`localStorage` : `vz-cart`, `vz-fav`, `vz-language`).
