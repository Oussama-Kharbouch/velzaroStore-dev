"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, LoaderCircle, Save, Timer } from "lucide-react";
import type { PromoSetting } from "../../lib/admin/promo";

type Model = { slug: string; name: string };

const QUICK = [{ hours: 24, label: "24 h" }, { hours: 48, label: "48 h" }, { hours: 72, label: "72 h" }, { hours: 24 * 7, label: "7 jours" }];

/** ISO date ⇄ value of an <input type="datetime-local"> (time of this computer, i.e. Morocco). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
const dateText = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const leftText = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
  return [d ? `${d} j` : "", h ? `${h} h` : "", !d && m ? `${m} min` : ""].filter(Boolean).join(" ") || "moins d’une minute";
};

/**
 * Limited-time offer of the shop: how long it lasts (quick choices or exact dates) and which
 * product pages show the countdown. The shop reads it at every visit.
 */
export default function PromoEditor({ setting, models }: { setting: PromoSetting; models: Model[] }) {
  const router = useRouter();
  const lock = useRef(false);
  const [start, setStart] = useState(() => toLocalInput(setting.startAt));
  const [end, setEnd] = useState(() => toLocalInput(setting.endAt));
  const [chosen, setChosen] = useState<string[]>(setting.models);
  const [allModels, setAllModels] = useState(setting.models.length === 0);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  // Browser time, known once the page is interactive (the status depends on it).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const busy = sending || refreshing;

  const savedEnd = setting.endAt ? Date.parse(setting.endAt) : null;
  const savedStart = setting.startAt ? Date.parse(setting.startAt) : null;
  const status = now === null ? null
    : savedEnd === null || savedEnd <= now ? { tone: "off", text: savedEnd ? "Aucune offre en cours (la dernière est terminée)." : "Aucune offre en cours." }
    : savedStart !== null && savedStart > now ? { tone: "next", text: `Offre programmée : commence ${dateText(setting.startAt!)}, se termine ${dateText(setting.endAt!)}.` }
    : { tone: "on", text: `Offre en cours : se termine ${dateText(setting.endAt!)} (reste ${leftText(savedEnd - now)}).` };
  const running = status?.tone === "on" || status?.tone === "next";

  const send = async (body: { startAt: string | null; endAt: string | null; models: string[] }, done: string) => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/promo", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json().catch(() => ({
        ok: false, erreur: response.status === 401 ? "Session expirée : reconnectez-vous." : `Le serveur a répondu ${response.status}.`,
      }))) as { ok: boolean; erreur?: string };
      if (data.ok) {
        setMessage({ tone: "success", text: done });
        startRefresh(() => router.refresh());
      } else setMessage({ tone: "error", text: data.erreur ?? "Enregistrement impossible." });
    } catch {
      setMessage({ tone: "error", text: "Le serveur n’a pas répondu : rien n’a été enregistré." });
    } finally {
      lock.current = false;
      setSending(false);
    }
  };

  const quick = (hours: number) => {
    const from = new Date();
    from.setSeconds(0, 0);
    setStart(toLocalInput(from.toISOString()));
    setEnd(toLocalInput(new Date(from.getTime() + hours * 3600000).toISOString()));
    setMessage(null);
  };
  const toggle = (slug: string) => { setChosen((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug])); setMessage(null); };
  const hours = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 3600000) : null;
  const canSave = !!end && (allModels || chosen.length > 0);

  return (
    <div className="vz-promo-editor">
      {status && <p className={`vz-promo-status is-${status.tone}`} role="status"><Timer aria-hidden="true"/>{status.text}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (canSave) send({ startAt: fromLocalInput(start), endAt: fromLocalInput(end), models: allModels ? [] : chosen }, "Offre enregistrée. La boutique affiche le compte à rebours."); }}>
        <fieldset className="vz-promo-block">
          <legend>Durée de l’offre</legend>
          <p className="vz-promo-hint">Choix rapide (commence maintenant) :</p>
          <div className="vz-promo-quick">
            {QUICK.map((q) => <button key={q.hours} type="button" className={`ad-btn${hours === q.hours ? " is-chosen" : ""}`} onClick={() => quick(q.hours)}>{q.label}</button>)}
          </div>
          <div className="vz-promo-dates">
            <label className="ad-field"><span className="ord-field-label">Début (vide = maintenant)</span>
              <input type="datetime-local" value={start} onChange={(e) => { setStart(e.target.value); setMessage(null); }}/></label>
            <label className="ad-field"><span className="ord-field-label">Fin *</span>
              <input type="datetime-local" value={end} required onChange={(e) => { setEnd(e.target.value); setMessage(null); }}/></label>
          </div>
          {hours !== null && hours > 0 && <p className="vz-promo-hint">Les clients verront « عرض خاص لمدة {hours} ساعة فقط » / « Offre spéciale de {hours} h seulement » et le compte à rebours jusqu’à la fin.</p>}
        </fieldset>

        <fieldset className="vz-promo-block">
          <legend>Fiches produit avec le compte à rebours</legend>
          <label className="vz-promo-check"><input type="checkbox" checked={allModels} onChange={(e) => { setAllModels(e.target.checked); setMessage(null); }}/> Tous les modèles</label>
          {!allModels && <div className="vz-promo-models">
            {models.map((m) => <label key={m.slug} className="vz-promo-check"><input type="checkbox" checked={chosen.includes(m.slug)} onChange={() => toggle(m.slug)}/> {m.name}</label>)}
          </div>}
          {!allModels && chosen.length === 0 && <p className="vz-promo-hint">Cochez au moins un modèle.</p>}
        </fieldset>

        <div className="vz-promo-actions">
          <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || !canSave} aria-busy={busy}>
            {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <Save aria-hidden="true"/>} Enregistrer l’offre
          </button>
          {running && <button type="button" className="ad-btn vz-promo-stop" disabled={busy} onClick={() => send({ startAt: null, endAt: null, models: allModels ? [] : chosen }, "Offre arrêtée. Le compte à rebours a disparu de la boutique.")}>
            <CircleStop aria-hidden="true"/> Arrêter l’offre maintenant
          </button>}
        </div>
        {message && <p className={message.tone === "error" ? "ord-error" : "vz-saved"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}
      </form>
    </div>
  );
}
