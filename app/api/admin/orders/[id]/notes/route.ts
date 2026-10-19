/** Note interne ajoutée à l'historique d'une commande. Corps : { message } */
import { requireAdminApi } from "../../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../../lib/admin/respond";
import { addOrderNote } from "../../../../../../lib/orders/mutations";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const id = numericId((await params).id);
  if (id === null) return badId();

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  return toResponse(await addOrderNote(id, body.data), 201);
}
