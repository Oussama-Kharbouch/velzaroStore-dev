/**
 * Racine du dashboard : feuilles de style et titre. La garde d'accès et le menu
 * vivent dans le groupe (dashboard), pour que la page de connexion y échappe.
 */
import type { Metadata } from "next";
import "./admin.css";
import "./orders.css";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration VELZARO" },
  // Un back-office n'a rien à faire dans un moteur de recherche.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
