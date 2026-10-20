/**
 * PATCH : changement de statut. Corps : { from, to, correction?, reason?, carrier?, trackingNumber? }
 * DELETE : suppression définitive. Corps : { number } (référence confirmée à l'écran).
 */
import { requireAdminApi } from "../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../lib/admin/respond";
import { changeOrderStatus, deleteOrder } from "../../../../../lib/orders/mutations";

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

export async function DELETE(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const id = numericId((await params).id);
  if (id === null) return badId();

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  const result = await deleteOrder(id, body.data);
  return toResponse(result);
}
