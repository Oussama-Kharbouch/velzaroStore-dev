"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Envoi d'une action sur une commande, partage par tous les boutons de la fiche.
 *
 * - Un seul envoi a la fois : un double clic ne part qu'une fois (verrou
 *   immediat, avant meme le rendu qui desactive le bouton). Le serveur refuse
 *   de toute facon un changement fait sur un statut deja depasse.
 * - Apres l'enregistrement, seules les donnees de la page sont relues
 *   (`router.refresh`), sans rechargement complet ; le bouton reste occupe
 *   jusqu'a ce qu'elles soient a jour.
 * - En cas d'echec, le message du serveur est affiche et la page relue : elle
 *   montre l'etat reel si quelqu'un d'autre a modifie la commande.
 */
export const useOrderAction = (orderId: number) => {
  const router = useRouter();
  const lock = useRef(false);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");

  const run = async (path: "" | "/notes" | "/payment", method: "PATCH" | "POST", body: object) => {
    if (lock.current) return false;
    lock.current = true;
    setSending(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };

      if (!data.ok) setError(data.erreur ?? "Enregistrement impossible.");
      startRefresh(() => router.refresh());
      return data.ok;
    } catch {
      setError("Le serveur n’a pas répondu : rien n’a été enregistré. Vérifiez la connexion puis réessayez.");
      return false;
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return { run, busy: sending || refreshing, error, setError };
};
