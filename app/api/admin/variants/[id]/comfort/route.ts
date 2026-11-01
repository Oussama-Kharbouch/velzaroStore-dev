/** « Pourquoi vous allez l'adorer » section of a colourway (dashboard). Body: { comfort, allColourways? }. */
import { saveVariantComfort } from "../../../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../../lib/admin/respond";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const id = numericId((await params).id);
  if (id === null) return badId();
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  return toResponse(await saveVariantComfort(id, body.data));
}
