import Link from "next/link";
import { Ban, Check, CircleCheck, CircleX, Hourglass, Package, Truck, Undo2 } from "lucide-react";
import { ADMIN_PATH } from "../../lib/site";
import { ORDER_STATUSES, ORDER_STATUS_INFO, type OrderStatus } from "../../lib/orders/status";

const ICONS: Record<OrderStatus, typeof Check> = {
  "en-attente": Hourglass, confirmee: Check, "en-preparation": Package, expediee: Truck,
  livree: CircleCheck, annulee: CircleX, refusee: Ban, retournee: Undo2,
};

/**
 * Compteurs par statut, calculés avec la recherche et la période en cours.
 * Chaque carte filtre la liste ; un second clic retire le filtre.
 */
export default function StatusCounters({ counts, active, query }: {
  counts: Record<OrderStatus, number>;
  active?: OrderStatus;
  query: Record<string, string | undefined>;
}) {
  const href = (status: OrderStatus) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (status !== active) params.set("statut", status);
    const search = params.toString();
    return search ? `${ADMIN_PATH}/commandes?${search}` : `${ADMIN_PATH}/commandes`;
  };

  return (
    <nav className="ord-counters" aria-label="Commandes par statut">
      {ORDER_STATUSES.map((status) => {
        const Icon = ICONS[status];
        const info = ORDER_STATUS_INFO[status];
        return (
          <Link key={status} href={href(status)} scroll={false}
            className={`ord-counter ord-tone-${info.tone}${status === active ? " is-active" : ""}`}
            aria-current={status === active ? "true" : undefined}>
            <span className="ord-counter-icon"><Icon aria-hidden="true"/></span>
            <span className="ord-counter-text"><span>{info.plural}</span><strong>{counts[status]}</strong></span>
          </Link>
        );
      })}
    </nav>
  );
}
