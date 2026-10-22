/** Catégorie d'un coloris (dashboard). Corps : { gender: "homme" | "femme" | "unisexe" | null } */
import { setVariantGender } from "../../../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../../lib/admin/respond";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const id = numericId((await params).id);
  if (id === null) return badId();
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  return toResponse(await setVariantGender(id, body.data));
}
