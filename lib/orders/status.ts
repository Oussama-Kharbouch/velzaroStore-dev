/**
 * Statuts d'une commande et règles de passage de l'un à l'autre.
 *
 * Module sans dépendance : la base (schema.ts), le serveur (transitions) et
 * le navigateur (boutons, badges) lisent les mêmes règles.
 */

export const ORDER_STATUSES = [
  "en-attente", "confirmee", "en-preparation", "expediee", "livree", "annulee", "refusee", "retournee",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["a-encaisser", "encaisse"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Parcours principal, dans l'ordre. */
export const ORDER_FLOW = ["en-attente", "confirmee", "en-preparation", "expediee", "livree"] as const satisfies readonly OrderStatus[];

/** Fins de parcours anticipées : un motif est obligatoire. */
export const CLOSING_STATUSES = ["annulee", "refusee", "retournee"] as const satisfies readonly OrderStatus[];

/** Statuts qui ne comptent pas dans le chiffre d'affaires. */
export const LOST_STATUSES: readonly OrderStatus[] = CLOSING_STATUSES;

export type StatusTone = "amber" | "blue" | "purple" | "orange" | "green" | "grey" | "red" | "slate";

export const ORDER_STATUS_INFO: Record<OrderStatus, { label: string; plural: string; tone: StatusTone }> = {
  "en-attente": { label: "À confirmer", plural: "À confirmer", tone: "amber" },
  confirmee: { label: "Confirmée", plural: "Confirmées", tone: "blue" },
  "en-preparation": { label: "En préparation", plural: "En préparation", tone: "purple" },
  expediee: { label: "En livraison", plural: "En livraison", tone: "orange" },
  livree: { label: "Livrée", plural: "Livrées", tone: "green" },
  annulee: { label: "Annulée", plural: "Annulées", tone: "grey" },
  refusee: { label: "Refusée", plural: "Refusées", tone: "red" },
  retournee: { label: "Retournée", plural: "Retournées", tone: "slate" },
};

export const PAYMENT_STATUS_INFO: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  "a-encaisser": { label: "À encaisser", tone: "amber" },
  encaisse: { label: "Encaissé", tone: "green" },
};

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  ORDER_STATUSES.includes(value as OrderStatus);

export const isClosing = (status: OrderStatus) => (CLOSING_STATUSES as readonly OrderStatus[]).includes(status);

/** Étape suivante du parcours principal et libellé du bouton qui y mène. */
export type NextStep = { to: OrderStatus; action: string; title: string; hint: string };

const NEXT_STEPS: Partial<Record<OrderStatus, NextStep>> = {
  "en-attente": {
    to: "confirmee", action: "Confirmer la commande", title: "Confirmer avec le client",
    hint: "Contactez le client sur WhatsApp, puis confirmez une fois sa réponse reçue.",
  },
  confirmee: {
    to: "en-preparation", action: "Passer en préparation", title: "Prochaine étape",
    hint: "Le client a confirmé sa commande. Préparez et emballez la paire.",
  },
  "en-preparation": {
    to: "expediee", action: "Remettre au livreur", title: "Remise au livreur",
    hint: "Le colis est prêt. Indiquez le transporteur et le numéro de suivi.",
  },
  expediee: {
    to: "livree", action: "Marquer comme livrée", title: "Suivi de livraison",
    hint: "La commande est en cours de livraison. À utiliser après confirmation de la réception.",
  },
};

export const nextStep = (status: OrderStatus): NextStep | null => NEXT_STEPS[status] ?? null;

/**
 * Fins anticipées proposées selon l'étape : on annule avant l'envoi, le
 * client refuse à la livraison, il retourne après l'avoir reçue.
 */
export const closingOptions = (status: OrderStatus): OrderStatus[] => {
  switch (status) {
    case "en-attente": case "confirmee": case "en-preparation": return ["annulee"];
    case "expediee": return ["refusee", "retournee"];
    case "livree": return ["retournee"];
    default: return [];
  }
};

/** Transition du parcours normal (bouton principal ou fin anticipée). */
export const isRegularTransition = (from: OrderStatus, to: OrderStatus) =>
  nextStep(from)?.to === to || closingOptions(from).includes(to);

/** Le motif est obligatoire pour annuler, refuser ou retourner. */
export const needsReason = (to: OrderStatus) => isClosing(to);

/** Rang dans le parcours principal (-1 hors parcours), pour la frise. */
export const flowIndex = (status: OrderStatus) => (ORDER_FLOW as readonly OrderStatus[]).indexOf(status);
