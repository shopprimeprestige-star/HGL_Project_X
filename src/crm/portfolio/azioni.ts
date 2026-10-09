/** ── PORTAFOGLIO FOTO E VIDEO · L'UNICO PUNTO CHE SCRIVE ───────────────────
 *
 *  Qui c'è il gesto intero: chiedere il permesso, mandare il file allo Storage,
 *  aggiungere la voce alla scheda, dirlo a chi ha premuto. Le REGOLE — cosa si
 *  può caricare, com'è fatta una voce, quale foto fa da principale — non stanno
 *  qui: stanno in `dati.ts`, che è pura e la legge anche il server. Qui c'è solo
 *  ciò che senza React e senza CRM non si può fare.
 *
 *  ── PERCHÉ È UN FILE SEPARATO DA dati.ts ──────────────────────────────────
 *  ⚠️ Non è un gusto: `dati.ts` è importata da routes/api.crm.media-upload.ts,
 *   che gira dentro il Worker. Mettere questo hook là dentro trascinerebbe
 *   React, il client Supabase del browser e i messaggi a schermo dentro il
 *   pacchetto del server, per riusare due controlli sul tipo di file. Il
 *   confine è quello: `dati.ts` non sa che esiste un browser, `azioni.ts` sì.
 *
 *  ── LE REGOLE DELLA CASA, TUTTE E TRE RISPETTATE ──────────────────────────
 *   · si riscrive SEMPRE il portafoglio intero (`updateLead` fa un merge
 *     superficiale: un pezzo solo cancella il resto — vedi MediaClienteInfo);
 *   · nessuna scrittura finta: se non è cambiato niente non si scrive, così lo
 *     storico della scheda non si riempie di righe che non dicono nulla;
 *   · «Annulla» sul gesto distruttivo, niente messaggio su quelli ripetuti.
 *
 *  ── ⚠️ NESSUN ERRORE MUTO ─────────────────────────────────────────────────
 *  `carica` non restituisce un booleano: restituisce il MOTIVO. Il server
 *  risponde già con frasi in italiano pensate per essere lette («la foto pesa
 *  40 MB e il limite è 25», «il telefono l'ha salvata in HEIC»), e buttarle via
 *  per scrivere «errore» significa lasciare la persona davanti a un pulsante
 *  che non funziona e nessuna idea di cosa fare.
 *  ───────────────────────────────────────────────────────────────────────── */

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { intestazioniCRM } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import type { Lead, MediaClienteInfo } from "@/crm/types";
import {
  conNome,
  conOrdine,
  conPrincipale,
  conVoceAggiunta,
  controllaFile,
  nuovaVoce,
  portafoglioDi,
  senzaVoce,
} from "@/crm/portfolio/dati";

/** Il permesso a termine, come torna dalla rotta. */
interface Permesso {
  ok?: boolean;
  reason?: string;
  bucket?: string;
  path?: string;
  token?: string;
  url?: string;
  kind?: "image" | "video";
  caricatoDa?: string;
}

/** ── LA FRASE QUANDO IL SERVER NON NE HA MANDATA UNA ──────────────────────
 *  Succede quando a rispondere non è la rotta ma qualcos'altro (una pagina di
 *  errore del proxy, una connessione caduta a metà). Il codice HTTP è l'unica
 *  cosa che resta, e ognuno dei tre casi ha un rimedio DIVERSO: rientrare,
 *  chiedere a un admin, riprovare. Dirli tutti con «errore» manda la persona a
 *  riprovare per sempre una cosa che non riuscirà mai. */
function motivoDaStato(stato: number): string {
  if (stato === 401) return "Sessione scaduta: esci e rientra col tuo PIN, poi riprova.";
  if (stato === 403) return "Non hai il permesso «Installazioni»: chiedilo a un amministratore.";
  if (stato === 413) return "Il file è troppo grande per l'archivio.";
  if (stato === 415) return "Questo tipo di file non si può caricare: servono foto o video.";
  if (stato >= 500) return "L'archivio non ha risposto. Riprova fra un minuto.";
  return "Il caricamento non è riuscito e il server non ha detto perché.";
}

export interface EsitoCaricamento {
  ok: boolean;
  /** La frase da mostrare. C'è solo quando `ok` è falso. */
  motivo?: string;
  /** ── ⚠️ IL PORTAFOGLIO COM'È STATO SCRITTO, E PERCHÉ ESCE DA QUI ─────────
   *  Serve a chi carica PIÙ FILE DI SEGUITO, ed è l'unico modo corretto di
   *  farlo. Il ragionamento, perché non si perda:
   *
   *  Ogni file aggiunge una voce all'elenco, quindi il secondo file deve
   *  ripartire dall'elenco che ha lasciato il primo. Verrebbe naturale
   *  rileggerlo dal lead aggiornato (un `useRef` che segue il contesto), e per
   *  un po' si è fatto così: NON FUNZIONA, ed è il tipo di guasto peggiore
   *  perché non dà nessun errore. `updateLead` chiama `setLeads` e ritorna
   *  SUBITO — dopo quella riga non c'è nessun `await` (CRMContext). React,
   *  ricevendo l'aggiornamento fuori da un evento suo, programma il ridisegno
   *  su un compito del browser, mentre il ciclo dei caricamenti prosegue sulla
   *  coda delle promesse, che viene prima: quando parte il secondo file il
   *  componente NON si è ancora ridisegnato e il riferimento punta ancora al
   *  lead di prima. Risultato: il secondo file scriveva un elenco con la sola
   *  voce sua, e la foto appena caricata spariva dalla scheda in silenzio —
   *  lasciando però il suo file nello spazio pubblico.
   *
   *  Con questo campo la catena non passa da React: chi carica prende l'elenco
   *  che è appena stato scritto e lo dà in pasto al file successivo. È un dato,
   *  non un ridisegno, quindi è pronto nell'istante stesso in cui serve.
   *  C'è solo quando `ok` è vero. */
  info?: MediaClienteInfo;
}

const nomeDi = (l: Lead) =>
  `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "questo cliente";

export function useAzioniPortafoglio() {
  const { updateLead } = useCRM();

  /** Scrive il portafoglio INTERO e dice se è andata. `updateLead` torna
   *  `false` quando il lead non è nell'elenco in memoria — una scheda aperta da
   *  un collegamento diretto, un elenco ricaricato mentre la finestra era
   *  aperta — e in quel caso non scrive niente SENZA nessun errore. È l'uscita
   *  più insidiosa del CRM (il commento è in CRMContext): qui non passa
   *  inosservata. */
  const scrivi = async (l: Lead, info: MediaClienteInfo): Promise<boolean> =>
    updateLead(l.id, { mediaCliente: info });

  /** ── CARICARE ───────────────────────────────────────────────────────────
   *  Tre anelli, e ognuno può dire di no con parole sue:
   *   1. il controllo qui, che evita di far aspettare per niente;
   *   2. il permesso a termine dal server, che rifà lo stesso controllo perché
   *      il primo si può scavalcare;
   *   3. il file DIRITTO allo Storage, senza passare dal nostro server: un
   *      video di posa girato col telefono ucciderebbe il Worker, che riceve i
   *      file interi in memoria (vedi routes/api.crm.media-upload.ts).
   *
   *  ⚠️ CARICANDONE CINQUE DI FILA, IL LEAD DA PASSARE AL SECONDO NON È QUELLO
   *   CHE HA IN MANO REACT. Ognuno aggiunge una voce, quindi ogni file deve
   *   ripartire dall'elenco lasciato dal precedente — e quell'elenco, subito
   *   dopo la scrittura, NON è ancora arrivato nel `lead` che il componente
   *   riceve (il perché per esteso è su `EsitoCaricamento.info`, qui sopra: è
   *   la differenza fra la coda delle promesse e i compiti del browser, e
   *   sbagliarla fa sparire le foto una a una senza nessun errore).
   *   La regola quindi è: al PRIMO file si passa il lead vero; dal secondo in
   *   poi si passa lo stesso lead con dentro l'`info` restituita dal
   *   precedente. In portfolio/Visore.tsx lo fa `caricaTutti`, ed è tre righe. */
  const carica = async (l: Lead | null | undefined, file: File): Promise<EsitoCaricamento> => {
    if (!l) return { ok: false, motivo: "Scheda non più aperta: riaprila e riprova." };

    const controllo = controllaFile({ mime: file.type, peso: file.size });
    if (!controllo.ok) return { ok: false, motivo: controllo.motivo };

    let permesso: Permesso | null = null;
    let stato = 0;
    try {
      const r = await fetch("/api/crm/media-upload", {
        method: "POST",
        headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mime: file.type, peso: file.size, nome: file.name }),
      });
      stato = r.status;
      permesso = (await r.json().catch(() => null)) as Permesso | null;
    } catch (e) {
      return {
        ok: false,
        motivo: `Caricamento interrotto: ${(e as Error)?.message || "connessione persa"}.`,
      };
    }
    //  La risposta si LEGGE: `reason` è già una frase pensata per essere
    //  mostrata, e viene prima di qualunque cosa possiamo dedurre dal codice.
    if (!permesso?.ok || !permesso.token || !permesso.path) {
      return { ok: false, motivo: permesso?.reason?.trim() || motivoDaStato(stato) };
    }

    const { error } = await supabase.storage
      .from(permesso.bucket || "clienti-media")
      .uploadToSignedUrl(permesso.path, permesso.token, file, {
        contentType: file.type || undefined,
      });
    if (error) return { ok: false, motivo: `Archivio: ${error.message}` };
    if (!permesso.url) return { ok: false, motivo: "L'archivio non ha restituito l'indirizzo." };

    //  ⚠️ Il tipo lo dice il SERVER, che ha appena controllato il file: il
    //  browser potrebbe dichiarare un mime e mandarne un altro, e da qui in poi
    //  `kind` decide se una voce può diventare la principale.
    const voce = nuovaVoce({
      url: permesso.url,
      kind: permesso.kind === "image" ? "image" : "video",
      //  Il nome del file diventa l'appunto interno. ⚠️ Spesso è il nome del
      //  cliente: sta nella scheda, che la vede solo chi lavora la pratica, e
      //  NON nell'indirizzo pubblico (là non ci finisce niente del nome — vedi
      //  la rotta). Al cliente non si mostra mai.
      nome: file.name,
      caricatoDa: permesso.caricatoDa,
    });

    const esito = conVoceAggiunta(portafoglioDi(l), voce);
    //  ⚠️ Il file è GIÀ nello spazio pubblico: se la voce non entra in elenco
    //   (portafoglio pieno, doppione) resta là senza che niente lo ricordi.
    //   È lo stesso buco della cancellazione, letto dall'altro lato, ed è il
    //   motivo per cui i due controlli che possono rifiutare qui sono anche gli
    //   unici due che si possono fare PRIMA di caricare. Se un domani si
    //   cancella davvero, è qui che va cancellato `permesso.path`.
    if (esito.motivo) return { ok: false, motivo: esito.motivo };

    const scritto = await scrivi(l, esito.info);
    if (!scritto) {
      return {
        ok: false,
        motivo:
          "Il file è stato caricato ma la scheda non era più in elenco: ricarica la pagina e riprova.",
      };
    }
    //  L'elenco appena scritto torna indietro: è quello da cui deve ripartire il
    //  file successivo (vedi `EsitoCaricamento.info`).
    return { ok: true, info: esito.info };
  };

  /** ── ELIMINARE — LA VOCE E IL FILE, IN QUEST'ORDINE ─────────────────────
   *  ⚠️ QUI «ELIMINA» TOGLIEVA LA VOCE E LASCIAVA IL FILE, a un indirizzo
   *   pubblico che si apre senza credenziali, per sempre. Il messaggio lo
   *   diceva — ed era onesto — ma su foto di teste e di volti «tolto dalla
   *   vista» e «cancellato» non possono essere la stessa parola: chi quel link
   *   ce l'aveva già continuava a vedere la foto dopo la cancellazione. Adesso
   *   il file lo cancella `api.crm.media-elimina`, dietro lo stesso permesso
   *   con cui era stato caricato.
   *
   *  L'ORDINE NON È INDIFFERENTE: prima la scheda, poi il file. Al contrario,
   *  un file cancellato con la scrittura della scheda fallita lascerebbe in
   *  elenco una voce che punta al nulla — un riquadro rotto al posto di una
   *  foto, e nessun modo di rimediare. Così invece il caso peggiore è un file
   *  orfano nell'archivio, che non si vede da nessuna parte e non fa danni.
   *
   *  E NON C'È PIÙ «ANNULLA»: rimetterebbe in elenco una voce il cui file non
   *  esiste più. Al suo posto la conferma che c'era già prima di arrivare qui
   *  (portfolio/Visore), che adesso è l'unica rete — e infatti il messaggio
   *  dice che il file è stato cancellato, non che è stato «tolto». */
  const elimina = async (l: Lead | null | undefined, id: string) => {
    if (!l) return;
    const precedente = portafoglioDi(l);
    const esito = senzaVoce(precedente, id);
    //  Niente da togliere: succede premendo due volte, o su una scheda che un
    //  altro ha già aggiornato. Non si scrive e non si dice niente.
    if (!esito.tolta) return;
    if (!(await scrivi(l, esito.info))) {
      toast.error("Non è stato possibile aggiornare la scheda: ricarica la pagina.");
      return;
    }
    //  ⚠️ IL FALLIMENTO QUI SI DICE, e non si tace come un dettaglio tecnico.
    //   La voce è già sparita dalla scheda, quindi a schermo sembra fatto: se
    //   il file è rimasto, chi ha eliminato deve saperlo — è l'unica persona
    //   che può decidere se importa (una foto di un volto) o no.
    const url = String(esito.tolta.url || "");
    let cancellato = false;
    let motivo = "";
    try {
      const r = await fetch("/api/crm/media-elimina", {
        method: "POST",
        headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        body: JSON.stringify({ url }),
      });
      const risposta = (await r.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
      } | null;
      cancellato = !!risposta?.ok;
      motivo = risposta?.reason?.trim() || "";
    } catch (e) {
      motivo = (e as Error)?.message || "connessione persa";
    }
    if (cancellato) {
      toast.success(`Eliminata · ${nomeDi(l)}`, {
        description: "Tolta dalla scheda e cancellata dall'archivio del centro.",
      });
      return;
    }
    toast.warning(`Tolta dalla scheda · ${nomeDi(l)}`, {
      description: `Il file però è rimasto nell'archivio${motivo ? `: ${motivo}` : "."} Riprova più tardi o segnalalo.`,
    });
  };

  /** ── SCEGLIERE LA PRINCIPALE ────────────────────────────────────────────
   *  Nessun messaggio quando riesce: il cambiamento si vede da sé (la stella si
   *  sposta, il pulsante della riga cambia foto), e un avviso su un gesto che
   *  si ripete provando e riprovando è rumore.
   *  ⚠️ Il rifiuto invece SI DICE: un video non può essere la principale
   *   (regola 3 in dati.ts) e senza una frase resterebbe un pulsante che non
   *   risponde. */
  const imponiPrincipale = async (l: Lead | null | undefined, id: string) => {
    if (!l) return;
    //  ⚠️ Si legge UNA volta sola e si tiene: `portafoglioDi` costruisce un
    //  oggetto nuovo a ogni chiamata, quindi confrontare il risultato con una
    //  SECONDA lettura darebbe sempre "diverso" — e ogni click, anche quello
    //  che non cambia niente, finirebbe nello storico della scheda.
    const attuale = portafoglioDi(l);
    const esito = conPrincipale(attuale, id);
    if (esito.motivo) {
      toast.error(esito.motivo);
      return;
    }
    //  Già lei: `conPrincipale` ha restituito lo stesso oggetto che gli è stato
    //  passato, e riscriverlo sarebbe una modifica finta.
    if (esito.info === attuale) return;
    if (!(await scrivi(l, esito.info))) {
      toast.error("Non è stato possibile aggiornare la scheda: ricarica la pagina.");
    }
  };

  /** L'ordine in cui si scorrono nel carosello. Senza messaggio: è una
   *  correzione che si fa dieci volte di fila, e dieci avvisi sono rumore.
   *  `ordine` può essere parziale — le voci non citate restano in coda (vedi
   *  `conOrdine`), così una scheda aperta prima dell'ultimo caricamento non fa
   *  sparire niente. */
  const riordina = async (l: Lead | null | undefined, ordine: string[]) => {
    if (!l) return;
    const attuale = portafoglioDi(l);
    const esito = conOrdine(attuale, ordine);
    if (esito.info === attuale) return;
    await scrivi(l, esito.info);
  };

  /** L'appunto interno accanto alla voce. ⚠️ Non si mostra mai al cliente
   *  (vedi `vociGalleria` in dati.ts). Senza messaggio, come sopra. */
  const rinomina = async (l: Lead | null | undefined, id: string, nome: string) => {
    if (!l) return;
    const attuale = portafoglioDi(l);
    const esito = conNome(attuale, id, nome);
    if (esito.info === attuale) return;
    await scrivi(l, esito.info);
  };

  return { carica, elimina, imponiPrincipale, riordina, rinomina };
}
