import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "../lib/orders/status";
import { GENDERS } from "../lib/catalog-categories";
import type { ComfortContent } from "../lib/comfort";

export { ORDER_STATUSES, PAYMENT_STATUSES, GENDERS };

/**
 * Schéma PostgreSQL (Neon).
 *
 * Prix en dirhams entiers : le catalogue n'a aucun centime, et un entier évite
 * les dérives d'arrondi sur les totaux. Les images restent dans public/ (ou un
 * stockage externe) : la base ne garde que leur URL.
 */

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  // Marque du modèle (« On ») ; null = non renseignée. Saisie dans le dashboard.
  brand: text("brand"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Coloris d'un produit. `slug` est l'identifiant utilisé par le panier et les URL (#produit/<slug>). */
export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  slug: text("slug").notNull().unique(),
  colorName: text("color_name").notNull(),
  // Nom affiché en arabe ; null = traduction intégrée à la boutique (translations.ts).
  colorNameAr: text("color_name_ar"),
  colorHex: text("color_hex").notNull(),
  price: integer("price").notNull(),
  // Prix barré ; null = pas de prix barré.
  oldPrice: integer("old_price"),
  active: boolean("active").notNull().default(true),
  // Ordre d'affichage des coloris.
  position: integer("position").notNull().default(0),
  // Catégorie du dashboard : homme, femme ou unisexe ; null = non classé (jamais deviné).
  gender: text("gender", { enum: GENDERS }),
  // Vignette du coloris sur la fiche produit (clé R2 : une de ses photos, ou une vignette
  // 150×150 dédiée) ; null = sa 1re photo.
  thumbnail: text("thumbnail"),
  // Section « Pourquoi vous allez l'adorer » de la fiche du coloris (dashboard, avec ses photos) ;
  // null = texte intégré du modèle (lib/comfort.ts).
  comfort: jsonb("comfort").$type<ComfortContent>(),
}, (table) => [
  index("variants_product_idx").on(table.productId),
  check("variants_price_positive", sql`${table.price} > 0`),
  check("variants_gender_valid", sql`${table.gender} is null or ${table.gender} in (${sql.raw(GENDERS.map((g) => `'${g}'`).join(", "))})`),
]);

/**
 * Photos téléversées depuis le dashboard. L'identifiant est la clé dans le bucket
 * Cloudflare R2 (`products/cloudtilt/sable-noir/3.webp`) ; l'adresse publique est
 * construite par lib/r2.ts. L'empreinte du contenu évite de stocker deux fois la
 * même photo.
 */
export const media = pgTable("media", {
  id: text("id").primaryKey(),
  sha256: text("sha256").notNull().unique(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt").notNull().default(""),
  position: integer("position").notNull(),
}, (table) => [uniqueIndex("product_images_variant_position_idx").on(table.variantId, table.position)]);

export const variantSizes = pgTable("variant_sizes", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  size: integer("size").notNull(),
  // Null = stock non suivi (pointure toujours commandable). Un nombre active le suivi :
  // la commande est refusée au-delà et le stock est décrémenté.
  stock: integer("stock"),
}, (table) => [
  uniqueIndex("variant_sizes_variant_size_idx").on(table.variantId, table.size),
  check("variant_sizes_stock_non_negative", sql`${table.stock} is null or ${table.stock} >= 0`),
]);

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  // « VZ-<uuid> » : la clé générée par le navigateur pour chaque passage en caisse.
  // Unique, elle empêche qu'une commande renvoyée deux fois soit enregistrée deux fois.
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  subtotal: integer("subtotal").notNull(),
  shippingFee: integer("shipping_fee").notNull(),
  total: integer("total").notNull(),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("en-attente"),
  // Motif d'une annulation, d'un refus ou d'un retour.
  statusReason: text("status_reason").notNull().default(""),
  carrier: text("carrier").notNull().default(""),
  trackingNumber: text("tracking_number").notNull().default(""),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  // Paiement à la livraison : suivi à part, une commande livrée reste « à encaisser »
  // tant que l'argent n'est pas reçu du livreur.
  paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES }).notNull().default("a-encaisser"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  // Frais retenus par le livreur, et montant réellement reçu.
  collectionFees: integer("collection_fees").notNull().default(0),
  amountReceived: integer("amount_received"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Suppression logique (corbeille du dashboard) : la commande disparaît de tous les écrans
  // et des statistiques, mais ses données restent en base. Null = commande visible.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("orders_created_at_idx").on(table.createdAt),
  index("orders_deleted_at_idx").on(table.deletedAt),
  index("orders_status_idx").on(table.status),
  index("orders_phone_idx").on(table.phone),
  check("orders_status_valid", sql`${table.status} in (${inList(ORDER_STATUSES)})`),
  check("orders_payment_status_valid", sql`${table.paymentStatus} in (${inList(PAYMENT_STATUSES)})`),
]);

export const ORDER_EVENT_KINDS = ["creation", "status", "correction", "note", "payment", "suppression"] as const;

/** Historique d'une commande : création, changements de statut, notes internes, encaissement. */
export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ORDER_EVENT_KINDS }).notNull(),
  fromStatus: text("from_status", { enum: ORDER_STATUSES }),
  toStatus: text("to_status", { enum: ORDER_STATUSES }),
  message: text("message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("order_events_order_idx").on(table.orderId)]);

/** Lignes de commande. Nom, coloris et prix sont copiés : la commande reste exacte si le catalogue change. */
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "restrict" }),
  productName: text("product_name").notNull(),
  colorName: text("color_name").notNull(),
  size: integer("size").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId),
  check("order_items_quantity_positive", sql`${table.quantity} > 0`),
]);

/**
 * Offre limitée (bandeau « عرض محدود » avec compte à rebours), réglée dans le dashboard.
 * Une seule ligne (id = 1). Fin nulle = aucune offre ; modèles vides = tous les modèles.
 * Sans ligne, la boutique lit encore VZ_PROMO_START_AT / VZ_PROMO_END_AT (lib/promo.ts).
 */
export const shopPromo = pgTable("shop_promo", {
  id: integer("id").primaryKey().default(1),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  models: text("models").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check("shop_promo_single_row", sql`${table.id} = 1`)]);
