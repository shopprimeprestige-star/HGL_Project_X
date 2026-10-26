/** ── LA ROTTA DELLE RISPOSTE: LA LOGICA ────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). Questo file lo riempie in due
 *  tempi, in sequenza:
 *   - compito U2 (Dev C), QUI: le parti CONFERMA (`rispostaAlPromemoria` del
 *     22/10), REGISTRO (`whatsapp_messages` deduplicato, `whatsapp_contacts`) e
 *     STOP (`non_scrivere_dal`);
 *   - compito 3 (Dev C): la parte SECONDO STATO (`contattoWa` e `risposta_il`
 *     dell'invio, via `dopoRisposta` di contatto.ts). Si aggancia dopo la
 *     registrazione, dentro `tratta`.
 *  Prove in `prove/manychat/risposta.mjs`.
 *
 *  La rotta (`api.public.manychat-risposta.ts`) è sottile: passa la richiesta e
 *  il segreto a `gestisciRichiesta`, che legge il corpo con `leggiCorpoLimitato`,
 *  controlla `X-HGL-Token` con `stessaChiave` e chiama `gestisciRisposta`. A una
 *  richiesta autorizzata risponde `{ok:true}` anche se dentro qualcosa va storto:
 *  ManyChat non ritenta, e un errore nostro non deve fermare il suo flusso.
 *
 *  ⚠️ NON CHIAMA MAI MANYCHAT (né nessun altro fuori dal database). Un messaggio
 *   da un numero sconosciuto (Default Reply, nessun invio abbinato) si registra
 *   solo se il telefono è già in `whatsapp_contacts` dell'installazione;
 *   altrimenti si ignora, STOP compreso.
 *  ⚠️ Nei log solo codici: mai numero, nome, testo o `subscriber_id`. Gli
 *   `esito` sono una lista chiusa di parole, mai dati.
 *  ⚠️ La stessa risposta arrivata due volte (flusso + Default Reply) fa UNA riga e
 *   UN passaggio in tutto: dal secondo arrivo in poi non si rifà niente (il
 *   secondo stato, altrimenti, scriverebbe due volte la storia).
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  abbina,
  cifreTelefono,
  impronta,
  leggiCorpo,
  leggiCorpoLimitato,
  stessaChiave,
  type CorpoRitorno,
  type InvioAbbinabile,
} from "./ritorno";
import {
  rispostaAlPromemoria,
  type PorteRisposta as PorteConferma,
} from "../promemoria/in-entrata";
import type { ContattoWa } from "../types";
import { dopoRisposta, eStop, type CambioContatto } from "./contatto";

/** Lo stato HTTP della rotta: 503 senza segreto sul server, 401 senza chiave
 *  giusta, 413 corpo oltre 8 KB, 200 per ogni richiesta autorizzata. */
export type StatoRisposta = 200 | 401 | 413 | 503;

export interface RichiestaRisposta {
  /** il confronto di `X-HGL-Token` con `MANYCHAT_RITORNO_TOKEN` è andato bene */
  chiaveOk: boolean;
  /** `MANYCHAT_RITORNO_TOKEN` esiste sul server */
  segretoPresente: boolean;
  /** il corpo letto e ripulito; `null` = illeggibile */
  corpo: CorpoRitorno | null;
  /** il corpo ha superato il limite di 8 KB */
  troppoGrande?: boolean;
  adesso: Date;
}

export interface EsitoRispostaRotta {
  stato: StatoRisposta;
  /** per i conteggi nei log (lista chiusa): `confermato`, `stop`, `registrata`,
   *  `risposta`, `ignorata`, `doppione`, `illeggibile`, `senza_configurazione`,
   *  `errore`, e per gli stati non 200 `segreto_assente`, `non_autorizzato`,
   *  `troppo_grande` */
  esito?: string;
}

/** Chi è l'installazione: la riga `manychat_config` (id = 1). */
export type EsitoUtente =
  | { userId: string }
  | { userId: null; motivo: "manca_migrazione" | "non_configurato" };

/** Un messaggio del cliente da mettere in `whatsapp_messages`. */
export interface MessaggioInEntrata {
  /** `mc-in:<impronta>` */
  waId: string;
  leadId: string | null;
  /** solo cifre */
  telefono: string;
  /** il testo del cliente (o «[messaggio senza testo]») */
  testo: string;
  adesso: Date;
}

/** Le porte della rotta (database e avvisi). Le porte che leggono o scrivono
 *  LANCIANO in caso di errore (con un `code` breve, se ce l'hanno): le prende
 *  `gestisciRisposta`, che registra solo il codice. */
export interface PorteRispostaManychat {
  avviso(messaggio: string): void;
  /** la configurazione dell'installazione */
  utente(): Promise<EsitoUtente>;
  /** gli invii del registro di questo utente, ultimi 7 giorni, che hanno quell'id,
   *  quel contatto ManyChat o quel telefono */
  invii(cerca: {
    userId: string;
    crmInvioId: string;
    subscriberId: string;
    telefono: string | null;
    dal: Date;
  }): Promise<InvioAbbinabile[]>;
  /** il telefono (solo cifre) è già in `whatsapp_contacts`? col suo lead */
  contattoNoto(userId: string, telefono: string): Promise<{ leadId: string | null } | null>;
  /** `whatsapp_messages` in entrata, deduplicato su `wa_message_id` */
  registraMessaggio(userId: string, messaggio: MessaggioInEntrata): Promise<"nuovo" | "doppione">;
  /** `whatsapp_contacts`: ultimo messaggio, e la riga se non c'è (serve a
   *  `non_scrivere_dal`, che altrimenti andrebbe perso) */
  aggiornaContatto(
    userId: string,
    x: { telefono: string; leadId: string | null; adesso: Date },
  ): Promise<void>;
  /** le porte di `rispostaAlPromemoria` (conferma del 22/10 e STOP) */
  conferma(userId: string, telefono: string, adesso: Date): PorteConferma;
  /** (compito 3) `manychat_risposta_arrivata`: l'ora della risposta sull'invio
   *  (`invioId` può mancare) e sul giro. È ciò che sblocca il freno «mai due
   *  volte senza risposta». */
  rispostaArrivata(userId: string, invioId: string | null, adesso: Date): Promise<void>;
  /** (compito 3) il secondo stato della scheda com'è adesso; `null` se la
   *  scheda non c'è o è di un'altra installazione */
  contattoDi(
    userId: string,
    leadId: string,
  ): Promise<{ contattoWa: ContattoWa | undefined } | null>;
  /** (compito 3) `contatto_wa_aggiorna`; vero se ha scritto */
  scriviContatto(userId: string, leadId: string, cambio: CambioContatto): Promise<boolean>;
}

const SETTE_GIORNI_MS = 7 * 24 * 3600e3;

/** Solo il codice di un errore, se sembra un codice: il messaggio può contenere
 *  dati del cliente. */
function codiceErrore(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,12}$/.test(code) ? code : "?";
}

/** Una risposta autorizzata e letta: cosa farne. Restituisce l'esito. */
async function tratta(
  porte: PorteRispostaManychat,
  corpo: CorpoRitorno,
  adesso: Date,
): Promise<string> {
  const u = await porte.utente();
  if (u.userId === null) {
    porte.avviso(
      u.motivo === "manca_migrazione"
        ? "manca la migrazione manychat_base: risposta non registrata"
        : "manychat_config senza riga: risposta non registrata",
    );
    return "senza_configurazione";
  }
  const userId = u.userId;

  const telCorpo = cifreTelefono(corpo.telefono);
  const invii = await porte.invii({
    userId,
    crmInvioId: corpo.crmInvioId,
    subscriberId: corpo.subscriberId,
    telefono: telCorpo,
    dal: new Date(adesso.getTime() - SETTE_GIORNI_MS),
  });
  const abbinata = abbina(corpo, invii, adesso);
  //  Un invio di un altro contatto: non si cerca un'altra strada.
  if (abbinata.tipo === "ignorata" && abbinata.motivo === "contatto_diverso") return "ignorata";

  //  Il telefono dell'invio è quello vero (lo ha scritto la porta); senza invio
  //  vale quello del corpo, fidato solo dietro la chiave.
  const telefono = abbinata.tipo === "invio" ? abbinata.invio.telefono : telCorpo;
  if (!telefono) return "ignorata";
  const noto = await porte.contattoNoto(userId, telefono);
  //  Né un nostro invio né un contatto che già conosciamo: uno sconosciuto.
  if (abbinata.tipo === "ignorata" && !noto) return "ignorata";
  const leadId = (abbinata.tipo === "invio" ? abbinata.invio.leadId : null) ?? noto?.leadId ?? null;

  //  Il registro, deduplicato: flusso e Default Reply dello stesso messaggio
  //  arrivano nello stesso minuto con lo stesso subscriber e lo stesso testo.
  const minuto = adesso.toISOString().slice(0, 16);
  const impr = await impronta(corpo.subscriberId || telefono, corpo.testo, minuto);
  const scritto = await porte.registraMessaggio(userId, {
    waId: `mc-in:${impr}`,
    leadId,
    telefono,
    testo: corpo.testo.trim() || "[messaggio senza testo]",
    adesso,
  });
  if (scritto === "doppione") return "doppione";
  //  La riga della rubrica PRIMA dello STOP: `non_scrivere_dal` si scrive con un
  //  aggiornamento, e se la riga non c'è lo STOP andrebbe perso.
  await porte.aggiornaContatto(userId, { telefono, leadId, adesso });

  //  Il freno «mai due volte senza risposta» guarda `risposta_il`: PRIMA della
  //  conferma, così non si perde nemmeno se la conferma poi dà errore. Un
  //  guasto qui non ferma il resto (solo il codice nell'avviso).
  try {
    await porte.rispostaArrivata(
      userId,
      abbinata.tipo === "invio" ? abbinata.invio.id : null,
      adesso,
    );
  } catch (e) {
    porte.avviso(`errore (${codiceErrore(e)}): ora della risposta non scritta`);
  }

  //  La conferma del 22/10: SÌ → confermato, STOP → non_scrivere_dal. La firma
  //  qui è la chiave giusta (siamo arrivati solo con quella).
  const esito = await rispostaAlPromemoria(porte.conferma(userId, telefono, adesso), {
    firmaVerificata: true,
    testo: corpo.testo,
    numero: `+${telefono}`,
    adesso,
  });

  //  Le parole di STOP del secondo stato («non mi scrivete più», «cancellatemi»…)
  //  sono più delle due del 22/10 («stop», «basta»): `rispostaAlPromemoria` non
  //  le conosce e non scrive `non_scrivere_dal`. Senza quello, la scheda direbbe
  //  STOP ma il numero resterebbe scrivibile da ogni altro canale. Idempotente.
  if (esito !== "stop" && eStop(corpo.testo)) {
    try {
      const { error } = await porte.conferma(userId, telefono, adesso).segnaStop();
      if (error) throw error;
    } catch (e) {
      porte.avviso(`errore (${codiceErrore(e)}): STOP non scritto sul numero`);
    }
  }

  //  Il secondo stato della scheda: «Ha risposto» (con l'anteprima), o «Non
  //  scrivere» se è uno STOP. Dopo la conferma e il suo STOP, perché la
  //  conferma non deve dipendere da questo. Una scheda già in STOP non si
  //  tocca (lo dicono `dopoRisposta` e, dentro l'UPDATE, la funzione SQL).
  if (leadId) {
    try {
      const scheda = await porte.contattoDi(userId, leadId);
      const cambio = scheda ? dopoRisposta(scheda.contattoWa, corpo.testo, adesso) : null;
      if (cambio) await porte.scriviContatto(userId, leadId, cambio);
    } catch (e) {
      porte.avviso(`errore (${codiceErrore(e)}): secondo stato non scritto`);
    }
  }
  return esito === "niente" ? "registrata" : esito;
}

export async function gestisciRisposta(
  porte: PorteRispostaManychat,
  r: RichiestaRisposta,
): Promise<EsitoRispostaRotta> {
  if (!r.segretoPresente) return { stato: 503, esito: "segreto_assente" };
  if (!r.chiaveOk) return { stato: 401, esito: "non_autorizzato" };
  if (r.troppoGrande) return { stato: 413, esito: "troppo_grande" };
  if (!r.corpo) return { stato: 200, esito: "illeggibile" };
  try {
    return { stato: 200, esito: await tratta(porte, r.corpo, r.adesso) };
  } catch (e) {
    porte.avviso(`errore (${codiceErrore(e)}): risposta non registrata`);
    return { stato: 200, esito: "errore" };
  }
}

/** Dalla richiesta HTTP alla risposta HTTP. Il corpo si legge SOLO dopo la
 *  chiave giusta: chi non ce l'ha non fa leggere né elaborare niente. */
export async function gestisciRichiesta(
  porte: PorteRispostaManychat,
  i: { request: Request; segreto: string | undefined; adesso: Date },
): Promise<{ response: Response; esito?: string }> {
  const segretoPresente = !!i.segreto;
  const chiaveOk = segretoPresente && stessaChiave(i.request.headers.get("x-hgl-token"), i.segreto);
  let corpo: CorpoRitorno | null = null;
  let troppoGrande = false;
  if (chiaveOk) {
    const letto = await leggiCorpoLimitato(i.request.body);
    troppoGrande = letto.troppoGrande;
    if (!troppoGrande) {
      try {
        corpo = leggiCorpo(JSON.parse(letto.testo));
      } catch {
        corpo = null;
      }
    }
  }
  const { stato, esito } = await gestisciRisposta(porte, {
    chiaveOk,
    segretoPresente,
    corpo,
    troppoGrande,
    adesso: i.adesso,
  });
  const json =
    stato === 200
      ? { ok: true }
      : {
          ok: false,
          errore: { 401: "non_autorizzato", 413: "troppo_grande", 503: "non_configurato" }[stato],
        };
  return {
    response: new Response(JSON.stringify(json), {
      status: stato,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
    esito,
  };
}
