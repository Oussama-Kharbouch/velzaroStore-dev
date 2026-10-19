import Link from "next/link";
import { UserRound } from "lucide-react";
import { ADMIN_PATH } from "../../../lib/site";
import type { OrderDetail } from "../../../lib/orders/queries";
import { PaymentBadge } from "../bits";

/** Coordonnées du client et mode de paiement. */
export default function CustomerCard({ order }: { order: OrderDetail }) {
  const facts: [string, React.ReactNode][] = [
    ["Nom", order.customerName],
    ["Téléphone", <a key="tel" href={`tel:${order.phone}`}>{order.phone || "—"}</a>],
    ["Ville", order.city || "—"],
    ["Adresse", <span key="adr" style={{ whiteSpace: "pre-line" }}>{order.address || "—"}</span>],
    ["Mode de paiement", "À la livraison"],
    ["Statut du paiement", <PaymentBadge key="pay" status={order.paymentStatus} icon/>],
  ];

  return (
    <section className="ad-panel ord-card">
      <div className="ord-card-head">
        <UserRound className="ord-card-icon" aria-hidden="true"/>
        <h2>Client</h2>
      </div>
      <dl className="ord-facts">
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="ord-card-foot">
        <Link className="ad-btn" href={`${ADMIN_PATH}/clients?q=${encodeURIComponent(order.phone)}`}>Voir la fiche client</Link>
      </div>
    </section>
  );
}
