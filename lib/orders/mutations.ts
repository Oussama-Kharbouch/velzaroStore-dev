/**
 * Modifications d'une commande depuis le dashboard : statut, note interne,
 * encaissement. Chaque modification est validée ici, enregistrée avec son
 * entrée d'historique dans la même transaction, et protégée contre le double
 * clic : la mise à jour ne s'applique que si la commande est toujours dans
 * l'état que l'administrateur avait sous les yeux.
 *
 * Une vente qui n'aboutit pas est annulée, refusée ou retournée (elle reste dans
 * l'historique). La suppression définitive (deleteOrder) sert aux commandes à
 * effacer : essais, doublons, fausses commandes.
 */
import "server-only";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../../db";
import { firstIssue, ko, ok, type Result } from "../admin/respond";
import {
  ORDER_STATUSES, ORDER_STATUS_INFO, flowIndex, isClosing, isRegularTransition, needsReason, type OrderStatus,
} from "./status";

const { orders, orderItems, orderEvents, variantSizes } = schema;

const REASON_MAX = 300;
const NOTE_MAX = 500;

class StockShortage extends Error {}

const STATUS_EVENT_TEXT: Partial<Record<OrderStatus, string>> = {
  confirmee: "Le client a confirmé sa commande.",
  "en-preparation": "La commande est en cours de préparation.",
  expediee: "La commande a été remise au transporteur.",
  livree: "La commande a été livrée et réceptionnée.",
  annulee: "Commande annulée.",
  refusee: "Le client a refusé la commande à la livraison.",
  retournee: "La paire a été retournée.",
};

const statusSchema = z.object({
  /** Statut affiché au moment du clic : refusé si la commande a changé depuis. */
  from: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: "Statut actuel inconnu." }) }),
  to: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: "Statut demandé inconnu." }) }),
  /** Correction manuelle, hors parcours normal (« Changer le statut »). */
  correction: z.boolean().default(false),
  reason: z.string().trim().max(REASON_MAX, `Motif limité à ${REASON_MAX} caractères.`).default(""),
  carrier: z.string().trim().max(80).default(""),
  trackingNumber: z.string().trim().max(80).default(""),
});

export const changeOrderStatus = async (id: number, payload: unknown): Promise<Result<{ id: number; status: OrderStatus; stockChanged: boolean }>> => {
  const parsed = statusSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const { from, to, correction, reason, carrier, trackingNumber } = parsed.data;

  if (from === to) return ko("La commande est déjà dans ce statut.");
  if (!correction && !isRegularTransition(from, to)) {
    return ko(`Passage impossible de « ${ORDER_STATUS_INFO[from].label} » à « ${ORDER_STATUS_INFO[to].label} ». Utilisez « Changer le statut » pour corriger.`);
  }
  if (needsReason(to) && reason.length < 3) return ko("Indiquez le motif (3 caractères minimum).", "reason");

  // Database clock, not the server clock: one reliable time source for every date of an order.
  const now = sql`now()`;
  // Dates de livraison : posées au passage, effacées si une correction ramène la commande avant l'étape.
  const toFlow = flowIndex(to);
  const shippedAt = to === "expediee" ? now : toFlow >= 0 && toFlow < flowIndex("expediee") ? null : undefined;
  const deliveredAt = to === "livree" ? now : toFlow >= 0 && toFlow < flowIndex("livree") ? null : undefined;

  // Stock suivi : une vente perdue rend ses paires, une vente réactivée les reprend.
  const restock = !isClosing(from) && isClosing(to);
  const destock = isClosing(from) && !isClosing(to);

  try {
    return await getDb().transaction(async (tx) => {
      const updated = await tx.update(orders).set({
        status: to,
        statusReason: isClosing(to) ? reason : "",
        updatedAt: now,
        ...(shippedAt !== undefined ? { shippedAt } : {}),
        ...(deliveredAt !== undefined ? { deliveredAt } : {}),
        ...(to === "expediee" && (carrier || trackingNumber) ? { carrier, trackingNumber } : {}),
      }).where(and(eq(orders.id, id), eq(orders.status, from), isNull(orders.deletedAt))).returning({ id: orders.id });

      if (updated.length === 0) {
        const [current] = await tx.select({ status: orders.status }).from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
        if (!current) return ko("Cette commande n'existe pas.");
        return ko(`La commande est déjà « ${ORDER_STATUS_INFO[current.status].label} » : la page a été mise à jour, vérifiez avant de recommencer.`);
      }

      let stockChanged = false;
      if (restock || destock) {
        const lines = await tx.select({ variantId: orderItems.variantId, size: orderItems.size, quantity: orderItems.quantity })
          .from(orderItems).where(eq(orderItems.orderId, id));
        for (const line of lines) {
          const match = and(eq(variantSizes.variantId, line.variantId), eq(variantSizes.size, line.size), isNotNull(variantSizes.stock));
          if (restock) {
            const r = await tx.update(variantSizes).set({ stock: sql`${variantSizes.stock} + ${line.quantity}` }).where(match).returning({ id: variantSizes.id });
            stockChanged ||= r.length > 0;
          } else {
            const [tracked] = await tx.select({ stock: variantSizes.stock }).from(variantSizes).where(match).limit(1);
            if (!tracked) continue;
            const r = await tx.update(variantSizes).set({ stock: sql`${variantSizes.stock} - ${line.quantity}` })
              .where(and(match, gte(variantSizes.stock, line.quantity))).returning({ id: variantSizes.id });
            if (!r.length) throw new StockShortage(`Stock insuffisant en pointure ${line.size} pour réactiver la commande : ajustez le stock dans le catalogue.`);
            stockChanged = true;
          }
        }
      }

      const details = [
        correction ? `Correction : ${ORDER_STATUS_INFO[from].label} → ${ORDER_STATUS_INFO[to].label}.` : STATUS_EVENT_TEXT[to] ?? "",
        reason ? `Motif : ${reason}` : "",
        to === "expediee" && carrier ? `Transporteur : ${carrier}` : "",
        to === "expediee" && trackingNumber ? `N° de suivi : ${trackingNumber}` : "",
        restock && stockChanged ? "Les paires suivies en stock ont été remises en stock." : "",
        destock && stockChanged ? "Les paires suivies en stock ont été reprises du stock." : "",
      ].filter(Boolean).join("\n");

      await tx.insert(orderEvents).values({
        orderId: id, kind: correction ? "correction" : "status", fromStatus: from, toStatus: to, message: details, createdAt: now,
      });
      return ok({ id, status: to, stockChanged });
    });
  } catch (error) {
    if (error instanceof StockShortage) return ko(error.message);
    throw error;
  }
};

/**
 * Suppression d'une commande depuis la corbeille du dashboard : suppression LOGIQUE.
 * La commande reçoit une date de suppression (orders.deleted_at) et disparaît de tous les
 * écrans et des statistiques ; ses lignes, son historique et ses notes restent en base,
 * avec une entrée « suppression » dans l'historique.
 * Corps : { number } — la référence affichée au moment du clic, pour ne jamais supprimer
 * une autre commande que celle confirmée à l'écran.
 * Une commande encore en cours avait pris ses paires dans le stock suivi : elles y
 * retournent. Une commande annulée, refusée ou retournée les a déjà rendues.
 */
export const deleteOrder = async (id: number, payload: unknown): Promise<Result<{ id: number; number: string; restocked: number }>> => {
  const parsed = z.object({ number: z.string().trim().min(1, "Référence manquante.") }).safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);

  return getDb().transaction(async (tx) => {
    const [order] = await tx.select({ number: orders.orderNumber, status: orders.status, deletedAt: orders.deletedAt })
      .from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
    if (!order || order.deletedAt) return ko("Cette commande n'existe plus : la liste a été mise à jour.");
    if (order.number !== parsed.data.number) return ko("La référence ne correspond pas : rechargez la page avant de recommencer.");

    // Only an order still visible is marked: a double click cannot delete twice (nor restock twice).
    const marked = await tx.update(orders).set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(orders.id, id), isNull(orders.deletedAt))).returning({ id: orders.id });
    if (!marked.length) return ko("Cette commande vient d'être supprimée.");

    let restocked = 0;
    if (!isClosing(order.status)) {
      const lines = await tx.select({ variantId: orderItems.variantId, size: orderItems.size, quantity: orderItems.quantity })
        .from(orderItems).where(eq(orderItems.orderId, id));
      for (const line of lines) {
        const r = await tx.update(variantSizes).set({ stock: sql`${variantSizes.stock} + ${line.quantity}` })
          .where(and(eq(variantSizes.variantId, line.variantId), eq(variantSizes.size, line.size), isNotNull(variantSizes.stock)))
          .returning({ id: variantSizes.id });
        if (r.length) restocked += line.quantity;
      }
    }
    await tx.insert(orderEvents).values({
      orderId: id, kind: "suppression", createdAt: sql`now()`,
      message: ["Commande supprimée depuis le dashboard (données conservées).",
        restocked ? `${restocked} paire${restocked > 1 ? "s" : ""} remise${restocked > 1 ? "s" : ""} en stock.` : ""].filter(Boolean).join("\n"),
    });
    return ok({ id, number: order.number, restocked });
  });
};

const noteSchema = z.object({
  message: z.string().trim().min(1, "La note est vide.").max(NOTE_MAX, `Note limitée à ${NOTE_MAX} caractères.`),
});

export const addOrderNote = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = noteSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);

  const db = getDb();
  const [order] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
  if (!order) return ko("Cette commande n'existe pas.");

  await db.insert(orderEvents).values({ orderId: id, kind: "note", message: parsed.data.message });
  return ok({ id });
};

const paymentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("encaisser"),
    /** Frais ou retenues du livreur, en dirhams. */
    fees: z.coerce.number({ invalid_type_error: "Montant des frais invalide." }).int("Montant en dirhams entiers.")
      .min(0, "Les frais ne peuvent pas être négatifs.").default(0),
  }),
  z.object({ action: z.literal("annuler") }),
], { errorMap: () => ({ message: "Action de paiement inconnue." }) });

/**
 * Encaissement d'une commande livrée, séparé du statut de livraison : une
 * commande livrée reste « à encaisser » tant que l'argent n'est pas reçu.
 */
export const recordOrderPayment = async (id: number, payload: unknown): Promise<Result<{ id: number }>> => {
  const parsed = paymentSchema.safeParse(payload);
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  return getDb().transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status, total: orders.total }).from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
    if (!order) return ko("Cette commande n'existe pas.");
    const now = sql`now()`;

    if (input.action === "encaisser") {
      if (order.status !== "livree") return ko("Seule une commande livrée peut être encaissée.");
      if (input.fees > order.total) return ko("Les frais dépassent le total de la commande.", "fees");
      const received = order.total - input.fees;
      const updated = await tx.update(orders).set({
        paymentStatus: "encaisse", paidAt: now, collectionFees: input.fees, amountReceived: received, updatedAt: now,
      }).where(and(eq(orders.id, id), eq(orders.paymentStatus, "a-encaisser"), isNull(orders.deletedAt))).returning({ id: orders.id });
      if (updated.length === 0) return ko("Le paiement est déjà enregistré comme encaissé.");
      await tx.insert(orderEvents).values({
        orderId: id, kind: "payment", createdAt: now,
        message: `Paiement encaissé : ${received.toLocaleString("fr-FR")} DH reçus`
          + (input.fees > 0 ? ` (${input.fees.toLocaleString("fr-FR")} DH de frais retenus sur ${order.total.toLocaleString("fr-FR")} DH).` : "."),
      });
      return ok({ id });
    }

    const updated = await tx.update(orders).set({
      paymentStatus: "a-encaisser", paidAt: null, collectionFees: 0, amountReceived: null, updatedAt: now,
    }).where(and(eq(orders.id, id), eq(orders.paymentStatus, "encaisse"), isNull(orders.deletedAt))).returning({ id: orders.id });
    if (updated.length === 0) return ko("Le paiement n'est pas enregistré comme encaissé.");
    await tx.insert(orderEvents).values({
      orderId: id, kind: "payment", createdAt: now, message: "Correction : encaissement annulé, paiement de nouveau à encaisser.",
    });
    return ok({ id });
  });
};
