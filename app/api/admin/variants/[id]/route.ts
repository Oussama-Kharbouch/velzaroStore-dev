/**
 * Un coloris.
 * PATCH  : modification rapide depuis la liste { price, oldPrice, active, stocks }
 * PUT    : fiche complète { name, nameAr, hex, price, oldPrice, active, photos, stocks }
 * DELETE : suppression d'un coloris jamais commandé
 * La boutique est régénérée aussitôt après chaque modification.
 */
import { revalidatePath } from "next/cache";
import { deleteVariant, saveVariant, updateVariant } from "../../../../../lib/admin/catalog";
import { requireAdminApi } from "../../../../../lib/admin/guard";
import { badId, numericId, readJson, toResponse, type Result } from "../../../../../lib/admin/respond";

type Context = { params: Promise<{ id: string }> };

const handle = async (request: Request, { params }: Context, run: (id: number, body: Record<string, unknown>) => Promise<Result<{ id: number }>>) => {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const id = numericId((await params).id);
  if (id === null) return badId();
  let data: Record<string, unknown> = {};
  if (request.method !== "DELETE") {
    const body = await readJson(request);
    if (!body.ok) return toResponse(body);
    data = body.data;
  }
  const result = await run(id, data);
  if (result.ok) revalidatePath("/");
  return toResponse(result);
};

export const PATCH = (request: Request, context: Context) => handle(request, context, updateVariant);
export const PUT = (request: Request, context: Context) => handle(request, context, saveVariant);
export const DELETE = (request: Request, context: Context) => handle(request, context, (id) => deleteVariant(id));
