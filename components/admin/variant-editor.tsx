"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle, PencilLine, Save, TriangleAlert } from "lucide-react";
import { ADMIN_PATH } from "../../lib/site";
import { productPath } from "../../lib/catalog.mjs";
import { formatDH } from "../../lib/admin/format";
import type { CatalogVariant } from "../../lib/admin/queries";
import { StockCell } from "./bits";
import { GENDERS, categoryLabel, isGender, type Gender } from "../../lib/catalog-categories";

const toNumber = (value: string) => (value.trim() === "" ? null : Number(value.trim()));

/**
 * Un coloris : prix, prix barré, mise en ligne et stock par pointure.
 * Stock vide = non suivi : la pointure reste toujours commandable.
 * La boutique, rendue à chaque visite, montre la modification aussitôt.
 */
export default function VariantEditor({ variant, brand }: { variant: CatalogVariant; brand: string | null }) {
  const router = useRouter();
  const lock = useRef(false);
  const [refreshing, startRefresh] = useTransition();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [price, setPrice] = useState(String(variant.price));
  const [oldPrice, setOldPrice] = useState(variant.oldPrice === null ? "" : String(variant.oldPrice));
  const [active, setActive] = useState(variant.active);
  const [stocks, setStocks] = useState(variant.sizes.map((s) => ({ size: s.size, value: s.stock === null ? "" : String(s.stock) })));

  const dirty = price !== String(variant.price)
    || oldPrice !== (variant.oldPrice === null ? "" : String(variant.oldPrice))
    || active !== variant.active
    || stocks.some((s, i) => s.value !== (variant.sizes[i].stock === null ? "" : String(variant.sizes[i].stock)));
  const busy = sending || refreshing;
  const [gender, setGender] = useState<Gender | null>(variant.gender);
  const [classifying, setClassifying] = useState(false);

  /** Category: saved as soon as it is chosen (independent of the price / stock form). */
  const classify = async (next: Gender | null) => {
    const previous = gender;
    setGender(next);
    setClassifying(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/variants/${variant.id}/category`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ gender: next }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      if (data.ok) {
        setMessage({ tone: "success", text: `Catégorie : ${categoryLabel(brand, next)}.` });
        startRefresh(() => router.refresh());
      } else {
        setGender(previous);
        setMessage({ tone: "error", text: data.erreur ?? "Catégorie non enregistrée." });
      }
    } catch {
      setGender(previous);
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : catégorie non enregistrée." });
    } finally {
      setClassifying(false);
    }
  };

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/variants/${variant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          price: toNumber(price),
          oldPrice: toNumber(oldPrice),
          active,
          stocks: stocks.map((s) => ({ size: s.size, stock: toNumber(s.value) })),
        }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      setMessage(data.ok
        ? { tone: "success", text: "Enregistré. La boutique est à jour." }
        : { tone: "error", text: data.erreur ?? "Enregistrement impossible." });
      if (data.ok) startRefresh(() => router.refresh());
    } catch {
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : rien n’a été enregistré." });
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <article className={`ad-panel vz-variant${active ? "" : " is-hidden"}`}>
      <div className="vz-variant-head">
        <span className="vz-variant-photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- photos statiques du catalogue. */}
          {variant.image && <img src={variant.image} alt="" loading="lazy"/>}
        </span>
        <div className="vz-variant-title">
          <h2><span className="vz-swatch" style={{ background: variant.hex }} aria-hidden="true"/>{variant.name}</h2>
          <p>
            <a href={productPath(variant.slug)} target="_blank" rel="noopener">{productPath(variant.slug)}</a>
            {" · "}{variant.sold} paire{variant.sold > 1 ? "s" : ""} vendue{variant.sold > 1 ? "s" : ""}
            {variant.photoCount < 6 && <span className="vz-warn"><TriangleAlert aria-hidden="true"/> {variant.photoCount}/6 photos</span>}
          </p>
        </div>
        <button type="button" className={`vz-toggle${active ? " is-on" : ""}`} onClick={() => setActive(!active)}
          aria-pressed={active} title={active ? "Visible sur la boutique" : "Masqué de la boutique"}>
          {active ? <Eye aria-hidden="true"/> : <EyeOff aria-hidden="true"/>}
          {active ? "En ligne" : "Masqué"}
        </button>
      </div>

      <div className="vz-variant-body">
        <label className="ad-field vz-category">
          <span className="ord-field-label">Catégorie</span>
          <select className={gender ? "" : "is-empty"} value={gender ?? ""} disabled={classifying || busy}
            onChange={(e) => classify(isGender(e.target.value) ? e.target.value : null)} aria-label={`Catégorie de ${variant.name}`}>
            <option value="">Non classé</option>
            {GENDERS.map((g) => <option key={g} value={g}>{categoryLabel(brand, g)}</option>)}
          </select>
        </label>
        <div className="vz-prices">
          <label className="ad-field">
            <span className="ord-field-label">Prix de vente (DH)</span>
            <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Prix de ${variant.name}`}/>
          </label>
          <label className="ad-field">
            <span className="ord-field-label">Prix barré (DH, vide = aucun)</span>
            <input inputMode="numeric" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} aria-label={`Prix barré de ${variant.name}`}/>
          </label>
        </div>

        <fieldset className="vz-stocks">
          <legend className="ord-field-label">Stock par pointure <small>(vide = non suivi)</small></legend>
          <div className="vz-stock-grid">
            {stocks.map((s, i) => (
              <label key={s.size} className="vz-stock">
                <span>{s.size}</span>
                <input inputMode="numeric" value={s.value} placeholder="—"
                  onChange={(e) => setStocks(stocks.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  aria-label={`Stock pointure ${s.size} de ${variant.name}`}/>
                <StockCell stock={variant.sizes[i].stock}/>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="vz-variant-foot">
        <span className="vz-variant-current">
          Sur la boutique : <strong>{formatDH(variant.price)}</strong>
          {variant.oldPrice !== null && variant.oldPrice > variant.price && <> <del>{formatDH(variant.oldPrice)}</del></>}
        </span>
        <Link className="ad-btn" href={`${ADMIN_PATH}/produits/${variant.id}`}><PencilLine aria-hidden="true"/> Modifier la fiche</Link>
        {message && <span className={message.tone === "error" ? "ord-error" : "vz-saved"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</span>}
        <button type="button" className="ad-btn ad-btn-primary" onClick={save} disabled={busy || !dirty} aria-busy={busy}>
          {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} Enregistrer
        </button>
      </div>
    </article>
  );
}
