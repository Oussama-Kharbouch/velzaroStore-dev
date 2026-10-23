/** Nom et/ou marque d'un modèle (dashboard). Corps : { name?, brand? } — marque vide = aucune. L'adresse du modèle ne change pas. */
import { updateModel } from "../../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../lib/admin/respond";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const id = numericId((await params).id);
  if (id === null) return badId();
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  return toResponse(await updateModel(id, body.data));
}
