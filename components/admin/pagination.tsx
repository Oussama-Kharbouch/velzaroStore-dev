import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Pages à afficher : première, dernière, voisines de la courante, « … » entre. */
const pageList = (page: number, pages: number): (number | "…")[] => {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((n, index) => (index > 0 && n - sorted[index - 1] > 1 ? ["…" as const, n] : [n]));
};

/** Pagination par liens : chaque page a son adresse et survit au rechargement. */
export default function Pagination({ basePath, page, pages, total, perPage, unit, query }: {
  basePath: string;
  page: number;
  pages: number;
  total: number;
  perPage: number;
  /** Au singulier : « commande », « client ». */
  unit: string;
  query: Record<string, string | undefined>;
}) {
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="ord-pagination">
      <p>Affichage de {first} à {last} sur {total} {unit}{total > 1 ? "s" : ""}</p>
      {pages > 1 && (
        <nav aria-label="Pagination">
          {page > 1
            ? <Link href={href(page - 1)} aria-label="Page précédente"><ChevronLeft/></Link>
            : <span className="is-disabled" aria-hidden="true"><ChevronLeft/></span>}
          {pageList(page, pages).map((item, index) => item === "…"
            ? <span key={`gap-${index}`} className="is-gap">…</span>
            : <Link key={item} href={href(item)} className={item === page ? "is-current" : ""} aria-current={item === page ? "page" : undefined}>{item}</Link>)}
          {page < pages
            ? <Link href={href(page + 1)} aria-label="Page suivante"><ChevronRight/></Link>
            : <span className="is-disabled" aria-hidden="true"><ChevronRight/></span>}
        </nav>
      )}
    </div>
  );
}
