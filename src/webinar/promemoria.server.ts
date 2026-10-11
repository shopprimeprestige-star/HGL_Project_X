import * as sala from "./sala.server";
import { testoPromemoria } from "./iscrizione";

/** ── MANDARE IL PROMEMORIA ─────────────────────────────────────────────────
 *
 *  ⚠️ NON SI SPEDISCE A RAFFICA. Duecento richieste lanciate insieme al server
 *   di WhatsApp non arrivano prima: arrivano tutte insieme a un limite di
 *   velocità, e quello che succede dopo è che una parte viene rifiutata senza
 *   che nessuno se ne accorga. Si va a piccoli gruppi.
 *
 *  ⚠️ E SI SEGNA UNO PER UNO, DOPO CHE È PARTITO. Segnandoli tutti prima, un
 *   errore a metà lascerebbe la seconda metà marcata come avvisata senza aver
 *   ricevuto niente: quelle persone non riceverebbero mai più nulla, e non ci
 *   sarebbe modo di sapere quali sono.
 *
 *  ⚠️ IL SILENZIO SERVE. Chi ha ricevuto il promemoria di un'ora fa non deve
 *   ricevere anche «siamo in diretta» due minuti dopo. Un messaggio doppio è il
 *   modo più veloce di farsi bloccare il numero, e su WhatsApp un blocco non si
 *   toglie più.
 */

/** Quanto silenzio deve esserci passato prima di riscrivere alla stessa
 *  persona. Venti minuti: abbastanza da non mandare due messaggi nello stesso
 *  momento, poco da poter mandare «manca un'ora» e poi «siamo in onda». */
export const SILENZIO_MS = 20 * 60 * 1000;

const GRUPPO = 5;

export async function mandaPromemoria(o: {
  codice: string;
  titolo: string;
  link: string;
  tipo: "manca-poco" | "in-diretta";
  /** da dove chiamare la porta che spedisce davvero */
  origine: string;
  /** l'intestazione con cui questa richiesta è autorizzata */
  intestazioni: Record<string, string>;
  /** il template approvato da Meta, se la sala ne ha uno */
  template?: string;
}): Promise<{ mandati: number; falliti: number; fuoriFinestra: number }> {
  const tutti = await sala.daAvvisare(o.codice, SILENZIO_MS);
  let mandati = 0;
  let falliti = 0;
  /** ⚠️ Contato a parte perché è l'unico fallimento che si risolve in un
   *  posto solo — impostando il template sulla sala. Confuso dentro «falliti»
   *  sembrerebbe una rete che fa i capricci, e si riproverebbe all'infinito
   *  una cosa che non può riuscire. */
  let fuoriFinestra = 0;
  const template = String(o.template || "").trim();

  for (let i = 0; i < tutti.length; i += GRUPPO) {
    const gruppo = tutti.slice(i, i + GRUPPO);
    await Promise.all(gruppo.map(async (p) => {
      try {
        const r = await fetch(`${o.origine}/api/whatsapp-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...o.intestazioni },
          //  ⚠️ Col template si manda IL TEMPLATE E BASTA, senza allegare
          //   anche il testo: la porta che spedisce, trovandoli entrambi,
          //   userebbe il template — ma il testo verrebbe comunque scritto
          //   nello storico al posto di quello vero, e riletto domani
          //   racconterebbe un messaggio che nessuno ha ricevuto.
          body: JSON.stringify(
            template
              ? {
                  to: p.contatto,
                  templateName: template,
                  templateParams: [p.nome || "", o.titolo, o.link],
                }
              : {
                  to: p.contatto,
                  body: testoPromemoria({
                    tipo: o.tipo, titolo: o.titolo, link: o.link, nome: p.nome || "",
                  }),
                },
          ),
        });
        if (!r.ok) {
          const perche = await r.json().catch(() => null) as { category?: string } | null;
          if (perche?.category === "outside_24h_window") fuoriFinestra += 1;
          else falliti += 1;
          return;
        }
        await sala.segnaAvvisato(o.codice, p.contatto);
        mandati += 1;
      } catch {
        //  ⚠️ Un fallimento NON si segna come avvisato: quella persona deve
        //   poter ricevere il messaggio al tentativo dopo.
        falliti += 1;
      }
    }));
  }

  return { mandati, falliti, fuoriFinestra };
}
