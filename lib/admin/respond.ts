/**
 * Résultats des modifications du dashboard et leur traduction en réponses HTTP,
 * pour que toutes les routes répondent dans le même format :
 *   succès -> { ok: true, ...données }
 *   échec  -> { ok: false, erreur, champ? }
 */
import type { ZodError } from "zod";

export type Result<T> = { ok: true; data: T } | { ok: false; erreur: string; champ?: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const ko = (erreur: string, champ?: string): Result<never> => ({ ok: false, erreur, ...(champ ? { champ } : {}) });

/** Premier problème de validation, en français, avec le champ concerné. */
export const firstIssue = (error: ZodError): Result<never> => {
  const issue = error.issues[0];
  return ko(issue?.message ?? "Données invalides.", issue?.path.join("."));
};

export const toResponse = <T extends object>(result: Result<T>, successStatus = 200): Response => {
  if (result.ok) return Response.json({ ok: true, ...result.data }, { status: successStatus });
  // 422 : la requête est bien formée mais son contenu est refusé.
  return Response.json({ ok: false, erreur: result.erreur, ...(result.champ ? { champ: result.champ } : {}) }, { status: 422 });
};

/** Corps JSON de la requête, ou un échec si le corps est illisible. */
export const readJson = async (request: Request): Promise<Result<Record<string, unknown>>> => {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object") return ko("Requête illisible.");
    return ok(data as Record<string, unknown>);
  } catch {
    return ko("Requête illisible.");
  }
};

/** Identifiant numérique d'une route, ou null. */
export const numericId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const badId = () => Response.json({ ok: false, erreur: "Identifiant invalide." }, { status: 400 });
