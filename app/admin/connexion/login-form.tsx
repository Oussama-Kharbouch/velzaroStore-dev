"use client";

import { useState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { Alert } from "../../../components/admin/bits";
import { ADMIN_PATH } from "../../../lib/site";

/**
 * Connexion au dashboard. Le mot de passe part en POST vers /api/admin/session,
 * qui pose le cookie signé ; la page ne le conserve nulle part.
 */
export default function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok: boolean; erreur?: string };
      if (!data.ok) {
        setError(data.erreur ?? "Connexion impossible.");
        setPassword("");
        setSending(false);
        return;
      }
      // Navigation complète : la garde serveur doit relire le nouveau cookie.
      window.location.href = ADMIN_PATH;
    } catch {
      setError("Le serveur n’a pas répondu. Vérifiez qu’il est démarré.");
      setSending(false);
    }
  };

  return (
    <div className="ad">
      <div className="ad-login">
        <div className="ad-login-card">
          <span className="ad-logo ad-logo-dark">VELZARO<small>.store</small></span>
          <h1>Administration</h1>
          <p>Accès réservé à la gestion de la boutique.</p>

          {!configured && (
            <div style={{ marginBottom: 18 }}>
              <Alert tone="info">
                Aucun mot de passe n’est configuré. Renseignez <strong>ADMIN_PASSWORD</strong> dans
                <strong> .env.local</strong>, puis redémarrez le serveur.
              </Alert>
            </div>
          )}

          <form className="ad-form" onSubmit={submit}>
            <div className={error ? "ad-field invalid" : "ad-field"}>
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" value={password} autoComplete="current-password" autoFocus
                disabled={!configured || sending} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••"/>
              {error && <span className="ad-field-error">{error}</span>}
            </div>
            <button className="ad-btn ad-btn-primary" type="submit" disabled={!configured || sending || !password}>
              {sending ? <LoaderCircle className="ad-spin"/> : <LogIn/>}
              {sending ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
