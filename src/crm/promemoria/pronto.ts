/** ── SI PUÒ INVIARE? E COSA HA DETTO META ───────────────────────────────────
 *
 *  Commessa 2026-10-22. Prima di mettere un solo segno su una scheda il giro
 *  chiede qui se è tutto a posto; se no, il motivo è una frase in italiano
 *  che il titolare legge nel riquadro. Mai un errore muto.
 *
 *  ⚠️ IL PRIMO MOTIVO È LA MIGRAZIONE: il codice si pubblica PRIMA che il
 *   titolare applichi l'aggiornamento del database (richiesta del titolare,
 *   22/10). Senza, non parte niente, e il riquadro lo dice anche da spento.
 *  ⚠️ UN ERRORE DI RETE NON È UN RIFIUTO (correzione 2 del revisore): timeout,
 *   `fetch` che lancia, 5xx, corpo illeggibile vogliono dire «Meta potrebbe
 *   averlo accettato». Il segno resta e la scheda diventa `incerto`: meglio un
 *   messaggio mancato (la setter chiama) che due uguali. Si toglie il segno
 *   solo con un rifiuto esplicito, cioè un `error` con il suo codice.
 *  ───────────────────────────────────────────────────────────────────────── */
import { NOME_MODELLO } from "./invio";

export type CodiceBlocco =
  | "manca_migrazione"
  | "spento"
  | "mancano_chiavi"
  | "manca_waba"
  | "manca_app_secret"
  | "sandbox"
  | "numero_di_prova"
  | "modello_assente"
  | "modello_non_approvato"
  | "token_scaduto"
  | "permessi"
  | "limite"
  | "meta_incerto"
  | "controllo_fallito";

export const FRASI_BLOCCO: Record<CodiceBlocco, string> = {
  manca_migrazione:
    "Manca l'aggiornamento del database (migrazione promemoria_whatsapp): finché non c'è, nessun messaggio parte.",
  spento: "Spento: nessun messaggio parte.",
  mancano_chiavi: "Mancano le chiavi WhatsApp (Impostazioni → WhatsApp).",
  manca_waba: "Manca l'ID dell'account WhatsApp Business (Impostazioni → WhatsApp).",
  manca_app_secret:
    "Manca il segreto dell'app Meta (App Secret, Impostazioni → WhatsApp): senza, non posso fidarmi delle risposte dei clienti.",
  sandbox: "WhatsApp è in modalità prova (sandbox): nessun messaggio parte.",
  numero_di_prova:
    "Meta non accetta il destinatario: il numero WhatsApp è ancora quello di prova, o l'app Meta non è in modalità Live.",
  modello_assente: `Il modello ${NOME_MODELLO} non esiste su Meta: va creato in WhatsApp Manager.`,
  modello_non_approvato: `Il modello ${NOME_MODELLO} non è ancora approvato da Meta.`,
  token_scaduto: "Il token WhatsApp è scaduto o non valido: va rigenerato.",
  permessi: "Il token WhatsApp non ha i permessi per inviare messaggi.",
  limite: "Meta ha limitato l'invio: riprovo fra qualche minuto.",
  meta_incerto:
    "Meta non ha risposto in modo chiaro: quel messaggio non verrà ripetuto (la setter lo vede), riprovo gli altri fra qualche minuto.",
  controllo_fallito:
    "Il controllo non è riuscito (database o Meta non raggiungibili): riprovo fra qualche minuto.",
};

export interface IngressoPronto {
  acceso: boolean;
  migrazione: boolean;
  haChiavi: boolean;
  haWaba: boolean;
  haAppSecret: boolean;
  mode: "live" | "sandbox";
  /** null = non controllato (nessun messaggio da mandare adesso) */
  modello: { trovato: boolean; stato?: string } | null;
  /** il controllo del modello è fallito con questo motivo */
  erroreControllo?: CodiceBlocco;
}

export interface Pronto {
  pronto: boolean;
  blocco?: CodiceBlocco;
  frase: string;
}

export function valutaPronto(i: IngressoPronto): Pronto {
  const no = (blocco: CodiceBlocco, extra = ""): Pronto => ({
    pronto: false,
    blocco,
    frase: FRASI_BLOCCO[blocco] + extra,
  });
  if (!i.migrazione) return no("manca_migrazione");
  if (!i.acceso) return no("spento");
  if (!i.haChiavi) return no("mancano_chiavi");
  if (!i.haWaba) return no("manca_waba");
  if (!i.haAppSecret) return no("manca_app_secret");
  if (i.mode === "sandbox") return no("sandbox");
  if (i.erroreControllo) return no(i.erroreControllo);
  if (i.modello && !i.modello.trovato) return no("modello_assente");
  if (i.modello && i.modello.stato !== "APPROVED")
    return no("modello_non_approvato", ` (stato: ${i.modello.stato ?? "sconosciuto"})`);
  return { pronto: true, frase: "Attivo." };
}

export interface ErroreMeta {
  /** tecnico = si ferma il giro; limite = idem, si riprova; cliente = solo questa scheda */
  tipo: "tecnico" | "cliente" | "limite";
  codice: CodiceBlocco | "non_recapitato" | "rifiutato";
}

const LIMITE = [4, 80007, 130429, 131048, 131049, 131056];
const MODELLO = [132000, 132001, 132005, 132007, 132012, 132015, 132016];
const CLIENTE_RIFIUTATO = [131008, 131009, 131021, 131047, 132018];

/** I codici di Meta, gli stessi già letti da `api.whatsapp-send.ts`.
 *  131030 (destinatario non autorizzato) è di CONFIGURAZIONE, non del cliente
 *  (correzione 6 del revisore): segnarlo sulla scheda la chiuderebbe per
 *  sempre per colpa nostra. */
export function classificaErroreMeta(code?: number, _sub?: number): ErroreMeta {
  if (code === 190 || code === 102) return { tipo: "tecnico", codice: "token_scaduto" };
  if (code === 3 || code === 10 || code === 200) return { tipo: "tecnico", codice: "permessi" };
  if (code === 131030) return { tipo: "tecnico", codice: "numero_di_prova" };
  if (MODELLO.includes(Number(code))) return { tipo: "tecnico", codice: "modello_non_approvato" };
  if (LIMITE.includes(Number(code))) return { tipo: "limite", codice: "limite" };
  if (code === 131026) return { tipo: "cliente", codice: "non_recapitato" };
  if (CLIENTE_RIFIUTATO.includes(Number(code))) return { tipo: "cliente", codice: "rifiutato" };
  return { tipo: "tecnico", codice: "controllo_fallito" };
}

/** Quello che è tornato dalla chiamata di invio, così com'è. */
export interface RispostaInvio {
  /** la chiamata non è arrivata in fondo (fetch che lancia, timeout) */
  rete?: boolean;
  status?: number;
  /** il corpo JSON; null = non era JSON */
  corpo?: unknown;
}

export type EsitoInvio =
  | { tipo: "ok"; waId: string }
  | { tipo: "rifiuto"; errore: ErroreMeta }
  | { tipo: "incerto" };

/** Codici con cui Meta dice «qualcosa è andato storto da noi»: non è un no. */
const DUBBI = [1, 2, 131000];

export function esitoInvio(r: RispostaInvio): EsitoInvio {
  if (r.rete || !r.status || r.status >= 500 || !r.corpo || typeof r.corpo !== "object")
    return { tipo: "incerto" };
  const corpo = r.corpo as { error?: { code?: unknown }; messages?: { id?: string }[] };
  const code = corpo.error?.code;
  if (typeof code === "number") {
    if (DUBBI.includes(code)) return { tipo: "incerto" };
    return { tipo: "rifiuto", errore: classificaErroreMeta(code) };
  }
  const waId = corpo.messages?.[0]?.id;
  if (r.status >= 200 && r.status < 300 && waId) return { tipo: "ok", waId };
  return { tipo: "incerto" };
}

/** L'errore del database dice che la migrazione non è stata applicata
 *  (funzione `promemoria_*` o colonna `non_scrivere_dal` assenti). */
export function mancaMigrazione(
  errore: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!errore) return false;
  if (["PGRST202", "42883", "42703", "PGRST204"].includes(String(errore.code ?? ""))) return true;
  return /could not find the function|function .*promemoria_\w+.* does not exist|non_scrivere_dal.* does not exist/i.test(
    String(errore.message ?? ""),
  );
}

/** ── LA FRASE DEL RIQUADRO DEL TITOLARE ────────────────────────────────────
 *  Una sola, sempre in chiaro. Il cron la scrive a ogni giro
 *  (`promemoria_whatsapp_stato`); qui si sceglie il tono e si aggiunge l'ora. */
export interface StatoPerRiquadro {
  giroIl: string;
  pronto: boolean;
  blocco?: CodiceBlocco;
  frase: string;
  inviatiOggi: number;
  confermatiOggi: number;
  senzaRisposta: number;
}

/** Dopo quanto un cron fermo si dice al titolare (gira ogni 2 minuti). */
const CRON_FERMO_MIN = 10;

const oraDiRoma = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

export function fraseRiquadro(
  stato: StatoPerRiquadro | null,
  config: { acceso: boolean } | null,
  adesso: Date,
): { tono: "verde" | "ambra" | "rosso" | "neutro"; frase: string } {
  if (stato?.blocco === "manca_migrazione") return { tono: "rosso", frase: stato.frase };
  if (!config?.acceso) return { tono: "neutro", frase: FRASI_BLOCCO.spento };
  if (!stato)
    return {
      tono: "neutro",
      frase:
        "Non è ancora girato nessun controllo. Il cron si programma con la riga SQL delle istruzioni (promemoria-whatsapp-2min).",
    };
  const ora = oraDiRoma(stato.giroIl);
  if (adesso.getTime() - Date.parse(stato.giroIl) > CRON_FERMO_MIN * 60_000)
    return {
      tono: "ambra",
      frase: `Il controllo automatico non gira dalle ${ora}: va controllata la riga SQL del cron.`,
    };
  if (!stato.pronto)
    return { tono: "rosso", frase: `${stato.frase} (ultimo controllo alle ${ora})` };
  return {
    tono: "verde",
    frase: `Attivo. Ultimo controllo alle ${ora}. Oggi: ${stato.inviatiOggi} inviati, ${stato.confermatiOggi} confermati, ${stato.senzaRisposta} senza risposta.`,
  };
}
