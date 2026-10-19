"use client";

import { useState } from "react";
import { LoaderCircle, StickyNote } from "lucide-react";
import { useOrderAction } from "./use-order-action";

const NOTE_MAX = 500;

/** Note interne, ajoutee a l'historique ; jamais visible du client. */
export default function NoteForm({ orderId }: { orderId: number }) {
  const { run, busy, error } = useOrderAction(orderId);
  const [text, setText] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (await run("/notes", "POST", { message: text })) setText("");
  };

  return (
    <form className="ord-note-form" onSubmit={submit}>
      <label className="ord-field-label" htmlFor={`note-${orderId}`}>Ajouter une note interne</label>
      <div className="ord-note-box">
        <textarea
          id={`note-${orderId}`}
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, NOTE_MAX))}
          placeholder="Ex. Client à rappeler après 18 h…"
          rows={3}
        />
        <span className="ord-note-count">{text.length}/{NOTE_MAX}</span>
      </div>
      <button type="submit" className="ad-btn" disabled={busy || !text.trim()}>
        {busy ? <LoaderCircle className="ad-spin" aria-hidden="true"/> : <StickyNote aria-hidden="true"/>}
        Ajouter la note
      </button>
      {error && <p className="ord-error" role="alert">{error}</p>}
    </form>
  );
}
