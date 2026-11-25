/** ── IL FLUSSO DELL'IMPORT DEI PRODOTTI (importa-flusso.ts) ──────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E10 (SPEC §2.3, §6). La macchina a stati senza schermo: dai prodotti nuovi ai GRUPPI da inviare,
 *  l'avanzamento, la ripresa dopo un errore e il riepilogo. L'anteprima dal file sta in `importa-analisi.ts`, ri-esportata da qui.
 *  Le finestre (`FinestraImporta` e i tre passi) mostrano soltanto ciò che esce di qui, e si provano da sole.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Il file vive solo in memoria. Prima di «Importa» il server riceve SOLO la verifica (indirizzi e SKU, sola lettura): nessuna scrittura.
 *  · Un gruppo = al massimo 5 prodotti e 80 000 byte di richiesta (misurati in byte con `TextEncoder`, non in caratteri: gli accenti e l'euro
 *    ne pesano di più). Un prodotto che da solo supera gli 80 000 byte non parte e si dice a parte.
 *  · Ripresa: un gruppo andato a buon fine non si rimanda MAI. Quello interrotto (rete, server) si rimanda: il server dice «già presente»
 *    per ciò che era entrato, quindi non nasce nessun doppione.
 *  · Una risposta che non è nella forma del contratto non è un successo. Un prodotto senza risposta non risulta importato.
 *  ⚠️ Niente rete qui dentro: chi chiama passa `esegui` (quello di `negozio`). Nessun log, mai. */
import { righeDaCorreggere } from "@/crm/negozio/csv-errori";
import {
  LIMITI,
  type ErroreRiga,
  type ProdottoImport,
  type RisultatoImporta,
} from "@/crm/negozio/import-contratto";
import {
  FRASE_RISPOSTA,
  eOggetto,
  eTesto,
  type Analisi,
  type EsitoEsegui,
} from "./importa-analisi";

export * from "./importa-analisi";

export const AZIONE_IMPORTA = "prodotti_importa";
export const NOME_FILE_DA_CORREGGERE = "righe-da-correggere.csv";

const CENTO = 100;

/* ══ I GRUPPI ═══════════════════════════════════════════════════════════════ */

/** I byte della richiesta vera (`{azione, prodotti}` in JSON, come la manda il client). */
export const misuraRichiesta = (prodotti: readonly ProdottoImport[]): number =>
  new TextEncoder().encode(JSON.stringify({ azione: AZIONE_IMPORTA, prodotti })).length;

/** In ordine, mai oltre 5 prodotti e 80 000 byte per gruppo. `troppoGrandi`: quelli che da soli superano il tetto (non partono). */
export function dividiInGruppi(prodotti: readonly ProdottoImport[]): {
  gruppi: ProdottoImport[][];
  troppoGrandi: ProdottoImport[];
} {
  const gruppi: ProdottoImport[][] = [];
  const troppoGrandi: ProdottoImport[] = [];
  let corrente: ProdottoImport[] = [];
  for (const p of prodotti) {
    if (misuraRichiesta([p]) > LIMITI.byteClient) {
      troppoGrandi.push(p);
      continue;
    }
    const pieno =
      corrente.length >= LIMITI.prodottiPerRichiesta ||
      misuraRichiesta([...corrente, p]) > LIMITI.byteClient;
    if (corrente.length > 0 && pieno) {
      gruppi.push(corrente);
      corrente = [];
    }
    corrente.push(p);
  }
  if (corrente.length > 0) gruppi.push(corrente);
  return { gruppi, troppoGrandi };
}

/* ══ I GRUPPI IN VIAGGIO: AVANZAMENTO E RIPRESA ═════════════════════════════ */

export type StatoGruppo = "da_fare" | "fatto" | "interrotto";
export interface GruppoImporta {
  prodotti: ProdottoImport[];
  stato: StatoGruppo;
  /** Uno per prodotto, solo quando il gruppo è fatto. */
  risultati: RisultatoImporta[];
}
export interface Fermo {
  tipo: string;
  messaggio: string;
  /** Non so se l'ultimo gruppo sia entrato (rete, server): rimandandolo, ciò che c'era risulta «già presente». */
  incerto: boolean;
}
export interface StatoImporta {
  gruppi: GruppoImporta[];
  troppoGrandi: ProdottoImport[];
  fermo: Fermo | null;
}

export function avviaImporta(nuovi: readonly ProdottoImport[]): StatoImporta {
  const { gruppi, troppoGrandi } = dividiInGruppi(nuovi);
  return {
    gruppi: gruppi.map((prodotti) => ({ prodotti, stato: "da_fare", risultati: [] })),
    troppoGrandi,
    fermo: null,
  };
}

/** Il primo gruppo non ancora fatto (quello interrotto prima degli altri), o `null` se è finito. */
export function prossimoGruppo(s: StatoImporta): number | null {
  const i = s.gruppi.findIndex((g) => g.stato !== "fatto");
  return i < 0 ? null : i;
}

const cambia = (
  s: StatoImporta,
  i: number,
  g: Partial<GruppoImporta>,
  fermo: Fermo | null,
): StatoImporta => ({
  ...s,
  gruppi: s.gruppi.map((x, k) => (k === i ? { ...x, ...g } : x)),
  fermo,
});

export function registraFallimento(
  s: StatoImporta,
  i: number,
  errore: { tipo: string; messaggio: string },
): StatoImporta {
  // Un rifiuto che riprovando non cambia (richiesta troppo grande, dati non validi): i prodotti del gruppo sono respinti con la frase
  // del server e si va avanti, invece di far premere «Riprendi» all'infinito sullo stesso gruppo.
  if (errore.tipo === "valore") {
    const risultati = s.gruppi[i].prodotti.map(
      (p): RisultatoImporta => ({
        handle: p.handle,
        esito: "errore",
        errori: [
          {
            riga: p.varianti[0]?.riga ?? 0,
            handle: p.handle,
            frase: `Il server ha rifiutato questo gruppo di prodotti: ${errore.messaggio}`,
          },
        ],
      }),
    );
    return cambia(s, i, { stato: "fatto", risultati }, null);
  }
  const incerto = errore.tipo === "rete" || errore.tipo === "server";
  return cambia(
    s,
    i,
    { stato: "interrotto" },
    { tipo: errore.tipo, messaggio: errore.messaggio, incerto },
  );
}

/** Una risposta del server per il gruppo `i`: un risultato per ogni prodotto mandato; uno che manca è respinto, uno sconosciuto si ignora. */
export function registraRisposta(
  s: StatoImporta,
  i: number,
  dati: Record<string, unknown>,
): StatoImporta {
  const lista = dati.risultati;
  if (!Array.isArray(lista))
    return registraFallimento(s, i, { tipo: "server", messaggio: FRASE_RISPOSTA });
  const risultati = s.gruppi[i].prodotti.map((p): RisultatoImporta => {
    const riga = p.varianti[0]?.riga ?? 0;
    const r = lista.find((x) => eOggetto(x) && x.handle === p.handle);
    if (!eOggetto(r) || !["creato", "gia_presente", "errore"].includes(r.esito as string))
      return {
        handle: p.handle,
        esito: "errore",
        errori: [
          {
            riga,
            handle: p.handle,
            frase: "Il server non ha risposto per questo prodotto: non risulta importato.",
          },
        ],
      };
    if (r.esito !== "errore")
      return {
        handle: p.handle,
        esito: r.esito as "creato" | "gia_presente",
        prodottoId: eTesto(r.prodottoId) ? r.prodottoId : undefined,
      };
    const errori = (Array.isArray(r.errori) ? r.errori : [])
      .filter((e): e is Record<string, unknown> => eOggetto(e) && eTesto(e.frase))
      .map(
        (e): ErroreRiga => ({
          riga: typeof e.riga === "number" ? e.riga : riga,
          handle: p.handle,
          frase: e.frase as string,
        }),
      );
    return {
      handle: p.handle,
      esito: "errore",
      errori:
        errori.length > 0
          ? errori
          : [{ riga, handle: p.handle, frase: "Il server non ha accettato questo prodotto." }],
    };
  });
  return cambia(s, i, { stato: "fatto", risultati }, null);
}

/** «Interrompi»: i gruppi fatti restano fatti, quelli che mancano restano in coda. */
export const sospendi = (s: StatoImporta): StatoImporta => ({
  ...s,
  fermo: {
    tipo: "interrotto",
    messaggio:
      "Importazione interrotta. I prodotti già importati restano: premi «Riprendi» per continuare.",
    incerto: false,
  },
});

/** «Riprendi»: solo il gruppo interrotto torna in coda; i gruppi fatti non si toccano e non si rimandano. */
export const riprendi = (s: StatoImporta): StatoImporta => ({
  ...s,
  gruppi: s.gruppi.map((g) => (g.stato === "interrotto" ? { ...g, stato: "da_fare" as const } : g)),
  fermo: null,
});

export function avanzamento(s: StatoImporta): {
  gruppiFatti: number;
  gruppiTotali: number;
  prodottiFatti: number;
  prodottiTotali: number;
  percento: number;
} {
  const fatti = s.gruppi.filter((g) => g.stato === "fatto");
  const somma = (gruppi: GruppoImporta[]) => gruppi.reduce((n, g) => n + g.prodotti.length, 0);
  const prodottiFatti = somma(fatti);
  const prodottiTotali = somma(s.gruppi);
  // Mai 100 prima della fine: si arrotonda per difetto.
  return {
    gruppiFatti: fatti.length,
    gruppiTotali: s.gruppi.length,
    prodottiFatti,
    prodottiTotali,
    percento: prodottiTotali === 0 ? CENTO : Math.floor((prodottiFatti * CENTO) / prodottiTotali),
  };
}

/** Manda i gruppi uno dopo l'altro e si ferma al primo errore, oppure quando `interrompi()` dice di sì (dopo il gruppo in corso). */
export async function eseguiGruppi(
  inizio: StatoImporta,
  invia: (prodotti: ProdottoImport[]) => Promise<EsitoEsegui>,
  opz: { interrompi?: () => boolean; aggiorna?: (s: StatoImporta) => void } = {},
): Promise<StatoImporta> {
  let s = inizio;
  while (!s.fermo) {
    const i = prossimoGruppo(s);
    if (i === null) break;
    if (opz.interrompi?.()) {
      s = sospendi(s);
      opz.aggiorna?.(s);
      break;
    }
    let r: EsitoEsegui;
    try {
      r = await invia(s.gruppi[i].prodotti);
    } catch {
      r = {
        ok: false,
        errore: {
          tipo: "rete",
          messaggio:
            "Non so se l'ultimo gruppo sia stato importato: controlla la connessione e premi «Riprendi».",
        },
      };
    }
    s = r.ok ? registraRisposta(s, i, r.dati) : registraFallimento(s, i, r.errore);
    opz.aggiorna?.(s);
  }
  return s;
}

/* ══ IL RIEPILOGO ═══════════════════════════════════════════════════════════ */

export interface Riepilogo {
  importati: number;
  /** Già presenti: quelli visti all'anteprima più quelli che il server ha trovato già presenti. */
  saltati: number;
  respinti: number;
  /** Prodotti dei gruppi non ancora fatti (importazione interrotta). */
  rimasti: number;
  /** Tutti gli errori, anche quelli del server: servono a «Scarica le righe da correggere». */
  errori: ErroreRiga[];
}

export function riepilogoFinale(
  a: Pick<Analisi, "nuovi" | "giaPresenti" | "errori" | "nProdottiConErrori">,
  s: StatoImporta,
): Riepilogo {
  const errori = [...a.errori];
  let importati = 0;
  let saltati = a.giaPresenti.length;
  let respinti = a.nProdottiConErrori + s.troppoGrandi.length;
  let rimasti = 0;
  for (const g of s.gruppi) {
    if (g.stato !== "fatto") {
      rimasti += g.prodotti.length;
      continue;
    }
    for (const r of g.risultati) {
      if (r.esito === "creato") importati++;
      else if (r.esito === "gia_presente") saltati++;
      else {
        respinti++;
        const righeProdotto = g.prodotti
          .find((p) => p.handle === r.handle)
          ?.varianti.map((v) => v.riga);
        errori.push(...(r.errori ?? []).map((e) => ({ ...e, righeProdotto })));
      }
    }
  }
  for (const p of s.troppoGrandi)
    errori.push({
      riga: p.varianti[0]?.riga ?? 0,
      handle: p.handle,
      frase: "Il prodotto è troppo grande per essere inviato: accorcia i testi o dividilo.",
      righeProdotto: p.varianti.map((v) => v.riga),
    });
  return { importati, saltati, respinti, rimasti, errori };
}

/** «Importati N prodotti (tutti in bozza). Saltati N già presenti. Respinti N con errori.» */
export function fraseFinale(r: Pick<Riepilogo, "importati" | "saltati" | "respinti">): string {
  const importati =
    r.importati === 1
      ? "Importato 1 prodotto (in bozza)"
      : `Importati ${r.importati} prodotti (tutti in bozza)`;
  const saltati = r.saltati === 1 ? "Saltato 1 già presente" : `Saltati ${r.saltati} già presenti`;
  const respinti = r.respinti === 1 ? "Respinto 1 con errori" : `Respinti ${r.respinti} con errori`;
  return `${importati}. ${saltati}. ${respinti}.`;
}

/** C'è almeno una riga del file da correggere? (Un errore «di tutto il file» non ne ha: il file delle righe sarebbe vuoto.) */
export const haRigheDaCorreggere = (errori: readonly ErroreRiga[]): boolean =>
  errori.some((e) => e.riga >= 2 || (e.righeProdotto?.length ?? 0) > 0);

/** Il CSV con le sole righe respinte e la colonna «Errore»: stesso separatore del file caricato. */
export const csvDaCorreggere = (
  a: Pick<Analisi, "record" | "separatore">,
  r: Pick<Riepilogo, "errori">,
): string => righeDaCorreggere(a.record, r.errori, a.separatore);
