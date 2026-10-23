/** Nouveau modèle (dashboard). Corps : { name, brand } — ses coloris s'ajoutent ensuite depuis sa page. */
import { createModel } from "../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../lib/admin/guard";
import { readJson, toResponse } from "../../../../lib/admin/respond";

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  return toResponse(await createModel(body.data), 201);
}
