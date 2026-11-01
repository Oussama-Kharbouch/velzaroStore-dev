"use client";
/* eslint-disable @next/next/no-img-element -- catalogue photos (R2) are shown as they are. */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { COMFORT_CARDS_MAX, COMFORT_ZOOMS, COMFORT_ZOOM_LABELS, DEFAULT_COMFORT, type Bilingual, type ComfortCard, type ComfortContent } from "../../lib/comfort";

const empty: ComfortCard = { photo: 1, zoom: "none", title: { ar: "", fr: "" }, text: { ar: "", fr: "" } };

/** Arabic and French fields side by side (Arabic written right to left). */
function Pair({ label, value, onChange, max, area }: { label: string; value: Bilingual; onChange: (v: Bilingual) => void; max: number; area?: boolean }) {
  const Field = area ? "textarea" : "input";
  return <div className="vz-comfort-pair">
    <label className="ad-field"><span className="ord-field-label">{label} — arabe</span>
      <Field dir="rtl" lang="ar" value={value.ar} maxLength={max} rows={area ? 3 : undefined} onChange={(e) => onChange({ ...value, ar: e.target.value })}/></label>
    <label className="ad-field"><span className="ord-field-label">{label} — français</span>
      <Field value={value.fr} maxLength={max} rows={area ? 3 : undefined} onChange={(e) => onChange({ ...value, fr: e.target.value })}/></label>
  </div>;
}

/**
 * « Pourquoi vous allez l'adorer » section of a colourway: shown or not, its title, and 1 to 6 cards
 * (one of its photos, framing, title and text in both languages). The same cards can be copied to
 * every colourway of the model: each one then shows its own photo of the chosen number.
 */
export default function ComfortEditor({ variantId, modelName, colourways, content, photos }: { variantId: number; modelName: string; colourways: number; content: ComfortContent; photos: string[] }) {
  const router = useRouter();
  const lock = useRef(false);
  const [value, setValue] = useState<ComfortContent>(content);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [allColourways, setAllColourways] = useState(false);
  const busy = sending || refreshing;
  const dirty = JSON.stringify(value) !== JSON.stringify(content) || allColourways;

  const change = (next: ComfortContent) => { setValue(next); setMessage(null); };
  const setCard = (i: number, card: ComfortCard) => change({ ...value, cards: value.cards.map((c, j) => (j === i ? card : c)) });
  const move = (i: number, step: number) => {
    const cards = [...value.cards];
    [cards[i], cards[i + step]] = [cards[i + step], cards[i]];
    change({ ...value, cards });
  };
  const photoOf = (n: number) => photos[n - 1] ?? photos[0];

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/variants/${variantId}/comfort`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ comfort: value, allColourways }),
      });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string; count?: number };
      if (data.ok) {
        setMessage({ tone: "success", text: (data.count ?? 1) > 1 ? `Section enregistrée sur les ${data.count} coloris de ${modelName}.` : "Section enregistrée. La fiche de ce coloris est à jour." });
        setAllColourways(false);
        startRefresh(() => router.refresh());
      } else setMessage({ tone: "error", text: data.erreur ?? "Enregistrement impossible." });
    } catch {
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : rien n’a été enregistré." });
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  return (
    <form className="vz-comfort-editor" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }}>
      <label className="vz-promo-check vz-comfort-toggle">
        <input type="checkbox" checked={value.enabled} onChange={(e) => change({ ...value, enabled: e.target.checked })}/> Afficher cette section sur la fiche de ce coloris
      </label>

      <fieldset className="vz-promo-block" disabled={!value.enabled}>
        <legend>Titre de la section</legend>
        <Pair label="Titre" value={value.title} max={80} onChange={(title) => change({ ...value, title })}/>
      </fieldset>

      {value.cards.map((card, i) => (
        <fieldset key={i} className="vz-promo-block vz-comfort-card" disabled={!value.enabled}>
          <legend>Carte {i + 1}</legend>
          <div className="vz-comfort-card-tools">
            <button type="button" className="ad-btn" aria-label={`Monter la carte ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden="true"/></button>
            <button type="button" className="ad-btn" aria-label={`Descendre la carte ${i + 1}`} disabled={i === value.cards.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden="true"/></button>
            <button type="button" className="ad-btn vz-promo-stop" aria-label={`Supprimer la carte ${i + 1}`} disabled={value.cards.length === 1} onClick={() => change({ ...value, cards: value.cards.filter((_, j) => j !== i) })}><Trash2 aria-hidden="true"/></button>
          </div>
          <div className="vz-comfort-card-body">
            <div className={`vz-comfort-preview zoom-${card.zoom}`}>{photos.length ? <img src={photoOf(card.photo)} alt={`Aperçu de la carte ${i + 1}`}/> : <span>Aucune photo</span>}</div>
            <div className="vz-comfort-card-fields">
              <div className="ad-field"><span className="ord-field-label">Photo du coloris</span>
                <div className="vz-comfort-photos" role="radiogroup" aria-label={`Photo de la carte ${i + 1}`}>
                  {photos.map((src, n) => <button key={n} type="button" role="radio" aria-checked={card.photo === n + 1} aria-label={`Photo ${n + 1}`} className={card.photo === n + 1 ? "is-chosen" : ""} onClick={() => setCard(i, { ...card, photo: n + 1 })}><img src={src} alt=""/><small>{n + 1}</small></button>)}
                </div>
              </div>
              <label className="ad-field"><span className="ord-field-label">Cadrage</span>
                <select value={card.zoom} onChange={(e) => setCard(i, { ...card, zoom: e.target.value as ComfortCard["zoom"] })}>
                  {COMFORT_ZOOMS.map((z) => <option key={z} value={z}>{COMFORT_ZOOM_LABELS[z]}</option>)}
                </select>
              </label>
            </div>
          </div>
          <Pair label="Titre de la carte" value={card.title} max={60} onChange={(title) => setCard(i, { ...card, title })}/>
          <Pair label="Texte" value={card.text} max={240} area onChange={(text) => setCard(i, { ...card, text })}/>
        </fieldset>
      ))}

      <p className="vz-promo-hint">Les photos sont celles de ce coloris (ajoutées plus haut). Une langue laissée vide affiche l’autre.</p>
      {colourways > 1 && <label className="vz-promo-check vz-comfort-all">
        <input type="checkbox" checked={allColourways} onChange={(e) => { setAllColourways(e.target.checked); setMessage(null); }}/> Utiliser ces cartes pour les {colourways} coloris de {modelName} (chacun avec sa propre photo du même numéro)
      </label>}
      <div className="vz-promo-actions">
        <button type="button" className="ad-btn" disabled={!value.enabled || value.cards.length >= COMFORT_CARDS_MAX} onClick={() => change({ ...value, cards: [...value.cards, { ...empty }] })}><Plus aria-hidden="true"/> Ajouter une carte</button>
        <button type="button" className="ad-btn" onClick={() => change({ ...DEFAULT_COMFORT, enabled: value.enabled })}><RotateCcw aria-hidden="true"/> Remettre le texte d’origine</button>
        <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || !dirty} aria-busy={busy}>
          {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} Enregistrer la section
        </button>
      </div>
      {message && <p className={message.tone === "error" ? "ord-error" : "vz-saved"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}
    </form>
  );
}
