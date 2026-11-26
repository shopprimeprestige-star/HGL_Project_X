/** ── LE VARIANTI IN TABELLA: LE AZIONI SUL SERVER (scheda/varianti-azioni.ts) ───────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E8. Le scritture di `EditorVarianti` senza schermo, così si provano contro il server vero (con il
 *  database finto) senza disegnare niente: salvare le righe cambiate, «Imposta il prezzo di tutte», «Imposta lo stock di tutte».
 *  ⚠️ Una variante non si cancella: qui non c'è nessuna chiamata che la tolga, solo `variante_attiva`. Una riga alla volta; se l'errore è di
 *  sessione, permesso, migrazione o rete ci si ferma (riprovare con la riga dopo è inutile) e si dice quali righe sono rimaste fuori. */
import type { ErroreNegozio } from "@/crm/negozio/client";
import type { OpzioneInput, Variante } from "@/shop/cms/modello";
import type { Negozio } from "../tipi";
import { prezzoVarianteDaTesto, quantitaDaTesto } from "../scheda-pura";
import type { MotivoGiacenza } from "../semplice-puro";
import type { LavoroRiga } from "./varianti-puro";

export type Esito = { tono: "ok" | "errore"; testo: string } | null;
type Esegui = Negozio["esegui"];

/** Dopo questi errori riprovare con la riga dopo è inutile: l'operazione si ferma. */
const FERMANO = ["sessione", "permesso", "migrazione", "rete"];

const righeDi = (n: number) => (n === 1 ? "1 riga" : `${n} righe`);

export const errore = (e: ErroreNegozio): Esito => ({ tono: "errore", testo: e.messaggio });

/** Esegue `f` su ogni riga, una alla volta, e riassume: «Fatto per N righe su M. Rimaste fuori: …». `ok` è la frase se tutte vanno bene. */
async function perOgniRiga<T extends { nome: string }>(
  righe: readonly T[],
  f: (r: T) => Promise<ErroreNegozio | null>,
  ok: (fatte: number) => string,
): Promise<Esito> {
  const fuori: string[] = [];
  let fatte = 0;
  let fermo = false;
  for (const r of righe) {
    if (fermo) {
      fuori.push(`${r.nome}: non l'ho provata, l'operazione si è fermata prima`);
      continue;
    }
    const e = await f(r);
    if (!e) fatte++;
    else {
      fuori.push(`${r.nome}: ${e.messaggio}`);
      if (FERMANO.includes(e.tipo)) fermo = true;
    }
  }
  return fuori.length
    ? {
        tono: "errore",
        testo: `Fatto per ${fatte} righe su ${righe.length}. Rimaste fuori: ${fuori.join(" · ")}.`,
      }
    : { tono: "ok", testo: ok(fatte) };
}

/** Salva le righe cambiate: i campi con `variante_salva`, poi i pezzi con `giacenza_imposta`. Ritorna anche gli id andati a buon fine. */
export async function salvaRighe(
  esegui: Esegui,
  prodottoId: string,
  lavori: readonly { v: Variante; lavoro: LavoroRiga }[],
  pubblicato: boolean,
): Promise<{ esito: Esito; fatte: string[] }> {
  const fatte: string[] = [];
  const esito = await perOgniRiga(
    lavori.map((l) => ({ ...l, nome: l.v.nome })),
    async ({ v, lavoro }) => {
      if (lavoro.campi) {
        const r = await esegui("variante_salva", {
          prodottoId,
          variante: { id: v.id, ...lavoro.campi },
        });
        if (!r.ok) return r.errore;
      }
      if (lavoro.giacenza) {
        const r = await esegui("giacenza_imposta", {
          varianteId: v.id,
          valore: lavoro.giacenza.valore,
          motivo: lavoro.giacenza.motivo,
        });
        if (!r.ok) return r.errore;
      }
      fatte.push(v.id);
      return null;
    },
    (n) =>
      `${n === 1 ? "Salvata" : "Salvate"} ${righeDi(n)}${pubblicato ? ": si vede già sul sito" : ""}.`,
  );
  return { esito, fatte };
}

/** «Imposta il prezzo di tutte»: scrive il prezzo su OGNI riga data (non lo lascia vuoto). Zero o testo storto = una frase, nessuna scrittura. */
export async function impostaPrezzoDiTutte(
  esegui: Esegui,
  prodottoId: string,
  righe: readonly Variante[],
  testo: string,
): Promise<Esito> {
  const p = prezzoVarianteDaTesto(testo);
  if (!p.ok || !p.cent)
    return { tono: "errore", testo: "Scrivi il prezzo in euro, per esempio 19,90." };
  const cent = p.cent;
  return perOgniRiga(
    righe,
    async (v) => {
      const r = await esegui("variante_salva", {
        prodottoId,
        variante: { id: v.id, prezzoCent: cent },
      });
      return r.ok ? null : r.errore;
    },
    (n) => `Prezzo impostato su ${righeDi(n)}.`,
  );
}

/** «Imposta lo stock di tutte»: ogni riga arriva a quel numero di pezzi, con un movimento registrato e il motivo scelto. */
export async function impostaStockDiTutte(
  esegui: Esegui,
  righe: readonly Variante[],
  testo: string,
  motivo: MotivoGiacenza,
): Promise<Esito> {
  const q = quantitaDaTesto(testo);
  if (!q.ok) return { tono: "errore", testo: "Scrivi i pezzi come numero intero, da 0 in su." };
  return perOgniRiga(
    righe,
    async (v) => {
      const r = await esegui("giacenza_imposta", { varianteId: v.id, valore: q.n, motivo });
      return r.ok ? null : r.errore;
    },
    (n) => `Giacenza impostata a ${q.n} su ${righeDi(n)}.`,
  );
}

/**
 * «Crea le varianti»: genera le combinazioni nuove (prezzo vuoto: vale il prezzo di base, NON si scrive il prezzo su ogni riga da soli).
 * `unicaDaSpegnere` = la variante «Unica» del prodotto che era semplice: passando alle opzioni si spegne (non si cancella).
 */
export async function generaVarianti(
  esegui: Esegui,
  prodottoId: string,
  opzioni: OpzioneInput[],
  unicaDaSpegnere: Variante | null,
): Promise<Esito> {
  const r = await esegui("varianti_genera", { prodottoId, opzioni });
  if (!r.ok) return errore(r.errore);
  const n = Array.isArray(r.dati.create) ? r.dati.create.length : 0;
  let frase = n === 1 ? "Ho creato 1 variante nuova." : `Ho creato ${n} varianti nuove.`;
  if (n > 0 && unicaDaSpegnere) {
    const s = await esegui("variante_attiva", {
      prodottoId,
      varianteId: unicaDaSpegnere.id,
      attiva: false,
    });
    frase += s.ok
      ? " La variante unica è stata spenta."
      : ` Non sono riuscito a spegnere la variante unica: ${s.errore.messaggio}`;
  }
  return { tono: "ok", testo: `${frase} Il prezzo è vuoto: vale il prezzo di base.` };
}
