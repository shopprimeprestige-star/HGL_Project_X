/** L'ANTEPRIMA DEL LINK — creata quando nasce il link, non quando si guarda
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ PERCHÉ QUESTO FILE ESISTE, cioè che cosa è andato storto prima.
 *  La prima versione depositava l'anteprima dentro il pannello del biglietto,
 *  subito dopo il disegno. Sembrava sensato — il disegno è già lì — ed era
 *  sbagliato: legava una cosa che deve succedere SEMPRE a un gesto che l'utente
 *  può non fare. Chi crea il link, copia e chiude senza guardare l'anteprima
 *  (cioè quasi tutti, quando si va di fretta) mandava un link senza immagine, e
 *  nell'archivio non c'era un solo deposito.
 *
 *  Adesso il deposito parte dal momento in cui il link viene creato. Il disegno
 *  si fa su una tela fuori schermo: non serve che una finestra sia aperta, non
 *  serve che qualcuno guardi. Il pannello, quando è aperto, riusa la tela che
 *  ha già — è solo una scorciatoia, non è più la condizione.
 *
 *  ⚠️ Il disegno vuole i caratteri del documento e il logo scaricato: gira nel
 *  browser e nient'altro. Da un servitore non si può fare (vedi api.anteprima).
 */
import { disegnaBiglietto, type DatiBiglietto } from "./biglietto";
import { intestazioniCRM } from "./AuthContext";
import { DURATA_PREDEFINITA, dataPulita, durataPulita, nomeDiBattesimo, oraPulita } from "./invito";
import type { Lead } from "./types";
import { urlPubblico } from "@/lib/sito";
import { codiceAnteprimaDi } from "@/shop/chi-dal-link";
import { gettoneDi } from "./fascia-consulenza";

export type EsitoAnteprima = "" | "invio" | "fatta" | "errore";

/** I codici già depositati in questa sessione del browser: creare il link due
 *  volte, o riaprire il pannello, non deve rispedire lo stesso file. */
const giaDepositate = new Set<string>();

/** Il codice dell'invito, che sta in fondo al suo indirizzo. */
export function codiceDaLink(link: string): string {
  const m = /\/invito\/([A-Za-z0-9._-]+)/.exec(String(link || ""));
  return m ? m[1] : "";
}

/** I due indirizzi sotto cui la stessa immagine deve stare.
 *  Il cliente riceve due link diversi — la pagina dell'appuntamento
 *  (/invito/…) e la stanza vera (/meetly/…) — e un'anteprima si cerca sotto il
 *  codice che sta NELL'INDIRIZZO: depositarla una volta sola lascia scoperto
 *  l'altro link, che poi è quello che si manda più spesso. */
/*  ⚠️ E DAL 6/10 CE N'È UN TERZO: il codice personale di chi riceve il link.
    In una consulenza con tre persone la stanza è una sola, quindi il biglietto
    depositato sotto il suo codice è uno solo: i tre se lo riscrivevano sopra a
    turno e restava il nome del primo, mandato anche agli altri due. Il codice
    personale (`<stanza>_<gettone>`) dà a ciascuno il suo. Il codice della
    stanza resta depositato: lo cercano i link mandati prima di questa regola,
    che non portano nessun gettone e non si possono richiamare indietro. */
function codiciDi(d: DatiBiglietto): string[] {
  const stanza = String(d.stanza || "").trim();
  return [codiceDaLink(d.link), stanza, codiceAnteprimaDi(stanza, d.gettone)].filter(
    (c, i, tutti) => c && tutti.indexOf(c) === i,
  );
}

function motivoLeggibile(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  const t = String(e ?? "").trim();
  return t && t !== "[object Object]" ? t : "motivo sconosciuto";
}

/** ── DEPOSITA L'ANTEPRIMA ───────────────────────────────────────────────────
 *  `tela` è facoltativa: se il pannello ne ha già una disegnata si riusa, se no
 *  se ne fa una fuori schermo. È l'unica differenza fra i due richiamanti.
 *
 *  ⚠️ Si rimpicciolisce a 1200×675 e si comprime in JPEG: oltre il mezzo mega
 *  i programmi di messaggistica non mostrano più l'anteprima, e la mostrano
 *  comunque rimpicciolita — i pixel in più non li vedrebbe nessuno.
 *
 *  ⚠️ La risposta del server si LEGGE. Buttarla via voleva dire che un rifiuto
 *  (sessione scaduta, permesso mancante) spariva senza traccia: si manda il
 *  link convinti che l'anteprima ci sia, e la si scopre vuota dal cliente. */
export async function depositaAnteprimaBiglietto(
  d: DatiBiglietto,
  avvisa: (stato: EsitoAnteprima, motivo?: string) => void = () => {},
  tela?: HTMLCanvasElement | null,
): Promise<void> {
  const codici = codiciDi(d);
  if (!codici.length) return;
  const daFare = codici.filter((c) => !giaDepositate.has(c));
  if (!daFare.length) {
    //  Già depositata: lo stato resta «fatta», altrimenti riaprendo il pannello
    //  sembrerebbe che non sia mai partita.
    avvisa("fatta");
    return;
  }
  daFare.forEach((c) => giaDepositate.add(c));
  avvisa("invio");

  try {
    let sorgente = tela;
    if (!sorgente) {
      //  Fuori schermo: nessuna finestra deve essere aperta perché questo
      //  accada. È tutto il punto di questo file.
      sorgente = document.createElement("canvas");
      await disegnaBiglietto(sorgente, d);
    }

    const piccola = document.createElement("canvas");
    piccola.width = 1200;
    piccola.height = 675;
    const c = piccola.getContext("2d");
    if (!c) throw new Error("tela non disponibile");
    c.drawImage(sorgente, 0, 0, piccola.width, piccola.height);

    const blob = await new Promise<Blob | null>((ris) =>
      piccola.toBlob((b) => ris(b), "image/jpeg", 0.86),
    );
    if (!blob) throw new Error("immagine non prodotta");

    const intestazioni = await intestazioniCRM();
    for (const codice of daFare) {
      const modulo = new FormData();
      modulo.append("tipo", "invito");
      modulo.append("codice", codice);
      modulo.append("file", blob, `invito-${codice}.jpg`);
      const r = (await fetch("/api/anteprima", {
        method: "POST",
        headers: intestazioni,
        body: modulo,
      }).then((x) => x.json())) as { ok?: boolean; reason?: string };
      if (!r?.ok) throw new Error(String(r?.reason || "rifiutata dal server"));
    }
    avvisa("fatta");
  } catch (e) {
    //  Il link funziona lo stesso: nella chat comparirà il marchio dello studio
    //  invece del biglietto. Ma adesso si SA.
    daFare.forEach((c) => giaDepositate.delete(c));
    avvisa("errore", motivoLeggibile(e));
  }
}

/** ── L'ANTEPRIMA DI UNA STANZA APPENA NATA ─────────────────────────────────
 *  Il link che il cliente riceve più spesso è quello della stanza, e la stanza
 *  nasce quando il consulente avvia la consulenza o salva l'appuntamento — non
 *  quando qualcuno prepara il biglietto. Finché il deposito è stato legato al
 *  tasto del biglietto, dodici stanze su tredici sono rimaste senza: chi
 *  riceveva quel link vedeva la scheda generica.
 *
 *  Questa funzione si chiama SUBITO DOPO che la stanza è nata, da tutti i
 *  punti che la creano. Costruisce il biglietto con i dati del lead e lo
 *  deposita sotto il codice della stanza.
 *
 *  ⚠️ Silenziosa: sta dentro gesti che l'utente ha chiesto per altro (avviare
 *  la consulenza, salvare la scheda), e un avviso qui lo distrarrebbe da quello
 *  che stava facendo. Se non riesce, il link funziona lo stesso — comparirà la
 *  scheda generica invece del biglietto.
 *  ⚠️ Senza giorno e ora non si disegna niente: un biglietto che dice «alle
 *  ore —» è peggio di nessun biglietto. */
export async function depositaAnteprimaPerLead(
  lead: Lead,
  codiceStanza: string,
  nomeConsulente?: string,
): Promise<void> {
  const stanza = String(codiceStanza || "").trim();
  if (!stanza) return;
  const giorno = dataPulita(lead?.data?.dataMeeting);
  const ora = oraPulita(lead?.data?.oraMeeting);
  if (!giorno || !ora) return;

  const dati: DatiBiglietto = {
    nome: nomeDiBattesimo(lead.data?.nome, lead.data?.cognome),
    giorno,
    ora,
    durataMinuti: durataPulita(lead.data?.durataMeeting) || DURATA_PREDEFINITA,
    consulente: nomeConsulente,
    //  ⚠️ Il link serve solo a ricavare il codice dell'invito, quando c'è. Qui
    //  non c'è: si deposita sotto la sola stanza, ed è esattamente ciò che
    //  serve. Il campo resta vuoto invece di inventare un indirizzo.
    link: urlPubblico(""),
    stanza,
    //  ⚠️ Il gettone si calcola SEMPRE, anche quando in quella stanza c'è una
    //   persona sola: qui non si sa quante ne saranno (una seconda si può
    //   aggiungere a quell'ora cinque minuti dopo), e un biglietto depositato
    //   anche sotto il codice personale non dà fastidio a nessuno — mentre
    //   quello che manca si scopre dal cliente.
    gettone: gettoneDi({ leadId: String(lead.id || ""), nome: lead.data?.nome || "" }),
  };
  await depositaAnteprimaBiglietto(dati);
}
