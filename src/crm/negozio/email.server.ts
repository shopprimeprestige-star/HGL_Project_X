/** ── LE EMAIL DELLO SHOP: IL SERVER DEL CRM (email.server.ts) ────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T54 (PIANO-R2 D53). Porte come `interruttori.server.ts`. La rotta propria
 *  (`api.crm.negozio-email`, T57) lo collega con la guardia `impostazioni`: i testi, l'approvazione e l'interruttore sono di chi
 *  ha quel permesso; «invia ora» e lo stato per ordine sono di `pagamenti` (altrove).
 *
 *  GET  ?modelli                                              → `{ ok, modelli: [...], variabili }`
 *  POST { azione: "modello_salva",  chiave, atteso, oggetto, testo }   (atteso = `aggiornatoIl` che la schermata aveva)
 *  POST { azione: "modello_approva", chiave, impronta }                 (impronta = quella del testo VISTO, da `modelli[].impronta`)
 *  POST { azione: "modello_acceso", chiave, acceso }
 *  POST { azione: "anteprima", chiave, oggetto, testo }                 (un giudizio sul testo che si sta scrivendo: nessun database)
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · I modelli si scrivono SOLO con `rpc` (`shop_email_modello_salva/approva/acceso`, S6): la tabella per `service_role` è in sola
 *    lettura. Lo storico lo scrive il database. Salvare spegne il messaggio e toglie l'approvazione (lo fa la funzione SQL).
 *  · Chi approva è il nome che dà la GUARDIA (mai un `chi` del corpo). `approva` sposta `aggiornatoIl`: la risposta porta la
 *    versione nuova, e la schermata deve usare quella per il prossimo «Salva» (altrimenti il confronto dà 409).
 *  · «Accendi» e l'anteprima passano da `messaggioInviabile` (T49, la regola è una sola): un testo non approvato, con `{{…}}` o con
 *    una graffa fuori elenco si rifiuta PRIMA di scrivere (il database è la seconda rete: 55000 e 23514 danno lo stesso 409). Spegnere
 *    si può sempre. «Approvato» non vuol dire «pronto»: un testo con segnaposto non si approva nemmeno.
 *  · `atteso` si rimanda com'è arrivato (testo): ricostruirlo con `Date` perderebbe i microsecondi e il confronto darebbe 409.
 *  · Tutti i controlli dei valori vengono PRIMA di qualunque chiamata al database. Tabella assente → `migrazione`. Nel log solo codici. */
import { impronta, messaggioInviabile, variabiliUsate } from "../../shop/email/inviabile";
import {
  CHIAVI_EMAIL,
  VARIABILI_PER_CHIAVE,
  type ChiaveEmail,
  type MotivoNonInviabile,
} from "../../shop/email/tipi";
import {
  azioneDi,
  codiceDi,
  conflitto,
  dati,
  eMancante,
  gestisci,
  guasto,
  leggiCorpo,
  rifiuta,
  righe,
  senzaMigrazione,
  type PorteDb,
} from "./comune";

export const AZIONI_EMAIL = [
  "modello_salva",
  "modello_approva",
  "modello_acceso",
  "anteprima",
] as const;

const OGGETTO_MAX = 200;
const TESTO_MAX = 8000; // il corpo di una richiesta può avere al massimo 20.000 byte (comune.ts)
const COLONNE =
  "chiave, oggetto, testo, acceso, approvato_da, approvato_il, approvato_hash, aggiornato_il";
const FRASE_TESTO_CAMBIATO =
  "Il testo è stato cambiato da un'altra persona nel frattempo: ricarica la pagina, rileggilo e rifai la modifica.";

/** Perché un messaggio non si può mandare, nella lingua del titolare. `spento` non dipende dal testo: «Accendi» è proprio quello che si chiede. */
export const FRASE_NON_INVIABILE: Record<MotivoNonInviabile, string> = {
  spento: "Il messaggio è spento.",
  vuoto: "L'oggetto e il testo non possono essere vuoti.",
  segnaposto:
    "Il testo ha ancora un segnaposto «{{…}}» (per esempio «{{da confermare}}»): scrivi il testo vero prima di approvarlo e accenderlo.",
  non_approvato:
    "Il testo non è approvato, o è stato cambiato dopo l'approvazione: approvalo prima di accendere il messaggio.",
  variabile_sconosciuta:
    "Nel testo c'è una parola tra graffe che non è una variabile di questo messaggio, oppure una graffa rimasta sola: usa solo le variabili dell'elenco, ognuna con una graffa per parte, per esempio {nome}.",
};

type Giudizio = { ok: true } | { ok: false; motivo: MotivoNonInviabile; frase: string };
const giudizio = (m: unknown): Giudizio => {
  const e = messaggioInviabile(m);
  return e.ok ? e : { ok: false, motivo: e.motivo, frase: FRASE_NON_INVIABILE[e.motivo] };
};

/** Un modello com'è mostrato nel pannello. `contenuto` = il testo in sé (vuoto, segnaposto, variabili); `inviabile` = anche acceso e approvato. */
function vista(r: Record<string, unknown>) {
  const oggetto = typeof r.oggetto === "string" ? r.oggetto : "";
  const testo = typeof r.testo === "string" ? r.testo : "";
  const imp = impronta(oggetto, testo);
  const approvato = typeof r.approvato_hash === "string" && r.approvato_hash === imp;
  return {
    chiave: r.chiave as ChiaveEmail,
    oggetto,
    testo,
    acceso: r.acceso === true,
    approvato,
    approvatoDa: approvato && typeof r.approvato_da === "string" ? r.approvato_da : null,
    approvatoIl: approvato && typeof r.approvato_il === "string" ? r.approvato_il : null,
    aggiornatoIl: typeof r.aggiornato_il === "string" ? r.aggiornato_il : null,
    impronta: imp,
    contenuto: giudizio({ chiave: r.chiave, oggetto, testo, acceso: true, approvato_hash: imp }),
    inviabile: giudizio(r),
  };
}
type Vista = ReturnType<typeof vista>;

/* ══ I CONTROLLI DEI VALORI (prima del database) ═════════════════════════════ */

// eslint-disable-next-line no-control-regex -- i caratteri di controllo sono proprio ciò che si cerca
const CONTROLLO_OGGETTO = /[\u0000-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex -- vanno bene a capo e tabulazione, nient'altro
const CONTROLLO_TESTO = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function chiaveDi(x: unknown): ChiaveEmail {
  if (typeof x !== "string" || !(CHIAVI_EMAIL as readonly string[]).includes(x))
    throw rifiuta("valore", 400, "Questo messaggio non esiste.");
  return x as ChiaveEmail;
}
function oggettoDi(x: unknown, ammettiVuoto = false): string {
  const frase = `L'oggetto è obbligatorio, su una riga sola, al massimo ${OGGETTO_MAX} caratteri.`;
  if (typeof x !== "string" || x.length > OGGETTO_MAX * 2 || CONTROLLO_OGGETTO.test(x))
    throw rifiuta("valore", 400, frase);
  const t = x.trim();
  if (t.length > OGGETTO_MAX || (!t && !ammettiVuoto)) throw rifiuta("valore", 400, frase);
  return t;
}
function testoDi(x: unknown, ammettiVuoto = false): string {
  const frase = `Il testo è obbligatorio, al massimo ${TESTO_MAX} caratteri.`;
  if (typeof x !== "string" || x.length > TESTO_MAX * 2 || CONTROLLO_TESTO.test(x))
    throw rifiuta("valore", 400, frase);
  const t = x.trim();
  if (t.length > TESTO_MAX || (!t && !ammettiVuoto)) throw rifiuta("valore", 400, frase);
  return t;
}
function versioneVista(x: unknown): string {
  if (typeof x !== "string" || Number.isNaN(Date.parse(x)))
    throw rifiuta(
      "valore",
      400,
      "Manca la versione che vedevi prima del cambio: ricarica la pagina.",
    );
  return x;
}

/* ══ LE LETTURE ══════════════════════════════════════════════════════════════ */

async function leggiUno(d: PorteDb, chiave: ChiaveEmail): Promise<Record<string, unknown>> {
  const r = righe(
    dati(
      d,
      "lettura",
      await d.db.from("shop_email_modelli").select(COLONNE).eq("chiave", chiave).limit(1),
    ),
  );
  if (!r.length)
    throw rifiuta(
      "non_trovato",
      404,
      "Questo messaggio non esiste nel database: manca il seme della migrazione delle email.",
    );
  return r[0];
}
/** Il modello com'è ORA (la versione cambia a ogni scrittura). Se non si riesce a leggere la scrittura è già fatta: `null`, la schermata rilegge. */
async function rilettura(d: PorteDb, chiave: ChiaveEmail): Promise<Vista | null> {
  try {
    return vista(await leggiUno(d, chiave));
  } catch {
    d.log("rilettura");
    return null;
  }
}
/** Un errore di una funzione SQL di S6 che non è «manca la migrazione»: il messaggio non esiste (404) o è un guasto. */
function erroreFunzione(d: PorteDb, dove: string, e: { code?: unknown }) {
  if (eMancante(e)) return senzaMigrazione();
  if (codiceDi(e) === "P0002")
    return rifiuta(
      "non_trovato",
      404,
      "Questo messaggio non esiste nel database: manca il seme della migrazione delle email.",
    );
  return guasto(d, dove, e);
}

/* ══ LE AZIONI ═══════════════════════════════════════════════════════════════ */

async function salva(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const chiave = chiaveDi(corpo.chiave);
  const oggetto = oggettoDi(corpo.oggetto);
  const testo = testoDi(corpo.testo);
  const atteso = versioneVista(corpo.atteso);
  const r = await d.db.rpc("shop_email_modello_salva", {
    p_chiave: chiave,
    p_atteso: atteso,
    p_oggetto: oggetto,
    p_testo: testo,
    p_chi: chi,
  });
  if (r.error) throw erroreFunzione(d, "salva", r.error);
  if (r.data !== true)
    throw conflitto(FRASE_TESTO_CAMBIATO, { modello: await rilettura(d, chiave) });
  return { chiave, modello: await rilettura(d, chiave) };
}

async function approva(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const chiave = chiaveDi(corpo.chiave);
  const improntaVista = corpo.impronta;
  if (typeof improntaVista !== "string" || !/^[0-9a-f]{64}$/.test(improntaVista))
    throw rifiuta("valore", 400, "Manca l'impronta del testo che hai letto: ricarica la pagina.");
  const v = vista(await leggiUno(d, chiave));
  if (v.impronta !== improntaVista) throw conflitto(FRASE_TESTO_CAMBIATO, { modello: v });
  if (!v.contenuto.ok)
    throw rifiuta("non_inviabile", 409, v.contenuto.frase, { perche: v.contenuto.motivo });
  const r = await d.db.rpc("shop_email_modello_approva", {
    p_chiave: chiave,
    p_impronta: improntaVista,
    p_chi: chi,
  });
  if (r.error) throw erroreFunzione(d, "approva", r.error);
  if (r.data !== true)
    throw conflitto(FRASE_TESTO_CAMBIATO, { modello: await rilettura(d, chiave) });
  return { chiave, modello: await rilettura(d, chiave) };
}

async function accendi(corpo: Record<string, unknown>, chi: string, d: PorteDb) {
  const chiave = chiaveDi(corpo.chiave);
  if (typeof corpo.acceso !== "boolean")
    throw rifiuta("valore", 400, "Dì se il messaggio va acceso o spento.");
  const acceso = corpo.acceso;
  const nonInviabile = (motivo: MotivoNonInviabile) =>
    rifiuta("non_inviabile", 409, FRASE_NON_INVIABILE[motivo], { perche: motivo });
  if (acceso) {
    // la stessa regola dell'invio: se non si potrebbe mandare, non si accende (e non si chiama nemmeno il database)
    const g = messaggioInviabile({ ...(await leggiUno(d, chiave)), acceso: true });
    if (!g.ok) throw nonInviabile(g.motivo);
  }
  const r = await d.db.rpc("shop_email_modello_acceso", {
    p_chiave: chiave,
    p_acceso: acceso,
    p_chi: chi,
  });
  if (r.error) {
    const codice = codiceDi(r.error);
    if (acceso && codice === "55000") throw nonInviabile("non_approvato"); // seconda rete: lo rifiuta il database
    if (acceso && codice === "23514") throw nonInviabile("segnaposto");
    throw erroreFunzione(d, "acceso", r.error);
  }
  return { chiave, cambiato: r.data === true, modello: await rilettura(d, chiave) };
}

/** Un giudizio sul testo che si sta scrivendo, senza toccare il database. */
function anteprima(corpo: Record<string, unknown>) {
  const chiave = chiaveDi(corpo.chiave);
  const oggetto = oggettoDi(corpo.oggetto, true);
  const testo = testoDi(corpo.testo, true);
  return {
    chiave,
    contenuto: giudizio({
      chiave,
      oggetto,
      testo,
      acceso: true,
      approvato_hash: impronta(oggetto, testo),
    }),
    variabili: {
      usate: variabiliUsate(`${oggetto}\n${testo}`),
      ammesse: [...VARIABILI_PER_CHIAVE[chiave]],
    },
  };
}

/* ══ LE ROTTE ════════════════════════════════════════════════════════════════ */

export const gestisciGET = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async () => {
    if (!new URL(request.url).searchParams.has("modelli"))
      throw rifiuta("azione_sconosciuta", 400, "Questa lettura non è prevista.");
    const r = righe(
      dati(d, "lettura", await d.db.from("shop_email_modelli").select(COLONNE).limit(20)),
    );
    const modelli = CHIAVI_EMAIL.flatMap((k) => {
      const riga = r.find((x) => x.chiave === k);
      return riga ? [vista(riga)] : [];
    });
    return { modelli, variabili: VARIABILI_PER_CHIAVE };
  });

export const gestisciPOST = (request: Request, d: PorteDb): Promise<Response> =>
  gestisci(request, d, async (chi) => {
    const corpo = await leggiCorpo(request);
    const azione = azioneDi(corpo, AZIONI_EMAIL);
    if (azione === "modello_salva") return salva(corpo, chi, d);
    if (azione === "modello_approva") return approva(corpo, chi, d);
    if (azione === "modello_acceso") return accendi(corpo, chi, d);
    return anteprima(corpo);
  });
