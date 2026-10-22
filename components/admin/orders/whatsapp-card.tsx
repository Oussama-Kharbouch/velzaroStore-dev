"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import WhatsappIcon from "../../whatsapp-icon";
import { whatsappLink } from "../../../lib/orders/whatsapp";

/**
 * Message WhatsApp au client, modifiable avant l'ouverture. Le lien wa.me
 * ouvre WhatsApp Web ou l'application ; l'envoi reste manuel et ne change
 * jamais le statut de la commande.
 *
 * Le parent remonte ce composant (cle) quand le statut change : le texte
 * propose suit alors la nouvelle etape.
 */
export default function WhatsappCard({
  phone, title, action, message,
}: { phone: string; title: string; action: string; message: string }) {
  const [text, setText] = useState(message);
  const link = whatsappLink(phone, text);

  return (
    <section className="ad-panel ord-card">
      <div className="ord-card-head">
        <span className="ord-wa-logo"><WhatsappIcon/></span>
        <h2>{title}</h2>
      </div>

      <div className="ord-card-body">
        <label className="ord-wa-label" htmlFor="ord-wa-text">Message (modifiable avant l’envoi)</label>
        <textarea
          id="ord-wa-text"
          className="ord-wa-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
        />
        {text !== message && (
          <button type="button" className="ord-link-btn" onClick={() => setText(message)}>Revenir au message proposé</button>
        )}

        {link ? (
          <a className="ord-btn ord-btn-wa" href={link} target="_blank" rel="noopener noreferrer">
            <WhatsappIcon/> {action}
          </a>
        ) : (
          <p className="ord-warning" role="alert">
            <TriangleAlert aria-hidden="true"/>
            Numéro absent ou invalide ({phone || "aucun"}). Un mobile marocain est attendu (06, 07 ou +212) :
            contactez le client par téléphone.
          </p>
        )}
        <p className="ord-caption">Vérifiez le message, puis appuyez sur Envoyer dans WhatsApp.</p>
      </div>
    </section>
  );
}
