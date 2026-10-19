/** Changement de statut d'une commande. Corps : { from, to, correction?, reason?, carrier?, trackingNumber? } */
import { requireAdminApi } from "../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../lib/admin/respond";
import { changeOrderStatus } from "../../../../../lib/orders/mutations";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const id = numericId((await params).id);
  if (id === null) return badId();

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  const result = await changeOrderStatus(id, body.data);
  return toResponse(result);
}
