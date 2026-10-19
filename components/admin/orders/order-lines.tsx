import { formatDH } from "../../../lib/admin/format";
import type { OrderDetail } from "../../../lib/orders/queries";

/**
 * Articles et montants tels qu'enregistrés à l'achat : noms, prix et frais de
 * livraison ne suivent pas les changements ultérieurs du catalogue.
 */
export default function OrderLines({ order }: { order: OrderDetail }) {
  return (
    <section className="ad-panel ord-card">
      <div className="ord-card-head"><h2>Articles commandés</h2></div>

      <div className="ord-lines" role="table" aria-label="Articles commandés">
        <div className="ord-lines-head" role="row">
          <span role="columnheader">Article</span>
          <span role="columnheader">Prix unitaire</span>
          <span role="columnheader">Quantité</span>
          <span role="columnheader">Sous-total</span>
        </div>

        {order.lines.map((line) => (
          <div className="ord-line" role="row" key={line.id}>
            <div className="ord-line-product" role="cell">
              <span className="ord-line-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element -- photos statiques du catalogue. */}
                {line.image && <img src={line.image} alt="" loading="lazy" decoding="async"/>}
              </span>
              <div>
                <strong>{line.productName}</strong>
                <span>{line.colorName} · Pointure {line.size}</span>
              </div>
            </div>
            <span role="cell" data-label="Prix unitaire">{formatDH(line.unitPrice)}</span>
            <span role="cell" data-label="Quantité">{line.quantity}</span>
            <span role="cell" data-label="Sous-total" className="ord-line-sum">{formatDH(line.unitPrice * line.quantity)}</span>
          </div>
        ))}
      </div>

      <dl className="ord-totals">
        <div><dt>Articles</dt><dd>{formatDH(order.subtotal)}</dd></div>
        <div><dt>Livraison{order.city ? ` — ${order.city}` : ""}</dt><dd>{formatDH(order.shippingFee)}</dd></div>
        <div className="ord-totals-grand"><dt>Total à payer à la livraison</dt><dd>{formatDH(order.total)}</dd></div>
      </dl>
    </section>
  );
}
