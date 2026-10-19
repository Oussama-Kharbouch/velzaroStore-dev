import { Check, FileText, PackageCheck, Settings, Truck } from "lucide-react";
import { ORDER_FLOW, ORDER_STATUS_INFO, flowIndex, type OrderStatus } from "../../../lib/orders/status";

const ICONS = [FileText, Check, Settings, Truck, PackageCheck];

/**
 * Frise du parcours. `reached` : etape la plus avancee atteinte, utile quand
 * la commande est sortie du parcours (annulee apres confirmation…) pour
 * montrer jusqu'ou elle etait allee.
 */
export default function OrderStepper({ status, reached }: { status: OrderStatus; reached: OrderStatus }) {
  const current = flowIndex(status);
  const last = current >= 0 ? current : flowIndex(reached);
  const delivered = status === "livree";

  return (
    <ol className={`ord-stepper${delivered ? " is-delivered" : ""}${current < 0 ? " is-closed" : ""}`} aria-label="Avancement de la commande">
      {ORDER_FLOW.map((step, index) => {
        const Icon = index < last || delivered ? Check : ICONS[index];
        const state = index < last || delivered ? "done" : index === current ? "current" : "todo";
        return (
          <li key={step} className={`ord-step is-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="ord-step-dot"><Icon aria-hidden="true"/></span>
            <span className="ord-step-label">{ORDER_STATUS_INFO[step].label}</span>
          </li>
        );
      })}
    </ol>
  );
}
