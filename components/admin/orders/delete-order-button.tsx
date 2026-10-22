"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "../confirm-dialog";

/**
 * Corbeille d'une commande : fenêtre de confirmation (Annuler / Supprimer), état de chargement,
 * puis message de résultat en haut de la liste (?supprimee=<référence>). Suppression logique :
 * la commande disparaît du dashboard mais ses données restent en base (lib/orders/mutations.ts).
 * La référence est renvoyée au serveur : seule la commande confirmée à l'écran peut partir.
 */
export default function DeleteOrderButton({ id, number, reference, customer, total }: {
  id: number; number: string; reference: string; customer: string; total: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ number }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string; restocked?: number };
      if (!data.ok) { setError(data.erreur ?? "Suppression impossible."); return; }
      const next = new URLSearchParams(params.toString());
      next.set("supprimee", reference);
      if (data.restocked) next.set("stock", String(data.restocked)); else next.delete("stock");
      setOpen(false);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      router.refresh();
    } catch {
      setError("Le serveur n’a pas répondu : la commande n’a pas été supprimée.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="ord-icon-btn ord-icon-btn-danger" onClick={() => { setError(null); setOpen(true); }}
        title="Supprimer la commande" aria-label={`Supprimer la commande ${reference} de ${customer}`}>
        <Trash2 aria-hidden="true"/>
      </button>
      <ConfirmDialog open={open} title="Supprimer cette commande ?" confirmLabel="Supprimer" busy={busy} error={error}
        onConfirm={remove} onCancel={() => setOpen(false)}>
        <p className="ad-dialog-order"><strong>{reference}</strong> · {customer} · {total}</p>
        <p>Elle disparaîtra de la liste, du tableau de bord, des statistiques et de la fiche client.
          Ses données restent conservées en base. Si elle n’était pas annulée, ses paires suivies en stock y retournent.</p>
      </ConfirmDialog>
    </>
  );
}
