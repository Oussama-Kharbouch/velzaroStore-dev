"use client";

import { Menu } from "lucide-react";
import { useAdminShell } from "./shell";

/** En-tête d'une page du dashboard : titre, actions à droite, bouton du menu mobile. */
export default function AdminHeader({ eyebrow, title, children }: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  const { openSidebar } = useAdminShell();

  return (
    <header className="ad-header">
      <button className="ad-burger" onClick={openSidebar} aria-label="Ouvrir le menu"><Menu/></button>
      <div className="ad-header-titles">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children && <div className="ad-header-actions">{children}</div>}
    </header>
  );
}
