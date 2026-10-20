"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

/**
 * Suppression définitive d'une commande (essai, doublon, fausse commande), après confirmation.
 * La référence est renvoyée au serveur : seule la commande confirmée à l'écran peut partir.
 */
export default function DeleteOrderButton({ id, number, reference, customer, total }: {
  id: number; number: string; reference: string; customer: string; total: string;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = sending || refreshing;

  const remove = async () => {
    if (lock.current) return;
    const confirmed = window.confirm(
      `Supprimer définitivement la commande ${reference} ?\n\n${customer} · ${total}\n\n`
      + "Elle disparaîtra du dashboard, des statistiques et de la fiche client, avec son historique et ses notes. "
      + "Si elle n’était pas annulée, ses paires suivies en stock y retournent.\n\nCette action est irréversible.",
    );
    if (!confirmed) return;
    lock.current = true;
    setSending(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ number }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      if (data.ok) startRefresh(() => router.refresh());
      else window.alert(data.erreur ?? "Suppression impossible.");
    } catch {
      window.alert("Le serveur n’a pas répondu : la commande n’a pas été supprimée.");
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <button type="button" className="ord-icon-btn ord-icon-btn-danger" onClick={remove} disabled={busy} aria-busy={busy}
      title="Supprimer la commande" aria-label={`Supprimer la commande ${reference} de ${customer}`}>
      {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Trash2 aria-hidden="true"/>}
    </button>
  );
}
