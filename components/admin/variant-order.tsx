"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, LoaderCircle, RotateCcw, Save } from "lucide-react";
import type { CatalogVariant } from "../../lib/admin/queries";

type Item = Pick<CatalogVariant, "id" | "name" | "image" | "active" | "hex">;

/**
 * Display order of the colourways on the shop (home page, shop, product thumbnails).
 * Reordered by drag and drop (computer) or with the arrows (phone, keyboard), then saved at once.
 */
export default function VariantOrder({ variants }: { variants: Item[] }) {
  const router = useRouter();
  const lock = useRef(false);
  const [order, setOrder] = useState(variants);
  // Order saved in the database: when it changes (after saving, or a colourway added), start again from it.
  const savedKey = variants.map((v) => v.id).join(",");
  const [shownKey, setShownKey] = useState(savedKey);
  if (shownKey !== savedKey) {
    setShownKey(savedKey);
    setOrder(variants);
  }
  const [dragged, setDragged] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const busy = sending || refreshing;
  const dirty = order.some((v, i) => v.id !== variants[i].id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    setMessage(null);
  };

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/variants/order", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: order.map((v) => v.id) }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      if (data.ok) {
        setMessage({ tone: "success", text: "Ordre enregistré. La boutique est à jour." });
        startRefresh(() => router.refresh());
      } else setMessage({ tone: "error", text: data.erreur ?? "Enregistrement impossible." });
    } catch {
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : l’ordre n’a pas été enregistré." });
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <section className="ad-panel vz-sort" aria-labelledby="vz-sort-title">
      <div className="ad-panel-head">
        <div>
          <h2 id="vz-sort-title">Ordre sur la boutique</h2>
          <p>Glissez un coloris pour le déplacer (ou utilisez les flèches), puis enregistrez. Le n° 1 s’affiche en premier sur l’accueil et dans la boutique.</p>
        </div>
      </div>

      <ol className="vz-sort-list">
        {order.map((v, i) => (
          <li key={v.id} draggable={!busy}
            className={`vz-sort-item${dragged === i ? " is-dragged" : ""}${v.active ? "" : " is-hidden"}`}
            onDragStart={(e) => { setDragged(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(v.id)); }}
            onDragOver={(e) => { e.preventDefault(); if (dragged !== null && dragged !== i) { move(dragged, i); setDragged(i); } }}
            onDrop={(e) => e.preventDefault()}
            onDragEnd={() => setDragged(null)}>
            <GripVertical className="vz-sort-grip" aria-hidden="true"/>
            <span className="vz-sort-pos">{i + 1}</span>
            <span className="vz-sort-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- vignette du catalogue. */}
              {v.image && <img src={v.image} alt="" draggable={false}/>}
            </span>
            <span className="vz-sort-name"><span className="vz-swatch" style={{ background: v.hex }} aria-hidden="true"/>{v.name}</span>
            {!v.active && <span className="vz-sort-tag">Masqué</span>}
            <span className="vz-order">
              <button type="button" onClick={() => move(i, i - 1)} disabled={busy || i === 0} aria-label={`Monter ${v.name}`} title="Monter"><ArrowUp/></button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={busy || i === order.length - 1} aria-label={`Descendre ${v.name}`} title="Descendre"><ArrowDown/></button>
            </span>
          </li>
        ))}
      </ol>

      <div className="vz-sort-foot">
        {message && <span className={message.tone === "error" ? "ord-error" : "vz-saved"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</span>}
        <button type="button" className="ad-btn" onClick={() => { setOrder(variants); setMessage(null); }} disabled={busy || !dirty}>
          <RotateCcw aria-hidden="true"/> Annuler
        </button>
        <button type="button" className="ad-btn ad-btn-primary" onClick={save} disabled={busy || !dirty} aria-busy={busy}>
          {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} Enregistrer l’ordre
        </button>
      </div>
    </section>
  );
}
