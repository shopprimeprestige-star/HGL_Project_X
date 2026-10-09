/** ── INVITARE UN LEAD A UNA DIRETTA ─────────────────────────────────────────
 *
 *  Un pulsante nella scheda del cliente. Sta lì e non in una pagina «inviti»
 *  perché la decisione di invitare qualcuno nasce guardando LUI: stai leggendo
 *  le sue note, vedi che è fermo in valutazione da tre settimane, e ti viene in
 *  mente che giovedì c'è la diretta sulle domande. In una pagina a parte quella
 *  decisione non la prende nessuno, perché quando ci arrivi non hai davanti la
 *  persona.
 *
 *  ⚠️ MANDA SU WHATSAPP, non «segna l'invito». Un invito registrato da qualche
 *   parte e mai spedito è lavoro che sembra fatto e non lo è — e in questo
 *   gestionale la gente si contatta su WhatsApp, non per posta. Il messaggio
 *   parte già scritto: resta da premere invio.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Radio, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra } from "@/crm/ui/Finestra";
import { intestazioniCRM } from "@/crm/AuthContext";
import { buildWhatsAppLink } from "@/crm/whatsapp";
import type { Lead } from "@/crm/types";
import { messaggioInvitoWebinar } from "./messaggio-invito";

interface Sala { codice: string; titolo: string; link: string }

export function PulsanteInvitaAlWebinar({ lead, className }: { lead: Lead; className?: string }) {
  const [aperta, setAperta] = useState(false);
  const [sale, setSale] = useState<Sala[] | null>(null);

  useEffect(() => {
    if (!aperta) return;
    let annullato = false;
    void (async () => {
      try {
        const r = await fetch("/api/crm/webinar?azione=elenco", { headers: await intestazioniCRM() });
        const j = await r.json();
        if (!annullato) setSale(Array.isArray(j?.stanze) ? j.stanze : []);
      } catch {
        if (!annullato) setSale([]);
      }
    })();
    return () => { annullato = true; };
  }, [aperta]);

  const telefono = String(lead.data.telefono ?? "").trim();

  const invita = (s: Sala) => {
    const testo = messaggioInvitoWebinar({
      nome: String(lead.data.nome ?? ""),
      titolo: s.titolo,
      link: s.link,
    });
    //  Senza numero non si rinuncia: si apre WhatsApp sull'elenco delle chat
    //  col messaggio già scritto. Un tocco in più, e il testo non si perde.
    const url = telefono
      ? buildWhatsAppLink(telefono, testo)
      : `https://wa.me/?text=${encodeURIComponent(testo)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setAperta(false);
  };

  const copia = async (s: Sala) => {
    const testo = messaggioInvitoWebinar({
      nome: String(lead.data.nome ?? ""),
      titolo: s.titolo,
      link: s.link,
    });
    try {
      await navigator.clipboard.writeText(testo);
      toast.success("Messaggio copiato");
    } catch {
      toast.error("Il browser non mi lascia copiare");
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setAperta(true)} className={className}>
        <Radio className="h-4 w-4" /> Invita a un webinar
      </Button>

      <Finestra
        aperta={aperta}
        onCambio={setAperta}
        larghezza="md"
        icona={Radio}
        titolo="Invita a una diretta"
        contesto={`${lead.data.nome ?? ""} ${lead.data.cognome ?? ""}`.trim()}
        classeCorpo="space-y-2"
      >
        {sale === null && (
          <p className="t-corpo flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cerco le sale…
          </p>
        )}

        {sale?.length === 0 && (
          <p className="t-corpo text-muted-foreground">
            Non hai ancora nessuna sala. Si creano dal menu <b>Webinar</b>: lì dai il nome
            all&apos;evento e ottieni il link.
          </p>
        )}

        {!!sale?.length && (
          <>
            {/*  ⚠️ Il numero si dice PRIMA, non dopo: se manca, chi preme
                «Invita» si aspetta che si apra la chat di questa persona e
                invece si apre l'elenco delle chat. Saperlo prima cambia il
                gesto; scoprirlo dopo lo fa sembrare rotto. */}
            <p className="t-nota text-muted-foreground">
              {telefono
                ? "Si apre WhatsApp sulla sua chat, col messaggio già scritto."
                : "Questo lead non ha un numero: si apre WhatsApp col messaggio da incollare."}
            </p>
            <ul className="divide-y rounded-lg border">
              {sale.map((s) => (
                <li key={s.codice} className="flex flex-wrap items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="t-riga truncate font-medium">{s.titolo}</p>
                    <p className="t-nota truncate text-muted-foreground">{s.link}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void copia(s)} title="Copia il messaggio">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" onClick={() => invita(s)}>
                    <Send className="h-3.5 w-3.5" /> Invita
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Finestra>
    </>
  );
}
