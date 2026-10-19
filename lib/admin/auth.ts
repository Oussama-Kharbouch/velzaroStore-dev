/**
 * Accès au dashboard : mot de passe unique, session signée dans un cookie.
 *
 * Pas de table de sessions : le cookie porte sa propre preuve. Il contient une
 * date d'expiration et sa signature HMAC-SHA256. Sans la clé, on ne peut ni
 * forger un cookie ni repousser l'expiration. Le cookie est HttpOnly, donc
 * invisible au JavaScript de la page, et SameSite=Lax, ce qui bloque les
 * requêtes inter-sites.
 *
 * Le mot de passe vit dans l'environnement (ADMIN_PASSWORD) : .env.local en
 * développement, les variables de l'hébergeur en production. Jamais dans le code.
 */

export const SESSION_COOKIE = "velzaro_admin";

/** Durée d'une session : 12 h, soit une journée de travail. */
const SESSION_MAX_AGE = 60 * 60 * 12;
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE;

export const adminPassword = () => process.env.ADMIN_PASSWORD ?? "";

/**
 * Clé de signature. À défaut de clé dédiée, elle dérive du mot de passe :
 * changer le mot de passe invalide alors toutes les sessions en cours.
 */
const signingKey = () => process.env.ADMIN_SESSION_SECRET || `velzaro::${adminPassword()}`;

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");

const sign = async (payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(signingKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
};

/**
 * Comparaison à durée constante : une comparaison `===` sort au premier
 * caractère différent et laisse deviner la signature octet par octet.
 */
export const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
};

/** Le mot de passe saisi est-il le bon ? Sans mot de passe configuré, personne n'entre. */
export const checkPassword = (candidate: string) => {
  const expected = adminPassword();
  if (!expected) return false;
  return safeEqual(candidate, expected);
};

export const createSessionValue = async () => {
  const expiry = Date.now() + SESSION_MAX_AGE * 1000;
  return `${expiry}.${await sign(String(expiry))}`;
};

/** Le cookie présente-t-il une signature valide et non expirée ? */
export const isValidSession = async (value: string | undefined) => {
  if (!value || !adminPassword()) return false;
  const separator = value.indexOf(".");
  if (separator < 1) return false;

  const expiry = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const deadline = Number(expiry);
  if (!Number.isFinite(deadline) || deadline < Date.now()) return false;

  return safeEqual(signature, await sign(expiry));
};

/**
 * En-tête `Set-Cookie` de la session ; `maxAge` à 0 le supprime (déconnexion).
 * `secure` suit le protocole réel de la requête : en http (aperçu local,
 * téléphone sur le réseau) un cookie Secure serait ignoré et la connexion
 * échouerait en boucle.
 */
export const serializeSessionCookie = (value: string, maxAge: number, secure: boolean) => {
  const parts = [`${SESSION_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

/** La requête est-elle arrivée en HTTPS (y compris derrière le proxy d'un hébergeur) ? */
export const isSecureRequest = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
};
