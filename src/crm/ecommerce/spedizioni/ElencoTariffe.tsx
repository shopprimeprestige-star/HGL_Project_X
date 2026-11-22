/** ── LA SCHEDA «SPEDIZIONI» DEL CRM (ElencoTariffe.tsx) ───────────────────────────────────────
 *  Shop completo R2, T65 (PIANO-R2 D51, D62; SPEC 7.4 n. 7). Sostituisce il segnaposto di T62, con lo stesso nome e le stesse props.
 *  Sta in `/CRM/ecommerce?scheda=spedizioni` (permesso `pagamenti`). Dice, in quest'ordine:
 *   0. un avviso: finché la cassa nuova non è accesa la tariffa vale solo per il carrello, la cassa di oggi usa ancora 4,90 €
 *      (decisione del capo progetto dopo la revisione di T59). Sparisce solo se `?cassa` dice `stripe`; se non si legge resta;
 *   1. la tariffa per l'Italia: nome, corriere, costo in EURO, tempi (vuoti = non si mostrano), attiva; «Provvisoria» finché non è
 *      confermata; «Conferma la tariffa»; e, senza una tariffa attiva, che la cassa Stripe resta chiusa;
 *   2. i corrieri, ognuno con il suo modello di link, e la prova «metti un numero e guarda il link»;
 *   3. l'interruttore «Spedizioni e resi sono scritti nelle pagine» (`resi_confermati`), che serve per aprire lo shop.
 *  Il campo «gratis da» di S5 non c'è: D51 lo ignora e il CRM non lo legge né lo scrive.
 *
 *  ── COME È FATTA ─────────────────────────────────────────────────────────────
 *  Nessuna rotta nuova: si parla solo con `/api/crm/negozio` (T50: `?spedizioni`, `tariffa_salva`, `tariffa_conferma`, `corrieri_salva`;
 *  T56: `?cassa` e `interruttore_imposta`) attraverso `chiamaRotta` di T62, che dà le frasi di errore e non lancia mai.
 *  Il costo si scrive in euro («4,90», «4.9») e al server va in centesimi interi, calcolati senza numeri a virgola.
 *  Ogni salvataggio manda la versione che si VEDEVA (`aggiornatoIl`, l'elenco dei corrieri, il valore dell'interruttore): se nel
 *  frattempo l'ha cambiata un'altra persona il server risponde 409 con la sua frase, e la scheda rilegge i valori veri.
 *  `VistaTariffe` disegna e basta (dati e funzioni dalle props: si prova con `react-dom/server`); `ElencoTariffe` tiene lo stato.
 *  Le funzioni pure stanno qui perché il compito ha un solo file di UI: se servono altrove si portano in un `*-puro.ts`.
 *  Nessuna parola di cancellazione: qui si salva e si spegne. Nessun log. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/crm/ui";
import { Avviso } from "@/crm/ecommerce/Avviso";
import { Riquadro } from "@/crm/ecommerce/Riquadro";
import {
  chiamaRotta,
  fraseSicura,
  urlCassa,
  type ErroreR2,
  type FetchRotta,
} from "@/crm/ecommerce/pagina-r2";
import { corriereLink } from "@/shop/cassa/spedizione";
import { cassaEffettiva } from "@/shop/cms/cassa-sito";

/* ══ I TIPI ══════════════════════════════════════════════════════════════════ */

/** La tariffa come la manda `GET ?spedizioni` (T50): soldi in centesimi, `aggiornatoIl` è la versione che si vede. */
export interface TariffaCrm {
  id: string;
  nome: string;
  corriere: string | null;
  costoCent: number;
  giorniMin: number | null;
  giorniMax: number | null;
  attiva: boolean;
  provvisoria: boolean;
  /** Come la vede il pubblico (D62): `false` finché il titolare non ha premuto «Conferma». */
  confermata: boolean;
  confermataIl: string | null;
  aggiornatoIl: string;
}
export interface Corriere {
  nome: string;
  modello: string;
}
export interface DatiSpedizioni {
  /** `null` = nessuna tariffa nel database. */
  tariffa: TariffaCrm | null;
  corrieri: Corriere[];
  /** `null` = il seme dell'interruttore non c'è (S5 non applicata) o non si è riuscito a leggerlo. */
  resi: boolean | null;
  /** La cassa che il sito usa DAVVERO (`cassaEffettiva`: `stripe` solo col catalogo `cms`), letta da `?cassa`; `null` = non si è riusciti a leggerla
   *  (l'avviso dei 4,90 € resta visibile). */
  cassa: "vecchia" | "stripe" | null;
  /** Il catalogo del sito letto da `?cassa`: con `codice` il carrello di oggi non legge la tariffa. `null` = non letto. */
  catalogo: "cms" | "codice" | null;
}

/* ══ LE FRASI E I LIMITI (gli stessi di T50: il server li rifà tutti) ════════ */

export const urlSpedizioni = "/api/crm/negozio?spedizioni";
const urlNegozio = "/api/crm/negozio";

export const FRASE_CASSA_OGGI =
  "Finché la cassa nuova non è accesa, la tariffa vale solo per il carrello: la cassa di oggi usa ancora 4,90 €.";
const FRASE_CATALOGO_CODICE =
  "Il catalogo del sito è ancora quello di prima: la tariffa non vale ancora né per il carrello né per la cassa, che usano ancora 4,90 €.";
const FRASE_CASSA_CHIUSA =
  "Senza una tariffa attiva la cassa Stripe resta chiusa: i clienti vedono «Il negozio sta per aprire» e non possono pagare.";
const FRASE_COSTO =
  "Scrivi il costo in euro, per esempio 4,90 (da 0 a 999 euro, al massimo due decimali).";
const FRASE_TEMPI =
  "I giorni vanno da 1 a 60, interi, con il minimo non oltre il massimo: scrivili tutti e due oppure lasciali vuoti.";
const COSTO_MAX_CENT = 99_900;
const NOME_MAX = 80;
const CORRIERE_MAX = 40;
const MAX_CORRIERI = 20;
const NOME_CORRIERE_MAX = 40;
const MODELLO_MAX = 300;

/* ══ IL COSTO: EURO A SCHERMO, CENTESIMI AL SERVER ═══════════════════════════ */

export type Importo = { ok: true; centesimi: number } | { ok: false; frase: string };

/** «4,90», «4.9», «5», « 4,90 € » → centesimi interi. Con la virgola o il punto, al massimo due decimali, da 0 a 999 euro.
 *  Tutto il resto è un errore con la frase: mai un arrotondamento in silenzio, mai un numero a virgola mobile. */
export function costoInCentesimi(testo: string): Importo {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(testo.replace(/€/g, "").trim());
  if (!m) return { ok: false, frase: FRASE_COSTO };
  const centesimi = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return centesimi > COSTO_MAX_CENT ? { ok: false, frase: FRASE_COSTO } : { ok: true, centesimi };
}

/** 490 → «4,90»: come si legge, con la virgola. */
export const centesimiInEuro = (cent: number): string =>
  `${Math.floor(cent / 100)},${String(cent % 100).padStart(2, "0")}`;

/* ══ IL MODULO DELLA TARIFFA ═════════════════════════════════════════════════ */

/** Quello che si scrive nei campi: tutto testo, come lo vede chi digita. */
export interface ModuloTariffa {
  nome: string;
  corriere: string;
  costo: string;
  giorniMin: string;
  giorniMax: string;
  attiva: boolean;
}
export const moduloDaTariffa = (t: TariffaCrm): ModuloTariffa => ({
  nome: t.nome,
  corriere: t.corriere ?? "",
  costo: centesimiInEuro(t.costoCent),
  giorniMin: t.giorniMin === null ? "" : String(t.giorniMin),
  giorniMax: t.giorniMax === null ? "" : String(t.giorniMax),
  attiva: t.attiva,
});

export interface CampiTariffa {
  nome: string;
  corriere: string | null;
  costoCent: number;
  giorniMin: number | null;
  giorniMax: number | null;
  attiva: boolean;
}
export type ErroriModulo = { nome?: string; corriere?: string; costo?: string; tempi?: string };
export type Verifica = { ok: true; campi: CampiTariffa } | { ok: false; errori: ErroriModulo };

const giorno = (t: string): number | null => {
  const s = t.trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 60 ? n : null;
};

/** Il modulo → i campi che vanno al server (costo in centesimi interi, tempi vuoti = `null`), oppure gli errori campo per campo. */
export function verificaModulo(m: ModuloTariffa): Verifica {
  const errori: ErroriModulo = {};
  const nome = m.nome.trim();
  if (!nome || nome.length > NOME_MAX)
    errori.nome = `Il nome della tariffa è obbligatorio e può avere al massimo ${NOME_MAX} caratteri.`;
  const corriere = m.corriere.trim();
  if (corriere.length > CORRIERE_MAX)
    errori.corriere = `Il corriere può avere al massimo ${CORRIERE_MAX} caratteri.`;
  const costo = costoInCentesimi(m.costo);
  if (!costo.ok) errori.costo = costo.frase;
  let giorniMin: number | null = null,
    giorniMax: number | null = null;
  if (m.giorniMin.trim() || m.giorniMax.trim()) {
    giorniMin = giorno(m.giorniMin);
    giorniMax = giorno(m.giorniMax);
    if (giorniMin === null || giorniMax === null || giorniMin > giorniMax)
      errori.tempi = FRASE_TEMPI;
  }
  if (Object.keys(errori).length || !costo.ok) return { ok: false, errori };
  return {
    ok: true,
    campi: {
      nome,
      corriere: corriere || null,
      costoCent: costo.centesimi,
      giorniMin,
      giorniMax,
      attiva: m.attiva,
    },
  };
}

/** C'è qualcosa di diverso da ciò che è salvato? «4,9» e «4,90» sono lo stesso importo; un costo che non si legge conta come cambiato. */
export function moduloCambiato(m: ModuloTariffa, t: TariffaCrm): boolean {
  const costo = costoInCentesimi(m.costo);
  return (
    m.nome.trim() !== t.nome ||
    m.corriere.trim() !== (t.corriere ?? "") ||
    !costo.ok ||
    costo.centesimi !== t.costoCent ||
    m.giorniMin.trim() !== (t.giorniMin === null ? "" : String(t.giorniMin)) ||
    m.giorniMax.trim() !== (t.giorniMax === null ? "" : String(t.giorniMax)) ||
    m.attiva !== t.attiva
  );
}

/* ══ I CORRIERI E IL LINK DI PROVA ═══════════════════════════════════════════ */

/** Una frase se l'elenco non va (il server rifà gli stessi controlli), altrimenti `null`. */
export function controllaCorrieri(elenco: readonly Corriere[]): string | null {
  if (elenco.length > MAX_CORRIERI) return `Al massimo ${MAX_CORRIERI} corrieri.`;
  const visti = new Set<string>();
  for (const { nome: grezzo, modello: m } of elenco) {
    const nome = grezzo.trim();
    const modello = m.trim();
    if (!nome || nome.length > NOME_CORRIERE_MAX)
      return `Ogni corriere ha un nome, al massimo ${NOME_CORRIERE_MAX} caratteri.`;
    if (visti.has(nome.toLowerCase())) return `Il corriere «${nome}» è scritto due volte.`;
    visti.add(nome.toLowerCase());
    if (modello.length > MODELLO_MAX)
      return `Il modello di link di «${nome}» può avere al massimo ${MODELLO_MAX} caratteri.`;
    if (modello && corriereLink([{ nome, modello }], nome, "1") === null)
      return `Il modello di link di «${nome}» deve cominciare con https:// e contenere {numero} (non nel nome del sito), senza spazi. Oppure lascialo vuoto.`;
  }
  return null;
}

/** «Metti un numero e guarda il link»: per ogni corriere il link che ne uscirebbe, o `null` (nessun modello, modello sbagliato, nessun numero). */
export const linkDiProva = (elenco: readonly Corriere[], numero: string) =>
  elenco.map((c) => ({
    nome: c.nome,
    modello: c.modello.trim(),
    link: numero.trim() ? corriereLink([c], c.nome, numero) : null,
  }));

const pulisci = (elenco: readonly Corriere[]): Corriere[] =>
  elenco.map((c) => ({ nome: c.nome.trim(), modello: c.modello.trim() }));
const stessoElenco = (a: readonly Corriere[], b: readonly Corriere[]): boolean =>
  JSON.stringify(pulisci(a)) === JSON.stringify(pulisci(b));

/* ══ LE CHIAMATE ═════════════════════════════════════════════════════════════ */

const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const intOrNull = (v: unknown): number | null | undefined =>
  v === null || v === undefined
    ? null
    : typeof v === "number" && Number.isSafeInteger(v)
      ? v
      : undefined;

/** Si copiano solo i campi noti. `undefined` = la risposta non si capisce; `null` = nessuna tariffa. */
function leggiTariffa(v: unknown): TariffaCrm | null | undefined {
  if (v === null) return null;
  if (!eOggetto(v)) return undefined;
  const giorniMin = intOrNull(v.giorniMin);
  const giorniMax = intOrNull(v.giorniMax);
  if (
    typeof v.id !== "string" ||
    typeof v.nome !== "string" ||
    typeof v.costoCent !== "number" ||
    !Number.isSafeInteger(v.costoCent) ||
    typeof v.attiva !== "boolean" ||
    typeof v.aggiornatoIl !== "string" ||
    giorniMin === undefined ||
    giorniMax === undefined
  )
    return undefined;
  return {
    id: v.id,
    nome: v.nome,
    corriere: typeof v.corriere === "string" && v.corriere ? v.corriere : null,
    costoCent: v.costoCent,
    giorniMin,
    giorniMax,
    attiva: v.attiva,
    provvisoria: v.provvisoria === true,
    confermata: v.confermata === true,
    confermataIl: typeof v.confermataIl === "string" ? v.confermataIl : null,
    aggiornatoIl: v.aggiornatoIl,
  };
}
function leggiCorrieri(v: unknown): Corriere[] | null {
  if (!Array.isArray(v)) return null;
  const elenco: Corriere[] = [];
  for (const x of v) {
    if (!eOggetto(x) || typeof x.nome !== "string") return null;
    elenco.push({ nome: x.nome, modello: typeof x.modello === "string" ? x.modello : "" });
  }
  return elenco;
}

const errore = (tipo: ErroreR2["tipo"], messaggio: string): ErroreR2 => ({
  ok: false,
  tipo,
  messaggio,
});
const FRASE_SERVER = "Qualcosa non ha funzionato: riprova tra un momento.";
const scrivi = (f: FetchRotta, corpo: Record<string, unknown>) =>
  chiamaRotta(
    f,
    urlNegozio,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    },
    true, // se la rete cade non si sa se è stato scritto: la frase lo dice
  );

/** La scheda: la tariffa e i corrieri (`?spedizioni`) e l'interruttore dei resi (`?cassa`). Un guasto sui soli resi non nasconde il resto. */
export async function caricaSpedizioni(
  f: FetchRotta,
): Promise<({ ok: true } & DatiSpedizioni) | ErroreR2> {
  const [s, k] = await Promise.all([chiamaRotta(f, urlSpedizioni), chiamaRotta(f, urlCassa)]);
  if (!s.ok) return s;
  if (!k.ok && (k.tipo === "permesso" || k.tipo === "sessione")) return k;
  const tariffa = leggiTariffa(s.dati.tariffa);
  const corrieri = leggiCorrieri(s.dati.corrieri);
  if (tariffa === undefined || corrieri === null) return errore("server", FRASE_SERVER);
  const interruttori = k.ok && eOggetto(k.dati.interruttori) ? k.dati.interruttori : null;
  const resi =
    interruttori && eOggetto(interruttori.resi_confermati)
      ? interruttori.resi_confermati.valore
      : null;
  const cassa =
    interruttori && eOggetto(interruttori.cassa_sito) ? interruttori.cassa_sito.valore : null;
  const catalogo =
    interruttori && eOggetto(interruttori.catalogo_sito) ? interruttori.catalogo_sito.valore : null;
  return {
    ok: true,
    tariffa,
    corrieri,
    resi: typeof resi === "boolean" ? resi : null,
    //  `stripe` scritto ma catalogo `codice` = la cassa di oggi: l'avviso dei 4,90 € deve restare (e `null` se la cassa non si legge)
    cassa: cassa === "vecchia" || cassa === "stripe" ? cassaEffettiva(catalogo, cassa) : null,
    catalogo: catalogo === "cms" || catalogo === "codice" ? catalogo : null,
  };
}

export type EsitoScrittura = { ok: true; cambiato: boolean; avviso: string | null } | ErroreR2;

/** «Salva»: il costo si legge qui (euro → centesimi); se non si legge non parte niente. Si manda la versione vista. */
export async function salvaTariffa(
  f: FetchRotta,
  visto: TariffaCrm,
  modulo: ModuloTariffa,
): Promise<EsitoScrittura> {
  const v = verificaModulo(modulo);
  if (!v.ok) return errore("valore", Object.values(v.errori)[0] ?? FRASE_COSTO);
  const r = await scrivi(f, {
    azione: "tariffa_salva",
    id: visto.id,
    atteso: visto.aggiornatoIl,
    ...v.campi,
  });
  if (!r.ok) return r;
  return {
    ok: true,
    cambiato: r.dati.cambiato !== false,
    avviso: fraseSicura(r.dati.avviso, "") || null,
  };
}

/** «Conferma la tariffa»: l'id e la versione vista, nient'altro (il server confronta e scrive la data). */
export async function confermaTariffa(f: FetchRotta, visto: TariffaCrm): Promise<EsitoScrittura> {
  const r = await scrivi(f, {
    azione: "tariffa_conferma",
    id: visto.id,
    atteso: visto.aggiornatoIl,
  });
  return r.ok ? { ok: true, cambiato: r.dati.cambiato !== false, avviso: null } : r;
}

/** I corrieri: l'elenco nuovo e l'elenco che si VEDEVA. Il server rifà tutti i controlli e rifiuta con la sua frase. */
export async function salvaCorrieri(
  f: FetchRotta,
  nuovi: readonly Corriere[],
  visti: readonly Corriere[],
): Promise<EsitoScrittura> {
  const r = await scrivi(f, { azione: "corrieri_salva", corrieri: pulisci(nuovi), atteso: visti });
  return r.ok ? { ok: true, cambiato: r.dati.cambiato !== false, avviso: null } : r;
}

/** L'interruttore dei resi: sì o no, col valore visto. */
export async function impostaResi(
  f: FetchRotta,
  valore: unknown,
  atteso: unknown,
): Promise<EsitoScrittura> {
  if (typeof valore !== "boolean" || typeof atteso !== "boolean")
    return errore("valore", "La richiesta non è valida: ricarica la pagina e riprova.");
  const r = await scrivi(f, {
    azione: "interruttore_imposta",
    chiave: "resi_confermati",
    valore,
    atteso,
  });
  return r.ok ? { ok: true, cambiato: r.dati.cambiato !== false, avviso: null } : r;
}

/* ══ LA SCHERMATA ════════════════════════════════════════════════════════════ */

type Lavoro = "tariffa" | "conferma" | "corrieri" | "resi";
/** Quale parte della scheda ha appena salvato: è l'unica che dopo la rilettura prende i valori del server (le altre tengono le modifiche non salvate). */
export type Parte = "tariffa" | "corrieri" | "resi";

/** Dopo una lettura: i dati nuovi e quali campi si riscrivono. Senza `parte` (prima lettura, «Riprova») tutto; con `parte` solo la tariffa (modulo)
 *  o i corrieri, che hanno una bozza; i resi e la cassa non ne hanno e si prendono sempre. Dei corrieri non salvati restano anche i dati visti,
 *  perché sono la versione `atteso` che il server confronta. */
export function riallinea(
  prima: DatiSpedizioni | null,
  nuovo: DatiSpedizioni,
  parte?: Parte,
): { dati: DatiSpedizioni; modulo: boolean; corrieri: boolean } {
  const modulo = !prima || !parte || parte === "tariffa";
  const corrieri = !prima || !parte || parte === "corrieri";
  return {
    dati: {
      ...nuovo,
      tariffa: modulo || !prima ? nuovo.tariffa : prima.tariffa,
      corrieri: corrieri || !prima ? nuovo.corrieri : prima.corrieri,
    },
    modulo,
    corrieri,
  };
}
interface Esito {
  tono: "ok" | "errore";
  testo: string;
  /** In quale riquadro si legge: l'esito sta accanto a ciò che si è fatto, non in fondo alla pagina. */
  dove: "tariffa" | "corrieri" | "resi";
}

export interface PropsVistaTariffe {
  /** `null` = non sono ancora arrivati (o la lettura è fallita: allora c'è `errore`). */
  dati: DatiSpedizioni | null;
  errore: string | null;
  modulo: ModuloTariffa;
  corrieri: Corriere[];
  numeroProva: string;
  lavoro: Lavoro | null;
  esito: Esito | null;
  onModulo: (cambi: Partial<ModuloTariffa>) => void;
  onSalva: () => void;
  onConferma: () => void;
  onCorrieri: (elenco: Corriere[]) => void;
  onSalvaCorrieri: () => void;
  onNumeroProva: (numero: string) => void;
  onResi: (acceso: boolean) => void;
  onRiprova: () => void;
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Un campo con la sua etichetta, l'aiuto e l'errore. */
function Campo({
  id,
  etichetta,
  aiuto,
  errore,
  children,
}: {
  id: string;
  etichetta: string;
  aiuto?: string;
  errore?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {etichetta}
      </label>
      {children}
      {errore ? (
        <p
          id={`${id}-nota`}
          role="alert"
          className="flex items-start gap-1.5 text-[12px] text-rose-800"
        >
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {errore}
        </p>
      ) : aiuto ? (
        <p id={`${id}-nota`} className="text-[12px] text-muted-foreground">
          {aiuto}
        </p>
      ) : null}
    </div>
  );
}

const CLASSE_INPUT = "h-11 min-w-0 text-[13px] md:h-9 md:text-[13px]";

export function VistaTariffe(p: PropsVistaTariffe) {
  const occupato = p.lavoro !== null;
  const tariffa = p.dati?.tariffa ?? null;
  const verifica = verificaModulo(p.modulo);
  const errori = verifica.ok ? {} : verifica.errori;
  const cambiato = tariffa ? moduloCambiato(p.modulo, tariffa) : false;
  const sbagliatoCorrieri = controllaCorrieri(p.corrieri);
  const corrieriCambiati = p.dati ? !stessoElenco(p.corrieri, p.dati.corrieri) : false;
  const prova = linkDiProva(p.corrieri, p.numeroProva);

  const esitoIn = (dove: Esito["dove"]) =>
    p.esito?.dove !== dove ? null : p.esito.tono === "ok" ? (
      <p role="status" className="flex items-start gap-1.5 text-[12.5px] text-emerald-800">
        <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {p.esito.testo}
      </p>
    ) : (
      <Avviso errore>{p.esito.testo}</Avviso>
    );
  const riprova = (
    <Button size="sm" variant="outline" className="h-11 text-[12px] md:h-8" onClick={p.onRiprova}>
      Riprova
    </Button>
  );
  const giro = (cosa: Lavoro) => (
    <RefreshCw
      className={`mr-1.5 h-3.5 w-3.5 ${p.lavoro === cosa ? "animate-spin motion-reduce:animate-none" : "hidden"}`}
      aria-hidden="true"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── 0 · La cassa di oggi: visibile finché la cassa nuova non è accesa (o non si sa) ── */}
      {p.dati?.cassa !== "stripe" && (
        <Avviso>{p.dati?.catalogo === "codice" ? FRASE_CATALOGO_CODICE : FRASE_CASSA_OGGI}</Avviso>
      )}

      {p.errore && (
        <Avviso errore azione={riprova}>
          {p.errore}
        </Avviso>
      )}
      {!p.dati && !p.errore && (
        <div
          role="status"
          aria-busy="true"
          className="flex h-16 items-center rounded-lg bg-muted/50 px-4 text-[12.5px] text-muted-foreground motion-safe:animate-pulse"
        >
          Le tariffe di spedizione stanno arrivando…
        </div>
      )}

      {p.dati && (
        <>
          {/* ── 1 · La tariffa ── */}
          <Riquadro
            id="spedizioni-tariffa"
            titolo="Tariffa per l'Italia"
            chip={
              tariffa && (
                <>
                  <Chip tono={tariffa.confermata ? "vinta" : "in_sospeso"} punto>
                    {tariffa.confermata ? "Confermata" : "Provvisoria"}
                  </Chip>
                  {!tariffa.attiva && <Chip tono="neutro">Spenta</Chip>}
                </>
              )
            }
          >
            {(!tariffa || !tariffa.attiva) && <Avviso>{FRASE_CASSA_CHIUSA}</Avviso>}
            {!tariffa ? (
              <p className="text-[12.5px] text-muted-foreground">
                Nel database non c'è nessuna tariffa di spedizione. La tariffa di partenza la mette
                l'aggiornamento delle spedizioni (migrazione S5): da qui non si può creare.
              </p>
            ) : (
              <>
                <p className="text-[12.5px] text-muted-foreground">
                  {tariffa.confermata
                    ? `Confermata${tariffa.confermataIl ? ` il ${quando(tariffa.confermataIl)}` : ""}: ai clienti arrivano costo, corriere e tempi, se li hai scritti. Ogni modifica è subito visibile.`
                    : "Finché non la confermi, ai clienti arriva solo il costo: corriere e tempi non compaiono."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo id="tariffa-nome" etichetta="Nome della tariffa" errore={errori.nome}>
                    <Input
                      id="tariffa-nome"
                      value={p.modulo.nome}
                      maxLength={NOME_MAX * 2}
                      disabled={occupato}
                      aria-invalid={errori.nome ? true : undefined}
                      aria-describedby={errori.nome ? "tariffa-nome-nota" : undefined}
                      onChange={(e) => p.onModulo({ nome: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </Campo>
                  <Campo
                    id="tariffa-costo"
                    etichetta="Costo in euro"
                    aiuto="Per esempio 4,90. Quello che paga il cliente."
                    errore={errori.costo}
                  >
                    <div className="relative">
                      <Input
                        id="tariffa-costo"
                        value={p.modulo.costo}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={occupato}
                        aria-invalid={errori.costo ? true : undefined}
                        aria-describedby="tariffa-costo-nota"
                        onChange={(e) => p.onModulo({ costo: e.target.value })}
                        className={`${CLASSE_INPUT} pr-8`}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground"
                      >
                        €
                      </span>
                    </div>
                  </Campo>
                  <Campo
                    id="tariffa-corriere"
                    etichetta="Corriere (facoltativo)"
                    aiuto="Si mostra ai clienti solo a tariffa confermata."
                    errore={errori.corriere}
                  >
                    <Input
                      id="tariffa-corriere"
                      value={p.modulo.corriere}
                      maxLength={CORRIERE_MAX * 2}
                      disabled={occupato}
                      aria-invalid={errori.corriere ? true : undefined}
                      aria-describedby="tariffa-corriere-nota"
                      onChange={(e) => p.onModulo({ corriere: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </Campo>
                  <fieldset className="flex min-w-0 flex-col gap-1" disabled={occupato}>
                    <legend className="mb-1 text-[12.5px] font-medium">
                      Giorni lavorativi per la consegna
                    </legend>
                    <div className="flex items-center gap-2">
                      <Input
                        id="tariffa-giorni-min"
                        aria-label="Giorni, da"
                        placeholder="da"
                        value={p.modulo.giorniMin}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={errori.tempi ? true : undefined}
                        aria-describedby="tariffa-giorni-nota"
                        onChange={(e) => p.onModulo({ giorniMin: e.target.value })}
                        className={CLASSE_INPUT}
                      />
                      <span aria-hidden="true" className="text-[13px] text-muted-foreground">
                        –
                      </span>
                      <Input
                        id="tariffa-giorni-max"
                        aria-label="Giorni, a"
                        placeholder="a"
                        value={p.modulo.giorniMax}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={errori.tempi ? true : undefined}
                        aria-describedby="tariffa-giorni-nota"
                        onChange={(e) => p.onModulo({ giorniMax: e.target.value })}
                        className={CLASSE_INPUT}
                      />
                    </div>
                    <p
                      id="tariffa-giorni-nota"
                      role={errori.tempi ? "alert" : undefined}
                      className={`text-[12px] ${errori.tempi ? "text-rose-800" : "text-muted-foreground"}`}
                    >
                      {errori.tempi ??
                        "Lasciali vuoti se non vuoi promettere i tempi: allora non si mostrano."}
                    </p>
                  </fieldset>
                </div>

                <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">Tariffa attiva</p>
                    <p
                      id="tariffa-attiva-nota"
                      className="mt-0.5 text-[12.5px] text-muted-foreground"
                    >
                      {p.modulo.attiva
                        ? "Carrello e cassa usano questa tariffa."
                        : "Spenta: la cassa Stripe resta chiusa finché non c'è una tariffa attiva."}
                    </p>
                  </div>
                  <div className="-my-2 flex min-h-11 shrink-0 items-center">
                    <Switch
                      checked={p.modulo.attiva}
                      disabled={occupato}
                      onCheckedChange={(v) => p.onModulo({ attiva: v })}
                      aria-label="Tariffa attiva"
                      aria-describedby="tariffa-attiva-nota"
                      className="h-7 w-12 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    className="min-h-11 text-[12.5px] sm:min-h-8"
                    disabled={occupato || !cambiato || !verifica.ok}
                    onClick={p.onSalva}
                  >
                    {giro("tariffa")}
                    Salva la tariffa
                  </Button>
                  {!tariffa.confermata && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 text-[12.5px] sm:min-h-8"
                      disabled={occupato || cambiato}
                      onClick={p.onConferma}
                    >
                      {giro("conferma")}
                      Conferma la tariffa
                    </Button>
                  )}
                  {!tariffa.confermata && cambiato && (
                    <span className="text-[12px] text-muted-foreground">
                      Salva prima le modifiche: la conferma vale per la tariffa salvata.
                    </span>
                  )}
                </div>
              </>
            )}
            {esitoIn("tariffa")}
          </Riquadro>

          {/* ── 2 · I corrieri ── */}
          <Riquadro id="spedizioni-corrieri" titolo="Corrieri e link di tracciamento">
            <p className="text-[12.5px] text-muted-foreground">
              Il modello di link serve al cliente per seguire il pacco: nel modello scrivi{" "}
              {"{numero}"} dove va il numero di spedizione, per esempio https://…/segui?n=
              {"{numero}"}. Senza modello il cliente vede solo il numero.
            </p>
            <ul className="flex flex-col gap-2">
              {p.corrieri.map((c, i) => (
                <li
                  key={i}
                  className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
                >
                  <Input
                    value={c.nome}
                    aria-label={`Nome del corriere ${i + 1}`}
                    placeholder="Nome"
                    maxLength={NOME_CORRIERE_MAX * 2}
                    disabled={occupato}
                    onChange={(e) =>
                      p.onCorrieri(
                        p.corrieri.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                      )
                    }
                    className={CLASSE_INPUT}
                  />
                  <Input
                    value={c.modello}
                    aria-label={`Modello di link di ${c.nome || "nuovo corriere"}`}
                    placeholder="https://…/{numero}"
                    inputMode="url"
                    autoComplete="off"
                    disabled={occupato}
                    onChange={(e) =>
                      p.onCorrieri(
                        p.corrieri.map((x, j) => (j === i ? { ...x, modello: e.target.value } : x)),
                      )
                    }
                    className={`${CLASSE_INPUT} font-mono text-[12.5px]`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 justify-self-start text-[12.5px] md:h-9"
                    aria-label={`Togli ${c.nome || "questo corriere"}`}
                    disabled={occupato}
                    onClick={() => p.onCorrieri(p.corrieri.filter((_, j) => j !== i))}
                  >
                    <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Togli
                  </Button>
                </li>
              ))}
            </ul>
            {sbagliatoCorrieri && (
              <p role="alert" className="flex items-start gap-1.5 text-[12px] text-rose-800">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {sbagliatoCorrieri}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                aria-label="Aggiungi un corriere"
                disabled={occupato || p.corrieri.length >= MAX_CORRIERI}
                onClick={() => p.onCorrieri([...p.corrieri, { nome: "", modello: "" }])}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Aggiungi un corriere
              </Button>
              <Button
                type="button"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                aria-label="Salva i corrieri"
                disabled={occupato || !corrieriCambiati || sbagliatoCorrieri !== null}
                onClick={p.onSalvaCorrieri}
              >
                {giro("corrieri")}
                Salva i corrieri
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <Campo
                id="numero-prova"
                etichetta="Numero di prova"
                aiuto="Metti un numero e guarda il link che ne esce: non si salva da nessuna parte."
              >
                <Input
                  id="numero-prova"
                  value={p.numeroProva}
                  maxLength={120}
                  autoComplete="off"
                  aria-describedby="numero-prova-nota"
                  onChange={(e) => p.onNumeroProva(e.target.value)}
                  className={`${CLASSE_INPUT} sm:max-w-xs`}
                />
              </Campo>
              {p.numeroProva.trim() && (
                <ul className="flex flex-col gap-1.5" aria-live="polite">
                  {prova
                    .filter((x) => x.modello)
                    .map((x, i) => (
                      <li key={i} className="text-[12.5px]">
                        <span className="font-medium">{x.nome || "Corriere senza nome"}</span>
                        <span className="text-muted-foreground"> → </span>
                        {x.link ? (
                          <span className="break-all font-mono text-[12px]">{x.link}</span>
                        ) : (
                          <span className="text-amber-900">
                            {x.nome.trim()
                              ? "nessun link: il modello non è valido"
                              : "nessun link: manca il nome del corriere"}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            {esitoIn("corrieri")}
          </Riquadro>

          {/* ── 3 · Spedizioni e resi scritti nelle pagine ── */}
          <Riquadro id="spedizioni-resi" titolo="Spedizioni e resi nelle pagine del sito">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">
                  Spedizioni e resi sono scritti nelle pagine
                </p>
                <p
                  id="spedizioni-resi-aiuto"
                  className="mt-0.5 text-[12.5px] text-muted-foreground"
                >
                  Accendilo quando le pagine di spedizioni e resi del sito sono scritte davvero:
                  finché è spento lo shop non si può aprire al pubblico.
                </p>
              </div>
              <div className="-my-2 flex min-h-11 shrink-0 items-center">
                <Switch
                  checked={p.dati.resi === true}
                  disabled={occupato || p.dati.resi === null}
                  onCheckedChange={(v) => p.onResi(v)}
                  aria-label="Spedizioni e resi sono scritti nelle pagine"
                  aria-describedby="spedizioni-resi-aiuto"
                  className="h-7 w-12 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
                />
              </div>
            </div>
            {p.dati.resi === null && (
              <p className="text-[12.5px] text-amber-900">
                Non riesco a leggere questo interruttore: ricarica la scheda. Se resta così manca
                l'aggiornamento delle spedizioni (migrazione S5): chiedi a chi gestisce il database
                di applicarlo.
              </p>
            )}
            {esitoIn("resi")}
          </Riquadro>
        </>
      )}
    </div>
  );
}

/** La scheda vera: lo stato e le chiamate. `fetch` è la `fetchCRM` della pagina. La lettura parte QUANDO la scheda si disegna. */
export function ElencoTariffe({ fetch }: { fetch: FetchRotta }) {
  const [dati, setDati] = useState<DatiSpedizioni | null>(null);
  const [erroreLettura, setErroreLettura] = useState<string | null>(null);
  const [modulo, setModulo] = useState<ModuloTariffa>({
    nome: "",
    corriere: "",
    costo: "",
    giorniMin: "",
    giorniMax: "",
    attiva: true,
  });
  const [corrieri, setCorrieri] = useState<Corriere[]>([]);
  const [numeroProva, setNumeroProva] = useState("");
  const [lavoro, setLavoro] = useState<Lavoro | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const sequenza = useRef(0);
  const vivo = useRef(true);

  /** A chi non può non si lascia a schermo niente di una lettura precedente. */
  const negato = (e: ErroreR2) => e.tipo === "permesso" || e.tipo === "sessione";

  const datiVisti = useRef<DatiSpedizioni | null>(null);
  datiVisti.current = dati;
  const carica = useCallback(
    async (parte?: Parte) => {
      const n = ++sequenza.current;
      const r = await caricaSpedizioni(fetch);
      if (!vivo.current || n !== sequenza.current) return; // una lettura più vecchia di un'altra non conta
      if (r.ok) {
        const nuovo: DatiSpedizioni = {
          tariffa: r.tariffa,
          corrieri: r.corrieri,
          resi: r.resi,
          cassa: r.cassa,
          catalogo: r.catalogo,
        };
        const x = riallinea(datiVisti.current, nuovo, parte);
        setDati(x.dati);
        if (x.modulo && r.tariffa) setModulo(moduloDaTariffa(r.tariffa));
        if (x.corrieri) setCorrieri(r.corrieri);
        setErroreLettura(null);
      } else {
        if (negato(r)) setDati(null);
        setErroreLettura(r.messaggio);
      }
    },
    [fetch],
  );

  useEffect(() => {
    vivo.current = true;
    void carica();
    return () => {
      vivo.current = false;
    };
  }, [carica]);

  /** Un lavoro di scrittura: l'esito va nel riquadro giusto; il conflitto e la rete incerta rileggono i valori veri. */
  async function lavora(
    cosa: Lavoro,
    dove: Esito["dove"],
    azione: () => Promise<EsitoScrittura>,
    fatto: (r: Extract<EsitoScrittura, { ok: true }>) => string,
  ) {
    //  Dopo il salvataggio si riallinea solo la parte salvata: le modifiche non salvate delle altre restano dove sono.
    const parte: Parte = dove;
    setLavoro(cosa);
    setEsito(null);
    const r = await azione();
    if (!vivo.current) return;
    setLavoro(null);
    if (r.ok) {
      setEsito({ tono: "ok", testo: fatto(r), dove });
      await carica(parte);
      return;
    }
    setEsito({
      tono: "errore",
      testo: r.tipo === "conflitto" ? `${r.messaggio} Ho riletto i valori attuali.` : r.messaggio,
      dove,
    });
    if (r.tipo === "conflitto" || r.tipo === "rete") await carica(parte);
    else if (negato(r)) setDati(null);
  }

  const tariffa = dati?.tariffa ?? null;
  return (
    <VistaTariffe
      dati={dati}
      errore={erroreLettura}
      modulo={modulo}
      corrieri={corrieri}
      numeroProva={numeroProva}
      lavoro={lavoro}
      esito={esito}
      onModulo={(cambi) => setModulo((m) => ({ ...m, ...cambi }))}
      onSalva={() =>
        tariffa &&
        void lavora(
          "tariffa",
          "tariffa",
          () => salvaTariffa(fetch, tariffa, modulo),
          (r) =>
            r.cambiato
              ? `Tariffa salvata.${r.avviso ? ` ${r.avviso}` : ""}`
              : "Non c'era niente da cambiare: la tariffa è già così.",
        )
      }
      onConferma={() =>
        tariffa &&
        void lavora(
          "conferma",
          "tariffa",
          () => confermaTariffa(fetch, tariffa),
          () =>
            "Tariffa confermata: da ora i clienti vedono anche corriere e tempi, se li hai scritti.",
        )
      }
      onCorrieri={setCorrieri}
      onSalvaCorrieri={() =>
        dati &&
        void lavora(
          "corrieri",
          "corrieri",
          () => salvaCorrieri(fetch, corrieri, dati.corrieri),
          (r) => (r.cambiato ? "Corrieri salvati." : "Non c'era niente da cambiare."),
        )
      }
      onNumeroProva={setNumeroProva}
      onResi={(v) =>
        dati &&
        void lavora(
          "resi",
          "resi",
          () => impostaResi(fetch, v, dati.resi),
          () =>
            v
              ? "Segnato: le pagine di spedizioni e resi sono scritte."
              : "Segnato: le pagine di spedizioni e resi non sono ancora scritte.",
        )
      }
      onRiprova={() => void carica()}
    />
  );
}
