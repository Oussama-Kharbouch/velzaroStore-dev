/**
 * Garde d'accès au dashboard : rendu d'une page (redirection vers la connexion)
 * et route d'API (réponse 401). Toute page et toute route du dashboard en appelle une.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_PATH } from "../site";
import { SESSION_COOKIE, isValidSession } from "./auth";

export const hasAdminSession = async () => {
  const store = await cookies();
  return isValidSession(store.get(SESSION_COOKIE)?.value);
};

/** En tête de chaque page : `redirect()` interrompt le rendu si la session manque. */
export const requireAdminPage = async () => {
  if (await hasAdminSession()) return;
  redirect(`${ADMIN_PATH}/connexion`);
};

/** En tête de chaque route d'API : une réponse 401 à renvoyer telle quelle, ou null. */
export const requireAdminApi = async (): Promise<Response | null> => {
  if (await hasAdminSession()) return null;
  return Response.json({ ok: false, erreur: "Session expirée ou absente : reconnectez-vous." }, { status: 401 });
};
