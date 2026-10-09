/** ─────────────────────────────────────────────────────────────────────────
 *  LE SCRITTURE DELLA MANUTENZIONE — tutto ciò che un ritorno può cambiare
 *
 *  PERCHÉ IN UN POSTO SOLO
 *  Stessa ragione di `useAzioniInstallazione` in crm/InstallationScheduleDialog:
 *  le stesse quattro azioni si premono da tre schermate diverse (la lente delle
 *  installazioni, la giornata del tecnico, la procedura guidata), e se ognuna
 *  scrivesse per conto suo prima o poi una delle tre dimenticherebbe un campo.
 *  Qui ogni azione fa TRE cose sempre nello stesso ordine: compone il nuovo
 *  elenco con `conManutenzione` (mai un push a mano), scrive, LEGGE la risposta.
 *
 *  ⚠️ LA RISPOSTA SI LEGGE. `updateLead` torna `false` anche senza errore di
 *   rete — per esempio su un lead che l'elenco in memoria non ha — e senza quel
 *   controllo si annuncerebbe un appuntamento che non è stato preso: il cliente
 *   se ne va convinto di avere una data e in CRM non c'è niente.
 *
 *  OGNI AZIONE LASCIA UN «ANNULLA», e rimette l'oggetto `manutenzione` INTERO
 *  com'era. Non i singoli campi: `updateLead` sostituisce il campo tutto
 *  insieme, quindi rimettere solo la riga toccata cancellerebbe lo storico.
 *  ───────────────────────────────────────────────────────────────────────── */

import { toast } from "sonner";
import { useCRM } from "../CRMContext";
import type { AppuntamentoManutenzione, Lead } from "../types";
import { formatDate } from "@/lib/date-format";
import {
  cadenzaDi,
  conManutenzione,
  dataProposta,
  generaIlSuccessivo,
  nuovoPromemoria,
  oggiISO,
  senzaManutenzione,
  tipoDi,
} from "./regole";

const nome = (l: Lead) => `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "il cliente";

export function useAzioniManutenzione() {
  const { updateLead } = useCRM();

  /** Il messaggio di errore è sempre lo stesso e dice la cosa che serve: NON è
   *  stato salvato. Un «riprova» generico lascia credere che forse è passato. */
  const nonSalvato = (cosa: string) => {
    toast.error(`Non è stato salvato: ${cosa}. Riprova.`);
  };

  /** ── FISSA O RIFISSA ─────────────────────────────────────────────────────
   *  L'unica scrittura che la procedura guidata usa, sia per il promemoria sia
   *  per l'appuntamento: la differenza sta tutta dentro `app` (con ora e
   *  consulente, o senza), non in due funzioni diverse che poi divergono.
   *  La cadenza si scrive INSIEME perché è la stessa decisione: si è appena
   *  detto ogni quanto torna questo cliente.
   *  ⚠️ E si scrive SOLO SE C'È. Un intervento singolo non ha nessuna cadenza da
   *  scrivere — è precisamente ciò che vuol dire «un ritorno e basta, senza
   *  impegnare il cliente a un giro» — e se quel cliente una cadenza ce l'aveva
   *  già, non si tocca: `conManutenzione` lascia il campo com'era quando il
   *  numero non arriva (`cadenza && cadenza > 0`). Passare qui uno zero o il
   *  valore predefinito avrebbe riscritto in silenzio il giro di un cliente
   *  mentre gli si fissava un ritocco fuori giro. */
  const salvaManutenzione = async (
    lead: Lead,
    app: AppuntamentoManutenzione,
    cadenza?: number,
  ): Promise<boolean> => {
    const precedente = lead.data.manutenzione;
    const salvato = await updateLead(lead.id, {
      manutenzione: conManutenzione(precedente, app, cadenza),
    });
    if (!salvato) {
      nonSalvato("la manutenzione non è stata registrata");
      return false;
    }
    const quando = formatDate(app.data);
    //  ── IL MESSAGGIO DICE ANCHE CHE COSA SUCCEDE DOPO ──────────────────────
    //   È l'unica differenza che il cliente si porta a casa, e chi ha premuto il
    //   pulsante deve poterla rileggere senza riaprire la scheda: con un ciclo
    //   il CRM continua da solo, con un intervento singolo si ferma qui.
    const seguito = generaIlSuccessivo(app)
      ? " Quando la segni fatta nasce da sola la successiva."
      : " Intervento singolo: nessuna cadenza scritta, e dopo non nasce nessun altro ritorno.";
    toast.success(
      app.stato === "fissata"
        ? `Manutenzione fissata · ${nome(lead)} · ${quando} alle ${app.ora}`
        : `Promemoria messo · ${nome(lead)} · intorno al ${quando}`,
      {
        description:
          (app.stato === "fissata"
            ? "Il cliente ha un giorno e un'ora. La trovi nella lente «Manutenzioni»."
            : "Nessuna agenda occupata: quando il cliente conferma, si trasforma in appuntamento dalla stessa lente.") +
          seguito,
        action: {
          label: "Annulla",
          onClick: () => void updateLead(lead.id, { manutenzione: precedente ?? {} }),
        },
      },
    );
    return true;
  };

  /** ── È TORNATO ───────────────────────────────────────────────────────────
   *  Segna il ritorno E crea da solo il promemoria del prossimo, contato dal
   *  giorno VERO in cui è tornato.
   *  ⚠️ La successiva nasce come PROMEMORIA e non come appuntamento, ed è la
   *   decisione che tiene pulita l'agenda: un appuntamento che si genera da solo
   *   fra trenta giorni occupa il tempo di una persona per un cliente che non ha
   *   confermato niente, e a fine anno l'agenda è piena di gente che non verrà.
   *   Così invece il ritorno non si perde (è in elenco, con la sua data) e il
   *   posto in calendario si prende solo quando c'è un sì.
   *  ⚠️⚠️ E LA SUCCESSIVA NASCE SOLO SE QUESTO ERA UN CICLO. Un intervento
   *   singolo si chiude e finisce lì: era stato fissato dicendo al cliente «un
   *   ritorno e basta», e generargli comunque il promemoria del prossimo sarebbe
   *   la porta di servizio da cui «e basta» diventa «per sempre» — con la
   *   scelta fatta al primo passo della procedura che non conterebbe niente.
   *   La domanda si fa a `generaIlSuccessivo`, che è l'unico posto in cui questa
   *   conseguenza è scritta. */
  const segnaFatta = async (lead: Lead, app: AppuntamentoManutenzione): Promise<boolean> => {
    const precedente = lead.data.manutenzione;
    const oggi = oggiISO();
    const cadenza = cadenzaDi(lead.data);
    const chiusa: AppuntamentoManutenzione = { ...app, stato: "fatta", fattaIl: oggi };
    //  Si compone in due passaggi sullo STESSO oggetto: prima la riga chiusa,
    //  poi la successiva. Due `updateLead` di fila si sovrascriverebbero a
    //  vicenda, e a perderci sarebbe sempre il secondo.
    const conChiusa = conManutenzione(precedente, chiusa);
    const prossima = generaIlSuccessivo(app)
      ? nuovoPromemoria(
          dataProposta(
            { manutenzione: conChiusa, installazione: lead.data.installazione },
            cadenza,
            oggi,
          ),
          "precedente",
        )
      : null;
    const salvato = await updateLead(lead.id, {
      manutenzione: prossima ? conManutenzione(conChiusa, prossima) : conChiusa,
    });
    if (!salvato) {
      nonSalvato("la manutenzione risulta ancora da fare");
      return false;
    }
    toast.success(`Manutenzione fatta · ${nome(lead)}`, {
      description: prossima
        ? `Prossimo ritorno fra ${cadenza} giorni: promemoria per il ${formatDate(
            prossima.data,
          )}. Nessuna agenda occupata finché non lo fissi.`
        : //  Il vuoto va DETTO, o si legge come una dimenticanza del CRM: era un
          //  intervento singolo, e questo cliente adesso non ha nessun ritorno in
          //  programma. Chi vuole rimetterlo in un giro sa dove tornare.
          "Era un intervento singolo: non nasce nessun ritorno successivo, e il cliente resta senza manutenzioni in programma. Per rimetterlo in un ciclo si rifissa dalla sua scheda.",
      action: {
        label: "Annulla",
        onClick: () => void updateLead(lead.id, { manutenzione: precedente ?? {} }),
      },
    });
    return true;
  };

  /** ── NON È VENUTO ────────────────────────────────────────────────────────
   *  «Saltata» resta scritta e conta: è l'unico modo di sapere, sei mesi dopo,
   *  che un cliente ne ha saltate tre di fila — cioè che lo stiamo perdendo.
   *  ⚠️ E LASCIA UN PROMEMORIA PER OGGI, non per fra un mese: un cliente che ha
   *   saltato va richiamato adesso, e senza questa riga uscirebbe da ogni elenco
   *   — nessuna manutenzione aperta vuol dire nessuna riga da nessuna parte, e
   *   quello è esattamente il modo in cui si perde un cliente in silenzio. */
  const segnaSaltata = async (
    lead: Lead,
    app: AppuntamentoManutenzione,
    motivo?: string,
  ): Promise<boolean> => {
    const precedente = lead.data.manutenzione;
    const oggi = oggiISO();
    const persa: AppuntamentoManutenzione = {
      ...app,
      stato: "saltata",
      ...(motivo?.trim() ? { motivo: motivo.trim() } : {}),
    };
    const conPersa = conManutenzione(precedente, persa);
    //  ⚠️ Il promemoria di richiamo eredita il TIPO di ciò che è saltato: un
    //   intervento singolo saltato va richiamato, ma richiamarlo non lo mette
    //   dentro un ciclo che il cliente non ha mai chiesto. Il richiamo si fa in
    //   tutti e due i casi — è la riga che impedisce di perdere un cliente in
    //   silenzio — ma quello che ci sta scritto sopra resta quello che era.
    const daRichiamare = nuovoPromemoria(
      oggi,
      "precedente",
      "Ha saltato la manutenzione: richiamare",
      tipoDi(app),
    );
    const salvato = await updateLead(lead.id, {
      manutenzione: conManutenzione(conPersa, daRichiamare),
    });
    if (!salvato) {
      nonSalvato("la manutenzione risulta ancora aperta");
      return false;
    }
    toast.success(`Manutenzione saltata · ${nome(lead)}`, {
      description:
        "Resta in elenco come da richiamare oggi: un cliente che salta va ripreso subito.",
      action: {
        label: "Annulla",
        onClick: () => void updateLead(lead.id, { manutenzione: precedente ?? {} }),
      },
    });
    return true;
  };

  /** ── QUESTA RIGA NON DOVEVA ESSERCI ──────────────────────────────────────
   *  Il cliente sbagliato, o una manutenzione fissata due volte. Toglie la riga
   *  e basta: NON è il modo di dire che il cliente non tornerà — per quello c'è
   *  «saltata», che resta scritta. */
  const togliManutenzione = async (lead: Lead, app: AppuntamentoManutenzione): Promise<boolean> => {
    const precedente = lead.data.manutenzione;
    const salvato = await updateLead(lead.id, {
      manutenzione: senzaManutenzione(precedente, app.id),
    });
    if (!salvato) {
      nonSalvato("la manutenzione è ancora in elenco");
      return false;
    }
    toast.success(`Manutenzione tolta · ${nome(lead)}`, {
      description: "Il cliente non ha più nessun ritorno in programma.",
      action: {
        label: "Annulla",
        onClick: () => void updateLead(lead.id, { manutenzione: precedente ?? {} }),
      },
    });
    return true;
  };

  return { salvaManutenzione, segnaFatta, segnaSaltata, togliManutenzione };
}
