"use client";

import { useState } from "react";
import { CircleX, LoaderCircle, PencilLine, Settings, Undo2 } from "lucide-react";
import { ORDER_STATUSES, ORDER_STATUS_INFO, closingOptions, needsReason, type OrderStatus } from "../../../lib/orders/status";
import { useOrderAction } from "./use-order-action";

const CLOSING_ACTION: Partial<Record<OrderStatus, { label: string; icon: typeof CircleX; prompt: string }>> = {
  annulee: { label: "Annuler la commande", icon: CircleX, prompt: "Motif de l’annulation" },
  refusee: { label: "Signaler un refus", icon: CircleX, prompt: "Motif du refus à la livraison" },
  retournee: { label: "Signaler un retour", icon: Undo2, prompt: "Motif du retour" },
};

type Panel = { kind: "closing"; to: OrderStatus } | { kind: "correction" } | null;

/**
 * Actions secondaires : fins anticipees (motif obligatoire) et correction
 * manuelle du statut, toujours confirmees et inscrites a l'historique.
 */
export default function StatusActions({ orderId, status, children }: {
  orderId: number;
  status: OrderStatus;
  /** Suppression de la commande, rendue par la page. */
  children?: React.ReactNode;
}) {
  const { run, busy, error, setError } = useOrderAction(orderId);
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<OrderStatus | "">("");

  const open = (next: Panel) => {
    setPanel(next);
    setReason("");
    setTarget("");
    setError("");
  };

  const to = panel?.kind === "closing" ? panel.to : target || null;
  const reasonRequired = to ? needsReason(to) : false;
  const ready = Boolean(to) && (!reasonRequired || reason.trim().length >= 3);

  const submit = async () => {
    if (!to || !ready) return;
    const label = ORDER_STATUS_INFO[to].label;
    const message = panel?.kind === "correction"
      ? `Corriger le statut : « ${ORDER_STATUS_INFO[status].label} » → « ${label} » ?\n\nLa correction sera inscrite dans l’historique.`
      : `Passer la commande en « ${label} » ?`;
    if (!window.confirm(message)) return;

    const done = await run("", "PATCH", {
      from: status, to, reason: reason.trim(), correction: panel?.kind === "correction",
    });
    if (done) open(null);
  };

  return (
    <section className="ad-panel ord-card">
      <div className="ord-card-head">
        <Settings className="ord-card-icon" aria-hidden="true"/>
        <h2>Autres actions</h2>
      </div>

      <div className="ord-card-body ord-actions">
        <button type="button" className="ord-btn ord-btn-outline" onClick={() => open(panel?.kind === "correction" ? null : { kind: "correction" })}>
          <PencilLine aria-hidden="true"/> Changer le statut
        </button>

        {closingOptions(status).map((closing) => {
          const action = CLOSING_ACTION[closing]!;
          const Icon = action.icon;
          return (
            <button
              key={closing}
              type="button"
              className="ord-btn ord-btn-danger"
              onClick={() => open(panel?.kind === "closing" && panel.to === closing ? null : { kind: "closing", to: closing })}
            >
              <Icon aria-hidden="true"/> {action.label}
            </button>
          );
        })}

        {panel && (
          <div className="ord-panel" role="group" aria-label={panel.kind === "correction" ? "Corriger le statut" : "Motif"}>
            {panel.kind === "correction" && (
              <label className="ad-field">
                <span className="ord-field-label">Nouveau statut</span>
                <select className="ad-select" value={target} onChange={(event) => setTarget(event.target.value as OrderStatus)}>
                  <option value="">Choisir…</option>
                  {ORDER_STATUSES.filter((value) => value !== status).map((value) => (
                    <option key={value} value={value}>{ORDER_STATUS_INFO[value].label}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="ad-field">
              <span className="ord-field-label">
                {panel.kind === "closing" ? CLOSING_ACTION[panel.to]?.prompt : "Motif de la correction"}
                {reasonRequired ? " *" : " (facultatif)"}
              </span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 300))} rows={3}/>
            </label>

            <div className="ord-panel-actions">
              <button type="button" className="ad-btn" onClick={() => open(null)} disabled={busy}>Fermer</button>
              <button type="button" className="ad-btn ad-btn-primary" onClick={submit} disabled={busy || !ready} aria-busy={busy}>
                {busy && <LoaderCircle className="ad-spin" aria-hidden="true"/>} Enregistrer
              </button>
            </div>
            {reasonRequired && !ready && to && <p className="ord-caption">Le motif est obligatoire (3 caractères minimum).</p>}
          </div>
        )}

        {error && <p className="ord-error" role="alert">{error}</p>}
        {children}
      </div>
    </section>
  );
}
