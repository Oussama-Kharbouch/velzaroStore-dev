"use client";

import { useState } from "react";
import { Banknote, CreditCard, LoaderCircle } from "lucide-react";
import { formatDH, formatShortDateTime } from "../../../lib/admin/format";
import type { PaymentStatus } from "../../../lib/orders/status";
import { PaymentBadge } from "../bits";
import { useOrderAction } from "./use-order-action";

export type PaymentOrder = {
  id: number;
  total: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  collectionFees: number;
  amountReceived: number | null;
};

/**
 * Encaissement, separe du statut de livraison : une commande livree reste « a
 * encaisser » jusqu'a ce que l'administrateur confirme la reception des fonds.
 * Les frais ou retenues du transporteur sont deduits du montant recu.
 */
export default function PaymentCard({ order }: { order: PaymentOrder }) {
  const { run, busy, error } = useOrderAction(order.id);
  const [fees, setFees] = useState("0");
  const feeValue = Number(fees.replace(",", "."));
  const validFees = Number.isInteger(feeValue) && feeValue >= 0 && feeValue <= order.total;

  const collect = () => {
    if (!validFees) return;
    const received = order.total - feeValue;
    const ok = window.confirm(
      `Confirmer la réception de ${formatDH(received)} ?\n\nÀ n’utiliser qu’après réception réelle des fonds.`,
    );
    if (ok) run("/payment", "POST", { action: "encaisser", fees: feeValue });
  };

  const undo = () => {
    if (window.confirm("Annuler l’encaissement ? Le paiement repassera « À encaisser ».")) {
      run("/payment", "POST", { action: "annuler" });
    }
  };

  if (order.paymentStatus === "encaisse") {
    return (
      <section className="ad-panel ord-card ord-step-card is-success">
        <div className="ord-step-card-head">
          <span className="ord-step-icon"><Banknote aria-hidden="true"/></span>
          <div>
            <h2>Paiement encaissé</h2>
            <p>
              {formatDH(order.amountReceived ?? order.total)} reçus le {formatShortDateTime(order.paidAt)}
              {order.collectionFees > 0 ? ` (${formatDH(order.collectionFees)} de frais retenus sur ${formatDH(order.total)})` : ""}.
            </p>
          </div>
          <PaymentBadge status="encaisse"/>
        </div>
        <button type="button" className="ord-link-btn" onClick={undo} disabled={busy}>Annuler l’encaissement</button>
        {error && <p className="ord-error" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="ad-panel ord-card ord-step-card is-pending">
      <div className="ord-step-card-head">
        <span className="ord-step-icon"><CreditCard aria-hidden="true"/></span>
        <div>
          <h2>Encaissement</h2>
          <p>{formatDH(order.total)} à recevoir du livreur.</p>
        </div>
        <PaymentBadge status="a-encaisser"/>
      </div>

      <div className="ord-form-grid">
        <label className="ad-field">
          <span className="ord-field-label">Frais ou retenues du livreur (DH)</span>
          <input inputMode="numeric" value={fees} onChange={(event) => setFees(event.target.value)} aria-invalid={!validFees}/>
        </label>
        <div className="ord-received">
          <span>Montant reçu</span>
          <strong>{validFees ? formatDH(order.total - feeValue) : "—"}</strong>
        </div>
      </div>

      <button type="button" className="ord-btn ord-btn-primary" onClick={collect} disabled={busy || !validFees} aria-busy={busy}>
        {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <CreditCard aria-hidden="true"/>}
        Marquer le paiement comme encaissé
      </button>
      {!validFees && <p className="ord-error">Frais : un nombre entier entre 0 et {order.total}.</p>}
      {error && <p className="ord-error" role="alert">{error}</p>}
      <p className="ord-caption">À utiliser uniquement après réception des fonds.</p>
    </section>
  );
}
