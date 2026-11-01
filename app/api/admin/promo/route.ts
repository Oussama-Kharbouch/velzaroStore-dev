/** Limited-time offer (dashboard, Offre page). Body: { startAt?, endAt, models } — endAt null stops it. */
import { savePromo } from "../../../../lib/admin/promo";
import { requireAdminApi } from "../../../../lib/admin/guard";
import { readJson, toResponse } from "../../../../lib/admin/respond";

export async function PUT(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  return toResponse(await savePromo(body.data));
}
