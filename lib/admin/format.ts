/**
 * Mise en forme partagée par les écrans du dashboard. Les dates sont toujours
 * affichées à l'heure du Maroc : un serveur hébergé tourne souvent en UTC.
 */
export { formatDH } from "../site";

const MOROCCO = "Africa/Casablanca";

const toDate = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Un chiffre d'affaires à six chiffres déborde d'une carte : on l'abrège. */
export const formatCompact = (value: number) =>
  value >= 100000 ? `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : value.toLocaleString("fr-FR");

/** « 05/10/2026 », pour les listes. */
export const formatShortDate = (value: Date | string | null | undefined) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString("fr-FR", { timeZone: MOROCCO, day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
};

/** « 05/10/2026 à 11:04 » */
export const formatShortDateTime = (value: Date | string | null | undefined) => {
  const date = toDate(value);
  if (!date) return "—";
  const day = date.toLocaleDateString("fr-FR", { timeZone: MOROCCO, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = date.toLocaleTimeString("fr-FR", { timeZone: MOROCCO, hour: "2-digit", minute: "2-digit" });
  return `${day} à ${time}`;
};

/** « 05 octobre 2026 · 11:04 » */
export const formatLongDateTime = (value: Date | string | null | undefined) => {
  const date = toDate(value);
  if (!date) return "—";
  const day = date.toLocaleDateString("fr-FR", { timeZone: MOROCCO, day: "2-digit", month: "long", year: "numeric" });
  const time = date.toLocaleTimeString("fr-FR", { timeZone: MOROCCO, hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};
