/** Création d'un coloris. Corps : { name, nameAr, hex, price, oldPrice, active, photos, stocks } */
import { createVariant } from "../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../lib/admin/guard";
import { readJson, toResponse } from "../../../../lib/admin/respond";

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  const result = await createVariant(body.data);
  return toResponse(result, 201);
}
