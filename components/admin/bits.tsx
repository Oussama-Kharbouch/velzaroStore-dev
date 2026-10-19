import { Banknote, CircleAlert, CircleCheck, CreditCard, Inbox, TriangleAlert } from "lucide-react";
import { ORDER_STATUS_INFO, PAYMENT_STATUS_INFO, type OrderStatus, type PaymentStatus } from "../../lib/orders/status";
import { LOW_STOCK_THRESHOLD } from "../../lib/admin/thresholds";

/**
 * Petites briques d'affichage communes, sans état : utilisables depuis une
 * page serveur comme depuis un composant client. Elles n'importent rien qui
 * ouvre une connexion à la base.
 */

export const Alert = ({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) => {
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : TriangleAlert;
  return (
    <div className={`ad-alert ad-alert-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon/>
      <div>{children}</div>
    </div>
  );
};

export const EmptyState = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="ad-empty">
    <Inbox/>
    <strong>{title}</strong>
    {children && <p>{children}</p>}
  </div>
);

/** Pastille de statut de commande, couleur selon l'étape. */
export const OrderStatusBadge = ({ status, large }: { status: OrderStatus; large?: boolean }) => {
  const info = ORDER_STATUS_INFO[status];
  return <span className={`ord-badge ord-tone-${info.tone}${large ? " ord-badge-lg" : ""}`}>{info.label}</span>;
};

/** Pastille de paiement, suivi à part du statut de livraison. */
export const PaymentBadge = ({ status, icon }: { status: PaymentStatus; icon?: boolean }) => {
  const info = PAYMENT_STATUS_INFO[status];
  const Icon = status === "encaisse" ? Banknote : CreditCard;
  return <span className={`ord-badge ord-badge-flat ord-tone-${info.tone}`}>{icon && <Icon aria-hidden="true"/>}{info.label}</span>;
};

/** Stock d'une pointure, coloré selon l'urgence ; « — » s'il n'est pas suivi. */
export const StockCell = ({ stock }: { stock: number | null }) => {
  if (stock === null) return <span className="ad-stock ad-stock-none" title="Stock non suivi">—</span>;
  const tone = stock === 0 ? "out" : stock <= LOW_STOCK_THRESHOLD ? "low" : "ok";
  return <span className={`ad-stock ad-stock-${tone}`}>{stock}</span>;
};

/** Une carte d'indicateur ; l'accent colore la barre et l'icône. */
export const Stat = ({ label, value, hint, accent, icon: Icon }: {
  label: string; value: string; hint: string; accent: string; icon: typeof Inbox;
}) => (
  <article className="ad-stat" style={{ "--ad-stat-accent": accent } as React.CSSProperties}>
    <div className="ad-stat-head">
      <span>{label}</span>
      <div className="ad-stat-icon"><Icon/></div>
    </div>
    <strong>{value}</strong>
    <small>{hint}</small>
  </article>
);
