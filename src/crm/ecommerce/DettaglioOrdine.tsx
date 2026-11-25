/** ── IL DETTAGLIO DELL'ORDINE (DettaglioOrdine.tsx) · pannello laterale ────────
 *  Commessa 2026-11-17-crm-ecommerce, T12 (SPEC §3.3). Un pannello (`Sheet`): a destra sul computer, a tutta pagina sotto i
 *  640 px. Dentro, in ordine di uso: stato, pagamento, tracking, note interne (le cose che si FANNO), poi cliente, righe e
 *  storico (le cose che si LEGGONO). Un ordine sbagliato si segna «Annullato»: non c'è altro modo di toglierlo dalle cifre.
 *
 *  Qui non si chiama la rotta: ogni comando manda un'`Azione` a `chiedi`, che sta in `ElencoOrdini` (conferme, un'azione per
 *  volta, frase dell'esito). Il corpo (`CorpoOrdine`) è separato dal pannello perché il pannello vive in un portale e il corpo
 *  si può disegnare e provare da solo.
 *
 *  ── RILASCIO 2 (T64) ─────────────────────────────────────────────────────────────────────────────────────────
 *  Un ordine della cassa nuova (`statoPagamento` valorizzato) si disegna con `CorpoStripe`: pagamento con i rimborsi, spedizione, fattura e
 *  consensi (testo, solo campi noti), le cinque email, i passi dell'ordine; i dati vengono dall'archivio di T61 (`useDettaglioOrdine`), mai dalle funzioni nude.
 *  Rimborso, annullo e spedizione passano da finestre (dialoghi/), montate con `key={ordine.id}`. Un ordine di prima resta com'era (`CorpoVecchio`).
 *  ⚠️ Fattura e consensi sono dati riservati: solo testo React, mai HTML né il JSON intero; gli id di Stripe non si mostrano.
 *  ⚠️ Nessun log: l'ordine contiene nome, telefono e indirizzo di un cliente. */
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { CLASSI_TONO, dataBreve, oggiIso } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { Avviso } from "./Avviso";
import type { Azione, ChiaveEmailOrdine } from "./azioni";
import type { EventoStorico, RisultatoAzioneR2, RisultatoStorico } from "./client";
import {
  ETICHETTA_METODO,
  ETICHETTA_STATO,
  STATI_ORDINE,
  eIncassato,
  importoIncassato,
  nomeCliente,
} from "./ordine";
import type { MetodoPagamento, Ordine, StatoOrdine } from "./ordine";
import {
  TONO_STATO_ORDINE,
  avvisiDettaglio,
  avvisiOrdine,
  comandiEvasione,
  controllaFormCorreggi,
  controllaPagamento,
  datiConsensi,
  datiFattura,
  dataOra,
  descriviEvento,
  esitoAzioneR2,
  importoDiPartenza,
  ordinaEventi,
  righeEmail,
  rimborsoInCorso,
  tastoRimborso,
  testoConferma,
  testoPerFattura,
} from "./ordini-ui";
import type { Esito } from "./ordini-ui";
import { AVVISO_MIGRAZIONE, euro } from "./pagina";
import { ETICHETTA_PAGAMENTO, statoEffettivo, statoPagamentoDi } from "./pagamento";
import { DialogoAnnulla } from "./dialoghi/DialogoAnnulla";
import { DialogoRimborso } from "./dialoghi/DialogoRimborso";
import { DialogoSpedisci } from "./dialoghi/DialogoSpedisci";
import { useDettaglioOrdine } from "./useDettaglioOrdine";

/** Il menu nativo: sul telefono si apre il selettore del sistema e con la tastiera si usano le frecce. */
export const CLASSE_MENU =
  "min-h-11 rounded-md border border-input bg-background px-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9";
/** Il menu dello stato, colorato come il chip dello stato (stesso tono in tutto il CRM). */
export const classeMenuStato = (s: StatoOrdine): string =>
  cn(
    "min-h-11 rounded-full border px-2.5 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8",
    CLASSI_TONO[TONO_STATO_ORDINE[s]],
  );

/** L'esito dell'ultima azione: riuscita = una riga tranquilla; storico mancato o errore = avviso (che resta finché non si fa altro). */
export function MessaggioEsito({ esito }: { esito: Esito | null }) {
  if (!esito) return null;
  if (esito.tono === "ok")
    return (
      <p role="status" className="flex items-center gap-1.5 text-[12.5px] text-emerald-700">
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {esito.testo}
      </p>
    );
  return <Avviso errore={esito.tono === "errore"}>{esito.testo}</Avviso>;
}

function Sezione({ titolo, id, children }: { titolo: string; id: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 border-t border-border px-4 py-3.5 first:border-t-0"
    >
      <h3 id={id} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {titolo}
      </h3>
      {children}
    </section>
  );
}

/** Il testo di un campo che segue il valore salvato finché chi scrive non lo ha toccato: una rilettura (o un collega) non fa perdere ciò che si sta scrivendo. */
function useBozza(salvato: string | null): [string, (v: string) => void] {
  const base = salvato ?? "";
  const [v, setV] = useState(base);
  const prec = useRef(base);
  useEffect(() => {
    if (v === prec.current) setV(base);
    prec.current = base;
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps -- si guarda solo il valore salvato
  return [v, setV];
}

/** Le sezioni che non cambiano fra gli ordini di prima e quelli della cassa nuova. */
function SezioneCliente({ o }: { o: Ordine }) {
  return (
    <Sezione titolo="Cliente" id="ord-cliente">
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-muted-foreground">Nome</dt>
        <dd className="min-w-0 break-words font-medium">{nomeCliente(o)}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd className="min-w-0 break-all">
          {o.email ? (
            <a className="underline underline-offset-2" href={`mailto:${o.email}`}>
              {o.email}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-muted-foreground">Telefono</dt>
        <dd className="min-w-0 break-words">
          {o.telefono ? (
            <a
              className="underline underline-offset-2"
              href={`tel:${o.telefono.replace(/[^\d+]/g, "")}`}
            >
              {o.telefono}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-muted-foreground">Indirizzo</dt>
        <dd className="min-w-0 break-words">
          {[o.indirizzo, [o.cap, o.citta].filter(Boolean).join(" ")].filter(Boolean).join(", ") ||
            "—"}
        </dd>
        {o.note && (
          <>
            <dt className="text-muted-foreground">Note del cliente</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words">{o.note}</dd>
          </>
        )}
      </dl>
    </Sezione>
  );
}

function SezioneRighe({ o }: { o: Ordine }) {
  return (
    <Sezione titolo="Righe" id="ord-righe">
      {o.righe.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nessuna riga nell'ordine.</p>
      ) : (
        <ul className="divide-y divide-border">
          {o.righe.map((r, i) => (
            <li key={i} className="flex items-baseline gap-3 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{r.nome}</span>
                {r.variante && (
                  <span className="block break-words text-[12px] text-muted-foreground">
                    {r.variante}
                  </span>
                )}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.qty} × {euro(r.prezzo)}
              </span>
              <span className="w-20 text-right tabular-nums">{euro(r.qty * r.prezzo)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
        <dt className="text-muted-foreground">Subtotale</dt>
        <dd className="text-right">{euro(o.subtotale)}</dd>
        <dt className="text-muted-foreground">Spedizione</dt>
        <dd className="text-right">{euro(o.spedizione)}</dd>
        <dt className="font-semibold">Totale</dt>
        <dd className="text-right font-semibold">{euro(o.totale)}</dd>
      </dl>
    </Sezione>
  );
}

function SezioneNote({
  o,
  fermo,
  chiedi,
}: {
  o: Ordine;
  fermo: boolean;
  chiedi: (azione: Azione) => Promise<boolean>;
}) {
  const [nota, setNota] = useBozza(o.noteInterne);
  const salva = (ev: FormEvent) => {
    ev.preventDefault();
    void chiedi({ azione: "nota_interna", ordineId: o.id, valore: nota });
  };
  return (
    <Sezione titolo="Note interne" id="ord-note">
      <form onSubmit={salva} className="flex flex-col gap-1.5">
        <label htmlFor="ord-nota-campo" className="text-[12px] font-medium">
          Note interne (il cliente non le vede)
        </label>
        <Textarea
          id="ord-nota-campo"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={2000}
          rows={3}
          className="text-[13px]"
        />
        <div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="min-h-11 text-[12.5px] sm:min-h-9"
            disabled={fermo || nota.trim() === (o.noteInterne ?? "")}
          >
            Salva
          </Button>
        </div>
      </form>
    </Sezione>
  );
}

interface RigheStorico {
  fase: "carico" | "ok" | "errore";
  eventi: EventoStorico[];
  messaggio: string;
  pronta: boolean;
}
function SezioneStorico({ righe }: { righe: RigheStorico }) {
  return (
    <Sezione titolo="Storico" id="ord-storico">
      {righe.fase === "carico" && (
        <p className="text-[12.5px] text-muted-foreground" role="status">
          Carico lo storico…
        </p>
      )}
      {righe.fase === "errore" && (
        <p className="text-[12.5px] text-rose-700" role="alert">
          {righe.messaggio}
        </p>
      )}
      {righe.fase === "ok" && !righe.pronta && (
        <p className="text-[12.5px] text-muted-foreground">
          Lo storico si vedrà dopo l'aggiornamento del database.
        </p>
      )}
      {righe.fase === "ok" && righe.pronta && righe.eventi.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">Nessuna mossa registrata, per ora.</p>
      )}
      {righe.eventi.length > 0 && righe.pronta && (
        <ol className="flex flex-col gap-2.5">
          {righe.eventi.map((e) => {
            const d = descriviEvento(e);
            return (
              <li key={e.id} className="text-[13px]">
                <p className="font-medium">{d.titolo}</p>
                {d.dettaglio && <p className="break-words text-muted-foreground">{d.dettaglio}</p>}
                <p className="text-[11.5px] text-muted-foreground">
                  {d.chi} · {d.quando}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[11.5px] text-muted-foreground">
        Lo storico non si riscrive: ogni mossa resta.
      </p>
    </Sezione>
  );
}

export interface PropsCorpoOrdine {
  ordine: Ordine;
  /** `false` = mancano le colonne nuove del database: nessun comando. */
  comandi: boolean;
  /** Un'azione è in corso: si aspetta, niente doppi invii. */
  occupato: boolean;
  esito: Esito | null;
  /** Manda l'azione (con le conferme del caso). `true` = eseguita e riuscita. */
  chiedi: (azione: Azione) => Promise<boolean>;
  storico: (ordineId: string) => Promise<RisultatoStorico>;
}

/** L'ordine di prima (senza stato di pagamento): il corpo di sempre. */
function CorpoVecchio({ ordine: o, comandi, occupato, esito, chiedi, storico }: PropsCorpoOrdine) {
  const fermo = !comandi || occupato;
  const avvisi = avvisiOrdine(o);

  //  ── stato ──
  const cambiaStato = (a: string) =>
    void chiedi({ azione: "stato", ordineId: o.id, da: o.stato, a: a as StatoOrdine });

  //  ── pagamento ──
  const [pagando, setPagando] = useState(false);
  const [metodo, setMetodo] = useState("");
  const [importo, setImporto] = useState(() => importoDiPartenza(o));
  const [data, setData] = useState(() => oggiIso());
  const [erroreForm, setErroreForm] = useState<string | null>(null);
  const apriPagamento = () => {
    setMetodo("");
    setImporto(importoDiPartenza(o));
    setData(oggiIso());
    setErroreForm(null);
    setPagando(true);
  };
  const inviaPagamento = async (ev: FormEvent) => {
    ev.preventDefault();
    const r = controllaPagamento(o, { metodo, importo, data }, new Date());
    if (!r.ok) return setErroreForm(r.errore);
    setErroreForm(null);
    if (await chiedi(r.azione)) setPagando(false);
  };

  //  ── tracking e note ──
  const [tracking, setTracking] = useBozza(o.tracking);
  const salvaTracking = (ev: FormEvent) => {
    ev.preventDefault();
    void chiedi({ azione: "tracking", ordineId: o.id, valore: tracking });
  };

  //  ── storico: si rilegge quando l'ordine cambia (dopo ogni azione `aggiornatoIl` si muove) ──
  const [righe, setRighe] = useState<RigheStorico>({
    fase: "carico",
    eventi: [],
    messaggio: "",
    pronta: true,
  });
  useEffect(() => {
    let vivo = true;
    void storico(o.id).then((r) => {
      if (!vivo) return;
      setRighe(
        r.ok
          ? {
              fase: "ok",
              eventi: ordinaEventi(r.eventi),
              messaggio: "",
              pronta: r.migrazionePronta,
            }
          : (p) => ({ ...p, fase: "errore", messaggio: r.errore.messaggio }),
      );
    });
    return () => {
      vivo = false;
    };
  }, [o.id, o.aggiornatoIl, storico]);

  const pagato = eIncassato(o);
  return (
    <div className="flex flex-col">
      {(esito || !comandi || avvisi.length > 0) && (
        <div className="flex flex-col gap-2 px-4 py-3">
          <MessaggioEsito esito={esito} />
          {!comandi && <Avviso>Per ora l'ordine si può solo guardare. {AVVISO_MIGRAZIONE}</Avviso>}
          {avvisi.map((a) => (
            <Avviso key={a}>{a}</Avviso>
          ))}
        </div>
      )}

      <Sezione titolo="Stato" id="ord-stato">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Stato ordine ${o.ref}`}
            value={o.stato}
            disabled={fermo}
            onChange={(e) => cambiaStato(e.target.value)}
            className={classeMenuStato(o.stato)}
          >
            {STATI_ORDINE.map((s) => (
              <option key={s} value={s}>
                {ETICHETTA_STATO[s]}
              </option>
            ))}
          </select>
          {occupato && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Si può anche tornare indietro. Cambiare stato non scrive al cliente.
        </p>
      </Sezione>

      <Sezione titolo="Pagamento" id="ord-pagamento">
        {pagato ? (
          <>
            <p className="text-[13px]">
              <span className="font-semibold text-emerald-700">Pagato</span>{" "}
              <span className="tabular-nums">{euro(importoIncassato(o))}</span>
              {o.metodoPagamento ? ` · ${ETICHETTA_METODO[o.metodoPagamento]}` : ""}
              {o.pagatoIl ? ` · ${dataBreve(o.pagatoIl)}` : ""}
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                disabled={fermo}
                onClick={() => void chiedi({ azione: "pagamento_annullato", ordineId: o.id })}
              >
                Annulla pagamento
              </Button>
            </div>
          </>
        ) : pagando ? (
          <form onSubmit={(e) => void inviaPagamento(e)} className="flex flex-col gap-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-[12px] font-medium">
                Metodo
                <select
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                  className={CLASSE_MENU}
                  required
                >
                  <option value="" disabled>
                    Scegli…
                  </option>
                  {(Object.keys(ETICHETTA_METODO) as MetodoPagamento[]).map((m) => (
                    <option key={m} value={m}>
                      {ETICHETTA_METODO[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium">
                Importo (€)
                <Input
                  value={importo}
                  onChange={(e) => setImporto(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="24,90"
                  className="min-h-11 text-[13px] tabular-nums sm:min-h-9"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium">
                Data
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  max={oggiIso()}
                  className="min-h-11 text-[13px] sm:min-h-9"
                />
              </label>
            </div>
            {erroreForm && (
              <p role="alert" className="text-[12.5px] text-rose-700">
                {erroreForm}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="sm"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                disabled={fermo}
              >
                Conferma pagamento
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                onClick={() => setPagando(false)}
              >
                Lascia stare
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">Non risulta pagato.</p>
            <div>
              <Button
                type="button"
                size="sm"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                disabled={fermo}
                onClick={apriPagamento}
              >
                Segna come pagato
              </Button>
            </div>
          </>
        )}
      </Sezione>

      <Sezione titolo="Spedizione" id="ord-tracking">
        <form onSubmit={salvaTracking} className="flex flex-col gap-1.5">
          <label htmlFor="ord-tracking-campo" className="text-[12px] font-medium">
            Codice di tracciamento
          </label>
          <div className="flex gap-2">
            <Input
              id="ord-tracking-campo"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              maxLength={120}
              autoComplete="off"
              className="min-h-11 flex-1 text-[13px] sm:min-h-9"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="min-h-11 text-[12.5px] sm:min-h-9"
              disabled={fermo || tracking.trim() === (o.tracking ?? "")}
            >
              Salva
            </Button>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Si compila quando l'ordine passa a «Spedito». Il cliente non lo riceve da qui.
          </p>
        </form>
      </Sezione>

      <SezioneNote o={o} fermo={fermo} chiedi={chiedi} />
      <SezioneCliente o={o} />
      <SezioneRighe o={o} />
      <SezioneStorico righe={righe} />
    </div>
  );
}

/** Lo stato dell'archivio più le azioni: ciò che `useDettaglioOrdine` restituisce. */
export type ArchivioDettaglio = ReturnType<typeof useDettaglioOrdine>;

/** Il corpo del pannello: l'ordine della cassa nuova (con stato di pagamento) si legge e si lavora dall'archivio di T61; quello di prima è com'era. */
export function CorpoOrdine(props: PropsCorpoOrdine) {
  const stripe = props.ordine.statoPagamento !== null;
  //  Il dettaglio (con fattura e consensi) si legge solo per la cassa nuova; l'hook si chiude da solo allo smontaggio.
  //  `attivo` = true: la pagina si apre solo con il permesso `pagamenti`, e il rifiuto vero lo dà la rotta (che svuota il dettaglio).
  const d = useDettaglioOrdine(props.ordine.id, stripe);
  return stripe ? <CorpoStripe {...props} d={d} /> : <CorpoVecchio {...props} />;
}

const nomeFinestra = { rimborso: "rimborso", annulla: "annulla", spedisci: "spedisci" } as const;
type Finestra = keyof typeof nomeFinestra;

/** Il link di tracciamento solo se è https: mai `javascript:` o altro. */
const linkSicuro = (u: string | null): string | null =>
  u && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null;

function Dato({ e, v }: { e: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{e}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </>
  );
}
const CLASSE_DATI = "grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-[13px]";
const CLASSE_TASTO = "min-h-11 text-[12.5px] sm:min-h-8";
const ETICHETTA_RIMBORSO: Record<string, string> = {
  richiesto: "In corso",
  riuscito: "Riuscito",
  fallito: "Non riuscito",
};

export interface PropsCorpoStripe extends Omit<PropsCorpoOrdine, "storico"> {
  d: ArchivioDettaglio;
  storico?: PropsCorpoOrdine["storico"];
}

export function CorpoStripe({
  ordine: daElenco,
  comandi,
  occupato,
  esito,
  chiedi,
  d,
}: PropsCorpoStripe) {
  const dett = d.dettaglio;
  //  L'ordine del dettaglio è più fresco di quello dell'elenco (che si rilegge ogni 30 s).
  const o = dett?.ordine ?? daElenco;
  const rimborsi = dett?.rimborsi ?? null;
  const [finestra, setFinestra] = useState<Finestra | null>(null);
  const [esitoR2, setEsitoR2] = useState<Esito | null>(null);
  //  Dopo un rimborso «in corso» il tasto «Rimborsa» resta spento finché l'elenco dei rimborsi non è riletto (un elenco nuovo).
  const [blocco, setBlocco] = useState<{ rimborsi: unknown } | null>(null);
  const ultimiRimborsi = useRef<unknown>(rimborsi);
  ultimiRimborsi.current = rimborsi;
  const alLancio = useRef<unknown>(null);
  const [daConfermare, setDaConfermare] = useState<
    | { tipo: "email"; chiave: ChiaveEmailOrdine }
    | { tipo: "correggi"; da: StatoOrdine; a: StatoOrdine; motivo: string }
    | null
  >(null);
  const [correzione, setCorrezione] = useState<{ a: StatoOrdine | ""; motivo: string } | null>(
    null,
  );
  const [erroreCorr, setErroreCorr] = useState<string | null>(null);
  const [notaFattura, setNotaFattura] = useState("");

  useEffect(() => {
    if (esitoR2?.tono !== "ok") return;
    const t = setTimeout(() => setEsitoR2(null), 5000);
    return () => clearTimeout(t);
  }, [esitoR2]);

  const pronto = !!dett; // senza dettaglio (non letto, o permesso negato) nessun tasto
  const fermo = !comandi || occupato || d.inInvio || !pronto;
  const avvisi = avvisiDettaglio(o);
  const evasione = comandiEvasione(o);
  const adesso = new Date();
  const statoPag = statoEffettivo(o, adesso);
  const rimborsabile =
    statoPagamentoDi(o) === "pagato" || statoPagamentoDi(o) === "rimborsato_in_parte";
  const tasto = tastoRimborso({ ordine: o, rimborsi, inInvio: d.inInvio, blocco });
  const rimborsaSpento = fermo || !tasto.attivo;

  const avviaAzione = async (nome: Azione["azione"], fa: () => Promise<RisultatoAzioneR2>) => {
    setEsitoR2(null);
    setDaConfermare(null);
    const e = esitoAzioneR2(await fa(), nome);
    setEsitoR2(e);
    return e;
  };
  const fatto = (r: RisultatoAzioneR2, nome: Finestra) => {
    setFinestra(null);
    setEsitoR2(esitoAzioneR2(r, nomeFinestra[nome]));
    if (rimborsoInCorso(r)) setBlocco({ rimborsi: alLancio.current });
  };
  //  Ogni invio di una finestra ricorda l'elenco dei rimborsi com'era PRIMA: è quello che deve cambiare perché il tasto si riaccenda.
  const apriDialogo = () => {
    const dlg = d.apriDialogo();
    return {
      ...dlg,
      rimborso: (x: Parameters<typeof dlg.rimborso>[0]) => {
        alLancio.current = ultimiRimborsi.current;
        return dlg.rimborso(x);
      },
      annulla: (x: Parameters<typeof dlg.annulla>[0]) => {
        alLancio.current = ultimiRimborsi.current;
        return dlg.annulla(x);
      },
    };
  };
  //  Un passo in avanti semplice passa dall'azione di sempre (`stato`) e poi si rilegge il dettaglio.
  const avanti = async (a: StatoOrdine) => {
    if (await chiedi({ azione: "stato", ordineId: o.id, da: o.stato, a })) void d.ricarica();
  };
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testoPerFattura(o, dett?.riservati?.fattura));
      setEsitoR2({ tono: "ok", testo: "Dati copiati: incollali dove prepari la fattura." });
    } catch {
      setEsitoR2({
        tono: "errore",
        testo: "Non sono riuscito a copiare: seleziona i dati qui sopra e copiali a mano.",
      });
    }
  };
  const inviaCorrezione = (ev: FormEvent) => {
    ev.preventDefault();
    if (!correzione) return;
    const r = controllaFormCorreggi(o, correzione, rimborsi);
    if (!r.ok) return setErroreCorr(r.errore);
    setErroreCorr(null);
    setDaConfermare({ tipo: "correggi", da: r.da, a: r.a, motivo: r.motivo });
  };
  const bottoneRimborsa = (chiave: string) => (
    <Button
      key={chiave}
      type="button"
      variant="outline"
      size="sm"
      className={CLASSE_TASTO}
      disabled={rimborsaSpento}
      onClick={() => setFinestra("rimborso")}
    >
      Rimborsa
    </Button>
  );

  const fatturaRighe = datiFattura(dett?.riservati?.fattura);
  const consensiRighe = datiConsensi(dett?.riservati?.consensi);
  const link = linkSicuro(o.trackingUrl);
  const spedito = o.stato === "spedito" || o.stato === "consegnato" || o.speditoIl !== null;
  const emailRighe = righeEmail(o, dett?.email ?? []);

  //  Il testo della conferma inline (correzione di stato, email a mano): lo scrive `testoConferma`, come per le altre azioni gravi.
  const conferma = daConfermare
    ? testoConferma(
        daConfermare.tipo === "email"
          ? { azione: "email_invia", ordineId: o.id, chiave: daConfermare.chiave }
          : {
              azione: "correggi_stato",
              ordineId: o.id,
              da: daConfermare.da,
              a: daConfermare.a,
              motivo: daConfermare.motivo,
            },
        o,
      )
    : null;
  const confermaInline = (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
      <p>
        <span className="font-semibold">{conferma?.titolo}</span> {conferma?.testo}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className={CLASSE_TASTO}
          disabled={fermo}
          onClick={() => {
            const c = daConfermare;
            if (!c) return;
            if (c.tipo === "email")
              void avviaAzione("email_invia", () => d.emailInvia({ chiave: c.chiave }));
            else
              //  Il modulo si chiude solo se è andata: dopo un errore resta aperto, con il motivo che si era scritto.
              void avviaAzione("correggi_stato", () =>
                d.correggiStato({ da: c.da, a: c.a, motivo: c.motivo }),
              ).then((e) => e.tono !== "errore" && setCorrezione(null));
          }}
        >
          {conferma?.si}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={CLASSE_TASTO}
          onClick={() => setDaConfermare(null)}
        >
          Torna indietro
        </Button>
      </div>
    </div>
  );

  const righeStorico: RigheStorico = {
    fase: dett ? (dett.storico === null ? "errore" : "ok") : "carico",
    eventi: dett?.storico ? ordinaEventi(dett.storico) : [],
    messaggio: "Non sono riuscito a leggere lo storico: aggiorna e riprova.",
    pronta: dett?.migrazione.pronta ?? true,
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 px-4 py-3 empty:hidden">
        <MessaggioEsito esito={esito} />
        <MessaggioEsito esito={esitoR2} />
        {!comandi && <Avviso>Per ora l'ordine si può solo guardare. {AVVISO_MIGRAZIONE}</Avviso>}
        {!dett && !d.errore && (
          <p role="status" className="text-[12.5px] text-muted-foreground">
            Carico i dati dell'ordine…
          </p>
        )}
        {d.errore && <Avviso errore>{d.errore.messaggio}</Avviso>}
        {avvisi.map((a) => (
          <Avviso
            key={a.testo}
            errore={a.rosso}
            azione={
              pronto && a.azioni.length > 0 ? (
                <span className="flex flex-wrap gap-2">
                  {a.azioni.includes("rimborsa") && bottoneRimborsa(`${a.testo}-r`)}
                  {a.azioni.includes("giacenza_verificata") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={CLASSE_TASTO}
                      disabled={fermo}
                      onClick={() =>
                        void avviaAzione("giacenza_verificata", () => d.giacenzaVerificata())
                      }
                    >
                      Segna verificata
                    </Button>
                  )}
                </span>
              ) : undefined
            }
          >
            {a.testo}
          </Avviso>
        ))}
      </div>

      <Sezione titolo="Stato" id="ord-stato">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-8 items-center rounded-full border px-2.5 text-[12px] font-medium",
              CLASSI_TONO[TONO_STATO_ORDINE[o.stato]],
            )}
          >
            {ETICHETTA_STATO[o.stato]}
          </span>
          {d.inInvio && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        {o.stato === "annullato" && (
          <p className="text-[12.5px] text-muted-foreground">
            Annullato{o.annullatoIl ? ` il ${dataOra(o.annullatoIl)}` : ""}
            {o.annulloMotivo ? `: ${o.annulloMotivo}` : ""}
          </p>
        )}
        {pronto && (
          <div className="flex flex-wrap gap-2">
            {evasione.avanti.map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant="outline"
                className={CLASSE_TASTO}
                disabled={fermo}
                onClick={() => void avanti(a)}
              >
                Segna {ETICHETTA_STATO[a].toLowerCase()}
              </Button>
            ))}
            {evasione.spedisci && (
              <Button
                type="button"
                size="sm"
                className={CLASSE_TASTO}
                disabled={fermo}
                onClick={() => setFinestra("spedisci")}
              >
                Spedisci…
              </Button>
            )}
            {evasione.annulla && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={CLASSE_TASTO}
                disabled={fermo || (rimborsabile && tasto.annullaSpento)}
                onClick={() => setFinestra("annulla")}
              >
                Annulla l'ordine…
              </Button>
            )}
            {evasione.correzioni.length > 0 && !correzione && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={CLASSE_TASTO}
                disabled={fermo}
                onClick={() => setCorrezione({ a: "", motivo: "" })}
              >
                Correggi lo stato…
              </Button>
            )}
          </div>
        )}
        {correzione && pronto && !(daConfermare?.tipo === "correggi") && (
          <form onSubmit={inviaCorrezione} className="flex flex-col gap-2" noValidate>
            <label className="flex flex-col gap-1 text-[12px] font-medium">
              Torna a
              <select
                aria-label="Torna a"
                value={correzione.a}
                onChange={(e) => setCorrezione({ ...correzione, a: e.target.value as StatoOrdine })}
                className={CLASSE_MENU}
              >
                <option value="" disabled>
                  Scegli…
                </option>
                {evasione.correzioni.map((a) => (
                  <option key={a} value={a}>
                    {ETICHETTA_STATO[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium">
              Motivo (resta nello storico)
              <Textarea
                value={correzione.motivo}
                onChange={(e) => setCorrezione({ ...correzione, motivo: e.target.value })}
                maxLength={500}
                rows={2}
                className="text-[13px]"
              />
            </label>
            {erroreCorr && (
              <p role="alert" className="text-[12.5px] text-rose-700">
                {erroreCorr}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" className={CLASSE_TASTO} disabled={fermo}>
                Correggi
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={CLASSE_TASTO}
                onClick={() => {
                  setCorrezione(null);
                  setErroreCorr(null);
                }}
              >
                Lascia stare
              </Button>
            </div>
          </form>
        )}
        {daConfermare?.tipo === "correggi" && confermaInline}
      </Sezione>

      <Sezione titolo="Pagamento" id="ord-pagamento">
        <p className="text-[13px]">
          <span className={cn("font-semibold", statoPag === "pagato" && "text-emerald-700")}>
            {ETICHETTA_PAGAMENTO[statoPag]}
          </span>{" "}
          <span className="tabular-nums">{euro(importoIncassato(o))}</span>
          {" · "}
          Stripe{o.metodoDettaglio ? ` (${o.metodoDettaglio.slice(0, 40)})` : ""}
          {o.pagatoIl ? ` · ${dataOra(o.pagatoIl)}` : ""}
        </p>
        {o.rimborsatoCent > 0 && (
          <p className="text-[12.5px] text-muted-foreground">
            Rimborsato finora: <span className="tabular-nums">{euro(o.rimborsatoCent / 100)}</span>
          </p>
        )}
        {pronto &&
          (rimborsi === null ? (
            <p className="text-[12.5px] text-muted-foreground">
              Non riesco a leggere i rimborsi di questo ordine: aggiorna e riprova.
            </p>
          ) : rimborsi.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Nessun rimborso finora.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rimborsi.map((r) => (
                <li key={r.id} className="py-1.5 text-[13px]">
                  <span className="tabular-nums">{euro(r.importoCent / 100)}</span>
                  {" · "}
                  {ETICHETTA_RIMBORSO[r.stato] ?? "Stato non riconosciuto"}
                  <span className="block break-words text-[12px] text-muted-foreground">
                    {r.motivo} · {dataOra(r.creatoIl)}
                  </span>
                </li>
              ))}
            </ul>
          ))}
        {pronto && (
          <div className="flex flex-wrap items-center gap-2">
            {rimborsabile && bottoneRimborsa("principale")}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={CLASSE_TASTO}
              disabled={fermo}
              onClick={() => void avviaAzione("riconcilia", () => d.riconcilia())}
            >
              Controlla con Stripe
            </Button>
            {blocco && blocco.rimborsi === rimborsi && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={CLASSE_TASTO}
                disabled={d.inInvio}
                onClick={() => void d.ricarica()}
              >
                Aggiorna i rimborsi
              </Button>
            )}
          </div>
        )}
        {pronto && rimborsabile && tasto.ragione && (
          <p className="text-[12px] text-muted-foreground">{tasto.ragione}</p>
        )}
      </Sezione>

      {spedito && (
        <Sezione titolo="Spedizione" id="ord-tracking">
          <dl className={CLASSE_DATI}>
            {o.speditoIl && <Dato e="Spedito il" v={dataOra(o.speditoIl)} />}
            {o.senzaTracking ? (
              <Dato e="Tracking" v="Spedito senza tracking" />
            ) : (
              <>
                {o.corriere && <Dato e="Corriere" v={o.corriere} />}
                {o.tracking && (
                  <Dato
                    e="Numero"
                    v={
                      link ? (
                        <a
                          className="underline underline-offset-2"
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {o.tracking}
                        </a>
                      ) : (
                        o.tracking
                      )
                    }
                  />
                )}
              </>
            )}
          </dl>
        </Sezione>
      )}

      {pronto && (
        <Sezione titolo="Fattura" id="ord-fattura">
          {!o.fatturaRichiesta ? (
            <p className="text-[13px] text-muted-foreground">
              Il cliente non ha chiesto la fattura.
            </p>
          ) : (
            <>
              {dett?.riservati === null ? (
                <Avviso>
                  I dati per la fattura non si sono potuti leggere: aggiorna e riprova.
                </Avviso>
              ) : (
                <dl className={CLASSE_DATI}>
                  {fatturaRighe.map((r) => (
                    <Dato key={r.etichetta} e={r.etichetta} v={r.valore} />
                  ))}
                </dl>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={CLASSE_TASTO}
                  disabled={fatturaRighe.length === 0}
                  onClick={() => void copia()}
                >
                  Copia i dati per la fattura
                </Button>
              </div>
              {o.fatturaEmessaIl ? (
                <p className="text-[12.5px]">
                  Fattura emessa il {dataOra(o.fatturaEmessaIl)}
                  {o.fatturaNota ? `: ${o.fatturaNota}` : ""}
                </p>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-medium">
                    Nota (facoltativa, per esempio il numero)
                    <Input
                      value={notaFattura}
                      onChange={(e) => setNotaFattura(e.target.value)}
                      maxLength={500}
                      autoComplete="off"
                      className="min-h-11 text-[13px] sm:min-h-9"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className={CLASSE_TASTO}
                    disabled={fermo}
                    onClick={() =>
                      void avviaAzione("fattura_emessa", () =>
                        d.fatturaEmessa({ nota: notaFattura.trim() || undefined }),
                      )
                    }
                  >
                    Segna fattura emessa
                  </Button>
                </div>
              )}
            </>
          )}
          {consensiRighe.length > 0 && (
            <>
              <h4 className="mt-2 text-[12px] font-medium">Consensi del cliente</h4>
              <dl className={CLASSE_DATI}>
                {consensiRighe.map((r) => (
                  <Dato key={r.etichetta} e={r.etichetta} v={r.valore} />
                ))}
              </dl>
            </>
          )}
        </Sezione>
      )}

      {pronto && (
        <Sezione titolo="Email al cliente" id="ord-email">
          <ul className="divide-y divide-border">
            {emailRighe.map((r) => (
              <li key={r.chiave} className="flex flex-col gap-2 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.titolo}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {r.stato}
                      {r.dettaglio ? ` (${r.dettaglio})` : ""}
                    </span>
                    {r.blocco && (
                      <span className="block text-[11.5px] text-muted-foreground">{r.blocco}</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={CLASSE_TASTO}
                    disabled={fermo || r.blocco !== null}
                    onClick={() => setDaConfermare({ tipo: "email", chiave: r.chiave })}
                  >
                    Invia ora
                  </Button>
                </div>
                {daConfermare?.tipo === "email" &&
                  daConfermare.chiave === r.chiave &&
                  confermaInline}
              </li>
            ))}
          </ul>
        </Sezione>
      )}

      <SezioneNote o={o} fermo={!comandi || occupato} chiedi={chiedi} />
      <SezioneCliente o={o} />
      <SezioneRighe o={o} />
      <SezioneStorico righe={righeStorico} />

      {/*  Le finestre vivono solo mentre sono aperte, e per questo ordine (`key`): chiudere e riaprire dà una chiave di richiesta nuova. */}
      {finestra === "rimborso" && dett && (
        <DialogoRimborso
          key={o.id}
          ordine={o}
          rimborsi={rimborsi}
          apriDialogo={apriDialogo}
          inInvio={d.inInvio}
          onFatto={(r) => fatto(r, "rimborso")}
          onChiudi={() => setFinestra(null)}
        />
      )}
      {finestra === "annulla" && dett && (
        <DialogoAnnulla
          key={o.id}
          ordine={o}
          rimborsi={rimborsi}
          apriDialogo={apriDialogo}
          inInvio={d.inInvio}
          onFatto={(r) => fatto(r, "annulla")}
          onChiudi={() => setFinestra(null)}
        />
      )}
      {finestra === "spedisci" && dett && (
        <DialogoSpedisci
          key={o.id}
          ordine={o}
          spedisci={d.spedisci}
          inInvio={d.inInvio}
          onFatto={(r) => fatto(r, "spedisci")}
          onChiudi={() => setFinestra(null)}
        />
      )}
    </div>
  );
}

export interface PropsDettaglioOrdine extends Omit<PropsCorpoOrdine, "ordine"> {
  /** `null` = pannello chiuso (salvo `mancante`). */
  ordine: Ordine | null;
  /** L'indirizzo chiede un ordine che non si trova fra quelli letti: il pannello lo dice. */
  mancante?: boolean;
  onChiudi: () => void;
  /** La riga da cui si è aperto: alla chiusura il fuoco torna lì (con la tastiera non ci si perde). */
  ultimaRiga?: RefObject<HTMLElement | null>;
}

export function DettaglioOrdine({
  ordine,
  mancante,
  onChiudi,
  ultimaRiga,
  ...corpo
}: PropsDettaglioOrdine) {
  return (
    <Sheet open={!!ordine || !!mancante} onOpenChange={(v) => !v && onChiudi()}>
      <SheetContent
        side="right"
        //  `crm-theme`: il pannello vive in un portale fuori dal CRM (senza, i colori sono quelli del sito scuro).
        //  Sotto i 640 px è a tutta pagina; la X di serie si nasconde, c'è «Chiudi» da 44 px.
        className="crm-theme flex w-full flex-col gap-0 bg-white p-0 text-foreground sm:max-w-[520px] [&>button]:hidden"
        onCloseAutoFocus={(e) => {
          //  Aperto da un link (nessuna riga di partenza, o riga non più nell'elenco) il fuoco lo rimette Radix dove sa.
          const riga = ultimaRiga?.current;
          if (!riga?.isConnected) return;
          e.preventDefault();
          riga.focus();
        }}
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-border py-1.5 pl-4 pr-1">
          <SheetTitle className="min-w-0 flex-1 truncate text-[15px]">
            {ordine ? `Ordine ${ordine.ref}` : "Ordine"}
          </SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-[13px]">
              Chiudi
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Dati del cliente, righe, stato, pagamento, tracking, note interne e storico di questo
          ordine.
        </SheetDescription>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {ordine ? (
            <CorpoOrdine key={ordine.id} ordine={ordine} {...corpo} />
          ) : (
            <p className="px-4 py-6 text-[13px] text-muted-foreground">
              Non trovo questo ordine tra quelli letti: l'indirizzo potrebbe essere sbagliato.
              Chiudi e cercalo nell'elenco.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
