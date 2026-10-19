/** Ordre d'affichage d'un coloris. Corps : { direction: "haut" | "bas" } */
import { revalidatePath } from "next/cache";
import { moveVariant } from "../../../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse } from "../../../../../../lib/admin/respond";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const id = numericId((await params).id);
  if (id === null) return badId();
  const body = await readJson(request);
  if (!body.ok) return toResponse(body);
  const result = await moveVariant(id, body.data);
  if (result.ok) revalidatePath("/");
  return toResponse(result);
}
