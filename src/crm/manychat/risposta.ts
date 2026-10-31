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
 *   da un numero sconosciuto (Default Reply, nessun invio abbinato) SI REGISTRA
 *   (commessa 2026-10-28, chat nel CRM): la riga della rubrica nasce prima di
 *   `segnaStop`, quindi anche lo STOP di un numero nuovo vale. Si ignorano solo
 *   l'invio di un altro contatto e il telefono non valido.
 *  ⚠️ Un testo fatto SOLO di segnaposto non risolti (`{{...}}`: ManyChat lo lascia
 *   così quando l'input non è testo) da un numero sconosciuto si scarta
 *   (`segnaposto`); da un numero noto o abbinato a un nostro invio si registra
 *   come messaggio non leggibile, e da lì in poi `testo` vale `""` in tutta
 *   `tratta` (impronta, riga salvata, conferma, STOP, secondo stato).
 *  ⚠️ Nei log solo codici: mai numero, nome, testo o `subscriber_id`. Gli
 *   `esito` sono una lista chiusa di parole, mai dati.
 *  ⚠️ La stessa risposta arrivata due volte (flusso + Default Reply) fa UNA riga e
 *   UN passaggio in tutto: dal secondo arrivo in poi non si rifà niente (il
 *   secondo stato, altrimenti, scriverebbe due volte la storia).
 *  ⚠️ L'ECO (29/10/2026). Con la coesistenza, ogni messaggio mandato dall'app
 *   WhatsApp Business fa ripartire il Default Reply con `{{Last Text Input}}`,
 *   che è ancora l'ultimo testo del CLIENTE, anche ore dopo. Un testo uguale
 *   all'ultimo testo in entrata già registrato per quel numero (ManyChat o
 *   Cloud, non doppione) e più vecchio di `ECO_DOPO_MS` è un'eco: si scarta
 *   («eco») senza toccare rubrica, conferma, STOP, freno. Un messaggio nostro in
 *   uscita in mezzo NON la esclude: è proprio quello che la fa partire.
 *   LIMITE ACCETTATO: il cliente che riscrive davvero lo stesso identico testo
 *   (anche «ok», «sì») dopo più di 60 s, senza un altro testo in mezzo, non
 *   entra nel registro ManyChat (col ponte acceso la sua riga resta visibile
 *   in chat, ma non conta come risposta). Se la lettura delle entrate si
 *   guasta, si registra come prima: meglio un doppione di un messaggio perso.
 *   Le righe del PONTE (canale `baileys`) non si leggono: sono solo da
 *   mostrare e nessuna regola le guarda (commessa del ponte, I1). Il
 *   `{{Last Text Input}}` è comunque un testo che ManyChat ha ricevuto, quindi
 *   la sua riga ManyChat c'è.
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
import { anteprimaIn, classificaTesto, eSoloSegnaposto } from "../chatwa/media";
import { dopoRisposta, eStop, type CambioContatto } from "./contatto";
import { normalizzaTesto } from "../ponte/pari";
import { CONFRONTO_CARATTERI } from "../ponte/tipi";
import { eEcoVuota, eSenzaContenuto } from "../chatwa/eco";

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
   *  `risposta`, `ignorata`, `segnaposto`, `doppione`, `eco`, `illeggibile`,
   *  `senza_configurazione`, `errore`, e per gli stati non 200 `segreto_assente`, `non_autorizzato`,
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

/** Una riga in entrata già registrata (per l'eco). */
export interface EntrataRegistrata {
  /** `body` della riga */
  testo: string;
  /** `created_at` */
  il: Date;
  /** `media_type` (`image`, `audio`…); `null` = testo */
  media: string | null;
}

/** Quante entrate leggere: basta trovare l'ultimo TESTO dietro i media. Con 5 un cliente che
 *  manda un album di foto o vocali dopo l'ultimo testo faceva sfuggire l'eco (30/10/2026).
 *  LIMITE NOTO: con più di 50 media dopo l'ultimo testo, l'eco di quel testo non si riconosce
 *  e conta come un messaggio nuovo (nessun ripiego: la chat si chiude con «Fatto»). */
export const ENTRATE_DA_LEGGERE = 50;
/** Più vecchia di così, la stessa entrata ripetuta è un'eco. Sotto, è lo
 *  stesso messaggio che arriva da due strade (ManyChat dopo il ponte, o
 *  flusso + Default Reply a cavallo del minuto). */
export const ECO_DOPO_MS = 60_000;

/** L'ultimo testo in entrata (salta media e righe senza testo): è quello che
 *  ManyChat ha in `{{Last Text Input}}`. */
function ultimoTesto(entrate: EntrataRegistrata[]): EntrataRegistrata | null {
  for (const e of entrate) {
    if (e.media) continue;
    if (classificaTesto(e.testo).tipo !== "testo") continue;
    return e;
  }
  return null;
}

/** Il testo arrivato è un'eco o un doppione dell'ultimo testo in entrata?
 *  `eco` = uguale e più vecchio di `ECO_DOPO_MS`; `doppione` = uguale e più
 *  giovane (lo stesso messaggio da flusso e Default Reply, a cavallo del
 *  minuto: l'impronta non li unisce); `null` = si registra. Pura. */
export function ecoDi(
  testo: string,
  entrate: EntrataRegistrata[],
  adesso: Date,
): "eco" | "doppione" | null {
  const a = normalizzaTesto(testo).slice(0, CONFRONTO_CARATTERI);
  if (!a) return null;
  const uguale = (e: EntrataRegistrata | null | undefined) =>
    !!e && normalizzaTesto(e.testo).slice(0, CONFRONTO_CARATTERI) === a;
  //  L'ultimo testo (`{{Last Text Input}}`), oppure l'ultima entrata in assoluto:
  //  per un vocale o una foto ManyChat rimanda il link del file (29/10/2026,
  //  eco di un vocale dopo un vocale mandato dall'app).
  const ultima = [ultimoTesto(entrate), entrate[0]].find(uguale) ?? null;
  if (!ultima) return null;
  return adesso.getTime() - ultima.il.getTime() >= ECO_DOPO_MS ? "eco" : "doppione";
}

/** Un'entrata senza contenuto è l'eco di un nostro messaggio? `uscite`: gli istanti dei nostri
 *  messaggi partiti dello stesso numero (ultimi secondi). Pura. */
export function ecoSenzaContenuto(uscite: readonly Date[], adesso: Date): boolean {
  return eEcoVuota(
    adesso.getTime(),
    uscite.map((u) => u.getTime()),
  );
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
  /** le ultime righe in ENTRATA di quel telefono in `whatsapp_messages`, di
   *  ogni canale TRANNE il ponte (`baileys`), senza i doppioni
   *  (`duplicato_di`), la più nuova per prima, al più `ENTRATE_DA_LEGGERE`.
   *  Serve a riconoscere l'eco. */
  ultimeEntrate(userId: string, telefono: string): Promise<EntrataRegistrata[]>;
  /** (31/10/2026) gli istanti dei NOSTRI messaggi (uscita, di ogni canale: ponte, ManyChat,
   *  Cloud) a quel telefono, partiti (non `failed`), di `ECO_VUOTA_DOPO_MS` fa fino a poco
   *  dopo `adesso`. Serve a riconoscere l'eco senza testo. */
  ultimeUscite(userId: string, telefono: string, adesso: Date): Promise<Date[]>;
  /** `whatsapp_messages` in entrata, deduplicato su `wa_message_id` */
  registraMessaggio(userId: string, messaggio: MessaggioInEntrata): Promise<"nuovo" | "doppione">;
  /** `whatsapp_contacts`: ultimo messaggio (+1 ai non letti), e la riga se non
   *  c'è (serve a `non_scrivere_dal`, che altrimenti andrebbe perso).
   *  `anteprima`: la riga dell'elenco («Vocale», il testo…); `subscriberId` e
   *  `nome` si scrivono solo se la riga non li ha già. */
  aggiornaContatto(
    userId: string,
    x: {
      telefono: string;
      leadId: string | null;
      adesso: Date;
      anteprima: string;
      subscriberId: string | null;
      nome: string | null;
    },
  ): Promise<void>;
  /** (28/10/2026) la notifica push ai telefoni dello studio per un messaggio
   *  nuovo. Facoltativa: chi non la dà (le prove) non avvisa nessuno. Non lancia. */
  avvisaNuovo?(
    userId: string,
    x: { telefono: string; leadId: string | null; nome: string | null },
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
  //  Un testo fatto solo di segnaposto (`{{...}}`) è un messaggio che ManyChat
  //  non ha saputo leggere (figurina, posizione…). Da uno sconosciuto (né un
  //  nostro invio né in rubrica) è quasi sempre il flusso di prova: si scarta.
  //  Da un noto o da chi risponde a un nostro invio è un cliente vero: si
  //  registra, ma senza il segnaposto, in NESSUN punto da qui in poi.
  const sconosciuto = abbinata.tipo === "ignorata" && !noto;
  const soloSegnaposto = eSoloSegnaposto(corpo.testo);
  if (soloSegnaposto && sconosciuto) return "segnaposto";
  const testo = soloSegnaposto ? "" : corpo.testo;
  const leadId = (abbinata.tipo === "invio" ? abbinata.invio.leadId : null) ?? noto?.leadId ?? null;

  //  L'eco del Default Reply (vedi in cima): PRIMA di scrivere qualunque cosa.
  //  Un guasto della lettura non ferma il messaggio (solo il codice nell'avviso).
  if (testo && !eSenzaContenuto(testo)) {
    let eco: "eco" | "doppione" | null = null;
    try {
      eco = ecoDi(testo, await porte.ultimeEntrate(userId, telefono), adesso);
    } catch (e) {
      porte.avviso(`errore (${codiceErrore(e)}): controllo dell'eco saltato`);
    }
    if (eco) return eco;
  } else {
    //  L'eco SENZA contenuto (vedi in cima): nessun testo da confrontare, ma un nostro messaggio
    //  di un attimo prima la spiega. Un guasto della lettura non ferma il messaggio.
    try {
      if (ecoSenzaContenuto(await porte.ultimeUscite(userId, telefono, adesso), adesso))
        return "eco";
    } catch (e) {
      porte.avviso(`errore (${codiceErrore(e)}): controllo dell'eco senza testo saltato`);
    }
  }

  //  Il registro, deduplicato: flusso e Default Reply dello stesso messaggio
  //  arrivano nello stesso minuto con lo stesso subscriber e lo stesso testo.
  const minuto = adesso.toISOString().slice(0, 16);
  const impr = await impronta(corpo.subscriberId || telefono, testo, minuto);
  const testoSalvato = testo.trim() || "[messaggio senza testo]";
  const scritto = await porte.registraMessaggio(userId, {
    waId: `mc-in:${impr}`,
    leadId,
    telefono,
    testo: testoSalvato,
    adesso,
  });
  if (scritto === "doppione") return "doppione";
  //  La riga della rubrica PRIMA dello STOP: `non_scrivere_dal` si scrive con un
  //  aggiornamento, e se la riga non c'è lo STOP andrebbe perso.
  //  L'anteprima dell'elenco è calcolata dalla stessa funzione che disegna la bolla.
  await porte.aggiornaContatto(userId, {
    telefono,
    leadId,
    adesso,
    anteprima: anteprimaIn(testoSalvato),
    subscriberId: corpo.subscriberId || null,
    nome: corpo.nome || null,
  });

  //  Il freno «mai due volte senza risposta» guarda `risposta_il`: PRIMA della
  //  conferma, così non si perde nemmeno se la conferma poi dà errore. Un
  //  guasto qui non ferma il resto (solo il codice nell'avviso). Vale
  //  solo per chi risponde a un nostro invio o ha una scheda: un numero senza
  //  scheda (anche se la riga l'abbiamo creata noi al primo messaggio) non
  //  tocca l'ora della risposta del giro, altrimenti lo spam spegnerebbe
  //  l'avviso «nessuna risposta da 48 ore».
  if (abbinata.tipo === "invio" || noto?.leadId) {
    try {
      await porte.rispostaArrivata(
        userId,
        abbinata.tipo === "invio" ? abbinata.invio.id : null,
        adesso,
      );
    } catch (e) {
      porte.avviso(`errore (${codiceErrore(e)}): ora della risposta non scritta`);
    }
  }

  //  La conferma del 22/10: SÌ → confermato, STOP → non_scrivere_dal. La firma
  //  qui è la chiave giusta (siamo arrivati solo con quella).
  const esito = await rispostaAlPromemoria(porte.conferma(userId, telefono, adesso), {
    firmaVerificata: true,
    testo,
    numero: `+${telefono}`,
    adesso,
  });

  //  Le parole di STOP del secondo stato («non mi scrivete più», «cancellatemi»…)
  //  sono più delle due del 22/10 («stop», «basta»): `rispostaAlPromemoria` non
  //  le conosce e non scrive `non_scrivere_dal`. Senza quello, la scheda direbbe
  //  STOP ma il numero resterebbe scrivibile da ogni altro canale. Idempotente.
  if (esito !== "stop" && eStop(testo)) {
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
      const cambio = scheda ? dopoRisposta(scheda.contattoWa, testo, adesso) : null;
      if (cambio) await porte.scriviContatto(userId, leadId, cambio);
    } catch (e) {
      porte.avviso(`errore (${codiceErrore(e)}): secondo stato non scritto`);
    }
  }
  //  Il telefono dello studio suona (solo nome, mai il testo): per ULTIMO, così
  //  conferma e STOP non aspettano la notifica. Un guasto qui non cambia niente.
  await porte
    .avvisaNuovo?.(userId, { telefono, leadId, nome: corpo.nome || null })
    .catch(() => undefined);
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
