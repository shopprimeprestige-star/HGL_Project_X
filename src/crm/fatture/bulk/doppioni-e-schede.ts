/** ── FATTURE BULK · DOPPIONI E SCHEDE (doppioni-e-schede.ts) ──────────────
 *  Due domande a cui risponde, e nient'altro:
 *   1. questo pagamento è già stato fatturato (o è già in questo lavoro)?
 *   2. di quale scheda del CRM è questo cliente?
 *  Funzioni pure che non mutano l'input (la prova le passa congelate).
 *
 *  ── ⚠️ LA TABELLA DEI DOPPIONI (NOTE-FISCALI 2.7) ─────────────────────────
 *   · stesso riferimento (≥ 6 caratteri) o stesso screenshot del pagamento → BLOCCA:
 *     è lo stesso incasso, non un caso simile;
 *   · stesso CF + stesso totale + stessa data → CONFERMA: due pagamenti uguali
 *     lo stesso giorno possono essere veri, lo decide la persona;
 *   · omonimi con CF diverso, o stesso CF con nome diverso → CONFERMA;
 *   · stesso CF con altre fatture, o stessa data con importi diversi → AVVISO;
 *   · bozza aperta dello stesso cliente → AVVISO con gli importi (il bulk non la tocca mai, D6).
 *
 *  ⚠️ LE BOZZE NON HANNO UNA DATA (si assegna quando si emette), quindi per loro
 *   vale il riferimento, l'impronta e l'avviso: «CF + totale + data» le salta.
 *  ⚠️ L'IMPRONTA CHE CONTA È QUELLA DEL PAGAMENTO. Tessera e indirizzo si
 *   ricaricano legittimamente per un secondo pagamento della stessa persona.
 *  ⚠️ I confronti fra persone usano il CF solo se c'è: un CF non valido arriva
 *   vuoto (T1) e due vuoti non sono «lo stesso CF». */
import { etichettaNumero } from "../archivio";
import type { Fattura } from "../tipi";
import type { CampiRiga, Motivo, SchedaPerAbbinamento } from "./tipi";

/** Quello che serve a cercare doppioni di una riga (T10 lo costruisce). */
export interface RigaPerDoppioni {
  idRiga: string;
  /** Posizione 1-based nell'elenco, per scrivere «riga 3» nei motivi. Facoltativa: senza, il motivo usa l'id. */
  numero?: number;
  campi: CampiRiga;
  /** Impronta del file del pagamento: quella decisiva. Vuota = non calcolata, mai un doppione. */
  improntaPagamento: string;
  riferimento: string;
  /** Scheda abbinata o scelta (T10): serve a ritrovare la sua bozza. */
  schedaId?: string | null;
}

export interface FontiDoppioni {
  emesse: Fattura[];
  bozze: Fattura[];
  altreRighe: RigaPerDoppioni[];
  /** Impronte dei pagamenti di altri lotti aperti. */
  altriLotti: string[];
}

/** Sotto questa lunghezza un «riferimento» è troppo generico per dire che è lo stesso incasso. */
const RIFERIMENTO_MINIMO = 6;

/* ── piccoli attrezzi ──────────────────────────────────────────────────── */

const cf = (v: string | undefined | null) => String(v ?? "").replace(/\s+/g, "").toUpperCase();
const rifNorm = (v: string | undefined | null) => String(v ?? "").replace(/\s+/g, "").toUpperCase();
const centesimi = (n: number | null | undefined) => (typeof n === "number" ? Math.round(n * 100) : NaN);
const eur = (n: number) => n.toFixed(2).replace(".", ",");
const dataIt = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso);
/** Le parole di un nome: minuscole, senza accenti né segni, in ordine alfabetico («Rossi Mario» = «Mario Rossi»). */
const parole = (s: string): string[] =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
const nomeChiave = (nome: string, cognome: string) => parole(`${nome} ${cognome}`).sort().join(" ");
const dellaRiga = (r: RigaPerDoppioni) => (r.numero ? `riga ${r.numero}` : `riga ${r.idRiga}`);
const dataDi = (f: Fattura) => f.data || f.dataPagamento || "";
const nomeDi = (f: Fattura) => nomeChiave(f.cliente.nome, f.cliente.cognome);

/** Anno e numero decrescenti: la prima è l'ultima emessa. */
const piuRecentePrima = (a: Fattura, b: Fattura) => b.anno - a.anno || b.numero - a.numero;

/* ── 1. DOPPIONI ───────────────────────────────────────────────────────── */

export function trovaDoppioni(riga: RigaPerDoppioni, fonti: FontiDoppioni): Motivo[] {
  const altre = fonti.altreRighe.filter((r) => r.idRiga !== riga.idRiga);
  const c = riga.campi;
  const miaCf = cf(c.codiceFiscale);
  const miaRif = rifNorm(riga.riferimento);
  const bloccanti: Motivo[] = [];
  const conferme: Motivo[] = [];
  const avvisi: Motivo[] = [];

  // Stesso riferimento: emessa, poi bozza, poi altra riga.
  if (miaRif.length >= RIFERIMENTO_MINIMO) {
    const emessa = fonti.emesse.find((f) => rifNorm(f.riferimentoPagamento) === miaRif || rifNorm(f.origineBulk?.riferimento) === miaRif);
    const bz = fonti.bozze.find((f) => rifNorm(f.riferimentoPagamento) === miaRif || rifNorm(f.origineBulk?.riferimento) === miaRif);
    const altra = altre.find((r) => rifNorm(r.riferimento) === miaRif);
    const dove = emessa
      ? `sulla fattura ${etichettaNumero(emessa)}`
      : bz
        ? "su una bozza di fattura"
        : altra
          ? `nella ${dellaRiga(altra)} di questo caricamento`
          : "";
    if (dove)
      bloccanti.push({
        codice: "doppione_riferimento",
        gravita: "blocca",
        campo: "riferimento",
        testo: `Questo pagamento risulta già fatturato: il riferimento «${riga.riferimento.trim()}» c'è già ${dove}. Se il riferimento è letto male correggilo, altrimenti scarta la riga.`,
      });
  }

  // Stesso screenshot del pagamento.
  const imp = riga.improntaPagamento;
  if (imp) {
    const emessa = fonti.emesse.find((f) => f.origineBulk?.impronte.includes(imp));
    const bz = fonti.bozze.find((f) => f.origineBulk?.impronte.includes(imp));
    const altra = altre.find((r) => r.improntaPagamento === imp);
    const dove = emessa
      ? `già usato per la fattura ${etichettaNumero(emessa)}`
      : bz
        ? "già usato per una bozza di fattura"
        : altra
          ? `già presente nella ${dellaRiga(altra)} di questo caricamento`
          : fonti.altriLotti.includes(imp)
            ? "già presente in un altro caricamento aperto"
            : "";
    if (dove)
      bloccanti.push({
        codice: "doppione_screenshot",
        gravita: "blocca",
        testo: `Lo screenshot del pagamento è ${dove}: lo stesso incasso non si fattura due volte. Scarta la riga se è davvero lo stesso.`,
      });
  }

  // Stesso CF + stesso totale + stessa data: emesse, poi altre righe. Le bozze non hanno data.
  const mioTotale = centesimi(c.importo);
  const stessoPagamento = (cfAltro: string, totale: number, data: string) =>
    !!miaCf && cfAltro === miaCf && !Number.isNaN(mioTotale) && totale === mioTotale && !!c.data && data === c.data;
  const doppiaEmessa = fonti.emesse.find((f) => stessoPagamento(cf(f.cliente.codiceFiscale), centesimi(f.totale), dataDi(f)));
  const doppiaRiga = altre.find((r) => stessoPagamento(cf(r.campi.codiceFiscale), centesimi(r.campi.importo), r.campi.data));
  if (doppiaEmessa || doppiaRiga)
    conferme.push({
      codice: "doppione_pagamento",
      gravita: "conferma",
      testo: doppiaEmessa
        ? `Sembra già fatturata con la fattura ${etichettaNumero(doppiaEmessa)}: stesso codice fiscale, stesso importo, stessa data. Sono due pagamenti distinti?`
        : `Sembra la stessa della ${dellaRiga(doppiaRiga!)} di questo caricamento: stesso codice fiscale, stesso importo, stessa data. Sono due pagamenti distinti?`,
    });

  // Omonimi con CF diverso, o stesso CF con nome diverso (solo fra righe del lavoro).
  const mioNome = nomeChiave(c.nome, c.cognome);
  if (mioNome && miaCf) {
    const omonimo = altre.find((r) => cf(r.campi.codiceFiscale) && cf(r.campi.codiceFiscale) !== miaCf && nomeChiave(r.campi.nome, r.campi.cognome) === mioNome);
    if (omonimo)
      conferme.push({
        codice: "omonimo_cf_diverso",
        gravita: "conferma",
        campo: "codiceFiscale",
        testo: `Nome e cognome uguali alla ${dellaRiga(omonimo)} ma codice fiscale diverso: sono due persone o un codice fiscale è letto male? Controlla gli screenshot.`,
      });
    const stessoCf = altre.find((r) => cf(r.campi.codiceFiscale) === miaCf && nomeChiave(r.campi.nome, r.campi.cognome) && nomeChiave(r.campi.nome, r.campi.cognome) !== mioNome);
    if (stessoCf)
      conferme.push({
        codice: "cf_nome_diverso",
        gravita: "conferma",
        campo: "nome",
        testo: `Stesso codice fiscale della ${dellaRiga(stessoCf)} ma nome e cognome diversi: uno dei due è letto male. Controlla gli screenshot.`,
      });
  }

  // Avvisi: altre fatture dello stesso CF (senza contare il doppione già detto).
  if (miaCf) {
    const altreFatture = fonti.emesse
      .filter((f) => cf(f.cliente.codiceFiscale) === miaCf && !stessoPagamento(cf(f.cliente.codiceFiscale), centesimi(f.totale), dataDi(f)))
      .sort(piuRecentePrima);
    if (altreFatture.length) {
      const u = altreFatture[0];
      avvisi.push({
        codice: "stesso_cf_altre_fatture",
        gravita: "avviso",
        testo: `Questo cliente ha già ${altreFatture.length} ${altreFatture.length === 1 ? "fattura" : "fatture"} (l'ultima è la ${etichettaNumero(u)} del ${dataIt(dataDi(u))}, di € ${eur(u.totale)}): capita, ad esempio con acconto e saldo.`,
      });
    }
    // Due righe dello stesso CF e della stessa data con importi diversi.
    const stessaData = altre.find((r) => cf(r.campi.codiceFiscale) === miaCf && !!c.data && r.campi.data === c.data && centesimi(r.campi.importo) !== mioTotale);
    if (stessaData)
      avvisi.push({
        codice: "stesso_cf_stessa_data",
        gravita: "avviso",
        testo: `Nella ${dellaRiga(stessaData)} c'è lo stesso cliente con la stessa data e un importo diverso: due pagamenti dello stesso giorno.`,
      });
  }

  // Bozze aperte dello stesso cliente: per scheda o per CF.
  const bozze = fonti.bozze.filter((b) => (!!riga.schedaId && b.leadId === riga.schedaId) || (!!miaCf && cf(b.cliente.codiceFiscale) === miaCf));
  if (bozze.length)
    avvisi.push({
      codice: "bozza_aperta",
      gravita: "avviso",
      testo: `C'è già ${bozze.length === 1 ? "una bozza di fattura" : `${bozze.length} bozze di fattura`} per questo cliente (${bozze.map((b) => `€ ${eur(b.totale)}`).join(", ")}): emettendo da qui ${bozze.length === 1 ? "resta" : "restano"} com'${bozze.length === 1 ? "è" : "erano"}.`,
    });

  return [...bloccanti, ...conferme, ...avvisi];
}

/** Le impronte dei pagamenti già fatturati o già caricati (anche da `origineBulk.impronte`, che sopravvive al lotto cancellato). */
export function impronteGiaViste(fonti: FontiDoppioni): Set<string> {
  const viste = new Set<string>();
  for (const f of [...fonti.emesse, ...fonti.bozze]) for (const i of f.origineBulk?.impronte ?? []) viste.add(i);
  for (const r of fonti.altreRighe) viste.add(r.improntaPagamento);
  for (const i of fonti.altriLotti) viste.add(i);
  viste.delete("");
  return viste;
}

/* ── 2. ABBINAMENTO ALLA SCHEDA ────────────────────────────────────────── */

export interface AbbinamentoScheda {
  /** null = fattura senza scheda. */
  scheda: SchedaPerAbbinamento | null;
  motivi: Motivo[];
}

/** Le ultime 9 cifre, o vuoto se non ce ne sono abbastanza per fidarsi. */
const ultime9 = (t: string) => {
  const cifre = String(t ?? "").replace(/\D/g, "");
  return cifre.length >= 9 ? cifre.slice(-9) : "";
};

/** SPEC §5, il primo criterio che trova UNA sola scheda vince: CF; telefono + cognome; solo nome e cognome.
 *  Più schede allo stesso criterio (omonimi, CF doppio) = quel criterio non decide, si passa al successivo;
 *  alla fine, nessuna scheda: la fattura resta senza (il caso supportato di «un'altra fattura»). Non crea e non modifica schede.
 *  shortcut: il nome della scheda lo spezza chi chiama; qui il confronto è per parole, quindi regge «Rossi Mario» e «Mario Rossi». */
export function abbinaScheda(campi: CampiRiga, telefono: string, schede: SchedaPerAbbinamento[]): AbbinamentoScheda {
  const miaCf = cf(campi.codiceFiscale);
  const unica = (trovate: SchedaPerAbbinamento[]) => (trovate.length === 1 ? trovate[0] : null);
  const cfDiverso = (s: SchedaPerAbbinamento): Motivo[] =>
    miaCf && cf(s.codiceFiscale) && cf(s.codiceFiscale) !== miaCf
      ? [{
          codice: "scheda_cf_diverso",
          gravita: "conferma",
          campo: "codiceFiscale",
          testo: "La scheda collegata ha un codice fiscale diverso da quello letto: può essere un errore di lettura o la scheda sbagliata. Controlla, oppure cambia o togli il collegamento.",
        }]
      : [];

  // 1. Codice fiscale.
  const perCf = miaCf ? unica(schede.filter((s) => cf(s.codiceFiscale) === miaCf)) : null;
  if (perCf) return { scheda: perCf, motivi: [] };

  // 2. Telefono + cognome compatibile.
  const mioTel = ultime9(telefono);
  const mioCognome = parole(campi.cognome);
  const perTelefono =
    mioTel && mioCognome.length
      ? unica(
          schede.filter((s) => {
            const sue = parole(`${s.nome} ${s.cognome}`);
            return ultime9(s.telefono) === mioTel && mioCognome.every((p) => sue.includes(p));
          }),
        )
      : null;
  if (perTelefono) return { scheda: perTelefono, motivi: cfDiverso(perTelefono) };

  // 3. Solo nome e cognome (almeno due parole: un cognome solo non identifica nessuno).
  const mioNome = nomeChiave(campi.nome, campi.cognome);
  const perNome = mioNome.includes(" ") ? unica(schede.filter((s) => nomeChiave(s.nome, s.cognome) === mioNome)) : null;
  if (perNome)
    return {
      scheda: perNome,
      motivi: [
        {
          codice: "scheda_solo_nome",
          gravita: "conferma",
          testo: "Scheda collegata solo per il nome e il cognome (nessun altro dato in comune): controlla che sia la stessa persona, oppure cambia o togli il collegamento.",
        },
        ...cfDiverso(perNome),
      ],
    };

  // 4. Nessuna.
  return { scheda: null, motivi: [] };
}
