/** ── EMAIL DELLO SHOP · L'INVIO (R2 · T54 · D53) ──────────────────────────────────────────────────────────────
 *  Chi manda un'email al cliente (il webhook di pagamento, il CRM con «invia ora») passa da `inviaEmail`, e da qui soltanto.
 *  Il percorso è uno solo, anche con `manuale:true` («invia ora» non allenta niente):
 *    modello (da `shop_email_modelli`) → `messaggioInviabile` → mittente e chiave configurati → ordine e destinatario
 *    → si compone → `shop_email_prenota` (una sola volta per ordine e messaggio; `in_invio` scade dopo 5 minuti) → Resend
 *    → `shop_email_esito`.
 *  Regole:
 *   · `messaggioInviabile` viene SEMPRE prima di `componi`: un testo spento, non approvato, con `{{…}}` o con una graffa fuori
 *     elenco non parte, nemmeno forzando (SPEC 8A n. 4). Lo stato dice perché (`spenta`, `non_approvata`, `segnaposto`…);
 *   · mittente «Hair Genius Labs» + indirizzo da `SHOP_EMAIL_INDIRIZZO` (porta `mittente()`), `reply_to` lo stesso: nessuna
 *     chiave e nessun indirizzo scritto qui; `RESEND_FROM` resta per gli avvisi interni;
 *   · il link dell'ordine porta la chiave RICALCOLATA da `chiaveOrdine` (D48): è quella che accetta la pagina ordine;
 *   · mai un'eccezione verso chi chiama: ogni guasto è uno stato; nel log solo CODICI (mai email, nome, riferimento o chiave);
 *   · dell'ordine si leggono solo le colonne che servono al testo: mai telefono, codice fiscale, P.IVA (stanno in
 *     `shop_ordini_riservati`, che qui non si legge); l'indirizzo di spedizione del CLIENTE esce solo nella conferma;
 *   · i modelli e le colonne dell'ordine non si scrivono da qui: solo le due funzioni SQL `shop_email_prenota` e `shop_email_esito`.
 *  ⚠️ Importabile senza ambiente: niente `process.env`, niente client creato a livello di modulo. */
import { chiaveOrdine } from "../cassa/chiave-ordine";
import { codiceDi, eMancante, eOggetto, righe, type ClienteDb } from "../../crm/negozio/comune";
import { eUuid } from "../../crm/ecommerce/azioni";
import { componi } from "./compone";
import { messaggioInviabile } from "./inviabile";
import {
  CHIAVI_EMAIL,
  STATO_DEL_MOTIVO,
  type ChiaveEmail,
  type EsitoInvio,
  type PorteEmail,
  type Variabili,
} from "./tipi";

/** Il corpo che si manda a Resend (i nomi sono quelli della sua API). */
export type CorpoResend = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to: string;
};
/** Com'è andata la chiamata: `codice` è solo un codice (`ok`, `http_422`, `rete`…), mai il testo di una risposta. */
export type EsitoResend = { ok: boolean; codice: string };

export interface PorteInvio {
  db: ClienteDb;
  resend: (corpo: CorpoResend) => Promise<EsitoResend>;
  /** «Hair Genius Labs <indirizzo>» da `SHOP_EMAIL_INDIRIZZO`, oppure `null` se non è configurato (`intestazioneMittente`). */
  mittente: () => string | null;
  /** La chiave di servizio, per ricalcolare la chiave dell'ordine nel link. */
  chiaveServizio: string | null | undefined;
  /** L'indirizzo del sito (`https://…`, la costante `SITO`): mai da `Host` o `Origin`. */
  sito: string;
  adesso: () => Date;
  /** Solo CODICI. */
  log: (codice: string) => void;
}

const COLONNE_ORDINE =
  "id, order_ref, nome, cognome, email, indirizzo, citta, cap, provincia, nazione, items, total, totale_cent, corriere, tracking, tracking_url, email_inviate";
/** Un solo indirizzo semplice: niente spazi, a capo, virgole, `<`, `>`, virgolette (non si inietta nell'intestazione). */
const EMAIL = /^[^\s@<>,;"()]+@[^\s@<>,;"()]+\.[^\s@<>,;"()]+$/;
const SITO = /^https:\/\/[^\s/?#]+$/;
const MAX_RIGHE = 50;

const nomeDi = (e: unknown): string =>
  String((e as { name?: unknown } | null)?.name ?? "?")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 30) || "?";
const soloCodice = (x: unknown): string =>
  String(x ?? "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 40) || "sconosciuto";
const testo = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
const eChiave = (x: unknown): x is ChiaveEmail =>
  typeof x === "string" && (CHIAVI_EMAIL as readonly string[]).includes(x);

/** 3850 → «€ 38,50» (punto fra le migliaia). A mano: non dipende dai dati di lingua dell'ambiente. */
function euro(cent: number): string {
  const a = Math.abs(cent);
  return `${cent < 0 ? "-" : ""}€ ${String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(a % 100).padStart(2, "0")}`;
}

/** Il totale in centesimi: la colonna in centesimi, altrimenti l'euro dell'ordine; `""` se nessuno dei due si legge. */
function totale(o: Record<string, unknown>): string {
  if (
    typeof o.totale_cent === "number" &&
    Number.isSafeInteger(o.totale_cent) &&
    o.totale_cent >= 0
  )
    return euro(o.totale_cent);
  const e = Number(String(o.total ?? "").replace(",", "."));
  return o.total != null && Number.isFinite(e) && e >= 0 ? euro(Math.round(e * 100)) : "";
}

/** «2 × Prodotto (variante) — € 25,00», una riga per voce; una voce che non si legge si salta. */
function riepilogo(items: unknown): string {
  return (Array.isArray(items) ? items.slice(0, MAX_RIGHE) : [])
    .filter(eOggetto)
    .flatMap((r) => {
      const nome = testo(r.name).slice(0, 120);
      const q = r.qty;
      if (!nome || typeof q !== "number" || !Number.isSafeInteger(q) || q < 1) return [];
      const variante = testo(r.variant).slice(0, 80);
      const prezzo = Number(String(r.unit_price ?? "").replace(",", "."));
      const importo =
        r.unit_price != null && Number.isFinite(prezzo) && prezzo >= 0
          ? ` — ${euro(Math.round(prezzo * 100) * q)}`
          : "";
      return [`${q} × ${nome}${variante ? ` (${variante})` : ""}${importo}`];
    })
    .join("\n");
}

/** L'indirizzo di spedizione, come l'ha scritto il cliente. Nazione vuota o «IT» = Italia. */
function indirizzo(o: Record<string, unknown>): string {
  const paese = testo(o.nazione);
  const provincia = testo(o.provincia);
  const cittaCap = [testo(o.cap), testo(o.citta)].filter(Boolean).join(" ");
  return [
    [testo(o.nome), testo(o.cognome)].filter(Boolean).join(" "),
    testo(o.indirizzo),
    cittaCap && provincia ? `${cittaCap} (${provincia})` : cittaCap,
    !paese || paese.toUpperCase() === "IT" ? "Italia" : paese,
  ]
    .filter(Boolean)
    .join("\n");
}

/** I valori delle variabili di UN messaggio: la conferma porta righe, totale e indirizzo; nessun altro messaggio li porta.
 *  Il resto (`componi`) scarta comunque le variabili che la chiave non ammette. */
function variabiliDi(
  chiave: ChiaveEmail,
  o: Record<string, unknown>,
  linkOrdine: string,
  importoRimborso: string,
): Variabili {
  const comuni: Variabili = {
    nome: testo(o.nome),
    ref: testo(o.order_ref),
    link_ordine: linkOrdine,
  };
  if (chiave === "conferma_ordine")
    return {
      ...comuni,
      totale: totale(o),
      riepilogo_righe: riepilogo(o.items),
      indirizzo_spedizione: indirizzo(o),
    };
  if (chiave === "spedito")
    return {
      ...comuni,
      corriere: testo(o.corriere),
      numero_tracking: testo(o.tracking),
      link_tracking: testo(o.tracking_url),
    };
  if (chiave === "rimborso") return { ...comuni, importo_rimborso: importoRimborso };
  return comuni;
}

/** Il risultato quando il database non risponde come deve: la migrazione manca, oppure è un guasto (si logga solo il codice). */
function guasto(p: PorteInvio, dove: string, errore: { code?: unknown } | null): EsitoInvio {
  if (eMancante(errore)) return { stato: "migrazione" };
  p.log(`${dove} ${codiceDi(errore)}`);
  return { stato: "errore", codice: `${dove}_guasto` };
}

/** Scrive come è finito l'invio. Dopo l'invio non si fallisce: se non si scrive, si logga il codice (il messaggio è già partito). */
async function scriviEsito(
  p: PorteInvio,
  ordineId: string,
  chiave: ChiaveEmail,
  stato: "inviata" | "errore",
  codice: string | null,
): Promise<void> {
  try {
    const r = await p.db.rpc("shop_email_esito", {
      p_ordine: ordineId,
      p_chiave: chiave,
      p_stato: stato,
      p_codice: codice,
    });
    if (r.error) p.log(`esito ${codiceDi(r.error)}`);
  } catch (e) {
    p.log(`esito ${nomeDi(e)}`);
  }
}

/** Manda (una sola volta) l'email `chiave` dell'ordine. `manuale` è «invia ora» del CRM: passa dallo stesso percorso e dalle stesse regole.
 *  Mai un'eccezione: ogni cosa che non va è uno `stato`. */
export async function inviaEmail(
  p: PorteInvio,
  chiave: unknown,
  ordineId: unknown,
  _opzioni: { manuale: boolean } | null,
): Promise<EsitoInvio> {
  if (!p || typeof p !== "object") return { stato: "errore", codice: "porte_mancanti" };
  const log = (codice: string) => {
    try {
      p.log(codice);
    } catch {
      /* il log non deve mai far cadere l'invio */
    }
  };
  let prenotata = false;
  try {
    if (!eChiave(chiave) || !eUuid(ordineId))
      return { stato: "errore", codice: "parametro_non_valido" };

    // 1 · il modello, e la regola unica: acceso, approvato sul testo di oggi, senza segnaposto né variabili fuori elenco
    const rm = await p.db
      .from("shop_email_modelli")
      .select("chiave, oggetto, testo, acceso, approvato_hash")
      .eq("chiave", chiave)
      .limit(1);
    if (rm.error) return guasto({ ...p, log }, "modello", rm.error);
    const modello = righe(rm.data)[0];
    if (!modello) return { stato: "migrazione" }; // il seme di S6 non c'è
    const inviabile = messaggioInviabile(modello);
    if (!inviabile.ok) return { stato: STATO_DEL_MOTIVO[inviabile.motivo] };

    // 2 · le cose da configurare (si guardano PRIMA di prenotare: una prenotazione sprecata bloccherebbe 5 minuti)
    let da: string | null = null;
    try {
      da = p.mittente();
    } catch {
      /* mittente illeggibile = non configurato */
    }
    const sito = typeof p.sito === "string" ? p.sito.replace(/\/+$/, "") : "";
    if (
      typeof da !== "string" ||
      !da ||
      /[\r\n]/.test(da) ||
      typeof p.chiaveServizio !== "string" ||
      !p.chiaveServizio ||
      !SITO.test(sito)
    )
      return { stato: "non_configurata" };

    // 3 · l'ordine e il destinatario
    const ro = await p.db.from("shop_orders").select(COLONNE_ORDINE).eq("id", ordineId).limit(1);
    if (ro.error) return guasto({ ...p, log }, "ordine", ro.error);
    const ordine = righe(ro.data)[0];
    if (!ordine) return { stato: "errore", codice: "ordine_non_trovato" };
    const a = testo(ordine.email);
    if (!EMAIL.test(a)) return { stato: "senza_email" };

    // 4 · l'importo del rimborso: l'ultimo rimborso RIUSCITO dell'ordine (shortcut: con più rimborsi vicini vale l'ultimo; passarlo dal chiamante se serve)
    let importo = "";
    if (chiave === "rimborso") {
      const rr = await p.db
        .from("shop_rimborsi")
        .select("importo_cent")
        .eq("ordine_id", ordineId)
        .eq("stato", "riuscito")
        .order("aggiornato_il", { ascending: false })
        .limit(1);
      if (rr.error) return guasto({ ...p, log }, "rimborso", rr.error);
      const cent = righe(rr.data)[0]?.importo_cent;
      if (typeof cent === "number" && Number.isSafeInteger(cent) && cent > 0) importo = euro(cent);
    }

    // 5 · si compone (solo dopo `messaggioInviabile`), con il link che la pagina ordine accetta
    const ref = testo(ordine.order_ref);
    const link = ref
      ? `${sito}/shop/ordine/${encodeURIComponent(ref)}?t=${await chiaveOrdine(p.chiaveServizio, ordineId)}`
      : "";
    const messaggio = componi(modello, variabiliDi(chiave, ordine, link, importo));
    if (!messaggio.oggetto) return { stato: STATO_DEL_MOTIVO.vuoto };

    // 6 · la prenotazione: vera una sola volta; se non è vera, o è già partita o la sta mandando un altro
    const pr = await p.db.rpc("shop_email_prenota", { p_ordine: ordineId, p_chiave: chiave });
    if (pr.error) return guasto({ ...p, log }, "prenota", pr.error);
    if (pr.data !== true) {
      const gia =
        eOggetto(ordine.email_inviate) && eOggetto(ordine.email_inviate[chiave])
          ? ordine.email_inviate[chiave].stato
          : null;
      return gia === "inviata"
        ? { stato: "inviata", codice: "gia_inviata" }
        : { stato: "in_corso" };
    }
    prenotata = true;

    // 7 · l'invio e l'esito
    let esito: EsitoResend;
    try {
      const r = await p.resend({
        from: da,
        to: [a],
        subject: messaggio.oggetto,
        text: messaggio.testo,
        html: messaggio.html,
        reply_to: da,
      });
      esito =
        eOggetto(r) && r.ok === true
          ? { ok: true, codice: "ok" }
          : { ok: false, codice: soloCodice(eOggetto(r) ? r.codice : null) };
    } catch (e) {
      log(`resend ${nomeDi(e)}`);
      esito = { ok: false, codice: "resend_eccezione" };
    }
    await scriviEsito(
      { ...p, log },
      ordineId,
      chiave,
      esito.ok ? "inviata" : "errore",
      esito.ok ? null : esito.codice,
    );
    return esito.ok ? { stato: "inviata" } : { stato: "errore", codice: esito.codice };
  } catch (e) {
    log(`eccezione ${nomeDi(e)}`); // mai il messaggio: può contenere dati del cliente
    if (prenotata && eChiave(chiave) && eUuid(ordineId))
      await scriviEsito({ ...p, log }, ordineId, chiave, "errore", "eccezione");
    return { stato: "errore", codice: "eccezione" };
  }
}

/** La porta unica per il webhook e per il CRM (`PorteEmail` di T49). */
export const creaPorteEmail = (p: PorteInvio): PorteEmail => ({
  invia: (chiave, ordineId, opzioni) => inviaEmail(p, chiave, ordineId, opzioni),
});

/** Come si chiama Resend. La rotta passa la chiave letta dall'ambiente DENTRO il gestore (`RESEND_API_KEY`): qui non si legge niente.
 *  Risultato: solo `ok` e un codice (`ok`, `http_<stato>`, `rete`, `non_configurata`), mai il testo di una risposta o un'eccezione. */
export function resendConFetch(
  chiaveResend: string | null | undefined,
  fetchFn: (
    url: string,
    opzioni: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
  ) => Promise<{ ok: boolean; status: number }> = fetch,
): PorteInvio["resend"] {
  return async (corpo) => {
    if (typeof chiaveResend !== "string" || !chiaveResend)
      return { ok: false, codice: "non_configurata" };
    try {
      const r = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${chiaveResend}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(8000),
      });
      return r.ok
        ? { ok: true, codice: "ok" }
        : { ok: false, codice: `http_${Number.isSafeInteger(r.status) ? r.status : 0}` };
    } catch {
      return { ok: false, codice: "rete" };
    }
  };
}
