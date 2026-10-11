/** L'ANTEPRIMA DELLA STANZA, DAL LATO PRESENTATORE
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ PERCHÉ ESISTE, cioè l'errore che ho continuato a non vedere.
 *  Il link che il cliente riceve su WhatsApp è quasi sempre quello della stanza
 *  dal vivo, e quel link si copia da QUI — dalla barra del presentatore, non
 *  dal CRM. Per settimane il biglietto è stato depositato solo dai gesti del
 *  CRM (il tasto dell'invito, la creazione della stanza), cioè in posti che il
 *  consulente non attraversa quando sta per mandare il link: il risultato è
 *  stato che il cliente vedeva la scheda generica mentre nell'archivio, per
 *  quel lead, l'immagine giusta esisteva già.
 *
 *  Qui si chiude il cerchio: nel momento in cui si copia il link della
 *  consulenza, il biglietto di QUELLA persona viene disegnato e depositato
 *  sotto il codice della stanza.
 *
 *  ⚠️ Chi è «quella persona» lo dice `hg_lead_corrente`, scritto dal CRM quando
 *  si avvia la consulenza. Se manca — stanza aperta a mano, senza passare da un
 *  lead — non si inventa niente: resta la scheda generica, che è la cosa giusta
 *  da mostrare quando non si sa chi c'è dall'altra parte.
 */
import { disegnaBiglietto, type DatiBiglietto } from "@/crm/biglietto";
import {
  DURATA_PREDEFINITA,
  dataPulita,
  durataPulita,
  nomeDiBattesimo,
  oraPulita,
} from "@/crm/invito";

/** Quello che il CRM lascia in consegna al presentatore. I campi
 *  dell'appuntamento sono arrivati dopo: le consulenze avviate prima di quel
 *  cambiamento non li hanno, e in quel caso il biglietto non si disegna. */
interface LeadCorrente {
  id?: string;
  nome?: string;
  cognome?: string;
  dataMeeting?: string;
  oraMeeting?: string;
  durataMeeting?: number;
  consulente?: string;
}

const giaFatte = new Set<string>();

function leadCorrente(): LeadCorrente | null {
  try {
    const grezzo = localStorage.getItem("hg_lead_corrente");
    if (!grezzo) return null;
    const v = JSON.parse(grezzo) as LeadCorrente;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** ── DEPOSITA IL BIGLIETTO DI QUESTA CONSULENZA ────────────────────────────
 *  Si chiama quando si copia il link del cliente. Non aspetta e non parla: il
 *  gesto dell'utente era «copiare un link», e quello è già riuscito.
 *
 *  ⚠️ La tela è FUORI SCHERMO: nessuna finestra deve essere aperta, e nulla di
 *  quello che si vede in consulenza cambia di un pixel.
 *  ⚠️ Si rimpicciolisce a 1200×675 e si comprime: oltre il mezzo mega i
 *  programmi di messaggistica non mostrano più l'anteprima, e la mostrano
 *  comunque ridotta — i pixel in più non li vedrebbe nessuno. */
export async function depositaAnteprimaStanza(codiceStanza: string): Promise<void> {
  const stanza = String(codiceStanza || "").trim();
  if (!stanza || giaFatte.has(stanza)) return;

  const lead = leadCorrente();
  const giorno = dataPulita(lead?.dataMeeting);
  const ora = oraPulita(lead?.oraMeeting);
  //  Senza un appuntamento non c'è biglietto da fare: uno che dice «alle ore —»
  //  è peggio di nessun biglietto.
  if (!lead || !giorno || !ora) return;

  giaFatte.add(stanza);
  try {
    const dati: DatiBiglietto = {
      nome: nomeDiBattesimo(lead.nome, lead.cognome),
      giorno,
      ora,
      durataMinuti: durataPulita(lead.durataMeeting) || DURATA_PREDEFINITA,
      consulente: lead.consulente || undefined,
      //  Il link serve solo a ricavare il codice dell'invito, che qui non c'è:
      //  si deposita sotto la sola stanza, ed è esattamente ciò che serve.
      link: "",
      stanza,
    };

    const tela = document.createElement("canvas");
    await disegnaBiglietto(tela, dati);
    const piccola = document.createElement("canvas");
    piccola.width = 1200;
    piccola.height = 675;
    const c = piccola.getContext("2d");
    if (!c) return;
    c.drawImage(tela, 0, 0, piccola.width, piccola.height);
    const blob = await new Promise<Blob | null>((ris) =>
      piccola.toBlob((b) => ris(b), "image/jpeg", 0.86),
    );
    if (!blob) return;

    const modulo = new FormData();
    modulo.append("tipo", "invito");
    modulo.append("codice", stanza);
    modulo.append("file", blob, `invito-${stanza}.jpg`);
    //  Nessuna intestazione: dentro l'app del presentatore la sessione viaggia
    //  nel cookie, e la rotta la riconosce (vedi api.anteprima).
    const r = (await fetch("/api/anteprima", { method: "POST", body: modulo }).then((x) =>
      x.json(),
    )) as { ok?: boolean; reason?: string };
    if (!r?.ok) throw new Error(String(r?.reason || "rifiutata"));
    //  ⚠️ Silenzioso a schermo ma non muto nei registri: in questa funzione il
    //  silenzio totale è già costato sei giri di correzioni a vuoto.
    console.debug("[anteprima] stanza pronta", stanza);
  } catch (e) {
    giaFatte.delete(stanza);
    console.warn("[anteprima] stanza non depositata", stanza, e);
  }
}
