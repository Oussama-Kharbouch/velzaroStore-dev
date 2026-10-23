"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

/**
 * Name and brand of a model (« Cloudsurfer Max », « On »). The brand is shown in front of the
 * categories (On Homme, On Femme). Renaming keeps the model's address (/<model>/<colourway>).
 */
export default function ModelEditor({ id, name, brand }: { id: number; name: string; brand: string | null }) {
  const router = useRouter();
  const lock = useRef(false);
  const [nameValue, setNameValue] = useState(name);
  const [brandValue, setBrandValue] = useState(brand ?? "");
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const busy = sending || refreshing;
  const nameChanged = nameValue.trim() !== name;
  const brandChanged = brandValue.trim() !== (brand ?? "");
  const dirty = nameChanged || brandChanged;

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(nameChanged ? { name: nameValue } : {}), ...(brandChanged ? { brand: brandValue } : {}) }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      if (data.ok) {
        setMessage({ tone: "success", text: "Modèle enregistré. La boutique est à jour." });
        startRefresh(() => router.refresh());
      } else setMessage({ tone: "error", text: data.erreur ?? "Enregistrement impossible." });
    } catch {
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : rien n’a été enregistré." });
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <form className="vz-brand" onSubmit={(e) => { e.preventDefault(); if (dirty && nameValue.trim().length >= 2) save(); }}>
      <label className="ad-field">
        <span className="ord-field-label">Nom du modèle</span>
        <input value={nameValue} onChange={(e) => { setNameValue(e.target.value); setMessage(null); }} maxLength={60} aria-label="Nom du modèle"/>
      </label>
      <label className="ad-field">
        <span className="ord-field-label">Marque</span>
        <input value={brandValue} onChange={(e) => { setBrandValue(e.target.value); setMessage(null); }} maxLength={40} placeholder="Ex. On" aria-label={`Marque de ${name}`}/>
      </label>
      <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || !dirty || nameValue.trim().length < 2} aria-busy={busy}>
        {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} Enregistrer
      </button>
      {message && <span className={message.tone === "error" ? "ord-error" : "vz-saved"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</span>}
    </form>
  );
}
