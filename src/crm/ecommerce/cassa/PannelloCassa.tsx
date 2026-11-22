/** ── LA SCHEDA «CASSA» DEL CRM (PannelloCassa.tsx) ──────────────────────────────────────────
 *  Shop completo R2, T62 (PIANO-R2 D56, D58, D59, D65). Sta in `/CRM/ecommerce?scheda=cassa` (permesso `pagamenti`, lo stesso
 *  degli ordini). Dice, in quest'ordine:
 *   1. Stripe: collegato o no, PROVA o REALE (dal prefisso della chiave, letto dal server: la chiave non arriva mai qui),
 *      «Prova adesso» e l'ultimo webhook ricevuto;
 *   2. il webhook da incollare in Stripe: l'indirizzo con «Copia» e gli eventi da spuntare;
 *   3. «Cassa del sito»: l'interruttore `vecchia`/`Stripe`, con le condizioni e una frase per ciascuna che manca;
 *   4. «Pagamento sicuro» (spento con la sua frase finché non c'è un pagamento reale rimborsato) e i metodi attivi sull'account;
 *   5. «Collaudo con chiave» (T67, D57): il pulsante che chiede il link `…/shop/collaudo#k=…` a `collaudo_chiave`, con «Copia».
 *      Il link vive solo nello stato del riquadro: mai in `localStorage`, nella cronologia o in un log.
 *
 *  ── COME È FATTA ─────────────────────────────────────────────────────────────
 *  `VistaCassa` disegna e basta (riceve dati e funzioni: si prova con `react-dom/server`). `PannelloCassa` tiene lo stato e parla
 *  con le rotte tramite `pagina-r2.ts` (che riceve `fetch`: nella pagina è `fetchCRM`). La lettura parte QUANDO il pannello si
 *  disegna, cioè solo aprendo la linguetta: le altre schede non toccano Stripe.
 *  Chi non ha il permesso, o ha la sessione scaduta, non vede nemmeno i dati di una lettura precedente.
 *  Nessuna parola «Elimina»: qui si accende e si spegne, non si cancella niente. Nessun log. Nessuna chiave. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Clipboard, ClipboardCheck, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { Avviso } from "@/crm/ecommerce/Avviso";
import { Riquadro } from "@/crm/ecommerce/Riquadro";
import {
  EVENTI_STRIPE,
  FRASE_COLLAUDO,
  FRASE_SICURO,
  METODI_PAGAMENTO,
  caricaCassa,
  caricaStripe,
  copiaLink,
  creaLinkCollaudo,
  impostaCassa,
  indirizzoWebhook,
  metodiDopoCambio,
  motivoStripeSpento,
  provaAdesso,
  type EsitoCopia,
  type ErroreR2,
  type FetchRotta,
  type StatoCassa,
  type StatoStripe,
} from "@/crm/ecommerce/pagina-r2";

/** Il nastro in cima alla pagina quando la chiave è di prova (D58). Lo mette il guscio, solo se `mostraNastro` dice sì. */
export function NastroProva() {
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500 bg-amber-300 px-4 py-2 text-center text-[13px] font-semibold tracking-wide text-amber-950"
    >
      PROVA: nessun pagamento è reale
    </div>
  );
}

type Lavoro = "prova" | "cassa" | "sicuro" | "metodi";
interface Esito {
  tono: "ok" | "errore";
  testo: string;
  /** In quale riquadro si legge: l'esito sta accanto all'interruttore che si è girato, non in fondo alla pagina. */
  dove: "webhook" | "cassa" | "sicuro";
}
interface EsitoProva {
  ok: boolean;
  frase: string;
}

export interface PropsVistaCassa {
  stripe: StatoStripe | null;
  erroreStripe: string | null;
  cassa: StatoCassa | null;
  erroreCassa: string | null;
  lavoro: Lavoro | null;
  esito: Esito | null;
  indirizzo: string;
  copiato: boolean;
  provaEsito: EsitoProva | null;
  onProva: () => void;
  onCassa: (stripe: boolean) => void;
  onSicuro: (acceso: boolean) => void;
  onMetodo: (metodo: string, attivo: boolean) => void;
  onCopia: () => void;
  onRiprova: () => void;
  /** Il riquadro «Collaudo con chiave» (`RiquadroCollaudo` nella scheda vera), in fondo. */
  collaudo?: ReactNode;
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const Attesa = ({ cosa }: { cosa: string }) => (
  <div
    role="status"
    aria-busy="true"
    className="h-16 animate-pulse rounded-lg bg-muted/50 motion-reduce:animate-none"
  >
    <span className="sr-only">Controllo {cosa}…</span>
  </div>
);

export function VistaCassa(p: PropsVistaCassa) {
  const occupato = p.lavoro !== null;
  /** L'esito dell'ultimo cambio, dentro il riquadro dove si è fatto. Se i dati della cassa non ci sono più (permesso perso) il riquadro dei
   *  «metodi» non si disegna: l'esito si legge in quello di «Cassa del sito», che c'è sempre. */
  const esitoIn = (dove: Esito["dove"]) => {
    const e = p.esito;
    if (!e || (e.dove !== dove && !(dove === "cassa" && e.dove === "sicuro" && !p.cassa)))
      return null;
    return e.tono === "ok" ? (
      <p role="status" className="flex items-start gap-1.5 text-[12.5px] text-emerald-800">
        <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {e.testo}
      </p>
    ) : (
      <Avviso errore>{e.testo}</Avviso>
    );
  };
  const riprova = (
    <Button size="sm" variant="outline" className="h-11 text-[12px] md:h-8" onClick={p.onRiprova}>
      Riprova
    </Button>
  );
  const motivi = p.cassa ? motivoStripeSpento(p.cassa) : [];
  const stripeSpento =
    !p.cassa || p.cassa.valore === null || (p.cassa.valore === "vecchia" && motivi.length > 0);
  /** Perché l'interruttore è spento: le frasi (una per condizione che manca) a cui punta `aria-describedby`; con tutto a posto, la spiegazione. */
  const idRiga = (chiave: string) => `cassa-cond-${chiave.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const descrizioneCassa = !p.cassa
    ? "cassa-sito-aiuto"
    : p.cassa.valore === null
      ? "cassa-sito-aiuto cassa-sito-semi"
      : !stripeSpento
        ? "cassa-sito-aiuto"
        : p.cassa.righe.some((r) => !r.ok)
          ? [
              "cassa-sito-aiuto",
              ...p.cassa.righe.filter((r) => !r.ok).map((r) => idRiga(r.chiave)),
            ].join(" ")
          : "cassa-sito-aiuto cassa-sito-righe";
  const sicuroSpento = !p.cassa || (!p.cassa.sicuro && !p.cassa.puoAccendereSicuro);

  return (
    <div className="flex flex-col gap-4">
      {/* ── 1 · Stripe ── */}
      <Riquadro
        id="cassa-stripe"
        titolo="Stripe"
        chip={
          p.stripe && (
            <Chip
              tono={
                p.stripe.modalita === "prova"
                  ? "in_sospeso"
                  : p.stripe.modalita === "reale"
                    ? "vinta"
                    : "neutro"
              }
              punto
            >
              {p.stripe.collegato
                ? `Stripe collegato · ${p.stripe.modalita === "prova" ? "PROVA" : p.stripe.modalita === "reale" ? "REALE" : "modalità non letta"}`
                : "Non collegato"}
            </Chip>
          )
        }
      >
        {p.erroreStripe && (
          <Avviso errore azione={riprova}>
            {p.erroreStripe}
          </Avviso>
        )}
        {!p.stripe && !p.erroreStripe && <Attesa cosa="Stripe" />}
        {p.stripe && (
          <>
            <p className="text-[12.5px] text-muted-foreground">
              {!p.stripe.collegato
                ? "Stripe non è collegato: la chiave va messa fra le variabili del sito da chi lo gestisce. Qui non si scrive e non si vede mai."
                : p.stripe.modalita === "prova"
                  ? "Sono le chiavi di prova: i pagamenti non sono veri e gli ordini fatti così si vedono con il badge «PROVA»."
                  : p.stripe.modalita === "reale"
                    ? "Sono le chiavi reali: i pagamenti sono veri."
                    : "Il server non dice se la chiave è di prova o reale: controlla le variabili del sito."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                disabled={occupato}
                onClick={p.onProva}
              >
                <RefreshCw
                  className={cn("mr-1.5 h-3.5 w-3.5", p.lavoro === "prova" && "animate-spin")}
                  aria-hidden="true"
                />
                {p.lavoro === "prova" ? "Provo…" : "Prova adesso"}
              </Button>
              <span className="text-[12px] text-muted-foreground">
                Una sola lettura innocua a Stripe: non crea né cambia niente.
              </span>
            </div>
            {p.provaEsito && (
              <p
                role="status"
                className={cn(
                  "flex items-start gap-1.5 text-[12.5px]",
                  p.provaEsito.ok ? "text-emerald-800" : "text-rose-800",
                )}
              >
                {p.provaEsito.ok ? (
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                {p.provaEsito.frase}
              </p>
            )}
            <p className="text-[12.5px]">
              {p.stripe.ultimoWebhook ? (
                <>
                  Ultimo webhook ricevuto:{" "}
                  <span className="font-medium">{p.stripe.ultimoWebhook.tipo}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {quando(p.stripe.ultimoWebhook.ricevutoIl)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Nessun webhook ricevuto ancora: se hai già fatto un pagamento di prova, controlla
                  l'indirizzo qui sotto.
                </span>
              )}
            </p>
          </>
        )}
      </Riquadro>

      {/* ── 2 · Il webhook da incollare in Stripe ── */}
      <Riquadro id="cassa-webhook" titolo="Il webhook da collegare in Stripe">
        <p className="text-[12.5px] text-muted-foreground">
          In Stripe, in «Sviluppatori → Webhook», aggiungi questo indirizzo e spunta gli eventi qui
          sotto. Il segreto di firma che Stripe ti dà lo mette chi gestisce il sito fra le
          variabili: non si incolla in questa pagina.
        </p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={p.indirizzo}
            aria-label="Indirizzo del webhook"
            className="h-11 min-w-0 flex-1 font-mono text-[12.5px] md:h-9 md:text-[12.5px]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 text-[12.5px] sm:min-h-8"
            disabled={!p.indirizzo}
            onClick={p.onCopia}
          >
            {p.copiato ? (
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Clipboard className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {p.copiato ? "Copiato" : "Copia"}
          </Button>
        </div>
        <div>
          <h3 className="text-[12.5px] font-semibold">Eventi da spuntare</h3>
          <ul className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {EVENTI_STRIPE.map((ev) => (
              <li key={ev} className="font-mono text-[12px] text-muted-foreground">
                {ev}
              </li>
            ))}
          </ul>
        </div>
        {esitoIn("webhook")}
      </Riquadro>

      {/* ── 3 · La cassa del sito ── */}
      <Riquadro
        id="cassa-sito"
        titolo="Cassa del sito"
        chip={
          p.cassa &&
          p.cassa.valore && (
            <Chip tono={p.cassa.valore === "stripe" ? "vinta" : "neutro"} punto>
              {p.cassa.valore === "stripe" ? "Con Stripe" : "Quella di prima"}
            </Chip>
          )
        }
      >
        {p.erroreCassa && (
          <Avviso errore azione={riprova}>
            {p.erroreCassa}
          </Avviso>
        )}
        {!p.cassa && !p.erroreCassa && <Attesa cosa="la cassa" />}
        {p.cassa && (
          <>
            <div className="flex items-start justify-between gap-3">
              <p id="cassa-sito-aiuto" className="min-w-0 text-[12.5px] text-muted-foreground">
                Con la cassa di prima il sito prende l'ordine senza pagamento. Con Stripe il cliente
                paga sulla pagina di Stripe e l'ordine risulta pagato solo quando Stripe lo
                conferma. La cassa nuova lavora solo con lo shop aperto al pubblico (scheda
                Prodotti): finché è chiuso il sito usa quella di prima. Tornare a quella di prima è
                sempre un clic.
              </p>
              <div className="-my-2 flex min-h-11 shrink-0 items-center">
                <Switch
                  disabled={stripeSpento || occupato}
                  checked={p.cassa.valore === "stripe"}
                  onCheckedChange={(v) => p.onCassa(v)}
                  aria-label="Usa la cassa Stripe"
                  aria-describedby={descrizioneCassa}
                  className="h-7 w-12 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
                />
              </div>
            </div>
            {p.cassa.valore === null ? (
              <p
                id="cassa-sito-semi"
                className="flex items-start gap-1.5 text-[12.5px] text-amber-900"
              >
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {motivi[0]}
              </p>
            ) : p.cassa.righe.length === 0 ? (
              <p id="cassa-sito-righe" className="text-[12.5px] text-muted-foreground">
                {p.cassa.avviso ??
                  "Il server non ha mandato le condizioni: la cassa Stripe non si può accendere. Riprova tra un momento."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {p.cassa.righe.map((r) => (
                  <li key={r.chiave} className="flex items-start gap-2.5 py-2">
                    {r.ok ? (
                      <CircleCheck
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
                        aria-hidden="true"
                      />
                    )}
                    <p id={idRiga(r.chiave)} className="min-w-0 flex-1 text-[12.5px] leading-snug">
                      {r.frase}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-[11.5px] font-medium",
                        r.ok ? "text-emerald-700" : "text-amber-800",
                      )}
                    >
                      {r.ok ? "A posto" : "Da sistemare"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {esitoIn("cassa")}
      </Riquadro>

      {/* ── 4 · «Pagamento sicuro» e i metodi ── */}
      {p.cassa && (
        <Riquadro id="cassa-sicuro" titolo="Pagamento sicuro e metodi">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">Mostra «Pagamento sicuro» sul sito</p>
              <p id="cassa-sicuro-aiuto" className="mt-0.5 text-[12.5px] text-muted-foreground">
                {sicuroSpento
                  ? FRASE_SICURO
                  : "Sulla cassa del sito compare la dicitura «Pagamento sicuro», solo con la cassa Stripe attiva."}
              </p>
            </div>
            <div className="-my-2 flex min-h-11 shrink-0 items-center">
              <Switch
                disabled={sicuroSpento || occupato}
                checked={p.cassa.sicuro}
                onCheckedChange={(v) => p.onSicuro(v)}
                aria-label="Mostra «Pagamento sicuro» sul sito"
                aria-describedby="cassa-sicuro-aiuto"
                className="h-7 w-12 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
              />
            </div>
          </div>
          <fieldset disabled={occupato} className="border-t border-border pt-3">
            <legend className="sr-only">Metodi attivi sull'account Stripe</legend>
            <p className="text-[12.5px] font-semibold">Metodi attivi sull'account Stripe</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Spunta solo quelli che hai già attivato nel pannello di Stripe: sul sito si vedono i
              loghi di questi, e solo con «Pagamento sicuro» acceso.
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {METODI_PAGAMENTO.map((m) => (
                <li key={m.chiave} className="flex min-h-11 items-center gap-2 sm:min-h-8">
                  <Checkbox
                    id={`metodo-${m.chiave}`}
                    aria-label={m.etichetta}
                    checked={p.cassa?.metodi.includes(m.chiave) ?? false}
                    onCheckedChange={(v) => p.onMetodo(m.chiave, v === true)}
                  />
                  <label htmlFor={`metodo-${m.chiave}`} className="text-[13px]">
                    {m.etichetta}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {esitoIn("sicuro")}
        </Riquadro>
      )}
      {p.collaudo}
    </div>
  );
}

/* ══ COLLAUDO CON CHIAVE (T67, D57) ══════════════════════════════════════════ */

export interface PropsVistaCollaudo {
  link: string | null;
  errore: string | null;
  inCorso: boolean;
  copia: EsitoCopia | null;
  onCrea: () => void;
  onCopia: () => void;
}

export function VistaCollaudo(p: PropsVistaCollaudo) {
  return (
    <Riquadro id="cassa-collaudo" titolo="Collaudo con chiave">
      <p className="text-base text-muted-foreground md:text-[12.5px]">
        Serve a provare la cassa nuova dal tuo telefono, sul sito vero: per tutti gli altri non
        cambia niente.
      </p>
      <p id="cassa-collaudo-avviso" className="text-base font-medium md:text-[12.5px]">
        {FRASE_COLLAUDO}
      </p>
      <div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 text-base sm:min-h-8 sm:text-[12.5px]"
          disabled={p.inCorso}
          onClick={p.onCrea}
        >
          {p.inCorso ? "Creo il link…" : "Crea il link di collaudo"}
        </Button>
      </div>
      {p.errore && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-base leading-snug text-rose-900 md:text-[12.5px]"
        >
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{p.errore}</p>
        </div>
      )}
      {p.link && (
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={p.link}
            aria-label="Link di collaudo"
            aria-describedby="cassa-collaudo-avviso"
            className="h-11 min-w-0 flex-1 font-mono text-base md:h-9 md:text-[12.5px]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 text-base sm:min-h-8 sm:text-[12.5px]"
            onClick={p.onCopia}
          >
            <Clipboard className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Copia
          </Button>
        </div>
      )}
      {p.copia && (
        <p
          role="status"
          className={cn(
            "text-base md:text-[12.5px]",
            p.copia.ok ? "text-emerald-800" : "text-rose-800",
          )}
        >
          {p.copia.testo}
        </p>
      )}
    </Riquadro>
  );
}

/** Lo stato del riquadro: il link resta qui, in memoria, e sparisce con la scheda. */
export function RiquadroCollaudo({ fetch }: { fetch: FetchRotta }) {
  const [link, setLink] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [copia, setCopia] = useState<EsitoCopia | null>(null);
  const vivo = useRef(true);
  const via = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  async function crea() {
    if (via.current) return; // un secondo clic prima che il pulsante si spenga
    via.current = true;
    setInCorso(true);
    setLink(null);
    setErrore(null);
    setCopia(null);
    const r = await creaLinkCollaudo(fetch);
    via.current = false;
    if (!vivo.current) return;
    setInCorso(false);
    if (r.ok) setLink(r.link);
    else setErrore(r.messaggio);
  }

  return (
    <VistaCollaudo
      link={link}
      errore={errore}
      inCorso={inCorso}
      copia={copia}
      onCrea={() => void crea()}
      onCopia={() =>
        link &&
        void copiaLink(link).then((e) => {
          if (vivo.current) setCopia(e);
        })
      }
    />
  );
}

/** La scheda vera: lo stato e le chiamate. `sulloStato` dice al guscio com'è Stripe (serve al nastro «PROVA» sulle altre schede). */
export function PannelloCassa({
  fetch,
  sulloStato,
}: {
  fetch: FetchRotta;
  sulloStato?: (s: StatoStripe | null) => void;
}) {
  const [stripe, setStripe] = useState<StatoStripe | null>(null);
  const [cassa, setCassa] = useState<StatoCassa | null>(null);
  const [erroreStripe, setErroreStripe] = useState<string | null>(null);
  const [erroreCassa, setErroreCassa] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState<Lavoro | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [provaEsito, setProvaEsito] = useState<EsitoProva | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [indirizzo, setIndirizzo] = useState("");
  const sequenza = useRef(0);
  const vivo = useRef(true);
  const sullo = useRef(sulloStato);
  sullo.current = sulloStato;

  /** A chi non può non si lascia a schermo niente di una lettura precedente. */
  const negato = (e: ErroreR2) => e.tipo === "permesso" || e.tipo === "sessione";

  const carica = useCallback(async () => {
    const n = ++sequenza.current;
    const [s, k] = await Promise.all([caricaStripe(fetch), caricaCassa(fetch)]);
    if (!vivo.current || n !== sequenza.current) return; // una lettura più vecchia di un'altra non conta
    if (s.ok) {
      setStripe(s.stripe);
      setErroreStripe(null);
    } else {
      setStripe((p) => (negato(s) ? null : p));
      setErroreStripe(s.messaggio);
    }
    if (k.ok) {
      setCassa(k.cassa);
      setErroreCassa(null);
    } else {
      setCassa((p) => (negato(k) ? null : p));
      setErroreCassa(k.messaggio);
    }
  }, [fetch]);

  useEffect(() => {
    vivo.current = true;
    setIndirizzo(indirizzoWebhook(window.location.origin));
    void carica();
    return () => {
      vivo.current = false;
    };
  }, [carica]);
  useEffect(() => {
    if (stripe) sullo.current?.(stripe); // mai al montaggio con `null`: il nastro già acceso non deve spegnersi e riaccendersi
  }, [stripe]);

  async function prova() {
    setLavoro("prova");
    setProvaEsito(null);
    const r = await provaAdesso(fetch);
    if (!vivo.current) return;
    setLavoro(null);
    setProvaEsito(r.ok ? { ok: true, frase: r.frase } : { ok: false, frase: r.messaggio });
  }

  /** Un cambio di interruttore. I rifiuti dicono perché; il conflitto e la rete incerta rileggono. */
  async function cambia(
    lavoroInCorso: Lavoro,
    chiave: string,
    valore: unknown,
    atteso: unknown,
    fatto: string,
  ) {
    setLavoro(lavoroInCorso);
    setEsito(null);
    const dove: Esito["dove"] = lavoroInCorso === "cassa" ? "cassa" : "sicuro";
    const r = await impostaCassa(fetch, chiave, valore, atteso);
    if (!vivo.current) return;
    setLavoro(null);
    if (r.ok) {
      setEsito({ tono: "ok", testo: fatto, dove });
      await carica();
      return;
    }
    if (r.tipo === "rifiutato" && r.condizioni?.righe.length) {
      //  Il server ha visto qualcosa che qui era già vecchio: si mostrano le sue righe.
      const righe = r.condizioni.righe;
      setCassa((p) => (p ? { ...p, righe, puoAccendere: false } : p));
    }
    setEsito({ tono: "errore", testo: r.messaggio, dove });
    if (r.tipo === "conflitto" || r.tipo === "rete")
      await carica(); // si guarda com'è davvero
    else if (negato(r)) {
      setCassa(null);
      setStripe(null);
    }
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(indirizzo);
      setCopiato(true);
      window.setTimeout(() => vivo.current && setCopiato(false), 2000);
    } catch {
      setEsito({
        tono: "errore",
        testo: "Non riesco a copiare da qui: selezionalo e copialo a mano.",
        dove: "webhook",
      });
    }
  }

  return (
    <VistaCassa
      stripe={stripe}
      erroreStripe={erroreStripe}
      cassa={cassa}
      erroreCassa={erroreCassa}
      lavoro={lavoro}
      esito={esito}
      indirizzo={indirizzo}
      copiato={copiato}
      provaEsito={provaEsito}
      onProva={() => void prova()}
      onCassa={(v) =>
        cassa &&
        void cambia(
          "cassa",
          "cassa_sito",
          v ? "stripe" : "vecchia",
          cassa.valore,
          v ? "La cassa del sito ora è Stripe." : "La cassa del sito è tornata a quella di prima.",
        )
      }
      onSicuro={(v) =>
        cassa &&
        void cambia(
          "sicuro",
          "pagamento_sicuro",
          v,
          cassa.sicuro,
          v ? "«Pagamento sicuro» è acceso sul sito." : "«Pagamento sicuro» è spento.",
        )
      }
      onMetodo={(m, attivo) =>
        cassa &&
        void cambia(
          "metodi",
          "metodi_pagamento",
          metodiDopoCambio(cassa.metodi, m, attivo),
          cassa.metodi,
          "Metodi di pagamento salvati.",
        )
      }
      onCopia={() => void copia()}
      onRiprova={() => void carica()}
      collaudo={<RiquadroCollaudo fetch={fetch} />}
    />
  );
}
