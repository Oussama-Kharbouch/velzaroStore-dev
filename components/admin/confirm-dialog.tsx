"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

/**
 * Confirmation window of the dashboard (native <dialog>: focus kept inside, Escape closes it).
 * While `busy`, it cannot be closed and the confirm button shows a spinner; `error` is shown
 * inside the window, which stays open so that the action can be retried or cancelled.
 */
export default function ConfirmDialog({ open, title, children, confirmLabel, busy, error, onConfirm, onCancel }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string;
  busy: boolean; error: string | null; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="ad-dialog" aria-labelledby="ad-dialog-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="ad-dialog-body">
        <span className="ad-dialog-icon" aria-hidden="true"><TriangleAlert/></span>
        <h2 id="ad-dialog-title">{title}</h2>
        <div className="ad-dialog-text">{children}</div>
        {error && <p className="ord-error" role="alert">{error}</p>}
      </div>
      <div className="ad-dialog-foot">
        <button type="button" className="ad-btn" onClick={onCancel} disabled={busy} autoFocus>Annuler</button>
        <button type="button" className="ad-btn ad-btn-danger" onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy && <LoaderCircle className="ad-spin" aria-hidden="true"/>} {busy ? "Suppression…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
