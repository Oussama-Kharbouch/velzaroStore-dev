import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderStatusBadge } from "../../../../../components/admin/bits";
import AdminHeader from "../../../../../components/admin/header";
import CustomerCard from "../../../../../components/admin/orders/customer-card";
import NextStepCard from "../../../../../components/admin/orders/next-step-card";
import OrderHistory from "../../../../../components/admin/orders/order-history";
import OrderLines from "../../../../../components/admin/orders/order-lines";
import OrderStepper from "../../../../../components/admin/orders/order-stepper";
import PaymentCard from "../../../../../components/admin/orders/payment-card";
import StatusActions from "../../../../../components/admin/orders/status-actions";
import WhatsappCard from "../../../../../components/admin/orders/whatsapp-card";
import { formatLongDateTime } from "../../../../../lib/admin/format";
import { numericId } from "../../../../../lib/admin/respond";
import { getOrderDetail } from "../../../../../lib/orders/queries";
import { flowIndex, type OrderStatus } from "../../../../../lib/orders/status";
import { messageForStatus, shortReference } from "../../../../../lib/orders/whatsapp";
import { ADMIN_PATH } from "../../../../../lib/site";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = numericId((await params).id);
  return { title: id === null ? "Commande introuvable" : `Commande n° ${id}` };
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export default async function OrderDetailPage({ params }: { params: Params }) {
  const id = numericId((await params).id);
  if (id === null) notFound();
  const order = await getOrderDetail(id);
  if (!order) notFound();

  // Étape la plus avancée atteinte, pour la frise d'une commande sortie du parcours.
  const reached = [...order.events].reverse()
    .flatMap((event) => [event.toStatus, event.fromStatus])
    .find((status): status is OrderStatus => status !== null && flowIndex(status) >= 0) ?? "en-attente";
  const closedAt = flowIndex(order.status) < 0
    ? [...order.events].reverse().find((event) => event.toStatus === order.status)?.createdAt ?? null
    : null;

  const whatsapp = messageForStatus({
    number: order.orderNumber, status: order.status, shippingFee: order.shippingFee, total: order.total,
    customer: { name: order.customerName, address: order.address, city: order.city },
    lines: order.lines,
  });

  return (
    <>
      <AdminHeader eyebrow="Commande" title={shortReference(order.orderNumber)}>
        <span className="ord-header-date">{formatLongDateTime(order.createdAt)}</span>
        <OrderStatusBadge status={order.status} large/>
      </AdminHeader>

      <div className="ad-content ord-detail">
        <Link className="ad-back" href={`${ADMIN_PATH}/commandes`}><ArrowLeft/> Retour aux commandes</Link>

        <OrderStepper status={order.status} reached={reached}/>

        <div className="ord-detail-grid">
          <div className="ord-col">
            <OrderLines order={order}/>
            <NextStepCard order={{
              id: order.id, status: order.status, statusReason: order.statusReason,
              carrier: order.carrier, trackingNumber: order.trackingNumber,
              shippedAt: iso(order.shippedAt), deliveredAt: iso(order.deliveredAt), closedAt: iso(closedAt),
            }}/>
            {(order.status === "livree" || order.paymentStatus === "encaisse") && (
              <PaymentCard order={{
                id: order.id, total: order.total, paymentStatus: order.paymentStatus, paidAt: iso(order.paidAt),
                collectionFees: order.collectionFees, amountReceived: order.amountReceived,
              }}/>
            )}
            <OrderHistory orderId={order.id} events={order.events}/>
          </div>

          <div className="ord-col">
            <CustomerCard order={order}/>
            <WhatsappCard key={order.status} phone={order.phone} title={whatsapp.title} action={whatsapp.action} message={whatsapp.text}/>
            <StatusActions orderId={order.id} status={order.status}/>
          </div>
        </div>
      </div>
    </>
  );
}
