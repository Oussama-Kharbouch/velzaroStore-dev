/** Ordre d'affichage de tous les coloris sur la boutique. Corps : { ids } (premier affiché en premier). */
import { setVariantOrder } from "../../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../../lib/admin/guard";
import { readJson, toResponse } from "../../../../../lib/admin/respond";

export async function PUT(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  const result = await setVariantOrder(body.data);
  return toResponse(result);
}
