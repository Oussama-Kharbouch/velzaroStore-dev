"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, LoaderCircle, RefreshCw, Save, Trash2, X } from "lucide-react";
import { arabic } from "../../app/(store)/translations";
import { galleryLabels, SIZES } from "../../lib/catalog.mjs";
import type { EditableVariant } from "../../lib/admin/catalog";
import { ALLOWED_ACCEPT, UPLOAD_MAX_BYTES, humanSize } from "../../lib/media/rules";
import { ADMIN_PATH } from "../../lib/site";
import { GENDERS, categoryLabel, isGender, type Gender } from "../../lib/catalog-categories";
import type { CatalogModel } from "../../lib/admin/queries";
import { prepareImage, prepareVignette } from "./prepare-image";

const PHOTOS = 6;
const toNumber = (value: string) => (value.trim() === "" ? null : Number(value.trim()));

/** Rôle de chaque photo sur la boutique, dans l'ordre de la galerie. */
const photoRole = (index: number) => {
  const label = galleryLabels[index];
  if (index === 0) return `${label} · carte produit et panier`;
  if (index === 1) return `${label} · vignette du coloris`;
  return label;
};

/**
 * Fiche complète d'un coloris : création ou modification.
 * Les photos sont envoyées dès qu'on les choisit : converties en WebP par le serveur
 * et rangées dans Cloudflare R2 (route /api/upload) ; la fiche
 * enregistre ensuite leur ordre avec le reste. Six photos sont nécessaires
 * pour mettre le coloris en ligne : la galerie de la boutique en montre six.
 */
export default function VariantForm({ variant, models, modelId }: {
  variant?: EditableVariant;
  /** Models the colourway can belong to; `modelId`: preselected one for a new colourway. */
  models: CatalogModel[];
  modelId?: number;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [slotForUpload, setSlotForUpload] = useState<number | null>(null);

  const [name, setName] = useState(variant?.colorName ?? "");
  // Prefilled with the built-in translation, so it is kept if the French name is changed.
  const [nameAr, setNameAr] = useState(variant?.colorNameAr ?? (variant ? arabic[variant.colorName] ?? "" : ""));
  // A short code (#fff) is shown in full (#ffffff): the colour picker only understands 6 digits.
  const [hex, setHex] = useState(() => {
    const initial = variant?.colorHex ?? "#cccccc";
    return /^#[0-9a-fA-F]{3}$/.test(initial) ? `#${[...initial.slice(1)].map((c) => c + c).join("")}` : initial;
  });
  /** Thumbnail of the product page: one of the photos or a dedicated 150×150 image; null = the first photo. */
  const [thumbnail, setThumbnail] = useState<{ ref: string; url: string } | null>(
    variant?.thumbnail && variant.thumbnailUrl ? { ref: variant.thumbnail, url: variant.thumbnailUrl } : null);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState<number | null>(variant?.productId ?? modelId ?? (models.length === 1 ? models[0].id : null));
  const [gender, setGender] = useState<Gender | null>(variant?.gender ?? null);
  const model = models.find((m) => m.id === productId) ?? null;
  const brand = model?.brand ?? null;
  const [price, setPrice] = useState(String(variant?.price ?? 649));
  const [oldPrice, setOldPrice] = useState(variant ? (variant.oldPrice === null ? "" : String(variant.oldPrice)) : "799");
  const [active, setActive] = useState(variant?.active ?? false);
  /** ref: R2 key saved with the colourway; url: public address, for the preview. */
  const [photos, setPhotos] = useState<{ ref: string; url: string }[]>(variant?.photos ?? []);
  const [stocks, setStocks] = useState(SIZES.map((size) => {
    const stock = variant?.sizes.find((s) => s.size === size)?.stock ?? null;
    return { size, value: stock === null ? "" : String(stock) };
  }));

  const [uploading, setUploading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);

  const complete = photos.length === PHOTOS;

  /** Dedicated thumbnail: made square 150×150 WebP here, then stored on R2 like the photos. */
  const uploadThumbnail = async (file: File) => {
    setThumbBusy(true);
    setThumbError(null);
    try {
      const ready = await prepareVignette(file);
      const body = new FormData();
      body.append("fichier", ready);
      body.append("nom", name || "coloris");
      body.append("type", "vignette");
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = (await response.json().catch(() => ({ ok: false, erreur: `Le serveur a répondu ${response.status}.` }))) as
        { ok: boolean; key?: string; url?: string; erreur?: string };
      if (!data.ok || !data.key || !data.url) { setThumbError(data.erreur ?? "Téléversement impossible."); return; }
      setThumbnail({ ref: data.key, url: data.url });
      setMessage({ tone: "info", text: "Vignette envoyée sur R2 (150 × 150 WebP). Pensez à enregistrer la fiche." });
    } catch (error) {
      setThumbError(error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Le serveur n’a pas répondu.");
    } finally {
      setThumbBusy(false);
      if (thumbRef.current) thumbRef.current.value = "";
    }
  };
  const thumbnailShown = thumbnail?.url ?? photos[0]?.url ?? null;

  const choose = (slot: number) => { setSlotForUpload(slot); fileRef.current?.click(); };

  const upload = async (file: File) => {
    const slot = slotForUpload ?? photos.length;
    setUploading(slot);
    setMessage(null);
    try {
      if (file.type && !file.type.startsWith("image/")) throw new Error("Seules les images sont acceptées (JPEG, PNG, WebP, AVIF, GIF, HEIC).");
      // Converted here (WebP, or JPEG fallback): the server, on Workers, cannot resize images.
      const { file: ready, format } = await prepareImage(file);
      if (ready.size > UPLOAD_MAX_BYTES) throw new Error(`Image trop lourde (${humanSize(ready.size)}) : 10 Mo maximum.`);
      const body = new FormData();
      body.append("fichier", ready);
      body.append("nom", name || "coloris");
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = (await response.json().catch(() => ({ ok: false, erreur: `Le serveur a répondu ${response.status}.` }))) as
        { ok: boolean; key?: string; url?: string; size?: number; erreur?: string };
      if (!data.ok || !data.key || !data.url) {
        setMessage({ tone: "error", text: data.erreur ?? "Téléversement impossible." });
        return;
      }
      const photo = { ref: data.key, url: data.url };
      setPhotos((current) => {
        const next = [...current];
        if (slot < next.length) next[slot] = photo; else next.push(photo);
        return next;
      });
      setMessage({ tone: "info", text: `Photo envoyée sur R2 en ${format === "webp" ? "WebP" : "JPEG"} (${humanSize(file.size)} → ${humanSize(data.size ?? 0)}). Pensez à enregistrer la fiche.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Le serveur n’a pas répondu." });
    } finally {
      setUploading(null);
      setSlotForUpload(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const move = (index: number, step: -1 | 1) => setPhotos((current) => {
    const next = [...current];
    const target = index + step;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(variant ? `/api/admin/variants/${variant.id}` : "/api/admin/variants", {
        method: variant ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, nameAr, hex, productId, gender, thumbnail: thumbnail?.ref ?? null, price: toNumber(price), oldPrice: toNumber(oldPrice), active, photos: photos.map((p) => p.ref),
          stocks: stocks.map((s) => ({ size: s.size, stock: toNumber(s.value) })),
        }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; id?: number; erreur?: string };
      if (!data.ok) {
        setMessage({ tone: "error", text: data.erreur ?? "Enregistrement impossible." });
        return;
      }
      if (!variant && data.id) {
        router.push(`${ADMIN_PATH}/produits/${data.id}?cree=1`);
        return;
      }
      setMessage({ tone: "success", text: "Enregistré. La boutique est à jour." });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : rien n’a été enregistré." });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!variant || !window.confirm(`Supprimer définitivement le coloris « ${variant.colorName} » ?\n\nSes photos restent dans le stockage, mais il disparaît du dashboard et de la boutique.`)) return;
    setSaving(true);
    const response = await fetch(`/api/admin/variants/${variant.id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({ ok: false, erreur: `Le serveur a répondu ${response.status}.` }))) as { ok: boolean; erreur?: string };
    if (data.ok) { router.push(`${ADMIN_PATH}/produits`); return; }
    setMessage({ tone: "error", text: data.erreur ?? "Suppression impossible." });
    setSaving(false);
  };

  const busy = saving || uploading !== null;

  return (
    <div className="vz-form">
      <section className="ad-panel">
        <div className="ad-panel-head"><div><h2>Identité du coloris</h2><p>Modèle (sa marque et son nom), genre, coloris affiché sur la boutique (français et arabe) et couleur.</p></div></div>
        <div className="vz-form-grid">
          <label className="ad-field">
            <span className="ord-field-label">Modèle *</span>
            <select value={productId ?? ""} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : null)} aria-label="Modèle du coloris">
              <option value="" disabled>Choisissez le modèle</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.brand ? `${m.name} · ${m.brand}` : m.name}</option>)}
            </select>
          </label>
          {model && (
            <p className="vz-model-info">
              Sur la boutique : <span className="vz-model-info-brand">{model.brand ?? "sans marque"}</span> / <strong>{model.name}</strong> + ce coloris.
              {" "}<Link href={`${ADMIN_PATH}/produits/modeles/${model.id}`}>Modifier la marque ou le nom du modèle</Link>
            </p>
          )}
          <label className="ad-field">
            <span className="ord-field-label">Genre</span>
            <select value={gender ?? ""} onChange={(e) => setGender(isGender(e.target.value) ? e.target.value : null)} aria-label="Genre du coloris">
              <option value="">Non classé</option>
              {GENDERS.map((g) => <option key={g} value={g}>{categoryLabel(brand, g)}</option>)}
            </select>
          </label>
          <label className="ad-field">
            <span className="ord-field-label">Coloris (français) *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Black | Cayenne" aria-label="Nom du coloris"/>
          </label>
          <label className="ad-field">
            <span className="ord-field-label">Coloris (arabe)</span>
            <input dir="rtl" lang="ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={60}
              placeholder="Vide = nom français" aria-label="Nom arabe du coloris"/>
          </label>
          <label className="ad-field">
            <span className="ord-field-label">Couleur de la pastille</span>
            <span className="vz-color">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#cccccc"} onChange={(e) => setHex(e.target.value)} aria-label="Choisir la couleur"/>
              <input value={hex} onChange={(e) => setHex(e.target.value)} maxLength={7} aria-label="Code couleur"/>
            </span>
          </label>
          <div className="ad-field">
            <span className="ord-field-label">Sur la boutique</span>
            <button type="button" className={`vz-toggle${active ? " is-on" : ""}`} onClick={() => setActive(!active)} aria-pressed={active}>
              {active ? <Eye aria-hidden="true"/> : <EyeOff aria-hidden="true"/>}{active ? "En ligne" : "Masqué (brouillon)"}
            </button>
          </div>
        </div>
      </section>

      <section className="ad-panel">
        <div className="ad-panel-head">
          <div>
            <h2>Photos <small className={complete ? "vz-ok" : "vz-warn"}>{photos.length}/{PHOTOS}</small></h2>
            <p>Six photos, dans l’ordre de la galerie. Fond clair, paire entière et centrée, comme les photos existantes. Formats acceptés : JPEG, PNG, WebP, AVIF.</p>
          </div>
        </div>
        <div className="vz-photos">
          {Array.from({ length: PHOTOS }, (_, index) => {
            const url = photos[index]?.url;
            const canFill = index <= photos.length;
            return (
              <div key={index} className={`vz-photo${url ? " is-filled" : ""}`}>
                <button type="button" className="vz-photo-preview" disabled={busy || !canFill} onClick={() => choose(index)}
                  aria-label={url ? `Remplacer la photo ${index + 1}` : `Ajouter la photo ${index + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- photos du catalogue servies telles quelles. */}
                  {url ? <img src={url} alt=""/> : <ImagePlus aria-hidden="true"/>}
                  {uploading === index && <span className="vz-photo-busy"><LoaderCircle className="ad-spin"/></span>}
                </button>
                <span className="vz-photo-role"><b>{index + 1}.</b> {photoRole(index)}</span>
                {url && (
                  <span className="vz-photo-actions">
                    <button type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Avancer la photo ${index + 1}`}><ArrowLeft/></button>
                    <button type="button" onClick={() => choose(index)} disabled={busy} aria-label={`Remplacer la photo ${index + 1}`}><RefreshCw/></button>
                    <button type="button" onClick={() => setPhotos(photos.filter((_, i) => i !== index))} disabled={busy} aria-label={`Retirer la photo ${index + 1}`}><X/></button>
                    <button type="button" onClick={() => move(index, 1)} disabled={busy || index === photos.length - 1} aria-label={`Reculer la photo ${index + 1}`}><ArrowRight/></button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept={ALLOWED_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}/>
      </section>

      <section className="ad-panel">
        <div className="ad-panel-head"><div>
          <h2>Vignette du coloris</h2>
          <p>Petite image au-dessus du nom, sur la fiche produit. Choisissez une photo du coloris ou téléversez une image dédiée
            (JPG, PNG ou WebP, 5 Mo maximum) : elle est convertie en carré 150 × 150, produit entier et centré. Sans choix : la 1re photo.</p>
        </div></div>
        <div className="vz-thumb">
          <div className="vz-thumb-preview">
            <span className="vz-thumb-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu de la vignette. */}
              {thumbnailShown ? <img src={thumbnailShown} alt="Aperçu de la vignette"/> : <ImagePlus aria-hidden="true"/>}
            </span>
            <small>{thumbnail ? (photos.some((p) => p.ref === thumbnail.ref) ? "Photo du coloris choisie" : "Image dédiée") : "Par défaut : 1re photo"}</small>
            {thumbnail && <button type="button" className="ad-btn" onClick={() => setThumbnail(null)} disabled={thumbBusy}><X aria-hidden="true"/> Retirer</button>}
          </div>
          <div className="vz-thumb-choices">
            <span className="ord-field-label">Choisir une photo du coloris</span>
            {photos.length ? (
              <div className="vz-thumb-grid">
                {photos.map((p, i) => (
                  <button type="button" key={p.ref} className={`vz-thumb-option${thumbnail?.ref === p.ref ? " is-chosen" : ""}`}
                    aria-pressed={thumbnail?.ref === p.ref} aria-label={`Vignette : photo ${i + 1}`} onClick={() => { setThumbnail(p); setThumbError(null); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniature de la photo. */}
                    <img src={p.url} alt=""/>
                  </button>
                ))}
              </div>
            ) : <p className="vz-thumb-empty">Ajoutez d’abord des photos, ou téléversez une image dédiée.</p>}
            <div className="vz-thumb-actions">
              <button type="button" className="ad-btn" onClick={() => thumbRef.current?.click()} disabled={thumbBusy} aria-busy={thumbBusy}>
                {thumbBusy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <ImagePlus aria-hidden="true"/>} Téléverser une image dédiée
              </button>
              <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Image dédiée pour la vignette"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadThumbnail(file); }}/>
            </div>
            {thumbError && <p className="ord-error" role="alert">{thumbError}</p>}
          </div>
        </div>
      </section>

      <section className="ad-panel">
        <div className="ad-panel-head"><div><h2>Prix et stock</h2><p>Stock vide = non suivi : la pointure reste toujours commandable.</p></div></div>
        <div className="vz-variant-body">
          <div className="vz-prices">
            <label className="ad-field">
              <span className="ord-field-label">Prix de vente (DH) *</span>
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Prix de vente"/>
            </label>
            <label className="ad-field">
              <span className="ord-field-label">Prix barré (DH, vide = aucun)</span>
              <input inputMode="numeric" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} aria-label="Prix barré"/>
            </label>
          </div>
          <fieldset className="vz-stocks">
            <legend className="ord-field-label">Stock par pointure</legend>
            <div className="vz-stock-grid">
              {stocks.map((s, i) => (
                <label key={s.size} className="vz-stock">
                  <span>{s.size}</span>
                  <input inputMode="numeric" value={s.value} placeholder="—" aria-label={`Stock pointure ${s.size}`}
                    onChange={(e) => setStocks(stocks.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}/>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <div className="vz-form-foot">
        {variant && variant.orderLines === 0 && (
          <button type="button" className="ord-btn ord-btn-danger vz-delete" onClick={remove} disabled={busy}><Trash2 aria-hidden="true"/> Supprimer ce coloris</button>
        )}
        {variant && variant.orderLines > 0 && <span className="vz-hint">Déjà commandé : ce coloris peut être masqué, pas supprimé.</span>}
        {message && <span className={message.tone === "error" ? "ord-error" : message.tone === "success" ? "vz-saved" : "vz-hint"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</span>}
        {active && !complete && <span className="ord-error">En ligne : il faut les {PHOTOS} photos.</span>}
        <button type="button" className="ad-btn ad-btn-primary" onClick={save} disabled={busy || !name.trim()} aria-busy={saving}>
          {saving ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} {variant ? "Enregistrer" : "Créer le coloris"}
        </button>
      </div>
    </div>
  );
}
