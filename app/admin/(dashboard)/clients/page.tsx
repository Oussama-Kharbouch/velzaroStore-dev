import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "../../../../components/admin/bits";
import AdminHeader from "../../../../components/admin/header";
import ListToolbar from "../../../../components/admin/list-toolbar";
import Pagination from "../../../../components/admin/pagination";
import WhatsappIcon from "../../../../components/admin/whatsapp-icon";
import { formatDH, formatShortDate } from "../../../../lib/admin/format";
import { CUSTOMERS_PER_PAGE, listCustomers } from "../../../../lib/admin/queries";
import { whatsappLink } from "../../../../lib/orders/whatsapp";
import { ADMIN_PATH } from "../../../../lib/site";

export const metadata: Metadata = { title: "Clients" };

type Params = Promise<{ q?: string; page?: string }>;

export default async function CustomersPage({ searchParams }: { searchParams: Params }) {
  const raw = await searchParams;
  const q = raw.q?.trim() || undefined;
  const requestedPage = Number(raw.page);
  const list = await listCustomers({ q, page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1 });

  return (
    <>
      <AdminHeader eyebrow="Carnet" title="Clients"/>

      <div className="ad-content">
        <p className="ord-subtitle">Clients reconnus par leur numéro de téléphone ; nom et ville de leur dernière commande.</p>
        <section className="ad-panel">
          <ListToolbar placeholder="Rechercher par nom, téléphone ou ville…" total={list.total} unit="client"/>

          {list.rows.length === 0 ? (
            <EmptyState title={q ? "Aucun client ne correspond" : "Aucun client"}>
              {q ? "Essayez un autre nom ou un autre numéro." : "Un client apparaît ici dès sa première commande."}
            </EmptyState>
          ) : (
            <div className="ad-table-scroll">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Client</th><th>Téléphone</th><th>Ville</th>
                    <th className="ad-num">Commandes</th><th className="ad-num">Total dépensé</th><th>Dernière commande</th><th className="ad-num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((customer) => {
                    const link = whatsappLink(customer.phone, `Bonjour *${customer.name}* 👋\n\nJe vous contacte de la part de *VELZARO*.`);
                    return (
                      <tr key={customer.key}>
                        <td><strong>{customer.name}</strong><br/><span className="ad-sub">Client depuis le {formatShortDate(customer.premiere)}</span></td>
                        <td><a href={`tel:${customer.phone}`}>{customer.phone}</a></td>
                        <td>{customer.city || "—"}</td>
                        <td className="ad-num">
                          {customer.commandes}
                          {customer.commandes !== customer.commandesComptees && <><br/><span className="ad-sub">{customer.commandes - customer.commandesComptees} non abouties</span></>}
                        </td>
                        <td className="ad-num">{formatDH(customer.total)}</td>
                        <td>{formatShortDate(customer.derniere)}</td>
                        <td>
                          <div className="ad-cell-actions">
                            <Link className="ad-btn" href={`${ADMIN_PATH}/commandes?q=${encodeURIComponent(customer.phone)}`}>Commandes</Link>
                            {link && (
                              <a className="ord-btn ord-btn-wa-outline" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Contacter ${customer.name} sur WhatsApp`}>
                                <WhatsappIcon/>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination basePath={`${ADMIN_PATH}/clients`} unit="client" page={list.page} pages={list.pages}
            total={list.total} perPage={CUSTOMERS_PER_PAGE} query={{ q }}/>
        </section>
      </div>
    </>
  );
}
