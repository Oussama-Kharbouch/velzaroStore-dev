import { Clock3 } from "lucide-react";
import { formatShortDateTime } from "../../../lib/admin/format";
import type { OrderEvent } from "../../../lib/orders/queries";
import { ORDER_STATUS_INFO } from "../../../lib/orders/status";
import NoteForm from "./note-form";

const eventTitle = (event: OrderEvent) => {
  switch (event.kind) {
    case "creation": return "Commande créée";
    case "note": return "Note interne";
    case "payment": return "Paiement";
    case "correction": return "Statut corrigé";
    default: return event.toStatus ? ORDER_STATUS_INFO[event.toStatus].label : "Statut modifié";
  }
};

/** Historique complet : statuts (ancien → nouveau), notes internes, paiement. */
export default function OrderHistory({ orderId, events }: { orderId: number; events: OrderEvent[] }) {
  return (
    <section className="ad-panel ord-card">
      <div className="ord-card-head">
        <Clock3 className="ord-card-icon" aria-hidden="true"/>
        <h2>Historique de la commande</h2>
      </div>

      <ol className="ord-timeline">
        {events.map((event) => (
          <li key={event.id} className={`ord-event ord-event-${event.kind}`}>
            <span className="ord-event-dot" aria-hidden="true"/>
            <div>
              <p className="ord-event-title">
                <strong>{eventTitle(event)}</strong>
                <span> · {formatShortDateTime(event.createdAt)}</span>
              </p>
              {event.fromStatus && event.toStatus && event.kind !== "creation" && (
                <p className="ord-event-move">
                  {ORDER_STATUS_INFO[event.fromStatus]?.label ?? event.fromStatus} → {ORDER_STATUS_INFO[event.toStatus]?.label ?? event.toStatus}
                </p>
              )}
              {event.message && <p className="ord-event-text">{event.message}</p>}
            </div>
          </li>
        ))}
      </ol>

      <NoteForm orderId={orderId}/>
    </section>
  );
}
