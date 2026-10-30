/** ── IL GIRO «DATI PER LA FATTURA» (30/10/2026) ─────────────────────────────
 *
 *  Ogni pochi minuti (pg_cron → `/hooks/dati-fattura`) due cose:
 *   A. alle schede con un acconto che non hanno ancora ricevuto la richiesta, si
 *      chiedono i dati per la fattura (UNA volta; regole in `decidiRichiesta`);
 *   B. a chi ha ricevuto la richiesta e ha risposto (foto o testo coi dati) entro
 *      14 giorni, si salva la foto (bucket PRIVATO), si leggono i dati con l'AI già
 *      in uso e si crea o completa la BOZZA di fattura.
 *
 *  Le porte (database, rete, AI, storage, orologio) sono iniettate: il modulo non
 *  conosce Supabase. Prove in `prove/dati-fattura.mjs`.
 *
 *  ⚠️ MAI una fattura confermata o inviata allo SdI: solo bozza.
 *  ⚠️ NIENTE DI SENSIBILE NEL RISULTATO: solo conteggi e parole fisse.
 *  ⚠️ L'interruttore è SPENTO di base. Quando lo si accende (`avvio: "da_fare"`), le
 *   schede che hanno GIÀ un acconto diventano «preesistenti» e non ricevono niente.
 */
import {
  bozzaDaDati,
  chiaveRichiesta,
  cosaFareConMessaggio,
  conAlmenoUnDato,
  decidiRichiesta,
  entroIlTempo,
  FILE_MASSIMI,
  leggiJsonDatiTesto,
  MESSAGGI_RICORDATI,
  NOME_MODELLO_DATI_FATTURA,
  nomePerModello,
  unisciLetture,
  type ConfigDatiFattura,
  type DatiFatturaScheda,
  type DatiLetti,
  type SchedaPerBozza,
  type SchedaPerRichiesta,
} from "./dati-fattura";
import type { Fattura } from "./tipi";

export interface SchedaGiro {
  id: string;
  userId: string;
  /** la scheda (parziale: solo ciò che serve) */
  data: SchedaPerRichiesta & {
    nome?: string;
    cognome?: string;
    email?: string;
    payment?: { accontoPagato?: number; prezzoFinaleVendita?: number; prezzoTotale?: number };
  };
  updatedAt: string;
}

export type EsitoInvioRichiesta =
  | "ok"
  | "gia_preso"
  | "saltato"
  | "riprova"
  | "stop"
  | "incerto"
  | "errore";

export interface MessaggioIn {
  /** `wa_message_id` */
  id: string;
  body: string;
  canale: string | null;
  creatoIl: string;
}

export interface PorteDatiFattura {
  adesso(): Date;
  /** ── IL LUCCHETTO: UN SOLO GIRO ALLA VOLTA ────────────────────────────────
   *  L'hook è chiamabile da chiunque abbia la chiave pubblicabile: due giri insieme non
   *  devono mai mandare due messaggi né scrivere due volte. `prendi` è una scrittura
   *  CONDIZIONATA con scadenza (se il giro muore, il lucchetto scade da solo). */
  lucchetto: { prendi(): Promise<boolean>; rilascia(): Promise<void> };
  leggiConfig(): Promise<ConfigDatiFattura>;
  salvaConfig(c: ConfigDatiFattura): Promise<void>;
  /** le schede con `accontoPagato > 0` */
  schedeConAcconto(): Promise<SchedaGiro[]>;
  contatto(
    userId: string,
    telefono: string,
  ): Promise<{ ultimaEntrata: string | null; stop: boolean }>;
  /** il modello è utilizzabile fuori finestra? (flusso ManyChat mappato / modello approvato) */
  modelloPronto(userId: string, config: ConfigDatiFattura): Promise<boolean>;
  invia(i: {
    userId: string;
    leadId: string;
    telefono: string;
    nome: string;
    come: "testo" | "modello";
    chiave: string;
    /** il parametro {{1}} del modello */
    nomePerModello: string;
  }): Promise<EsitoInvioRichiesta>;
  /** Scrive `datiFattura` sulla scheda SOLO se non è cambiata (`updatedAt`). */
  scriviScheda(s: SchedaGiro, d: DatiFatturaScheda): Promise<boolean>;
  messaggiIn(userId: string, leadId: string, dal: string): Promise<MessaggioIn[]>;
  /** scarica il file dal link ManyChat e lo salva nel bucket privato; null se non riesce */
  scaricaESalva(
    userId: string,
    leadId: string,
    url: string,
  ): Promise<{ percorso: string; dataUrl: string } | null>;
  /** L'AI: da uno o più file (data URL) oppure da un testo; null = guasto (si riprova).
   *  ⚠️ UNA LETTURA SOLA PER MESSAGGIO: il giro scrive il risultato già interpretato sulla scheda
   *  (`datiFattura.letture`, con gli id dei messaggi) PRIMA di fare altro, e non lo rifà. */
  leggi(i: { file: string[] } | { testo: string }): Promise<string | null>;
  /** esiste già una fattura emessa per questa scheda? */
  giaEmessa(leadId: string): Promise<boolean>;
  aliquota(): Promise<number>;
  leggiBozza(leadId: string): Promise<Fattura | null>;
  scriviBozza(f: Fattura): Promise<string | null>;
}

export interface EsitoGiro {
  stato: "spento" | "avvio" | "occupato" | "ok";
  preesistenti: number;
  richieste: number;
  promemoria: number;
  bozze: number;
  daGuardare: number;
  errori: number;
}

const vuoto = (): EsitoGiro => ({
  stato: "ok",
  preesistenti: 0,
  richieste: 0,
  promemoria: 0,
  bozze: 0,
  daGuardare: 0,
  errori: 0,
});

export async function giroDatiFattura(porte: PorteDatiFattura): Promise<EsitoGiro> {
  const out = vuoto();
  const adesso = porte.adesso();
  const config = await porte.leggiConfig();
  if (!config.acceso) return { ...out, stato: "spento" };
  //  ⚠️ Un giro solo alla volta: chi non prende il lucchetto non fa niente.
  if (!(await porte.lucchetto.prendi().catch(() => false))) return { ...out, stato: "occupato" };
  try {
    return await giroSottoLucchetto(porte, config, out, adesso);
  } finally {
    await porte.lucchetto.rilascia().catch(() => undefined);
  }
}

async function giroSottoLucchetto(
  porte: PorteDatiFattura,
  config: ConfigDatiFattura,
  out: EsitoGiro,
  adesso: Date,
): Promise<EsitoGiro> {
  const schede = await porte.schedeConAcconto();

  //  ── L'AVVIO: chi ha già un acconto non riceve niente ─────────────────
  if (config.avvio === "da_fare") {
    let mancanti = 0;
    for (const s of schede) {
      if (s.data.datiFattura) continue;
      try {
        if (await porte.scriviScheda(s, { stato: "preesistente" })) out.preesistenti++;
        else mancanti++;
      } catch {
        mancanti++;
      }
    }
    //  ⚠️ «fatto» solo se TUTTE le schede con acconto sono state segnate: se una non lo è, si
    //   ritenta al giro dopo, e nessuna scheda con un acconto vecchio riceve la richiesta.
    if (mancanti > 0) return { ...out, stato: "avvio", errori: mancanti };
    await porte.salvaConfig({ ...config, avvio: "fatto", attivoDal: adesso.toISOString() });
    return { ...out, stato: "avvio" };
  }

  for (const s of schede) {
    try {
      const st = s.data.datiFattura?.stato;
      if (!st || st === "promemoria") await chiedi(porte, config, s, adesso, out);
      else if (st === "richiesta_inviata" || st === "bozza_pronta" || st === "da_guardare")
        await leggiRisposte(porte, s, adesso, out);
    } catch {
      out.errori++;
    }
  }
  return out;
}

/** ── A. LA RICHIESTA ──────────────────────────────────────────────────── */
async function chiedi(
  porte: PorteDatiFattura,
  config: ConfigDatiFattura,
  s: SchedaGiro,
  adesso: Date,
  out: EsitoGiro,
) {
  const tel = String(s.data.telefono ?? "");
  const c = tel ? await porte.contatto(s.userId, tel) : { ultimaEntrata: null, stop: false };
  const d = decidiRichiesta({
    scheda: s.data,
    config,
    ultimaEntrata: c.ultimaEntrata,
    stop: c.stop,
    modelloPronto: await porte.modelloPronto(s.userId, config),
    adesso,
  });
  if (d.azione === "niente") return;
  const precedente = s.data.datiFattura;
  if (d.azione === "promemoria") {
    //  Già in promemoria: niente da riscrivere.
    if (precedente?.stato === "promemoria" && precedente.motivo === d.motivo) return;
    if (await porte.scriviScheda(s, { stato: "promemoria", motivo: d.motivo })) out.promemoria++;
    return;
  }
  //  ⚠️ PRIMA SI PRENOTA, POI SI INVIA. La scheda si segna «richiesta inviata» con una scrittura
  //   condizionata su `updated_at`: se due giri arrivano insieme, uno solo la vince e solo lui
  //   manda il messaggio. Se il giro muore dopo la prenotazione la richiesta resta segnata
  //   (mai un secondo messaggio: al peggio una persona la rimanda a mano).
  const richiestaIl = adesso.toISOString();
  if (
    !(await porte.scriviScheda(s, { stato: "richiesta_inviata", richiestaIl, motivo: "in_invio" }))
  )
    return;
  const esito = await porte.invia({
    userId: s.userId,
    leadId: s.id,
    telefono: tel,
    nome: String(s.data.nome ?? ""),
    come: d.come,
    chiave: chiaveRichiesta(tel, s.id),
    nomePerModello: nomePerModello(s.data.nome),
  });
  if (esito === "ok" || esito === "gia_preso" || esito === "incerto") {
    //  «incerto»: non si sa se è partito, e non si rimanda (come per tutti gli invii).
    await porte.scriviScheda(s, {
      stato: "richiesta_inviata",
      richiestaIl,
      ...(esito === "incerto" ? { motivo: "esito_incerto" } : {}),
    });
    out.richieste++;
    return;
  }
  //  Non è partito: la prenotazione si toglie e la richiesta torna «da fare» per una persona
  //  (o per il prossimo giro: i promemoria si riprovano).
  const motivo =
    esito === "stop"
      ? "numero_in_stop"
      : esito === "saltato"
        ? "finestra_chiusa"
        : esito === "riprova"
          ? "pausa_contatto"
          : "invio_non_riuscito";
  await porte.scriviScheda(s, { stato: "promemoria", motivo });
  if (esito !== "riprova") out.promemoria++;
}

/** ── B. LE RISPOSTE ───────────────────────────────────────────────────── */
async function leggiRisposte(porte: PorteDatiFattura, s: SchedaGiro, adesso: Date, out: EsitoGiro) {
  const sc = s.data.datiFattura as DatiFatturaScheda;
  if (!sc.richiestaIl) return;
  const scaduta = !entroIlTempo(sc.richiestaIl, adesso.toISOString());
  if (scaduta) return;
  const letti = new Set(sc.letti ?? []);
  const nuovi = (await porte.messaggiIn(s.userId, s.id, sc.richiestaIl))
    .filter((m) => !letti.has(m.id) && entroIlTempo(sc.richiestaIl, m.creatoIl))
    .sort((a, b) => a.creatoIl.localeCompare(b.creatoIl));
  if (nuovi.length === 0) return;

  const file = [...(sc.file ?? [])];
  const dataUrl: string[] = [];
  const idFile: string[] = [];
  const testi: { id: string; testo: string }[] = [];
  const visti: string[] = [];
  let daGuardare = false;
  let motivo = "";
  for (const m of nuovi.slice(0, 8)) {
    const cosa = cosaFareConMessaggio(m.body, m.canale);
    if (cosa.tipo === "niente") {
      visti.push(m.id);
      continue;
    }
    if (cosa.tipo === "da_guardare") {
      daGuardare = true;
      motivo = "media_senza_file";
      visti.push(m.id);
      continue;
    }
    if (cosa.tipo === "testo") {
      testi.push({ id: m.id, testo: m.body });
      visti.push(m.id);
      continue;
    }
    if (file.length >= FILE_MASSIMI) {
      visti.push(m.id);
      continue;
    }
    const f = await porte.scaricaESalva(s.userId, s.id, cosa.url);
    visti.push(m.id);
    if (!f) {
      //  Il file non si prende (link scaduto, troppo grande…): lo guarda una persona in chat.
      daGuardare = true;
      motivo = "file_non_scaricato";
      continue;
    }
    file.push(f.percorso);
    dataUrl.push(f.dataUrl);
    idFile.push(m.id);
  }

  //  L'AI: una chiamata per i file (insieme) e una per ogni testo. Ogni lettura ha la sua chiave (gli
  //  id dei messaggi): se la scheda la ricorda già (`letture`), l'AI NON si richiama.
  const ricordate = sc.letture ?? {};
  const nuove: Record<string, DatiLetti> = {};
  let guasto = false;
  const leggiUna = async (k: string, ingresso: { file: string[] } | { testo: string }) => {
    if (ricordate[k]) return;
    const r = await porte.leggi(ingresso);
    if (r === null) guasto = true;
    else nuove[k] = leggiJsonDatiTesto(r);
  };
  const chiaviViste: string[] = [];
  if (dataUrl.length) {
    chiaviViste.push(`f:${idFile.join(",")}`);
    await leggiUna(chiaviViste[0], { file: dataUrl });
  }
  for (const t of testi) {
    chiaviViste.push(`t:${t.id}`);
    await leggiUna(`t:${t.id}`, { testo: t.testo });
  }
  //  Se l'AI non risponde i messaggi non si segnano letti e il giro dopo riprova; le letture già
  //  riuscite si salvano comunque sulla scheda, così non si rifanno.
  let corrente: DatiFatturaScheda = { ...sc, file };
  if (Object.keys(nuove).length) {
    corrente = { ...corrente, letture: { ...ricordate, ...nuove } };
    if (!(await porte.scriviScheda(s, corrente))) return;
  }
  if (guasto) {
    out.errori++;
    return;
  }
  const letture: DatiLetti[] = chiaviViste.map((k) => nuove[k] ?? ricordate[k]);

  const unite = unisciLetture(letture);
  const base: DatiFatturaScheda = {
    ...corrente,
    letture: undefined,
    file,
    letti: [...(sc.letti ?? []), ...visti].slice(-MESSAGGI_RICORDATI),
  };
  if (conAlmenoUnDato(unite)) {
    //  ⚠️ LA SCHEDA PRIMA, LA BOZZA DOPO. La scrittura condizionata della scheda («bozza pronta»,
    //   messaggi letti) è il lucchetto: se un altro l'ha cambiata nel frattempo, la bozza NON si
    //   scrive. Così per uno stesso acconto la bozza nasce una volta sola (e se esiste già si
    //   completa soltanto, mai si sostituisce).
    //  Fattura già emessa per questo cliente: niente seconda bozza, si segna sulla scheda e si salta.
    if (await porte.giaEmessa(s.id)) {
      await porte.scriviScheda(s, { ...base, letture: undefined, stato: "fattura_emessa" });
      return;
    }
    const nuovoStato: DatiFatturaScheda = {
      ...base,
      //  le letture restano finché la bozza non è scritta (se fallisce, non si rifanno)
      letture: corrente.letture,
      stato: "bozza_pronta",
      bozzaIl: adesso.toISOString(),
      motivo: undefined,
    };
    if (!(await porte.scriviScheda(s, nuovoStato))) return;
    const esistente = await porte.leggiBozza(s.id);
    const { bozza } = bozzaDaDati({
      scheda: { id: s.id, ...s.data },
      letti: unite,
      esistente,
      aliquota: await porte.aliquota(),
      adesso,
    });
    const errore = await porte.scriviBozza(bozza);
    if (errore) {
      //  La bozza non c'è: la scheda torna com'era (con i file salvati) così il prossimo giro
      //  riprova; la lettura AI è ancora tenuta e non si rifà.
      await porte.scriviScheda(s, { ...corrente });
      out.errori++;
      return;
    }
    out.bozze++;
    //  Bozza scritta: i dati interpretati non servono più sulla scheda.
    await porte.scriviScheda(s, { ...nuovoStato, letture: undefined });
    return;
  }
  //  Arrivato qualcosa ma non si legge: foto storta, o dato incompleto.
  if (daGuardare || dataUrl.length || testi.length) {
    const nuovo: DatiFatturaScheda =
      sc.stato === "bozza_pronta"
        ? base
        : { ...base, stato: "da_guardare", motivo: motivo || "non_letto" };
    if (!(await porte.scriviScheda(s, nuovo))) return;
    if (sc.stato !== "bozza_pronta") out.daGuardare++;
    return;
  }
  await porte.scriviScheda(s, base);
}

export { NOME_MODELLO_DATI_FATTURA };
