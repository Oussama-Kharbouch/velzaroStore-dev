"use client";

import { useState } from "react";
import { CircleCheck, CircleX, FileText, LoaderCircle, PackageCheck, Settings, Truck, Undo2 } from "lucide-react";
import { formatShortDateTime } from "../../../lib/admin/format";
import { ORDER_STATUS_INFO, nextStep, type OrderStatus } from "../../../lib/orders/status";
import { useOrderAction } from "./use-order-action";

export type StepOrder = {
  id: number;
  status: OrderStatus;
  statusReason: string;
  carrier: string;
  trackingNumber: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
};

const STEP_ICON: Partial<Record<OrderStatus, typeof FileText>> = {
  "en-attente": FileText, confirmee: Settings, "en-preparation": PackageCheck, expediee: Truck,
};

const ButtonContent = ({ busy, icon: Icon, label }: { busy: boolean; icon: typeof FileText; label: string }) => (
  <>{busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Icon aria-hidden="true"/>}{label}</>
);

/** Transporteur, numero de suivi et date de remise, une fois la commande partie. */
const Shipment = ({ order }: { order: StepOrder }) => (
  <dl className="ord-shipment">
    <div><dt>Transporteur</dt><dd>{order.carrier || "—"}</dd></div>
    <div><dt>N° de suivi</dt><dd>{order.trackingNumber || "—"}</dd></div>
    {order.shippedAt && <div><dt>Remis au livreur</dt><dd>{formatShortDateTime(order.shippedAt)}</dd></div>}
  </dl>
);

/**
 * Action principale adaptee au statut : un seul bouton, celui de l'etape
 * suivante. Les fins anticipees et corrections sont dans « Autres actions ».
 */
export default function NextStepCard({ order }: { order: StepOrder }) {
  const { run, busy, error } = useOrderAction(order.id);
  const [carrier, setCarrier] = useState(order.carrier);
  const [tracking, setTracking] = useState(order.trackingNumber);
  const step = nextStep(order.status);

  if (order.status === "livree") {
    return (
      <section className="ad-panel ord-card ord-step-card is-success">
        <div className="ord-step-card-head">
          <span className="ord-step-icon"><CircleCheck aria-hidden="true"/></span>
          <div>
            <h2>Commande livrée</h2>
            <p>Réception confirmée le {formatShortDateTime(order.deliveredAt)}.</p>
          </div>
        </div>
        {(order.carrier || order.trackingNumber) && <Shipment order={order}/>}
      </section>
    );
  }

  if (!step) {
    const Icon = order.status === "retournee" ? Undo2 : CircleX;
    return (
      <section className="ad-panel ord-card ord-step-card is-closed">
        <div className="ord-step-card-head">
          <span className="ord-step-icon"><Icon aria-hidden="true"/></span>
          <div>
            <h2>Commande {ORDER_STATUS_INFO[order.status].label.toLowerCase()}</h2>
            <p>
              {order.closedAt ? `Le ${formatShortDateTime(order.closedAt)}. ` : ""}
              {order.statusReason ? <>Motif : <strong>{order.statusReason}</strong></> : "Aucun motif enregistré."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const Icon = STEP_ICON[order.status] ?? FileText;
  const advance = () => run("", "PATCH", {
    from: order.status,
    to: step.to,
    ...(step.to === "expediee" ? { carrier, trackingNumber: tracking } : {}),
  });

  return (
    <section className="ad-panel ord-card ord-step-card">
      <div className="ord-step-card-head">
        <span className="ord-step-icon"><Icon aria-hidden="true"/></span>
        <div>
          <h2>{step.title}</h2>
          <p>{step.hint}</p>
        </div>
      </div>

      {order.status === "en-preparation" && (
        <div className="ord-form-grid">
          <label className="ad-field">
            <span className="ord-field-label">Transporteur</span>
            <input value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={80} placeholder="Ex. Amana, Cathedis, livreur…"/>
          </label>
          <label className="ad-field">
            <span className="ord-field-label">N° de suivi (facultatif)</span>
            <input value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={80} placeholder="Ex. CASA-0041"/>
          </label>
        </div>
      )}

      {order.status === "expediee" && <Shipment order={order}/>}

      <button
        type="button"
        className={`ord-btn ${step.to === "livree" ? "ord-btn-green" : "ord-btn-primary"}`}
        onClick={advance}
        disabled={busy}
        aria-busy={busy}
      >
        <ButtonContent busy={busy} icon={step.to === "livree" ? CircleCheck : Icon} label={step.action}/>
      </button>
      {error && <p className="ord-error" role="alert">{error}</p>}
      <p className="ord-caption">
        {order.status === "en-attente"
          ? "Ouvrir WhatsApp ne confirme pas la commande : confirmez ici après la réponse du client."
          : "Le changement sera enregistré dans l’historique."}
      </p>
    </section>
  );
}
