/** ── PONTE WHATSAPP · INVIO A MANO: IL GIRO SUL SERVER ───────────────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T5 (PIANO.md §3.3, §3.4).
 *  Due porte d'ingresso, entrambe sottili e provate con porte finte:
 *   · `gestisciPonte`   il Mac chiede la coda (`prendi`) e riporta l'esito
 *                       (`esito`); la chiamano `ingresso.ts` e la sua rotta,
 *                       DOPO la chiave `X-HGL-Token` e la lettura del corpo;
 *   · `gestisciBrowser` il CRM mette in coda (`accoda`) o rimette in coda
 *                       (`riprova`); la chiama la rotta `/api/crm/ponte-invio`,
 *                       DOPO la sessione (`guardiaCRM`).
 *
 *  ⚠️ L'utente non arriva MAI dal corpo: è `porte.utente()` (`manychat_config`).
 *  ⚠️ Le regole (chi può, in che ordine si rifiuta, riprova) sono quelle di
 *   `invio.ts`: qui si chiamano, non si riscrivono.
 *  ⚠️ Nei log solo `porte.avviso(codice, conteggi)`: mai testo, numeri, nomi, id.
 *  ⚠️ Un errore del database NON porta mai il messaggio: arriva `{ code }` e si
 *   risponde con una frase fissa.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  FRASE_CONFERMA_INCERTO,
  controllaAccodamento,
  fraseMotivo,
  leggiEsito,
  leggiPrendi,
  leggiRichiestaBrowser,
  puoRiprovare,
  statoVisibile,
} from "./invio";
import type { MotivoRifiuto, PorteInvio } from "./invio-tipi";

/** Funzione, tabella o colonna assente (migrazione non applicata, o cache dello
 *  schema che non la vede ancora): PostgREST o Postgres. */
export const CODICI_MIGRAZIONE = ["42883", "PGRST202", "42P01", "PGRST205", "42703", "PGRST204"];

const RISPOSTA = { "Content-Type": "application/json", "Cache-Control": "no-store" };

const oggetto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const codiceDi = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "?";
};

// ── Il Mac: `prendi` ed `esito` ───────────────────────────────────────────

function risposta(stato: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status: stato, headers: RISPOSTA });
}

/** Database: 503 `migrazione` se manca la migrazione (il Mac si ferma 5 minuti),
 *  500 `database` per il resto (il Mac ritenta: `esito` è idempotente). */
function erroreMac(porte: PorteInvio, e: unknown): Response {
  if (CODICI_MIGRAZIONE.includes(codiceDi(e))) {
    porte.avviso("invio_migrazione");
    return risposta(503, { ok: false, errore: "migrazione" });
  }
  porte.avviso("invio_database");
  return risposta(500, { ok: false, errore: "database" });
}

/** Il corpo `prendi` o `esito` del Mac (chiave e dimensione già controllate da
 *  chi chiama). 200 con la coda; 404 `sconosciuto` se la riga non c'è (il Mac
 *  smette di riprovare); 409 `stato_non_ammesso` se la riga c'è ma non accetta
 *  quell'esito (idem); 400 corpo non valido. */
export async function gestisciPonte(
  porte: PorteInvio,
  userId: string,
  json: unknown,
  adesso: Date,
): Promise<Response> {
  const tipo = oggetto(json) ? json.tipo : null;
  try {
    if (tipo === "prendi") {
      if (!leggiPrendi(json)) return risposta(400, { ok: false, errore: "corpo_non_valido" });
      const r = await porte.prendi(userId);
      porte.avviso("invio_prelevato", { invio: r.invio ? 1 : 0, limite: r.limite ? 1 : 0 });
      return risposta(200, r);
    }
    const c = tipo === "esito" ? leggiEsito(json, adesso) : null;
    if (!c) return risposta(400, { ok: false, errore: "corpo_non_valido" });
    const r = await porte.esito(userId, c);
    if (!r) {
      porte.avviso("invio_esito", { sconosciuto: 1 });
      return risposta(404, { ok: false, errore: "sconosciuto" });
    }
    //  La porta dà lo stato che la riga ha ADESSO. Se non è quello che l'esito
    //  produce (`inviato` / `non_inviato`) la riga non lo ha accettato: il Mac
    //  non deve ritentare (un esito tardivo di un tentativo vecchio).
    const atteso = c.esito === "inviato" ? "inviato" : "non_inviato";
    if (r.stato !== atteso) {
      porte.avviso("invio_esito", { non_ammesso: 1 });
      return risposta(409, { ok: false, errore: "stato_non_ammesso" });
    }
    porte.avviso("invio_esito", { ok: 1 });
    return risposta(200, r);
  } catch (e) {
    return erroreMac(porte, e);
  }
}

// ── Il browser: `accoda` e `riprova` ──────────────────────────────────────

/** Lo stato HTTP di ogni rifiuto (PIANO §3.4). */
const STATO_RIFIUTO: Record<MotivoRifiuto | "corpo_non_valido", number> = {
  testo_vuoto: 400,
  testo_lungo: 400,
  numero_non_valido: 400,
  corpo_non_valido: 400,
  ponte_non_collegato: 409,
  invii_spenti: 409,
  mai_scritto: 409,
  stop: 409,
  coda_piena: 409,
  non_riprovabile: 409,
  limite_giornaliero: 429,
  non_autorizzato: 403,
};

export interface RispostaBrowser {
  stato: number;
  corpo: Record<string, unknown>;
}

const rifiuto = (motivo: MotivoRifiuto | "corpo_non_valido", frase?: string): RispostaBrowser => ({
  stato: STATO_RIFIUTO[motivo],
  corpo: {
    ok: false,
    motivo,
    frase:
      frase ??
      (motivo === "corpo_non_valido"
        ? "Richiesta non valida: ricarica la pagina e riprova."
        : fraseMotivo(motivo)),
  },
});

/** Mai il testo dell'errore: una frase fissa. */
function erroreBrowser(porte: PorteInvio, e: unknown): RispostaBrowser {
  if (CODICI_MIGRAZIONE.includes(codiceDi(e))) {
    porte.avviso("invio_migrazione");
    return {
      stato: 503,
      corpo: {
        ok: false,
        motivo: "migrazione",
        frase: "L'invio dal telefono non è ancora pronto. Riprova più tardi.",
      },
    };
  }
  porte.avviso("invio_database");
  return {
    stato: 500,
    corpo: {
      ok: false,
      motivo: "database",
      frase: "Il server ha avuto un problema: riprova fra poco.",
    },
  };
}

/** La richiesta del browser (sessione già controllata da chi chiama).
 *  `chi.adminUserId` è l'installazione della sessione: deve essere quella del
 *  database, altrimenti 403. */
export async function gestisciBrowser(
  porte: PorteInvio,
  i: { chi: { adminUserId: string; nome: string }; corpo: unknown; adesso: Date },
): Promise<RispostaBrowser> {
  const letta = leggiRichiestaBrowser(i.corpo);
  if (!letta.ok) {
    porte.avviso("invio_rifiutato", { rifiuti: 1 });
    return rifiuto(letta.motivo);
  }
  const r = letta.r;
  try {
    const userId = await porte.utente();
    if (!userId || !i.chi.adminUserId || i.chi.adminUserId !== userId) {
      porte.avviso("invio_rifiutato", { rifiuti: 1 });
      return rifiuto("non_autorizzato");
    }

    if (r.azione === "accoda") {
      const fatti = await porte.fatti(userId, r.numero);
      const ok = controllaAccodamento({
        testo: r.testo,
        numero: r.numero,
        fatti,
        adesso: i.adesso,
      });
      if (!ok.ok) {
        porte.avviso("invio_rifiutato", { rifiuti: 1 });
        return rifiuto(ok.motivo);
      }
      const messo = await porte.accoda(userId, {
        chiave: r.chiave,
        numero: r.numero,
        testo: r.testo,
        creato_da: i.chi.nome.trim().slice(0, 80),
      });
      if (messo.nuovo) porte.avviso("invio_accodato", { n: 1 });
      return { stato: 200, corpo: { ok: true, id: messo.id, stato: messo.stato } };
    }

    //  riprova
    const riga = await porte.riga(userId, r.id);
    if (!riga) {
      porte.avviso("invio_rifiutato", { rifiuti: 1 });
      return { ...rifiuto("non_riprovabile"), stato: 404 };
    }
    //  La riga come la vede la chat: una `in_attesa` vecchia è «scaduta», una
    //  `in_invio` vecchia è «incerta» (il Mac spento non svuota il database).
    const vista = statoVisibile(riga, i.adesso);
    //  Già in coda (doppio tocco): niente da fare, si dice com'è.
    if (vista.fase === "in_attesa" || vista.fase === "in_invio") {
      return { stato: 200, corpo: { ok: true, id: riga.id, stato: riga.stato } };
    }
    const regola = puoRiprovare({ ...riga, stato: vista.fase, motivo: vista.motivo });
    if (!regola.ok) {
      porte.avviso("invio_rifiutato", { rifiuti: 1 });
      return rifiuto("non_riprovabile");
    }
    if (regola.serveConferma && r.confermaIncerto !== true) {
      porte.avviso("invio_rifiutato", { rifiuti: 1 });
      return rifiuto("non_riprovabile", FRASE_CONFERMA_INCERTO);
    }
    //  Gli stessi controlli di un accodamento nuovo (STOP, ponte, limiti). La
    //  riga stessa non conta fra quelle in coda: lo sarebbe solo per il database.
    const fatti = await porte.fatti(userId, riga.numero);
    const aperta = riga.stato === "in_attesa" || riga.stato === "in_invio";
    const ok = controllaAccodamento({
      testo: riga.testo,
      numero: riga.numero,
      fatti: aperta ? { ...fatti, in_coda: Math.max(0, fatti.in_coda - 1) } : fatti,
      adesso: i.adesso,
    });
    if (!ok.ok) {
      porte.avviso("invio_rifiutato", { rifiuti: 1 });
      return rifiuto(ok.motivo);
    }
    const messo = await porte.riprova(userId, riga.id, r.confermaIncerto === true);
    if (messo.stato === null) {
      porte.avviso("invio_rifiutato", { rifiuti: 1 });
      return { ...rifiuto("non_riprovabile"), stato: 404 };
    }
    if (messo.stato === "in_attesa") porte.avviso("invio_accodato", { n: 1, riprova: 1 });
    return { stato: 200, corpo: { ok: true, id: riga.id, stato: messo.stato } };
  } catch (e) {
    return erroreBrowser(porte, e);
  }
}
