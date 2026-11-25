/** ── LA SCHEDA «EMAIL» DEL CRM (ModelliEmail.tsx) ───────────────────────────────────────────
 *  Shop completo R2, T66 (PIANO-R2 D53, SPEC 8A n. 2, 3, 4). Sostituisce il segnaposto di T62 tenendo nome e props.
 *  Sta in `/CRM/ecommerce?scheda=email`. Il permesso è «impostazioni» e lo decide il SERVER (rotta `/api/crm/negozio-email`, T57):
 *  al primo 403 si chiama `onNegato()` e il guscio toglie la linguetta. Qui non c'è nessuna rotta nuova e nessun controllo di permesso.
 *
 *  Per ognuno dei cinque messaggi: oggetto e testo da modificare, le variabili che si possono usare, lo stato («Spenta/Accesa»,
 *  «Approvata da… il…»), «Salva», «Approva», l'interruttore e un'anteprima con dati INVENTATI.
 *   · I testi dei clienti non stanno qui: li scrive e li approva il titolare. Quelli di base sono solo segnaposto «{{da confermare}}».
 *   · «Approva» manda l'impronta del testo che si è VISTO (`modello.impronta`): se un'altra persona l'ha cambiato nel frattempo il
 *     server risponde «conflitto» e non approva niente. Il nome di chi approva lo scrive il server.
 *   · Salvare spegne il messaggio e toglie l'approvazione (lo fa il database): la schermata lo dice PRIMA, mentre si scrive.
 *   · L'interruttore si accende solo con un testo salvato, approvato e senza segnaposto o variabili fuori elenco (la stessa regola
 *     dell'invio, `messaggioInviabile`); spegnere si può sempre. Il server controlla comunque.
 *   · «saltata» (la conferma su un ordine annullato non parte) è una scelta del sistema, non un guasto: la scheda lo dice.
 *
 *  ── COME È FATTA ─────────────────────────────────────────────────────────────
 *  Le funzioni qui sotto sono pure (si provano con il server vero di T54, prove/ecommerce/email-schermata.mjs). `VistaModelli`
 *  disegna e basta; `ModelliEmail` tiene lo stato. La lettura parte quando la scheda si disegna, cioè solo aprendo la linguetta.
 *  Nessuna parola «Elimina»: si scrive, si approva, si accende e si spegne. Nessun log. */
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Chip, Vuoto } from "@/crm/ui";
import { Avviso } from "@/crm/ecommerce/Avviso";
import {
  chiamaRotta,
  type ErroreR2,
  type EsitoRotta,
  type FetchRotta,
} from "@/crm/ecommerce/pagina-r2";
import { componi } from "@/shop/email/compone";
import { FRASI_MOTIVO } from "@/shop/email/frasi-motivo";
import { impronta, messaggioInviabile } from "@/shop/email/inviabile";
import {
  CHIAVI_EMAIL,
  VARIABILI_NOTE,
  VARIABILI_PER_CHIAVE,
  type ChiaveEmail,
  type MotivoNonInviabile,
} from "@/shop/email/tipi";

/* ══ I DATI ══════════════════════════════════════════════════════════════════ */

export const URL_EMAIL = "/api/crm/negozio-email";

/** Come ogni messaggio si chiama nella schermata (senza apostrofi: il nome entra nelle etichette dei comandi). */
const ETICHETTE: Record<ChiaveEmail, string> = {
  conferma_ordine: "Conferma ordine",
  spedito: "Ordine spedito",
  pagamento_non_riuscito: "Pagamento non riuscito",
  rimborso: "Rimborso effettuato",
  annullato: "Ordine annullato",
};
export const etichettaDi = (chiave: ChiaveEmail): string => ETICHETTE[chiave];

/** Quando parte: solo il fatto che la fa partire, nessuna promessa di tempi. */
const QUANDO: Record<ChiaveEmail, string> = {
  conferma_ordine:
    "Parte quando il pagamento di un ordine è andato a buon fine. Su un ordine annullato non parte: è una scelta del sistema, non un guasto.",
  spedito: "Parte quando l'ordine passa a «spedito» dalla scheda dell'ordine.",
  pagamento_non_riuscito: "Parte quando Stripe dice che il pagamento non è riuscito.",
  rimborso: "Parte quando Stripe conferma un rimborso.",
  annullato: "Parte quando un ordine già incassato viene annullato.",
};

const FRASE_SALVA_PRIMA =
  "Salva prima le modifiche al testo: l'email si accende solo con un testo salvato e approvato.";
const FRASE_DA_APPROVARE =
  "Il testo non è approvato: leggilo, premi «Approva» e poi accendi l'email.";
const FRASE_GIA_APPROVATO = "Il testo è già approvato.";

export type Contenuto = { ok: true } | { ok: false; motivo: MotivoNonInviabile };

/** Un modello come lo dà il server (`email.server.ts`): si copiano solo i campi noti. */
export interface ModelloVista {
  chiave: ChiaveEmail;
  oggetto: string;
  testo: string;
  acceso: boolean;
  approvato: boolean;
  approvatoDa: string | null;
  approvatoIl: string | null;
  /** La versione che si è vista: si rimanda com'è arrivata per salvare (il server confronta). */
  aggiornatoIl: string | null;
  /** L'impronta del testo visto: è quello che «Approva» manda. */
  impronta: string;
  contenuto: Contenuto;
}
export type Bozza = { oggetto: string; testo: string };
type Variabili = Record<ChiaveEmail, readonly string[]>;

const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const eChiave = (v: unknown): v is ChiaveEmail =>
  typeof v === "string" && (CHIAVI_EMAIL as readonly string[]).includes(v);
const MOTIVI = Object.keys(FRASI_MOTIVO);

/** Un modello del server, copiato campo per campo; `null` se non è fatto come ci si aspetta (non entra). */
export function leggiModello(raw: unknown): ModelloVista | null {
  if (!eOggetto(raw) || !eChiave(raw.chiave)) return null;
  if (typeof raw.oggetto !== "string" || typeof raw.testo !== "string") return null;
  if (typeof raw.impronta !== "string" || !/^[0-9a-f]{64}$/.test(raw.impronta)) return null;
  const k = raw.contenuto;
  if (!eOggetto(k) || typeof k.ok !== "boolean") return null;
  if (!k.ok && !(typeof k.motivo === "string" && MOTIVI.includes(k.motivo))) return null;
  const data = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);
  return {
    chiave: raw.chiave,
    oggetto: raw.oggetto,
    testo: raw.testo,
    acceso: raw.acceso === true,
    approvato: raw.approvato === true,
    approvatoDa:
      raw.approvato === true && typeof raw.approvatoDa === "string"
        ? raw.approvatoDa.slice(0, 80)
        : null,
    approvatoIl: raw.approvato === true ? data(raw.approvatoIl) : null,
    aggiornatoIl: data(raw.aggiornatoIl),
    impronta: raw.impronta,
    contenuto: k.ok ? { ok: true } : { ok: false, motivo: k.motivo as MotivoNonInviabile },
  };
}

const errore = (tipo: ErroreR2["tipo"], messaggio: string): ErroreR2 => ({
  ok: false,
  tipo,
  messaggio,
});
const post = (corpo: Record<string, unknown>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

/** Le variabili ammesse di ogni messaggio: quelle del server, ma solo nomi che conosciamo; se mancano, l'elenco del modulo puro. */
function leggiVariabili(raw: unknown): Variabili {
  const r = eOggetto(raw) ? raw : {};
  return Object.fromEntries(
    CHIAVI_EMAIL.map((k) => {
      const v = r[k];
      const elenco = Array.isArray(v)
        ? v.filter(
            (x): x is string =>
              typeof x === "string" && (VARIABILI_NOTE as readonly string[]).includes(x),
          )
        : null;
      return [k, elenco ?? VARIABILI_PER_CHIAVE[k]];
    }),
  ) as Variabili;
}

/** `GET ?modelli`: i modelli (nell'ordine fisso) e le variabili. Non lancia mai. */
export async function caricaModelli(
  f: FetchRotta,
): Promise<{ ok: true; modelli: ModelloVista[]; variabili: Variabili } | ErroreR2> {
  const r = await chiamaRotta(f, `${URL_EMAIL}?modelli`);
  if (!r.ok) return r;
  if (!Array.isArray(r.dati.modelli))
    return errore("server", "Qualcosa non ha funzionato: riprova tra un momento.");
  const modelli = r.dati.modelli.flatMap((m) => leggiModello(m) ?? []);
  return { ok: true, modelli, variabili: leggiVariabili(r.dati.variabili) };
}

/** Dopo una scrittura il server rimanda il modello riletto (può mancare se la rilettura è fallita: la schermata rilegge tutto). */
export type EsitoModello = { ok: true; modello: ModelloVista | null } | ErroreR2;
const conModello = (r: EsitoRotta): EsitoModello =>
  r.ok ? { ok: true, modello: leggiModello(r.dati.modello) } : r;

/** `modello_salva`: oggetto e testo nuovi, con la versione che si è vista (`atteso`). Spegne e toglie l'approvazione. */
export async function salvaModello(
  f: FetchRotta,
  m: ModelloVista,
  bozza: Bozza,
): Promise<EsitoModello> {
  const oggetto = bozza.oggetto.trim();
  const testo = bozza.testo.trim();
  if (!m.aggiornatoIl || !oggetto || !testo)
    return errore(
      "valore",
      "Servono la versione che vedi, l'oggetto e il testo: ricarica la scheda.",
    );
  return conModello(
    await chiamaRotta(
      f,
      URL_EMAIL,
      post({ azione: "modello_salva", chiave: m.chiave, atteso: m.aggiornatoIl, oggetto, testo }),
      true,
    ),
  );
}

/** `modello_approva`: l'impronta è quella del testo che si è visto, non quella di oggi. */
export async function approvaModello(f: FetchRotta, m: ModelloVista): Promise<EsitoModello> {
  const p = puoApprovare(m, false);
  if (!p.ok) return errore("rifiutato", p.frase);
  return conModello(
    await chiamaRotta(
      f,
      URL_EMAIL,
      post({ azione: "modello_approva", chiave: m.chiave, impronta: m.impronta }),
      true,
    ),
  );
}

/** `modello_acceso`. Accendere un testo che non si può mandare non parte nemmeno; spegnere sì, sempre. */
export async function accendiModello(
  f: FetchRotta,
  m: ModelloVista,
  acceso: boolean,
): Promise<EsitoModello> {
  if (acceso) {
    const p = puoAccendere(m, false);
    if (!p.ok) return errore("rifiutato", p.frase);
  }
  return conModello(
    await chiamaRotta(
      f,
      URL_EMAIL,
      post({ azione: "modello_acceso", chiave: m.chiave, acceso }),
      true,
    ),
  );
}

/** Al primo 403 chiama `onNegato` (una volta sola) e restituisce l'esito com'è: il permesso lo decide il server, la scheda non lo indovina.
 *  Un 401 (sessione scaduta) non toglie la linguetta: basta rientrare. */
export function creaGuardia(onNegato?: () => void) {
  let fatto = false;
  return <T extends { ok: true } | ErroreR2>(r: T): T => {
    if (!r.ok && r.tipo === "permesso" && !fatto) {
      fatto = true;
      onNegato?.();
    }
    return r;
  };
}

/* ══ LE REGOLE (pure) ════════════════════════════════════════════════════════ */

/** Il testo che si sta scrivendo è diverso da quello salvato? (Il server salva senza spazi ai bordi: si confronta così.) */
export const eSporco = (m: ModelloVista, b: Bozza): boolean =>
  b.oggetto.trim() !== m.oggetto || b.testo.trim() !== m.testo;

/** Giudizio sul testo che si sta scrivendo: la stessa regola dell'invio (`messaggioInviabile`), come se fosse già acceso e approvato. */
export function giudizioBozza(
  chiave: ChiaveEmail,
  b: Bozza,
): { ok: true } | { ok: false; motivo: MotivoNonInviabile; frase: string } {
  const oggetto = b.oggetto.trim();
  const testo = b.testo.trim();
  const g = messaggioInviabile({
    chiave,
    oggetto,
    testo,
    acceso: true,
    approvato_hash: impronta(oggetto, testo),
  });
  return g.ok ? g : { ok: false, motivo: g.motivo, frase: FRASI_MOTIVO[g.motivo] };
}

type Permesso =
  | { ok: true }
  | { ok: false; frase: string; perche: "salva" | "contenuto" | "approva" };

/** L'interruttore si può accendere solo con un testo salvato, senza problemi e approvato. */
export function puoAccendere(m: ModelloVista, sporco: boolean): Permesso {
  if (sporco) return { ok: false, frase: FRASE_SALVA_PRIMA, perche: "salva" };
  if (!m.contenuto.ok)
    return { ok: false, frase: FRASI_MOTIVO[m.contenuto.motivo], perche: "contenuto" };
  if (!m.approvato) return { ok: false, frase: FRASE_DA_APPROVARE, perche: "approva" };
  return { ok: true };
}

/** «Approva» vale per il testo salvato: non con modifiche in sospeso, non con un problema nel testo, non se lo è già. */
export function puoApprovare(m: ModelloVista, sporco: boolean): Permesso {
  if (sporco)
    return {
      ok: false,
      frase: "Salva prima le modifiche: si approva il testo salvato.",
      perche: "salva",
    };
  if (!m.contenuto.ok)
    return { ok: false, frase: FRASI_MOTIVO[m.contenuto.motivo], perche: "contenuto" };
  if (m.approvato) return { ok: false, frase: FRASE_GIA_APPROVATO, perche: "approva" };
  return { ok: true };
}

/** L'interruttore è bloccato? Spento si può girare solo se si può accendere; acceso si può SEMPRE spegnere. */
export const interruttoreBloccato = (m: ModelloVista, sporco: boolean): boolean =>
  !m.acceso && !puoAccendere(m, sporco).ok;

/** L'avviso mentre si modifica: salvando, un messaggio acceso o approvato si spegne e perde l'approvazione. */
export function avvisoModifica(m: ModelloVista, b: Bozza): string | null {
  if (!eSporco(m, b)) return null;
  return m.acceso || m.approvato
    ? "Se salvi questa modifica l'email si spegne e l'approvazione si toglie: dopo il salvataggio il testo va riletto e approvato di nuovo."
    : "Dopo il salvataggio il testo va approvato prima di poter accendere l'email.";
}

/** Dati INVENTATI per l'anteprima: nessun cliente vero, nessun indirizzo vero (il dominio «.test» è riservato e non esiste). */
const DATI_ANTEPRIMA = {
  nome: "Giulia",
  ref: "HG-1042",
  totale: "€ 48,00",
  link_ordine: "https://esempio.test/shop/ordine/HG-1042",
  riepilogo_righe: "1 × Prodotto di esempio · € 24,00\n2 × Altro prodotto di esempio · € 12,00",
  indirizzo_spedizione: "Via di Esempio 1, 00000 Città",
  corriere: "Corriere di esempio",
  numero_tracking: "TRK-000123",
  link_tracking: "https://esempio.test/tracking/TRK-000123",
  importo_rimborso: "€ 24,00",
};

/** Il messaggio com'è con i dati inventati. Un segnaposto resta com'è (si vede che manca il testo vero) e si segnala. */
export function anteprimaDi(
  chiave: ChiaveEmail,
  b: Bozza,
): { oggetto: string; testo: string; segnaposto: boolean } {
  const m = componi({ chiave, oggetto: b.oggetto, testo: b.testo }, DATI_ANTEPRIMA);
  return {
    oggetto: m.oggetto,
    testo: m.testo,
    segnaposto: `${b.oggetto}${b.testo}`.includes("{{"),
  };
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ══ LA VISTA ════════════════════════════════════════════════════════════════ */

type Cosa = "salva" | "approva" | "acceso";
interface Esito {
  tono: "ok" | "errore";
  testo: string;
}

/** I testi che si stanno scrivendo e non sono ancora salvati (`bozze`), e il «mio testo» messo da parte quando un salvataggio va in conflitto (`miei`). */
export interface StatoBozze {
  bozze: Partial<Record<ChiaveEmail, Bozza>>;
  miei: Partial<Record<ChiaveEmail, Bozza>>;
}

/** Cosa succede ai testi dopo una scrittura. La bozza si azzera SOLO dopo un «Salva» riuscito (ciò che era scritto ora è salvato): accendere,
 *  spegnere e approvare non la toccano. Con un conflitto in «Salva» la bozza lascia il posto al testo riletto dell'altra persona e il mio
 *  testo resta da parte (`mia`), da rimettere o scartare a mano. Ogni altro errore lascia tutto com'è. */
export function dopoScrittura(
  s: StatoBozze,
  chiave: ChiaveEmail,
  cosa: Cosa,
  r: { ok: true } | { ok: false; tipo: string },
  mia?: Bozza,
): StatoBozze {
  if (cosa !== "salva") return s;
  if (r.ok)
    return {
      bozze: { ...s.bozze, [chiave]: undefined },
      miei: { ...s.miei, [chiave]: undefined },
    };
  if (r.tipo === "conflitto" && mia)
    return { bozze: { ...s.bozze, [chiave]: undefined }, miei: { ...s.miei, [chiave]: mia } };
  return s;
}
export const rimettiMio = (s: StatoBozze, chiave: ChiaveEmail): StatoBozze => ({
  bozze: { ...s.bozze, [chiave]: s.miei[chiave] },
  miei: { ...s.miei, [chiave]: undefined },
});
export const scartaMio = (s: StatoBozze, chiave: ChiaveEmail): StatoBozze => ({
  ...s,
  miei: { ...s.miei, [chiave]: undefined },
});

export interface PropsVistaModelli {
  /** `null` = non ancora letti. */
  modelli: ModelloVista[] | null;
  variabili: Variabili;
  /** Il testo che si sta scrivendo, per messaggio (se manca c'è quello salvato). */
  bozze: Partial<Record<ChiaveEmail, Bozza>>;
  /** Il mio testo non salvato dopo un conflitto (vedi `dopoScrittura`). */
  miei?: Partial<Record<ChiaveEmail, Bozza>>;
  lavoro: { chiave: ChiaveEmail; cosa: Cosa } | null;
  esiti: Partial<Record<ChiaveEmail, Esito>>;
  errore: string | null;
  onBozza: (chiave: ChiaveEmail, campo: keyof Bozza, valore: string) => void;
  onSalva: (chiave: ChiaveEmail) => void;
  onRipristina: (chiave: ChiaveEmail) => void;
  onRimetti?: (chiave: ChiaveEmail) => void;
  onScarta?: (chiave: ChiaveEmail) => void;
  onApprova: (chiave: ChiaveEmail) => void;
  onAcceso: (chiave: ChiaveEmail, acceso: boolean) => void;
  onRiprova: () => void;
}

const Attesa = () => (
  <div
    role="status"
    aria-busy="true"
    className="h-24 animate-pulse rounded-xl bg-muted/50 motion-reduce:animate-none"
  >
    <span className="sr-only">Controllo i testi delle email…</span>
  </div>
);

function Scheda({
  modello: m,
  bozza,
  variabili,
  occupato,
  inCorso,
  esito,
  mio,
  p,
}: {
  modello: ModelloVista;
  bozza: Bozza;
  variabili: readonly string[];
  occupato: boolean;
  inCorso: Cosa | null;
  esito: Esito | undefined;
  mio: Bozza | undefined;
  p: PropsVistaModelli;
}) {
  const nome = etichettaDi(m.chiave);
  const id = `email-${m.chiave}`;
  const sporco = eSporco(m, bozza);
  const giudizio = giudizioBozza(m.chiave, bozza);
  const accendere = puoAccendere(m, sporco);
  const approvare = puoApprovare(m, sporco);
  const bloccato = interruttoreBloccato(m, sporco);
  const avviso = avvisoModifica(m, bozza);
  const anteprima = anteprimaDi(m.chiave, bozza);
  const vuoto = !bozza.oggetto.trim() || !bozza.testo.trim();
  /** Il perché l'interruttore è spento. Con un problema nel testo lo dice già l'avviso sopra (nessuna frase doppia). */
  const perche =
    m.acceso || accendere.ok || accendere.perche === "contenuto" ? null : accendere.frase;
  const descrizioni = [`${id}-quando`, !giudizio.ok && `${id}-problema`, perche && `${id}-perche`]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby={`${id}-titolo`} className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <h2 id={`${id}-titolo`} className="text-[15px] font-semibold tracking-tight">
          {nome}
        </h2>
        <Chip tono={m.acceso ? "vinta" : "neutro"} punto>
          {m.acceso ? "Accesa" : "Spenta"}
        </Chip>
        <Chip tono={m.approvato ? "vinta" : "in_sospeso"} punto>
          {m.approvato ? "Testo approvato" : "Da approvare"}
        </Chip>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
        <p id={`${id}-quando`} className="text-[12.5px] text-muted-foreground">
          {QUANDO[m.chiave]}
        </p>
        <p className="text-[12.5px]">
          {m.approvato && m.approvatoDa ? (
            <>
              Approvata da <span className="font-medium">{m.approvatoDa}</span>
              {m.approvatoIl && (
                <span className="text-muted-foreground"> il {quando(m.approvatoIl)}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              Nessuna approvazione per il testo di oggi.
            </span>
          )}
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-oggetto`} className="text-[12.5px] font-medium">
            Oggetto
          </label>
          <Input
            id={`${id}-oggetto`}
            value={bozza.oggetto}
            maxLength={200}
            disabled={occupato}
            aria-label={`Oggetto: ${nome}`}
            className="h-11 text-base md:h-9 md:text-[13px]"
            onChange={(e) => p.onBozza(m.chiave, "oggetto", e.target.value)}
          />
          <label htmlFor={`${id}-testo`} className="mt-1 text-[12.5px] font-medium">
            Testo
          </label>
          <Textarea
            id={`${id}-testo`}
            value={bozza.testo}
            rows={8}
            maxLength={8000}
            disabled={occupato}
            aria-label={`Testo: ${nome}`}
            className="min-h-40 text-base leading-relaxed md:text-[13px]"
            onChange={(e) => p.onBozza(m.chiave, "testo", e.target.value)}
          />
          <p className="text-[12px] text-muted-foreground">
            Variabili che puoi usare, ognuna con una graffa per parte:{" "}
            {variabili.map((v) => (
              <code
                key={v}
                className="mr-1 rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]"
              >{`{${v}}`}</code>
            ))}
          </p>
          <p className="text-[12px] text-muted-foreground">
            Una graffa rimasta sola o una parola tra graffe che non è in elenco blocca l'accensione.
          </p>
        </div>

        {!giudizio.ok && (
          <div id={`${id}-problema`}>
            <Avviso>{giudizio.frase}</Avviso>
          </div>
        )}
        {avviso && <Avviso>{avviso}</Avviso>}
        {mio && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
            <h3 className="text-[12.5px] font-semibold">Il tuo testo non salvato</h3>
            <p className="text-[12px]">
              Un'altra persona ha cambiato questo messaggio mentre scrivevi: qui sopra c'è il suo
              testo. Il tuo non è stato salvato.
            </p>
            <p className="mt-2 text-[13px] font-medium">{mio.oggetto}</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{mio.testo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                disabled={occupato}
                aria-label={`Rimetti il mio testo: ${nome}`}
                onClick={() => p.onRimetti?.(m.chiave)}
              >
                Rimetti il mio testo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                disabled={occupato}
                aria-label={`Scarta il mio testo: ${nome}`}
                onClick={() => p.onScarta?.(m.chiave)}
              >
                Scarta il mio testo
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="min-h-11 text-[12.5px] sm:min-h-8"
            disabled={occupato || !sporco || vuoto}
            aria-label={`Salva ${nome}`}
            onClick={() => p.onSalva(m.chiave)}
          >
            {inCorso === "salva" ? "Salvo…" : "Salva"}
          </Button>
          {sporco && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 text-[12.5px] sm:min-h-8"
              disabled={occupato}
              aria-label={`Annulla le modifiche: ${nome}`}
              onClick={() => p.onRipristina(m.chiave)}
            >
              Annulla le modifiche
            </Button>
          )}
          {!m.approvato && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 text-[12.5px] sm:min-h-8"
              disabled={occupato || !approvare.ok}
              aria-label={`Approva ${nome}`}
              onClick={() => p.onApprova(m.chiave)}
            >
              {inCorso === "approva" ? "Approvo…" : "Approva"}
            </Button>
          )}
          <div className="ml-auto flex min-h-11 items-center gap-2">
            <label htmlFor={`${id}-interruttore`} className="text-[12.5px] font-medium">
              Email attiva
            </label>
            <Switch
              id={`${id}-interruttore`}
              disabled={occupato || bloccato}
              checked={m.acceso}
              onCheckedChange={(v) => p.onAcceso(m.chiave, v)}
              aria-label={`Email attiva: ${nome}`}
              aria-describedby={descrizioni}
              className="h-7 w-12 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
            />
          </div>
        </div>
        {perche && (
          <p id={`${id}-perche`} className="text-[12.5px] text-amber-900">
            {perche}
          </p>
        )}
        {esito &&
          (esito.tono === "ok" ? (
            <p role="status" className="flex items-start gap-1.5 text-[12.5px] text-emerald-800">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {esito.testo}
            </p>
          ) : (
            <Avviso errore>{esito.testo}</Avviso>
          ))}

        <div className="rounded-lg border border-dashed border-border bg-background/60 px-3 py-2.5">
          <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Anteprima con dati inventati
          </h3>
          <p className="text-[11.5px] text-muted-foreground">
            Serve solo a vedere dove cadono le variabili: nome, numero ordine e importi non sono di
            nessun cliente.
          </p>
          <p className="mt-2 text-[13px] font-medium">{anteprima.oggetto || "—"}</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">
            {anteprima.testo || "—"}
          </p>
          {anteprima.segnaposto && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-amber-900">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Segnaposto: non si può approvare né accendere finché c'è.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function VistaModelli(p: PropsVistaModelli) {
  if (p.modelli === null)
    return (
      <div className="flex flex-col gap-4">
        {p.errore ? (
          <Avviso
            errore
            azione={
              <Button
                size="sm"
                variant="outline"
                className="h-11 text-[12px] md:h-8"
                onClick={p.onRiprova}
              >
                Riprova
              </Button>
            }
          >
            {p.errore}
          </Avviso>
        ) : (
          <Attesa />
        )}
      </div>
    );
  if (p.modelli.length === 0)
    return (
      <Vuoto
        icona={Mail}
        titolo="Non trovo i modelli delle email"
        testo="Nel database mancano i cinque modelli: chiedi a chi gestisce il database di applicare l'aggiornamento delle email."
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-[12.5px] text-muted-foreground">
        Le email al cliente parlano di ciò che ha ordinato. Ognuna parte solo con il testo approvato
        e l'interruttore acceso; salvare un testo nuovo la spegne e toglie l'approvazione. Sono
        tutte spente finché non le accendi tu.
      </p>
      {p.errore && <Avviso errore>{p.errore}</Avviso>}
      {p.modelli.map((m) => (
        <Scheda
          key={m.chiave}
          modello={m}
          bozza={p.bozze[m.chiave] ?? { oggetto: m.oggetto, testo: m.testo }}
          variabili={p.variabili[m.chiave]}
          occupato={p.lavoro !== null}
          inCorso={p.lavoro?.chiave === m.chiave ? p.lavoro.cosa : null}
          esito={p.esiti[m.chiave]}
          mio={p.miei?.[m.chiave]}
          p={p}
        />
      ))}
    </div>
  );
}

/* ══ LA SCHEDA ═══════════════════════════════════════════════════════════════ */

/** La scheda vera: lo stato e le chiamate. `fetch` è la `fetchCRM` della pagina; `onNegato` toglie la linguetta se il server dice 403. */
export function ModelliEmail({
  fetch: chiama,
  onNegato,
}: {
  fetch: FetchRotta;
  onNegato?: () => void;
}) {
  const [modelli, setModelli] = useState<ModelloVista[] | null>(null);
  const [variabili, setVariabili] = useState<Variabili>(VARIABILI_PER_CHIAVE);
  const [testi, setTesti] = useState<StatoBozze>({ bozze: {}, miei: {} });
  const [lavoro, setLavoro] = useState<PropsVistaModelli["lavoro"]>(null);
  const [esiti, setEsiti] = useState<PropsVistaModelli["esiti"]>({});
  const [erroreLettura, setErroreLettura] = useState<string | null>(null);
  const sequenza = useRef(0);
  const vivo = useRef(true);
  //  La guardia ricorda di aver già chiamato `onNegato`: si crea una volta sola e legge l'ultimo `onNegato` che il guscio ha dato.
  const negato = useRef(onNegato);
  negato.current = onNegato;
  const guardia = useRef<ReturnType<typeof creaGuardia> | null>(null);
  guardia.current ??= creaGuardia(() => negato.current?.());
  const guarda = <T extends { ok: true } | ErroreR2>(r: T): T => guardia.current!(r);

  const carica = useCallback(async () => {
    const n = ++sequenza.current;
    const r = guarda(await caricaModelli(chiama));
    if (!vivo.current || n !== sequenza.current) return; // una lettura più vecchia di un'altra non conta
    if (r.ok) {
      setModelli(r.modelli);
      setVariabili(r.variabili);
      setErroreLettura(null);
    } else {
      //  A chi non può non si lascia a schermo niente di una lettura precedente.
      if (r.tipo === "permesso" || r.tipo === "sessione") setModelli(null);
      setErroreLettura(r.messaggio);
    }
  }, [chiama]);

  useEffect(() => {
    vivo.current = true;
    void carica();
    return () => {
      vivo.current = false;
    };
  }, [carica]);

  /** Una scrittura su UN messaggio: il modello riletto prende il posto del vecchio; se manca, o c'è conflitto, si rilegge tutto. */
  async function scrivi(
    chiave: ChiaveEmail,
    cosa: Cosa,
    fatto: string,
    chiamata: () => Promise<EsitoModello>,
    mia?: Bozza,
  ) {
    setLavoro({ chiave, cosa });
    setEsiti((e) => ({ ...e, [chiave]: undefined }));
    const r = guarda(await chiamata());
    if (!vivo.current) return;
    setLavoro(null);
    setTesti((t) => dopoScrittura(t, chiave, cosa, r, mia));
    if (r.ok) {
      setEsiti((e) => ({ ...e, [chiave]: { tono: "ok", testo: fatto } }));
      if (r.modello)
        setModelli((lista) => lista?.map((m) => (m.chiave === chiave ? r.modello! : m)) ?? lista);
      else await carica();
      return;
    }
    setEsiti((e) => ({ ...e, [chiave]: { tono: "errore", testo: r.messaggio } }));
    //  Conflitto o rete incerta: si guarda com'è davvero. Con un conflitto il testo riletto è quello dell'altra persona e il mio resta da parte.
    if (r.tipo === "conflitto" || r.tipo === "rete") await carica();
  }

  return (
    <VistaModelli
      modelli={modelli}
      variabili={variabili}
      bozze={testi.bozze}
      miei={testi.miei}
      lavoro={lavoro}
      esiti={esiti}
      errore={erroreLettura}
      onBozza={(chiave, campo, valore) =>
        setTesti((t) => {
          const m = modelli?.find((x) => x.chiave === chiave);
          const base = t.bozze[chiave] ?? { oggetto: m?.oggetto ?? "", testo: m?.testo ?? "" };
          return { ...t, bozze: { ...t.bozze, [chiave]: { ...base, [campo]: valore } } };
        })
      }
      onSalva={(chiave) => {
        const m = modelli?.find((x) => x.chiave === chiave);
        const b = testi.bozze[chiave];
        if (m && b)
          void scrivi(
            chiave,
            "salva",
            m.acceso || m.approvato
              ? "Salvato. L'email è spenta e il testo va approvato di nuovo."
              : "Salvato. Ora va riletto e approvato.",
            () => salvaModello(chiama, m, b),
            b,
          );
      }}
      onRipristina={(chiave) =>
        setTesti((t) => ({ ...t, bozze: { ...t.bozze, [chiave]: undefined } }))
      }
      onRimetti={(chiave) => setTesti((t) => rimettiMio(t, chiave))}
      onScarta={(chiave) => setTesti((t) => scartaMio(t, chiave))}
      onApprova={(chiave) => {
        const m = modelli?.find((x) => x.chiave === chiave);
        if (m) void scrivi(chiave, "approva", "Testo approvato.", () => approvaModello(chiama, m));
      }}
      onAcceso={(chiave, acceso) => {
        const m = modelli?.find((x) => x.chiave === chiave);
        if (m)
          void scrivi(chiave, "acceso", acceso ? "L'email è accesa." : "L'email è spenta.", () =>
            accendiModello(chiama, m, acceso),
          );
      }}
      onRiprova={() => void carica()}
    />
  );
}
