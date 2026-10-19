/**
 * Lien WhatsApp vers le numéro du client et messages préremplis.
 *
 * Rien n'est envoyé automatiquement : le lien wa.me ouvre WhatsApp avec le
 * message ; l'administrateur le relit et appuie lui-même sur Envoyer. Ouvrir
 * WhatsApp ne change jamais le statut de la commande.
 *
 * Sans dépendance : importable depuis le navigateur.
 */
import type { OrderStatus } from "./status";

/**
 * Numéro marocain au format wa.me (212 + 9 chiffres), ou null s'il n'est pas
 * un mobile marocain valide. Accepte 06…, 07…, +212 6…, 00212 7…
 */
export const whatsappNumber = (raw: string | null | undefined): string | null => {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("2120")) digits = `212${digits.slice(4)}`;
  if (digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  if (/^[67]\d{8}$/.test(digits)) digits = `212${digits}`;
  return /^212[67]\d{8}$/.test(digits) ? digits : null;
};

/** Lien wa.me vers le client, message encodé ; null si le numéro est invalide. */
export const whatsappLink = (phone: string, message: string) => {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
};

const dh = (value: number) => `${value.toLocaleString("fr-FR")} DH`;

/** Référence courte lue par le client, celle affichée à la fin de sa commande. */
export const shortReference = (orderNumber: string) => orderNumber.slice(0, 15).toUpperCase();

export type MessageOrder = {
  number: string;
  status: OrderStatus;
  shippingFee: number;
  total: number;
  customer: { name: string; address: string; city: string };
  lines: { productName: string; colorName: string; size: number; unitPrice: number; quantity: number }[];
};

const greeting = (order: MessageOrder) => `Bonjour *${order.customer.name.trim() || "cher client"}* 👋`;
const signature = "*VELZARO.store*";

export const confirmationMessage = (order: MessageOrder) => [
  greeting(order),
  "",
  `Je vous contacte de la part de *VELZARO* pour confirmer votre commande *${shortReference(order.number)}*.`,
  "",
  "👟 *DÉTAIL DE VOTRE COMMANDE*",
  ...order.lines.flatMap((line) => [
    "",
    `*Modèle :* ${line.productName} — ${line.colorName}`,
    `*Pointure :* ${line.size}`,
    `*Quantité :* ${line.quantity}`,
    `*Prix :* ${dh(line.unitPrice * line.quantity)}`,
  ]),
  "",
  "💰 *RÉCAPITULATIF*",
  "",
  `*Livraison à ${order.customer.city || "votre ville"} :* ${dh(order.shippingFee)}`,
  `*TOTAL À PAYER À LA LIVRAISON :* ${dh(order.total)}`,
  "",
  "📍 *ADRESSE DE LIVRAISON*",
  "",
  `*Adresse :* ${order.customer.address || "—"}`,
  `*Ville :* ${order.customer.city || "—"}`,
  "",
  "Pouvez-vous nous confirmer votre commande, s’il vous plaît ?",
  "",
  "Merci pour votre confiance",
  signature,
].join("\n");

const preparationMessage = (order: MessageOrder) => [
  greeting(order),
  "",
  `Merci d’avoir confirmé votre commande *${shortReference(order.number)}*.`,
  "Nous préparons votre paire avec soin et vous prévenons dès sa remise au livreur.",
  "",
  `*TOTAL À PAYER À LA LIVRAISON :* ${dh(order.total)}`,
  "",
  signature,
].join("\n");

const shippedMessage = (order: MessageOrder) => [
  greeting(order),
  "",
  `Votre commande *${shortReference(order.number)}* est en cours de livraison 🚚`,
  `*Total à payer à la livraison :* ${dh(order.total)}`,
  "",
  "Merci de rester joignable pour faciliter la remise de votre colis.",
  signature,
].join("\n");

const deliveredMessage = (order: MessageOrder) => [
  greeting(order),
  "",
  "Merci pour votre commande chez *VELZARO* 👟",
  `Nous espérons que votre paire vous plaît. Tout est bien arrivé ? Votre retour nous fait plaisir.`,
  "",
  signature,
].join("\n");

const neutralMessage = (order: MessageOrder) => [
  greeting(order),
  "",
  `Je vous contacte de la part de *VELZARO* au sujet de votre commande *${shortReference(order.number)}*.`,
].join("\n");

/** Message adapté au statut de la commande ; modifiable avant l'ouverture de WhatsApp. */
export const messageForStatus = (order: MessageOrder): { title: string; action: string; text: string } => {
  switch (order.status) {
    case "en-attente":
      return { title: "Confirmer sur WhatsApp", action: "Ouvrir WhatsApp", text: confirmationMessage(order) };
    case "confirmee":
    case "en-preparation":
      return { title: "Contacter le client sur WhatsApp", action: "Contacter le client", text: preparationMessage(order) };
    case "expediee":
      return { title: "Contacter le client sur WhatsApp", action: "Informer le client", text: shippedMessage(order) };
    case "livree":
      return { title: "Contacter le client sur WhatsApp", action: "Remercier le client", text: deliveredMessage(order) };
    default:
      return { title: "Contacter le client sur WhatsApp", action: "Contacter le client", text: neutralMessage(order) };
  }
};

/** Message court du bouton « Contacter » de la liste : référence et total. */
export const shortMessage = (order: { number: string; total: number; customerName: string }) => [
  `Bonjour *${order.customerName.trim() || "cher client"}* 👋`,
  "",
  `Je vous contacte de la part de *VELZARO* au sujet de votre commande *${shortReference(order.number)}* (total : *${dh(order.total)}*).`,
].join("\n");
