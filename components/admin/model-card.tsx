"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PencilLine, X } from "lucide-react";
import { ADMIN_PATH } from "../../lib/site";
import ModelEditor from "./model-editor";

/**
 * A model in the "Modèles" section: click opens its colourways; the pencil edits its name
 * and brand right there (same form as on the model page).
 */
export default function ModelCard({ id, name, brand, images, summary }: {
  id: number; name: string; brand: string | null; images: (string | null)[]; summary: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={`vz-model-item${editing ? " is-editing" : ""}`}>
      <Link className="vz-model-card" href={`${ADMIN_PATH}/produits/modeles/${id}`} aria-label={`Voir les coloris de ${name}`}>
        <span className="vz-model-card-photos" aria-hidden="true">
          {images.slice(0, 4).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- vignette du catalogue.
            <span key={i}>{src && <img src={src} alt=""/>}</span>
          ))}
        </span>
        <span className="vz-model-card-text">
          <small>{brand ?? "Marque non renseignée"}</small>
          <strong>{name}</strong>
          <span>{summary}</span>
        </span>
        <ChevronRight className="vz-model-row-go" aria-hidden="true"/>
      </Link>
      <button type="button" className="vz-model-edit" onClick={() => setEditing(!editing)} aria-expanded={editing}
        aria-label={editing ? `Fermer la modification de ${name}` : `Modifier le nom et la marque de ${name}`}
        title={editing ? "Fermer" : "Modifier le nom et la marque"}>
        {editing ? <X aria-hidden="true"/> : <PencilLine aria-hidden="true"/>}
      </button>
      {editing && <div className="vz-model-item-editor"><ModelEditor id={id} name={name} brand={brand}/></div>}
    </div>
  );
}
