import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Hourglass, Package, ShoppingCart, Users, Wallet } from "lucide-react";
import { EmptyState, OrderStatusBadge, Stat, StockCell } from "../../../components/admin/bits";
import AdminHeader from "../../../components/admin/header";
import { formatCompact, formatDH, formatShortDate } from "../../../lib/admin/format";
import { getDashboardStats, getLowStock, getRecentOrders, getSalesByVariant } from "../../../lib/admin/queries";
import { ADMIN_PATH } from "../../../lib/site";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const [stats, recent, sales, lowStock] = await Promise.all([
    getDashboardStats(), getRecentOrders(6), getSalesByVariant(), getLowStock(),
  ]);
  const maxPairs = Math.max(1, ...sales.map((row) => row.pairs));

  return (
    <>
      <AdminHeader eyebrow="VELZARO" title="Tableau de bord"/>

      <div className="ad-content">
        <section className="ad-stats">
          <Stat label="Chiffre d’affaires" accent="#2f7d5d" icon={Wallet}
            value={`${formatCompact(stats.chiffreAffaires)} DH`}
            hint={stats.commandesComptees > 0 ? `Panier moyen ${formatDH(stats.panierMoyen)}` : "Aucune vente enregistrée"}/>
          <Stat label="Commandes" accent="#111" icon={ShoppingCart}
            value={String(stats.commandes)}
            hint={stats.enCours > 0 ? `${stats.enCours} en cours de traitement` : "Aucune en cours"}/>
          <Stat label="À confirmer" accent="#b8690f" icon={Hourglass}
            value={String(stats.enAttente)}
            hint={stats.enAttente > 0 ? "Clients à contacter" : "Rien en attente"}/>
          <Stat label="À encaisser" accent="#b99a69" icon={Banknote}
            value={`${formatCompact(stats.aEncaisser)} DH`}
            hint={`${formatDH(stats.encaisse)} déjà encaissés`}/>
          <Stat label="Clients" accent="#5b4a92" icon={Users}
            value={String(stats.clients)}
            hint={stats.clients > 0 ? "Reconnus par leur téléphone" : "Aucun client encore"}/>
        </section>

        <div className="ad-grid ad-grid-2">
          <section className="ad-panel">
            <div className="ad-panel-head">
              <div>
                <h2>Dernières commandes</h2>
                <p>Les ventes les plus récentes passées sur la boutique.</p>
              </div>
              {recent.length > 0 && <Link className="ad-btn ad-btn-ghost" href={`${ADMIN_PATH}/commandes`}>Tout voir</Link>}
            </div>
            {recent.length === 0 ? (
              <EmptyState title="Aucune commande pour l’instant">
                Les commandes passées sur la boutique apparaîtront ici, avec leur client et leur statut.
              </EmptyState>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead><tr><th>Client</th><th>Date</th><th>Statut</th><th className="ad-num">Total</th></tr></thead>
                  <tbody>
                    {recent.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`${ADMIN_PATH}/commandes/${order.id}`}><strong>{order.customerName}</strong></Link>
                          <br/><span className="ad-sub">{order.city}</span>
                        </td>
                        <td>{formatShortDate(order.createdAt)}</td>
                        <td><OrderStatusBadge status={order.status}/></td>
                        <td className="ad-num">{formatDH(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="ad-panel">
            <div className="ad-panel-head">
              <div>
                <h2>Ventes par coloris</h2>
                <p>Paires vendues, hors commandes annulées, refusées ou retournées.</p>
              </div>
            </div>
            <div className="ad-panel-body">
              <div className="ad-bars">
                {sales.map((row) => (
                  <div key={row.slug}>
                    <div className="ad-bar-line">
                      <span><span className="vz-swatch" style={{ background: row.hex }} aria-hidden="true"/>{row.name}</span>
                      <strong>{row.pairs}</strong>
                    </div>
                    <div className="ad-bar-track"><div className="ad-bar-fill" style={{ width: `${(row.pairs / maxPairs) * 100}%` }}/></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="ad-grid">
          <section className="ad-panel">
            <div className="ad-panel-head">
              <div>
                <h2>Stocks à surveiller</h2>
                <p>Pointures dont le stock est suivi et bas (3 paires ou moins).</p>
              </div>
              <Link className="ad-btn ad-btn-ghost" href={`${ADMIN_PATH}/produits`}>Gérer le stock</Link>
            </div>
            {lowStock.length === 0 ? (
              <EmptyState title="Aucune alerte de stock">
                Renseignez le stock d’une pointure dans « Produits » pour le suivre ; sans stock renseigné, la
                pointure reste toujours commandable.
              </EmptyState>
            ) : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead><tr><th>Coloris</th><th className="ad-num">Pointure</th><th className="ad-num">Stock</th></tr></thead>
                  <tbody>
                    {lowStock.map((row) => (
                      <tr key={`${row.variantId}-${row.size}`}>
                        <td><Package className="vz-inline-icon" aria-hidden="true"/>{row.name}</td>
                        <td className="ad-num">{row.size}</td>
                        <td className="ad-num"><StockCell stock={row.stock}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
