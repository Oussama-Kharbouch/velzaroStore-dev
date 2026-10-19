/** Toutes les pages du dashboard passent par ici : session vérifiée, puis ossature commune. */
import AdminShell from "../../../components/admin/shell";
import { requireAdminPage } from "../../../lib/admin/guard";
import { countPendingOrders } from "../../../lib/orders/queries";

/** Le dashboard lit la base à chaque requête : rien n'y est prérendu. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <AdminShell pendingOrders={await countPendingOrders()}>{children}</AdminShell>;
}
