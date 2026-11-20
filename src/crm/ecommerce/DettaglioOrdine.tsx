/** ── IL DETTAGLIO DELL'ORDINE (DettaglioOrdine.tsx) · pannello laterale ────────
 *  Commessa 2026-11-17-crm-ecommerce, T12 (SPEC §3.3). Un pannello (`Sheet`): a destra sul computer, a tutta pagina sotto i
 *  640 px. Dentro, in ordine di uso: stato, pagamento, tracking, note interne (le cose che si FANNO), poi cliente, righe e
 *  storico (le cose che si LEGGONO). Un ordine sbagliato si segna «Annullato»: non c'è altro modo di toglierlo dalle cifre.
 *
 *  Qui non si chiama la rotta: ogni comando manda un'`Azione` a `chiedi`, che sta in `ElencoOrdini` (conferme, un'azione per
 *  volta, frase dell'esito). Il corpo (`CorpoOrdine`) è separato dal pannello perché il pannello vive in un portale e il corpo
 *  si può disegnare e provare da solo.
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
import type { Azione } from "./azioni";
import type { EventoStorico, RisultatoStorico } from "./client";
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
  avvisiOrdine,
  controllaPagamento,
  descriviEvento,
  importoDiPartenza,
  ordinaEventi,
} from "./ordini-ui";
import type { Esito } from "./ordini-ui";
import { AVVISO_MIGRAZIONE, euro } from "./pagina";

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

export function CorpoOrdine({
  ordine: o,
  comandi,
  occupato,
  esito,
  chiedi,
  storico,
}: PropsCorpoOrdine) {
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
  const [nota, setNota] = useBozza(o.noteInterne);
  const salva = (azione: "tracking" | "nota_interna", valore: string) => (ev: FormEvent) => {
    ev.preventDefault();
    void chiedi({ azione, ordineId: o.id, valore });
  };

  //  ── storico: si rilegge quando l'ordine cambia (dopo ogni azione `aggiornatoIl` si muove) ──
  const [righe, setRighe] = useState<{
    fase: "carico" | "ok" | "errore";
    eventi: EventoStorico[];
    messaggio: string;
    pronta: boolean;
  }>({ fase: "carico", eventi: [], messaggio: "", pronta: true });
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
        <form onSubmit={salva("tracking", tracking)} className="flex flex-col gap-1.5">
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

      <Sezione titolo="Note interne" id="ord-note">
        <form onSubmit={salva("nota_interna", nota)} className="flex flex-col gap-1.5">
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
                  {d.dettaglio && (
                    <p className="break-words text-muted-foreground">{d.dettaglio}</p>
                  )}
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
