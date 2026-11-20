/** ── «APRI LO SHOP AL PUBBLICO» (ApriShop.tsx) ───────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T17 (Design §4.10.5, D26). In cima alla linguetta «Prodotti»: l'interruttore e sotto le
 *  condizioni di uscita come righe a spunta automatiche (le calcola il server, qui si leggono e basta).
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · L'interruttore è spento (`disabled`) finché `puoAprire` non è vero: lo decide il server, e qui si rifà il controllo per non
 *    mandare una richiesta che verrebbe rifiutata. Se il server rifiuta lo stesso («cancello») si mostrano le sue righe.
 *  · Le righe che nel R1 non si sanno valutare (la cassa) dicono «si attiva col rilascio della cassa». Finché ce n'è una,
 *    **in produzione lo shop non si può aprire** (D26): la schermata lo dice, non lo nasconde.
 *  · Tornare a chiuso è UN clic e non guarda le condizioni: «Chiudi lo shop».
 *  · Le regole senza schermo sono in `interruttore-puro.ts`. Nessun `fetch` da qui: tutto passa da `negozio`.
 *  · Permesso o sessione negati, o S1 assente («migrazione»): non si disegna niente (l'elenco sotto lo dice già, una volta sola).
 *  ⚠️ Nessun log da qui, mai.
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `negozio`  `Pick<Negozio, "interruttori" | "esegui">`: `interruttori()` legge `{ interruttori, condizioni }`,
 *                `esegui("interruttore_imposta", { chiave, valore, atteso })` li cambia. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, Clock, Lock, RefreshCw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { Avviso } from "@/crm/ecommerce/Avviso";
import type { ErroreNegozio } from "@/crm/negozio/client";
import {
  fraseCondizione,
  leggiStatoShop,
  riepilogoCondizioni,
  righeDaCondizioni,
  statoCondizione,
  titoloCondizione,
  type StatoRiga,
  type StatoShop,
} from "./interruttore-puro";
import type { Negozio } from "./tipi";

export interface PropsApriShop {
  negozio: Pick<Negozio, "interruttori" | "esegui">;
}

const FRASE_AVVISO = "Con lo shop aperto il sito mostra solo i prodotti pubblicati qui.";
const MAX_SOGLIA = 9999;
type Lavoro = "apertura" | "chiusura" | "soglia";
interface Esito {
  tono: "ok" | "errore";
  testo: string;
  riprova?: () => void;
}
interface Lettura {
  stato: StatoShop | null;
  errore: ErroreNegozio | null;
  letto: boolean;
}

const SEGNI: Record<StatoRiga, { testo: string; classe: string; icona: typeof Clock }> = {
  ok: { testo: "A posto", classe: "text-emerald-700", icona: CircleCheck },
  no: { testo: "Da sistemare", classe: "text-amber-800", icona: CircleAlert },
  non_valutabile: { testo: "Non ancora attivo", classe: "text-slate-600", icona: Clock },
};

export function ApriShop({ negozio }: PropsApriShop) {
  const { interruttori, esegui } = negozio;
  const [lettura, setLettura] = useState<Lettura>({ stato: null, errore: null, letto: false });
  const [lavoro, setLavoro] = useState<Lavoro | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const sequenza = useRef(0);
  const vivo = useRef(true);

  const carica = useCallback(async () => {
    const n = ++sequenza.current;
    const r = await interruttori();
    if (!vivo.current || n !== sequenza.current) return; // una lettura più vecchia di un'altra non conta
    if (!r.ok) {
      const negato = r.errore.tipo === "permesso" || r.errore.tipo === "sessione";
      setLettura((p) => ({ stato: negato ? null : p.stato, errore: r.errore, letto: true }));
      return;
    }
    const stato = leggiStatoShop(r.dati);
    setLettura((p) =>
      stato
        ? { stato, errore: null, letto: true }
        : {
            stato: p.stato,
            errore: {
              tipo: "server",
              messaggio: "Non capisco la risposta del server: riprova tra un momento.",
            },
            letto: true,
          },
    );
  }, [interruttori]);

  useEffect(() => {
    vivo.current = true;
    void carica();
    return () => {
      vivo.current = false;
    };
  }, [carica]);

  /** Un cambio di interruttore. Gli errori dicono cosa è successo; il conflitto e la rete incerta rileggono. */
  async function imposta(
    dati: { chiave: string; valore: string | number; atteso: unknown },
    fatto: string,
    lavoroInCorso: Lavoro,
  ) {
    setLavoro(lavoroInCorso);
    setEsito(null);
    const r = await esegui("interruttore_imposta", dati);
    if (!vivo.current) return;
    setLavoro(null);
    if (r.ok) {
      setEsito({ tono: "ok", testo: fatto });
      await carica();
      return;
    }
    const e = r.errore;
    if (e.tipo === "cancello") {
      //  Il server ha le sue righe: si mostrano quelle (può aver visto qualcosa che qui è già vecchio).
      const righe = righeDaCondizioni(e.condizioni);
      if (righe)
        setLettura((p) => (p.stato ? { ...p, stato: { ...p.stato, righe, puoAprire: false } } : p));
      setEsito({ tono: "errore", testo: e.messaggio });
      return;
    }
    if (e.tipo === "conflitto") {
      setEsito({
        tono: "errore",
        testo:
          "Un'altra persona ha cambiato lo shop nel frattempo: ho aggiornato la schermata. Controlla e riprova.",
      });
      await carica();
      return;
    }
    if (e.tipo === "rete") await carica(); // la richiesta può essere arrivata: si guarda com'è davvero
    setEsito({
      tono: "errore",
      testo: e.messaggio,
      riprova: e.tipo === "rete" ? undefined : () => void imposta(dati, fatto, lavoroInCorso),
    });
  }

  if (!lettura.letto)
    return (
      <div
        role="status"
        aria-busy="true"
        className="h-24 animate-pulse rounded-xl border border-border bg-muted/50 motion-reduce:animate-none"
      >
        <span className="sr-only">Controllo lo shop…</span>
      </div>
    );
  //  Senza permesso, senza sessione o senza le tabelle del catalogo (S1 assente) l'elenco dei prodotti lo dice già,
  //  con la sua frase e il suo «Riprova»: qui non si ripete.
  if (
    !lettura.stato &&
    (lettura.errore?.tipo === "permesso" ||
      lettura.errore?.tipo === "sessione" ||
      lettura.errore?.tipo === "migrazione")
  )
    return null;
  if (!lettura.stato)
    return (
      <Avviso
        errore
        azione={
          <Button
            size="sm"
            variant="outline"
            className="h-11 text-[12px] md:h-8"
            onClick={() => void carica()}
          >
            Riprova
          </Button>
        }
      >
        Non riesco a controllare se lo shop è aperto. {lettura.errore?.messaggio}
      </Avviso>
    );

  return (
    <Pannello
      stato={lettura.stato}
      errore={lettura.errore}
      lavoro={lavoro}
      esito={esito}
      ricontrolla={() => void carica()}
      imposta={imposta}
    />
  );
}

function Pannello({
  stato,
  errore,
  lavoro,
  esito,
  ricontrolla,
  imposta,
}: {
  stato: StatoShop;
  errore: ErroreNegozio | null;
  lavoro: Lavoro | null;
  esito: Esito | null;
  ricontrolla: () => void;
  imposta: (
    dati: { chiave: string; valore: string | number; atteso: unknown },
    fatto: string,
    lavoro: Lavoro,
  ) => Promise<void>;
}) {
  const occupato = lavoro !== null;
  const { aPosto, totale, nonValutabili } = riepilogoCondizioni(stato.righe);

  /** Non parte se lo shop non si può aprire: il server lo rifiuterebbe comunque. */
  const apri = () => {
    if (!stato.puoAprire) return;
    void imposta(
      { chiave: "catalogo_sito", valore: "cms", atteso: stato.valore },
      "Lo shop è aperto al pubblico.",
      "apertura",
    );
  };
  const chiudi = () => {
    void imposta(
      { chiave: "catalogo_sito", valore: "codice", atteso: stato.valore },
      "Lo shop è chiuso: il sito è tornato al catalogo di prima.",
      "chiusura",
    );
  };

  const messaggi = (
    <>
      {errore && (
        <Avviso
          errore
          azione={
            <Button
              size="sm"
              variant="outline"
              className="h-11 text-[12px] md:h-8"
              onClick={ricontrolla}
            >
              Riprova
            </Button>
          }
        >
          Non riesco ad aggiornare lo shop: quello che vedi è l&apos;ultima lettura buona.{" "}
          {errore.messaggio}
        </Avviso>
      )}
      {esito && (
        <Avviso
          errore={esito.tono === "errore"}
          azione={
            esito.riprova && (
              <Button
                size="sm"
                variant="outline"
                className="h-11 text-[12px] md:h-8"
                onClick={esito.riprova}
              >
                Riprova
              </Button>
            )
          }
        >
          {esito.testo}
        </Avviso>
      )}
    </>
  );

  if (stato.aperto)
    return (
      <section aria-label="Shop aperto al pubblico" className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-emerald-900">
              <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
              Lo shop è aperto al pubblico
            </p>
            <p className="mt-0.5 text-[12.5px] text-emerald-900/80">{FRASE_AVVISO}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 bg-white text-[12.5px] sm:min-h-8"
            disabled={occupato}
            onClick={chiudi}
          >
            {lavoro === "chiusura" ? "Chiudo…" : "Chiudi lo shop"}
          </Button>
        </div>
        {messaggi}
        <ImpostazioniCatalogo stato={stato} lavoro={lavoro} imposta={imposta} />
      </section>
    );

  return (
    <section aria-labelledby="apri-shop-titolo" className="flex flex-col gap-2">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="apri-shop-titolo" className="text-[15px] font-semibold tracking-tight">
                Apri lo shop al pubblico
              </h2>
              <Chip tono="neutro" punto>
                Chiuso
              </Chip>
            </div>
            <p id="apri-shop-aiuto" className="mt-1 text-[12.5px] text-muted-foreground">
              Finché è chiuso il sito mostra il catalogo di prima. {FRASE_AVVISO}
            </p>
          </div>
          <div className="-my-2 flex min-h-11 shrink-0 items-center">
            <Switch
              disabled={!stato.puoAprire || occupato}
              checked={false}
              onCheckedChange={apri}
              aria-label="Apri lo shop al pubblico"
              aria-describedby="apri-shop-aiuto apri-shop-esito"
              className="h-7 w-12 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
            />
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12.5px] font-semibold">Condizioni per aprire</h3>
            <div className="flex items-center gap-2">
              <span className="text-[12px] tabular-nums text-muted-foreground">
                {aPosto} su {totale} a posto
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 text-[12px] sm:min-h-8"
                disabled={occupato}
                onClick={ricontrolla}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Ricontrolla
              </Button>
            </div>
          </div>
          {stato.righe.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Il server non ha mandato le condizioni: lo shop non si può aprire. Riprova tra un
              momento.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {stato.righe.map((r) => {
                const s = statoCondizione(r);
                const { testo, classe, icona: Icona } = SEGNI[s];
                return (
                  <li key={r.chiave} className="flex items-start gap-2.5 py-2">
                    <Icona className={cn("mt-0.5 h-4 w-4 shrink-0", classe)} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug">{titoloCondizione(r)}</p>
                      <p className="text-[12.5px] leading-snug text-muted-foreground">
                        {fraseCondizione(r)}
                      </p>
                      {/* sul telefono lo stato sta sotto il testo: a destra gli toglieva metà riga */}
                      <p className={cn("mt-0.5 text-[11.5px] font-medium sm:hidden", classe)}>
                        {testo}
                      </p>
                    </div>
                    <span
                      className={cn("hidden shrink-0 text-[11.5px] font-medium sm:block", classe)}
                    >
                      {testo}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p
            id="apri-shop-esito"
            className="mt-2 flex items-start gap-1.5 text-[12.5px] text-muted-foreground"
          >
            {!stato.puoAprire && (
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {stato.puoAprire
                ? "Tutte le condizioni sono a posto: puoi aprire lo shop. Potrai richiuderlo con un clic."
                : nonValutabili > 0
                  ? "Per ora lo shop non si può aprire al pubblico: le condizioni che dipendono dalla cassa si attivano col rilascio della cassa. Intanto puoi preparare e provare il catalogo con l'anteprima."
                  : "Lo shop si apre quando tutte le condizioni sono a posto."}
            </span>
          </p>
        </div>
      </div>
      {messaggi}
      <ImpostazioniCatalogo stato={stato} lavoro={lavoro} imposta={imposta} />
    </section>
  );
}

/** La soglia «giacenza bassa»: sotto questo numero di pezzi l'elenco avvisa. 0 = nessun avviso. */
function ImpostazioniCatalogo({
  stato,
  lavoro,
  imposta,
}: {
  stato: StatoShop;
  lavoro: Lavoro | null;
  imposta: (
    dati: { chiave: string; valore: string | number; atteso: unknown },
    fatto: string,
    lavoro: Lavoro,
  ) => Promise<void>;
}) {
  const [bozza, setBozza] = useState(stato.soglia === null ? "" : String(stato.soglia));
  //  Quando il valore sul server cambia (rilettura) la casella lo segue.
  useEffect(() => setBozza(stato.soglia === null ? "" : String(stato.soglia)), [stato.soglia]);
  const valore = /^\d{1,4}$/.test(bozza.trim()) ? Number(bozza.trim()) : null;
  const valida = valore !== null && valore <= MAX_SOGLIA;
  const cambiata = valida && valore !== stato.soglia;
  return (
    <details className="group rounded-xl border border-border bg-card px-4 text-[12.5px]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium sm:min-h-9 [&::-webkit-details-marker]:hidden">
        Impostazioni del catalogo
        <ChevronDown
          className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <form
        className="flex flex-wrap items-end gap-3 pb-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!cambiata || valore === null || stato.soglia === null) return;
          void imposta(
            { chiave: "giacenza_bassa", valore, atteso: stato.soglia },
            "Soglia di giacenza bassa salvata.",
            "soglia",
          );
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="soglia-giacenza" className="font-medium">
            Giacenza bassa: avvisa sotto i
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="soglia-giacenza"
              inputMode="numeric"
              value={bozza}
              onChange={(ev) => setBozza(ev.target.value)}
              disabled={stato.soglia === null || lavoro !== null}
              aria-invalid={bozza.trim() !== "" && !valida}
              aria-describedby="soglia-aiuto"
              className="h-11 w-24 md:h-8"
            />
            <span>pezzi</span>
          </div>
        </div>
        <Button
          type="submit"
          variant="outline"
          className="min-h-11 text-[12.5px] sm:min-h-8"
          disabled={!cambiata || lavoro !== null}
        >
          {lavoro === "soglia" ? "Salvo…" : "Salva"}
        </Button>
        <p id="soglia-aiuto" className="basis-full text-muted-foreground">
          {stato.soglia === null
            ? "Non riesco a leggere la soglia attuale: ricontrolla tra un momento."
            : `Un numero da 0 a ${MAX_SOGLIA}. Con 0 l'elenco non avvisa mai.`}
        </p>
      </form>
    </details>
  );
}
