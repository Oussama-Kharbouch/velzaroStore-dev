"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ExternalLink, LayoutDashboard, LogOut, Package, ShoppingCart, Timer, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { ADMIN_PATH } from "../../lib/site";

/**
 * Ossature du dashboard : menu latéral, et son état d'ouverture sur mobile.
 * L'en-tête est rendu par chaque page, qui seule connaît son titre ; le
 * contexte lui prête le bouton d'ouverture du menu.
 */
type ShellContext = { openSidebar: () => void };

const Shell = createContext<ShellContext>({ openSidebar: () => {} });

export const useAdminShell = () => useContext(Shell);

const NAV = [
  { href: ADMIN_PATH, label: "Tableau de bord", icon: LayoutDashboard },
  { href: `${ADMIN_PATH}/commandes`, label: "Commandes", icon: ShoppingCart, badge: true },
  { href: `${ADMIN_PATH}/produits`, label: "Produits", icon: Package },
  { href: `${ADMIN_PATH}/offre`, label: "Offre limitée", icon: Timer },
  { href: `${ADMIN_PATH}/clients`, label: "Clients", icon: Users },
];

export default function AdminShell({ children, pendingOrders }: {
  children: React.ReactNode;
  /** Commandes à confirmer : pastille de l'entrée « Commandes ». */
  pendingOrders: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/admin/session", { method: "DELETE" });
    // Rechargement complet : le cookie a disparu, la garde serveur renvoie vers la connexion.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose.
    window.location.href = `${ADMIN_PATH}/connexion`;
  };

  /** L'accueil ne s'allume que sur lui-même ; les autres couvrent leurs sous-pages. */
  const isActive = (href: string) => (href === ADMIN_PATH ? pathname === ADMIN_PATH : pathname.startsWith(href));

  return (
    <Shell.Provider value={{ openSidebar: () => setOpen(true) }}>
      <div className="ad">
        <div className="ad-shell">
          <aside className={open ? "ad-sidebar open" : "ad-sidebar"}>
            <div className="ad-sidebar-brand">
              <div>
                <span className="ad-logo">VELZARO<small>.store</small></span>
                <span className="ad-sidebar-tag">Administration</span>
              </div>
            </div>

            <nav className="ad-nav">
              <span className="ad-nav-label">Pilotage</span>
              {NAV.map((item) => {
                const Icon = item.icon;
                const badge = item.badge ? pendingOrders : 0;
                return (
                  <a key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""} onClick={() => setOpen(false)}>
                    <Icon/>
                    {item.label}
                    {badge > 0 && <span className="ad-nav-count" title="Commandes à confirmer">{badge}</span>}
                  </a>
                );
              })}
            </nav>

            <div className="ad-sidebar-foot">
              <a href="/" target="_blank" rel="noopener"><ExternalLink/> Voir la boutique</a>
              <button onClick={signOut} disabled={signingOut}><LogOut/> {signingOut ? "Déconnexion…" : "Se déconnecter"}</button>
            </div>
          </aside>

          {open && <div className="ad-backdrop" onClick={() => setOpen(false)} aria-hidden="true"/>}

          <div className="ad-main">{children}</div>
        </div>
      </div>
    </Shell.Provider>
  );
}
