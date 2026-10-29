/** ── LE CINQUE SEZIONI DEL MENU «ALTRO» ────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Le tre linguette (In attesa,
 *  Fissati da me) e la fila «Già lavorati» spariscono dalla pagina: ogni cosa
 *  resta raggiungibile da «Altro», in due tocchi (Altro, voce).
 *    In attesa · Fissati da me · Già lavorati · Liste · Strumenti
 *
 *  ⚠️ NESSUNA SECONDA LISTA: le voci vengono da `LINGUETTE`, `ALTRO` e
 *   `ALTRO_FILTRATE` di reparti.ts, quelle che la prova dei reparti già
 *   controlla. Una voce nuova in `ALTRO` compare da sola in «Strumenti» (o in
 *   «Liste» se apre «Tutta la lista»).
 *  ⚠️ «Già lavorati» mostra solo gli stati con qualcuno dentro, come prima: la
 *   pagina passa gli stati già contati (`giaLavorati`).
 *  ⚠️ Carica e Assegna hanno `richiede`: le vede solo chi ha il permesso.
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL, type LeadStatus } from "../types";
import type { ViaOrigine } from "./origine";
import { ALTRO, ALTRO_FILTRATE, LINGUETTE, type Vista, type VoceAltro } from "./reparti";

export type AzioneAltro =
  | { vista: Vista; filtro?: { origine: ViaOrigine }; statoTutti?: LeadStatus }
  | { href: string }
  | { pannello: "carica" | "assegna" | "scorciatoie" };

export type VoceAltro2 = {
  id: string;
  nome: string;
  titolo: string;
  azione: AzioneAltro;
  /** Il permesso che serve per vederla. */
  richiede?: "lead.crea" | "lead.assegna";
  /** Quanti ce ne sono, quando la voce lo dice (solo «Già lavorati»). */
  n?: number;
};

export type SezioneAltro = { titolo: string; voci: VoceAltro2[] };

const daLinguetta = (l: "attesa" | "miei"): VoceAltro2[] =>
  (LINGUETTE.find((x) => x.linguetta === l)?.viste ?? []).map((v) => ({
    id: `vista:${v.vista}`,
    nome: v.nome,
    titolo: v.titolo,
    azione: { vista: v.vista },
  }));

const daAltro = (v: VoceAltro, id: string): VoceAltro2 => ({
  id,
  nome: v.nome,
  titolo: v.titolo,
  azione: v.href
    ? { href: v.href }
    : { vista: v.vista as Vista, ...(v.filtro ? { filtro: v.filtro } : {}) },
});

export function sezioniAltro(o: {
  giaLavorati: { stato: LeadStatus; n: number }[];
}): SezioneAltro[] {
  const tutte = ALTRO.filter((x) => x.vista === "tutti").map((x) => daAltro(x, `vista:${x.vista}`));
  const strumenti = ALTRO.filter((x) => x.vista !== "tutti").map((x) =>
    daAltro(x, x.href ? `href:${x.href}` : `vista:${x.vista}`),
  );
  const sezioni: SezioneAltro[] = [
    { titolo: "In attesa", voci: daLinguetta("attesa") },
    { titolo: "Fissati da me", voci: daLinguetta("miei") },
    {
      titolo: "Già lavorati",
      voci: o.giaLavorati
        .filter((g) => g.n > 0)
        .map((g) => ({
          id: `gia:${g.stato}`,
          nome: LEAD_STATUS_LABEL[g.stato] ?? g.stato,
          titolo: `Apri l'elenco dei lead importati con stato «${LEAD_STATUS_LABEL[g.stato] ?? g.stato}»`,
          azione: { vista: "tutti", statoTutti: g.stato },
          n: g.n,
        })),
    },
    {
      titolo: "Liste",
      voci: [
        ...tutte,
        ...ALTRO_FILTRATE.map((x) => daAltro(x, `filtrata:${x.filtro?.origine ?? x.vista}`)),
        {
          id: "pannello:carica",
          nome: "Carica una lista",
          titolo: "Leggi un file di contatti e scrivili in archivio, dopo l'anteprima",
          azione: { pannello: "carica" },
          richiede: "lead.crea",
        },
        {
          id: "pannello:assegna",
          nome: "Assegna",
          titolo: "Dividi le schede senza padrone fra i consulenti",
          azione: { pannello: "assegna" },
          richiede: "lead.assegna",
        },
      ],
    },
    {
      titolo: "Strumenti",
      voci: [
        ...strumenti,
        {
          id: "pannello:scorciatoie",
          nome: "Scorciatoie da tastiera",
          titolo: "I tasti 1…4, S, A e / per lavorare senza il mouse",
          azione: { pannello: "scorciatoie" },
        },
      ],
    },
  ];
  return sezioni.filter((s) => s.voci.length > 0);
}

/** Quanti tocchi servono dalla pagina: sempre due, «Altro» e la voce. */
export function tocchiPerRaggiungere(v: VoceAltro2): number {
  void v;
  return 2;
}
