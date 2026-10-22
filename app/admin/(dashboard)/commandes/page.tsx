import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { EmptyState, OrderStatusBadge, PaymentBadge } from "../../../../components/admin/bits";
import AdminHeader from "../../../../components/admin/header";
import ListToolbar from "../../../../components/admin/list-toolbar";
import Pagination from "../../../../components/admin/pagination";
import DeleteOrderButton from "../../../../components/admin/orders/delete-order-button";
import StatusCounters from "../../../../components/admin/status-counters";
import WhatsappIcon from "../../../../components/whatsapp-icon";
import { formatDH, formatShortDate } from "../../../../lib/admin/format";
import { ORDERS_PER_PAGE, ORDER_PERIODS, isOrderPeriod, listOrders } from "../../../../lib/orders/queries";
import { ORDER_STATUSES, ORDER_STATUS_INFO, isOrderStatus } from "../../../../lib/orders/status";
import { shortMessage, shortReference, whatsappLink } from "../../../../lib/orders/whatsapp";
import { ADMIN_PATH } from "../../../../lib/site";

export const metadata: Metadata = { title: "Commandes" };

type Params = Promise<{ q?: string; statut?: string; periode?: string; page?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: Params }) {
  const raw = await searchParams;
  const q = raw.q?.trim() || undefined;
  const status = isOrderStatus(raw.statut) ? raw.statut : undefined;
  const period = isOrderPeriod(raw.periode) ? raw.periode : undefined;
  const requestedPage = Number(raw.page);

  const list = await listOrders({ q, status, period, page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1 });
  const filtered = Boolean(q || status || period);

  return (
    <>
      <AdminHeader eyebrow="Ventes" title="Commandes"/>

      <div className="ad-content ord-list-page">
        <p className="ord-subtitle">Suivez vos commandes et contactez vos clients.</p>

        <StatusCounters counts={list.counts} active={status} query={{ q, periode: period }}/>

        <section className="ad-panel ord-list-panel">
          <ListToolbar
            placeholder="Rechercher par référence, client, téléphone ou ville…"
            total={list.total}
            unit="commande"
            filters={[
              { key: "statut", all: "Tous les statuts", label: "Filtrer par statut", options: ORDER_STATUSES.map((value) => ({ value, label: ORDER_STATUS_INFO[value].label })) },
              { key: "periode", all: "Toutes les dates", label: "Filtrer par date", options: Object.entries(ORDER_PERIODS).map(([value, label]) => ({ value, label })) },
            ]}
          />

          {list.rows.length === 0 ? (
            <EmptyState title={filtered ? "Aucune commande ne correspond" : "Aucune commande"}>
              {filtered ? "Modifiez la recherche ou retirez les filtres." : "Les commandes passées sur la boutique apparaissent ici automatiquement."}
            </EmptyState>
          ) : (
            <table className="ord-table">
              <thead>
                <tr>
                  <th>Commande</th><th>Client</th><th>Ville</th><th>Date</th>
                  <th className="ord-num">Paires</th><th className="ord-num">Total</th><th>Statut</th><th>Paiement</th>
                  <th className="ord-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((order) => {
                  const link = whatsappLink(order.phone, shortMessage(order));
                  return (
                    <tr key={order.id}>
                      <td className="ord-ref"><Link href={`${ADMIN_PATH}/commandes/${order.id}`}>{shortReference(order.number)}</Link></td>
                      <td className="ord-client"><strong>{order.customerName}</strong><span>{order.phone}</span></td>
                      <td data-label="Ville">{order.city || "—"}</td>
                      <td data-label="Date">{formatShortDate(order.createdAt)}</td>
                      <td data-label="Paires" className="ord-num">{order.articles}</td>
                      <td data-label="Total" className="ord-num ord-total">{formatDH(order.total)}</td>
                      <td data-label="Statut"><OrderStatusBadge status={order.status}/></td>
                      <td data-label="Paiement"><PaymentBadge status={order.paymentStatus}/></td>
                      <td className="ord-row-actions">
                        <Link className="ord-icon-btn" href={`${ADMIN_PATH}/commandes/${order.id}`} title="Voir la commande" aria-label={`Voir la commande de ${order.customerName}`}>
                          <Eye aria-hidden="true"/>
                        </Link>
                        {link ? (
                          <a className="ord-btn ord-btn-wa-outline" href={link} target="_blank" rel="noopener noreferrer" title="Contacter sur WhatsApp" aria-label={`Contacter ${order.customerName} sur WhatsApp`}>
                            <WhatsappIcon/> <span className="ord-wa-text">Contacter</span>
                          </a>
                        ) : (
                          <span className="ord-no-phone" title="Numéro absent ou invalide">Numéro invalide</span>
                        )}
                        <DeleteOrderButton id={order.id} number={order.number} reference={shortReference(order.number)}
                          customer={order.customerName} total={formatDH(order.total)}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <Pagination basePath={`${ADMIN_PATH}/commandes`} unit="commande" page={list.page} pages={list.pages}
            total={list.total} perPage={ORDERS_PER_PAGE} query={{ q, statut: status, periode: period }}/>
        </section>
      </div>
    </>
  );
}
