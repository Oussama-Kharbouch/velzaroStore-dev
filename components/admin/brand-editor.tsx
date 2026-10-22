"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

/** Brand of a model (« On »): shown in front of the categories (On Homme, On Femme). */
export default function BrandEditor({ id, name, brand }: { id: number; name: string; brand: string | null }) {
  const router = useRouter();
  const lock = useRef(false);
  const [value, setValue] = useState(brand ?? "");
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const busy = sending || refreshing;
  const dirty = value.trim() !== (brand ?? "");

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: value }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      if (data.ok) {
        setMessage({ tone: "success", text: "Marque enregistrée." });
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
    <form className="vz-brand" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }}>
      <label className="ad-field">
        <span className="ord-field-label">Marque de {name}</span>
        <input value={value} onChange={(e) => { setValue(e.target.value); setMessage(null); }} maxLength={40} placeholder="Ex. On" aria-label={`Marque de ${name}`}/>
      </label>
      <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || !dirty} aria-busy={busy}>
        {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} Enregistrer
      </button>
      {message && <span className={message.tone === "error" ? "ord-error" : "vz-saved"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</span>}
    </form>
  );
}
