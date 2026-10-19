/** Connexion et déconnexion du dashboard. */
import {
  SESSION_MAX_AGE_SECONDS, adminPassword, checkPassword, createSessionValue,
  isSecureRequest, serializeSessionCookie,
} from "../../../../lib/admin/auth";

export async function POST(request: Request) {
  if (!adminPassword()) {
    return Response.json(
      { ok: false, erreur: "Aucun mot de passe administrateur configuré. Renseignez ADMIN_PASSWORD dans .env.local." },
      { status: 503 },
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ ok: false, erreur: "Requête illisible." }, { status: 400 });
  }

  if (!checkPassword(password)) {
    return Response.json({ ok: false, erreur: "Mot de passe incorrect." }, { status: 401 });
  }

  return Response.json({ ok: true }, {
    headers: { "set-cookie": serializeSessionCookie(await createSessionValue(), SESSION_MAX_AGE_SECONDS, isSecureRequest(request)) },
  });
}

export async function DELETE(request: Request) {
  // Mêmes attributs qu'à la pose, sans quoi le navigateur ne reconnaîtrait pas le cookie à supprimer.
  return Response.json({ ok: true }, {
    headers: { "set-cookie": serializeSessionCookie("", 0, isSecureRequest(request)) },
  });
}
