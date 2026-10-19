"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Barre de recherche et de filtres des listes du dashboard (reprise de Deco Prestigea).
 *
 * L'etat vit dans l'URL, pas dans le composant : un filtre survit donc a un
 * rafraichissement, et le lien d'une liste filtree se partage tel quel. La
 * frappe est temporisee, sans quoi chaque lettre relancerait une requete.
 */
const DEBOUNCE_MS = 300;

export type ToolbarFilter = {
  /** Nom du parametre d'URL. */
  key: string;
  /** Intitule de l'option « aucun filtre ». */
  all: string;
  label: string;
  options: { value: string; label: string }[];
};

export default function ListToolbar({
  placeholder, filters = [], total, unit,
}: {
  placeholder: string;
  filters?: ToolbarFilter[];
  total: number;
  /** Au singulier : « commande », « client ». */
  unit: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query = params.toString();
  const current = params.get("q") ?? "";
  const [term, setTerm] = useState(current);

  /**
   * Le champ suit l'URL quand elle change sous lui — navigation arriere, ou
   * filtre applique ailleurs. Ajuster l'etat pendant le rendu plutot que dans
   * un effet evite un rendu intermediaire ou le champ afficherait encore
   * l'ancien terme.
   */
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setTerm(current);
  }

  /** Reecrit l'URL avec la cle modifiee, en retirant les filtres vides. */
  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(key, value); else next.delete(key);
    // Un autre filtre, d'autres resultats : on repart de la premiere page.
    next.delete("page");
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  // La frappe est reportee ; le nettoyage annule la navigation d'une saisie
  // abandonnee ou poursuivie avant l'echeance.
  useEffect(() => {
    if (term.trim() === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(query);
      const trimmed = term.trim();
      if (trimmed) next.set("q", trimmed); else next.delete("q");
      next.delete("page");
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, current, query, pathname, router]);

  return (
    <div className="ad-toolbar">
      <div className="ad-search">
        <Search/>
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {term && <button onClick={() => setTerm("")} aria-label="Effacer la recherche"><X/></button>}
      </div>

      {filters.map((filter) => (
        <select
          key={filter.key}
          className="ad-select"
          value={params.get(filter.key) ?? ""}
          onChange={(event) => apply(filter.key, event.target.value)}
          aria-label={filter.label}
        >
          <option value="">{filter.all}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ))}

      <span className="ad-count">
        <strong>{total}</strong> {unit}{total > 1 ? "s" : ""}
      </span>
    </div>
  );
}
