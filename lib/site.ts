/**
 * Adresse du dashboard dans le navigateur (velzaro.store/ALLAH). Les fichiers
 * restent dans app/admin : next.config.ts sert cette adresse à partir d'eux et
 * renvoie l'ancienne (/admin) vers l'accueil. Les routes d'API (/api/admin/…)
 * ne changent pas. Sensible à la casse.
 */
export const ADMIN_PATH: string = "/ALLAH";

/** Prix en dirhams, sans centime : le catalogue est en entiers. */
export const formatDH = (value: number) => `${value.toLocaleString("fr-FR")} DH`;
