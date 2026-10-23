"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
import { ADMIN_PATH } from "../../lib/site";

/** "Ajouter un modèle": name and brand; once created, its page opens to add its colourways. */
export default function ModelCreate() {
  const router = useRouter();
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, brand }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; id?: number; erreur?: string };
      if (data.ok && data.id) { router.push(`${ADMIN_PATH}/produits/modeles/${data.id}`); return; }
      setError(data.erreur ?? "Création impossible.");
    } catch {
      setError("Le serveur n’a pas répondu : le modèle n’a pas été créé.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (!open) {
    return <button type="button" className="ad-btn" onClick={() => setOpen(true)}><Plus aria-hidden="true"/> Ajouter un modèle</button>;
  }
  return (
    <form className="vz-model-create" onSubmit={(e) => { e.preventDefault(); create(); }}>
      <label className="ad-field">
        <span className="ord-field-label">Nom du modèle *</span>
        <input value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={60} placeholder="Ex. Cloudmonster" aria-label="Nom du nouveau modèle" autoFocus/>
      </label>
      <label className="ad-field">
        <span className="ord-field-label">Marque</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={40} placeholder="Ex. On" aria-label="Marque du nouveau modèle"/>
      </label>
      <div className="vz-model-create-actions">
        <button type="button" className="ad-btn" onClick={() => { setOpen(false); setError(null); }} disabled={busy}><X aria-hidden="true"/> Annuler</button>
        <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || name.trim().length < 2} aria-busy={busy}>
          {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Plus aria-hidden="true"/>} Créer le modèle
        </button>
      </div>
      {error && <p className="ord-error" role="alert">{error}</p>}
    </form>
  );
}
