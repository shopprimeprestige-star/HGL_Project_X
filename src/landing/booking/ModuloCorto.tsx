/** ── IL MODULO CORTO ────────────────────────────────────────────────────────
 *  Nome, telefono, fascia in cui essere richiamati e (facoltativo su Protocol,
 *  obbligatorio dallo shop) il problema principale. Sotto, una casella FACOLTATIVA
 *  e mai spuntata di partenza per i promemoria su WhatsApp.
 *
 *  Non è un secondo modulo staccato: salva con gli stessi pezzi di `BookingFunnel`
 *  (`lead-comune.ts`: stesse chiavi del lead, stesso evento «Lead» a Meta, una volta).
 *  Dopo l'invio compare la conferma e la proposta di scegliere subito giorno e ora
 *  col calendario che c'è già (`BookingFunnel modo="solo-calendario"`): se la
 *  persona sceglie, si aggiorna LA STESSA richiesta (funzione del database), non se
 *  ne crea una seconda. Se il calendario non risponde, la richiesta è salvata e la
 *  conferma resta.
 *
 *  ⚠️ Il calendario in `modo="solo-calendario"` e `onOrarioScelto` li aggiunge B7 a
 *  `BookingFunnel`. Finché B7 non è dentro, il tocco su «Scegli giorno e ora» aprirebbe
 *  il modulo lungo: B7 va unito PRIMA di questo file (o insieme).
 *  ⚠️ Nome e telefono passano solo nel lead. Mai negli eventi, mai nei log.
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBookingPhrase } from "@/lib/date-format";
import { PROBLEMI, TESTI_CONSULENZA, type IdProblema } from "@/landing/testi-sito";
import { EVENTO_SCELTA, leggiScelta } from "@/landing/consulenza/scelta";
import type { Provenienza } from "@/landing/consulenza/regole";
import { buildJourneySnapshot, captureSourceData } from "./tracking";
import {
  annunciaLead,
  conservaRichiesta,
  costruisciPayload,
  dimenticaRichiesta,
  fissaOrario,
  impronta,
  inviaRichiesta,
  nuovaRichiesta,
  richiestaConservata,
  type ClienteLead,
  type RichiestaConservata,
} from "./lead-comune";
import { controllaModulo, type CampoErrore, type ModuloCortoDati, type PuntoSito } from "@/landing/sito/richiesta";
import { nomeEventoModulo } from "@/landing/sito/eventi";
import { traccia, usaVariante } from "@/landing/sito/traccia";
import { FASCE, TESTI_MODULO_CORTO as T, type Fascia } from "@/landing/sito/testi-modulo-corto";

//  Il calendario: lo stesso di oggi, in modo «solo-calendario» (B7). Caricato solo al tocco.
interface PropsCalendario {
  variant?: "light" | "dark";
  modo: "solo-calendario";
  onOrarioScelto: (data: string, ora: string) => void;
}
const Calendario = lazy(() =>
  import("./BookingFunnel").then((m) => ({ default: m.BookingFunnel as unknown as ComponentType<PropsCalendario> })),
);

export interface ModuloCortoProps {
  origine: Provenienza;
  punto: PuntoSito;
  problemaObbligatorio: boolean;
  titolo: string;
  variant?: "light" | "dark";
  onInviato?: () => void;
}

type Fase = "modulo" | "inviato";
type MessaggioCalendario = null | "occupato" | "non_valido" | "fissata";

const CLIENTE = supabase as unknown as ClienteLead;

export function ModuloCorto({ origine, punto, problemaObbligatorio, titolo, variant = "light", onInviato }: ModuloCortoProps) {
  const chiaro = variant === "light";
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fascia, setFascia] = useState<Fascia | "">("");
  const [problema, setProblema] = useState<IdProblema | null>(null);
  const [problemaAltro, setProblemaAltro] = useState("");
  const [consenso, setConsenso] = useState(false);
  const [errori, setErrori] = useState<Partial<Record<CampoErrore, string>>>({});
  const [inviando, setInviando] = useState(false);
  const [erroreInvio, setErroreInvio] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("modulo");
  //  La richiesta salvata, se c'è e se il calendario si può proporre (non di riserva).
  const [richiesta, setRichiesta] = useState<RichiestaConservata | null>(null);
  const [calendarioAperto, setCalendarioAperto] = useState(false);
  const [giro, setGiro] = useState(0);
  const [fissando, setFissando] = useState(false);
  const [messaggio, setMessaggio] = useState<MessaggioCalendario>(null);
  const [quando, setQuando] = useState("");
  const variante = usaVariante();

  const inizioFatto = useRef(false);
  const invioInCorso = useRef(false);
  const rif = useRef<Record<string, HTMLElement | null>>({});
  const confermaRif = useRef<HTMLDivElement | null>(null);

  //  Al montaggio: precompila dal link (come il modulo lungo) e dalla scelta fatta in barra/pannello;
  //  se la richiesta è già salvata in questa scheda, si torna alla conferma.
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const da = (...chiavi: string[]) => chiavi.map((k) => qs.get(k)?.trim()).find(Boolean) ?? "";
      const n = da("nome", "name", "first_name", "firstname", "full_name", "fullname");
      const t = da("tel", "telefono", "phone", "phone_number", "mobile");
      if (n) setNome((v) => v || n);
      if (t) setTelefono((v) => v || t);
    } catch {
      // un link strano non deve rompere il modulo
    }
    const scelta = leggiScelta();
    if (scelta?.problema) {
      setProblema(scelta.problema);
      setProblemaAltro(scelta.problemaAltro ?? "");
    }
    const salvata = richiestaConservata();
    if (salvata && salvata.stato !== "da_inviare") {
      setRichiesta(salvata.stato === "salvato_riserva" ? null : salvata);
      setFase("inviato");
    }
    const suScelta = (e: Event) => {
      const nuova = (e as CustomEvent).detail ?? leggiScelta();
      if (nuova?.problema) {
        setProblema(nuova.problema);
        setProblemaAltro(nuova.problemaAltro ?? "");
      }
    };
    window.addEventListener(EVENTO_SCELTA, suScelta);
    return () => window.removeEventListener(EVENTO_SCELTA, suScelta);
  }, []);

  const eventoModulo = useCallback(
    (azione: Parameters<typeof nomeEventoModulo>[1], extra: Record<string, unknown> = {}) => {
      const nomeEvento = nomeEventoModulo(origine, azione);
      if (nomeEvento) traccia(nomeEvento, { origine, punto, ...extra });
    },
    [origine, punto],
  );

  const primoTocco = () => {
    if (inizioFatto.current) return;
    inizioFatto.current = true;
    eventoModulo("inizio");
  };

  const dati = (): ModuloCortoDati => ({ nome, telefono, fascia, problema, problemaAltro, consensoWhatsapp: consenso });

  const fuocoSu = (campo: CampoErrore) => {
    const el = rif.current[campo];
    window.requestAnimationFrame(() => el?.focus());
  };

  const invia = async () => {
    if (invioInCorso.current) return;
    const e = controllaModulo(dati(), { problemaObbligatorio });
    setErrori(e);
    const primo = (["nome", "telefono", "fascia", "problema"] as CampoErrore[]).find((k) => e[k]);
    if (primo) {
      //  Solo il nome del campo: mai quello che la persona ha scritto.
      eventoModulo("errore", { campo: primo });
      fuocoSu(primo);
      return;
    }
    invioInCorso.current = true;
    setInviando(true);
    setErroreInvio(null);
    try {
      const r = richiestaConservata() ?? nuovaRichiesta();
      conservaRichiesta(r, "da_inviare");
      let hash: string | null = null;
      try {
        hash = await impronta(r.chiave);
      } catch {
        hash = null; // browser senza crypto.subtle: il lead si salva, il calendario non si propone
      }
      const prodotto = origine === "stock" ? leggiScelta()?.prodotto : undefined;
      const { pieno, senzaConsenso, riserva } = costruisciPayload({
        dati: dati(),
        richiesta: r,
        hash,
        sito: { origine, punto, prodotto },
        fonte: captureSourceData(),
        percorso: buildJourneySnapshot(),
      });
      const esito = await inviaRichiesta(CLIENTE, [pieno, senzaConsenso, riserva]);
      if (typeof esito === "object") {
        setErroreInvio(T.errori.invio);
        return;
      }
      conservaRichiesta(r, esito);
      annunciaLead(r.eventId, { nome, telefono });
      eventoModulo("invio", { voce: problema ?? undefined });
      const conservata = richiestaConservata();
      setRichiesta(esito === "salvato_riserva" || !hash ? null : conservata);
      setFase("inviato");
      window.requestAnimationFrame(() => confermaRif.current?.focus());
      onInviato?.();
    } finally {
      invioInCorso.current = false;
      setInviando(false);
    }
  };

  const apriCalendario = () => {
    eventoModulo("calendario");
    setMessaggio(null);
    setCalendarioAperto(true);
  };

  const orarioScelto = async (data: string, ora: string) => {
    if (!richiesta || fissando) return;
    setFissando(true);
    try {
      const esito = await fissaOrario(CLIENTE, richiesta.id, richiesta.chiave, data, ora);
      if (esito === "fissato") {
        dimenticaRichiesta();
        eventoModulo("prenotata");
        setQuando(formatBookingPhrase(data, ora));
        setMessaggio("fissata");
        setCalendarioAperto(false);
        setRichiesta(null);
      } else if (esito === "occupato") {
        //  Il calendario resta aperto e si ricarica, così l'orario preso sparisce.
        setMessaggio("occupato");
        setGiro((g) => g + 1);
      } else if (esito === "non_valido") {
        setMessaggio("non_valido");
        setCalendarioAperto(false);
      } else {
        //  Funzione assente o rete: la richiesta è salvata e la conferma resta, nessun errore.
        setCalendarioAperto(false);
      }
    } finally {
      setFissando(false);
    }
  };

  /* ── Aspetto ─────────────────────────────────────────────────────────── */
  const guscio = chiaro ? "bg-white text-ink border border-ink/10" : "bg-navy-light/40 text-white border border-white/10";
  const sommesso = chiaro ? "text-ink-muted" : "text-white/70";
  const rosso = chiaro ? "text-red-700" : "text-red-300";
  const campo = chiaro
    ? "bg-white text-ink border-ink/30 placeholder:text-ink-muted/60 focus-visible:ring-brand"
    : "bg-white/10 text-white border-white/30 placeholder:text-white/50 focus-visible:ring-brand";
  const opzione = (attiva: boolean) =>
    `flex min-h-12 items-center justify-center rounded-lg border px-3 py-2 text-left text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
      chiaro ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-[#0a1a3a]"
    } ${
      attiva
        ? "border-brand bg-brand/10 " + (chiaro ? "text-ink" : "text-white")
        : chiaro
          ? "border-ink/25 bg-white text-ink hover:border-ink/50"
          : "border-white/25 bg-white/[0.04] text-white hover:border-white/50"
    }`;
  const etichetta = `block text-[15px] font-semibold ${chiaro ? "text-ink" : "text-white"}`;
  const errore = (k: CampoErrore) =>
    errori[k] ? (
      <p id={`mc-err-${k}`} role="alert" className={`mt-1.5 text-[13px] font-medium ${rosso}`}>
        {errori[k]}
      </p>
    ) : null;

  /* ── Dopo l'invio ────────────────────────────────────────────────────── */
  if (fase === "inviato") {
    return (
      <section id="modulo" data-barra-nascondi="vista" aria-labelledby="mc-conferma" className={`w-full rounded-xl p-5 sm:p-6 ${guscio}`}>
        <div ref={confermaRif} tabIndex={-1} role="status" aria-live="polite" className="space-y-1 outline-none">
          <h3 id="mc-conferma" className="text-xl font-bold leading-tight">
            {T.conferma.titolo}
          </h3>
          <p className={`text-[15px] ${sommesso}`}>{T.conferma.testo}</p>
        </div>

        {messaggio === "fissata" && (
          <p role="status" className="mt-4 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 text-[15px] font-medium">
            {T.calendario.fissata(quando)}
          </p>
        )}
        {messaggio === "non_valido" && (
          <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-[15px] ${chiaro ? "border-ink/20" : "border-white/25"}`}>
            {T.calendario.nonValido}
          </p>
        )}

        {richiesta && messaggio !== "fissata" && messaggio !== "non_valido" && (
          <div className={`mt-5 border-t pt-5 ${chiaro ? "border-ink/10" : "border-white/15"}`}>
            {!calendarioAperto ? (
              <>
                <p className="text-[15px] font-semibold">{T.calendario.domanda}</p>
                <Button type="button" onClick={apriCalendario} variant="outline" className="mt-3 h-12 w-full text-base font-semibold">
                  {T.calendario.bottone}
                </Button>
              </>
            ) : (
              <div aria-busy={fissando}>
                {messaggio === "occupato" && (
                  <p role="alert" className={`mb-3 text-[14px] font-medium ${rosso}`}>
                    {T.calendario.occupato}
                  </p>
                )}
                <Suspense
                  fallback={
                    <div className="flex h-24 items-center justify-center" role="status" aria-label="Carico il calendario">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    </div>
                  }
                >
                  <Calendario key={giro} variant={variant} modo="solo-calendario" onOrarioScelto={orarioScelto} />
                </Suspense>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  /* ── Il modulo ───────────────────────────────────────────────────────── */
  const telefonoNonValido = !!errori.telefono;
  return (
    <section id="modulo" data-barra-nascondi="vista" aria-labelledby="mc-titolo" className={`w-full rounded-xl p-5 sm:p-6 ${guscio}`}>
      <h3 id="mc-titolo" className="text-xl font-bold leading-tight">
        {titolo}
      </h3>

      <form
        noValidate
        className="mt-5 space-y-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          void invia();
        }}
      >
        <div>
          <label htmlFor="mc-nome" className={etichetta}>
            {T.nome}
          </label>
          <input
            id="mc-nome"
            ref={(el) => {
              rif.current.nome = el;
            }}
            type="text"
            name="name"
            autoComplete="name"
            enterKeyHint="next"
            value={nome}
            onFocus={primoTocco}
            onChange={(ev) => setNome(ev.target.value)}
            aria-invalid={!!errori.nome}
            aria-describedby={errori.nome ? "mc-err-nome" : undefined}
            className={`mt-1.5 h-12 w-full rounded-lg border px-3.5 text-base focus-visible:outline-none focus-visible:ring-2 ${campo}`}
          />
          {errore("nome")}
        </div>

        <div>
          <label htmlFor="mc-tel" className={etichetta}>
            {T.telefono}
          </label>
          <input
            id="mc-tel"
            ref={(el) => {
              rif.current.telefono = el;
            }}
            type="tel"
            name="tel"
            inputMode="tel"
            autoComplete="tel-national"
            enterKeyHint="done"
            placeholder="333 1234567"
            value={telefono}
            onFocus={primoTocco}
            onChange={(ev) => setTelefono(ev.target.value)}
            aria-invalid={telefonoNonValido}
            aria-describedby={telefonoNonValido ? "mc-err-telefono" : undefined}
            className={`mt-1.5 h-12 w-full rounded-lg border px-3.5 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 ${campo}`}
          />
          {errore("telefono")}
        </div>

        <fieldset aria-describedby={errori.fascia ? "mc-err-fascia" : undefined}>
          <legend className={etichetta}>{T.fascia}</legend>
          <div role="radiogroup" aria-label={T.fascia} aria-invalid={!!errori.fascia} className="mt-1.5 grid grid-cols-3 gap-2">
            {FASCE.map((f, i) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={fascia === f.id}
                ref={(el) => {
                  if (i === 0) rif.current.fascia = el;
                }}
                onClick={() => {
                  primoTocco();
                  setFascia(f.id);
                  setErrori((x) => ({ ...x, fascia: undefined }));
                }}
                className={opzione(fascia === f.id) + " justify-center text-center"}
              >
                {f.etichetta}
              </button>
            ))}
          </div>
          {errore("fascia")}
        </fieldset>

        <fieldset aria-describedby={errori.problema ? "mc-err-problema" : undefined}>
          <legend className={etichetta}>
            {TESTI_CONSULENZA.campo.etichetta}
            {!problemaObbligatorio && <span className={`ml-1.5 font-normal ${sommesso}`}>{T.facoltativo}</span>}
          </legend>
          <div role="radiogroup" aria-label={TESTI_CONSULENZA.campo.etichetta} aria-invalid={!!errori.problema} className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {PROBLEMI.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={problema === p.id}
                ref={(el) => {
                  if (i === 0) rif.current.problema = el;
                }}
                onClick={() => {
                  primoTocco();
                  //  Un secondo tocco sulla stessa voce la toglie (dove il problema è facoltativo).
                  setProblema(problema === p.id && !problemaObbligatorio ? null : p.id);
                  setErrori((x) => ({ ...x, problema: undefined }));
                }}
                className={opzione(problema === p.id) + " justify-start"}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
          {problema === "altro" && (
            <div className="mt-2">
              <label htmlFor="mc-altro" className={`block text-[13px] ${sommesso}`}>
                {TESTI_CONSULENZA.campo.altro}
              </label>
              <input
                id="mc-altro"
                type="text"
                maxLength={120}
                autoComplete="off"
                value={problemaAltro}
                onChange={(ev) => setProblemaAltro(ev.target.value)}
                className={`mt-1 h-12 w-full rounded-lg border px-3.5 text-base focus-visible:outline-none focus-visible:ring-2 ${campo}`}
              />
            </div>
          )}
          {errore("problema")}
        </fieldset>

        {/* Facoltativa, mai spuntata di partenza, non blocca l'invio: registra il consenso, non manda nulla da qui. */}
        <label className={`flex min-h-11 cursor-pointer items-start gap-3 text-[14px] ${chiaro ? "text-ink" : "text-white"}`}>
          <input
            type="checkbox"
            checked={consenso}
            onChange={(ev) => setConsenso(ev.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-scuro)]"
          />
          <span>{T.consenso}</span>
        </label>

        {erroreInvio && (
          <p role="alert" className={`text-[14px] font-medium ${rosso}`}>
            {erroreInvio}
          </p>
        )}

        <div>
          <Button
            type="submit"
            disabled={inviando}
            className="h-12 w-full rounded-xl text-base font-bold"
            size="lg"
          >
            {inviando ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Invio in corso" /> : variante === "B" ? T.bottoneB : T.bottoneA}
          </Button>
          <p className={`mt-2 text-center text-[13px] ${sommesso}`}>{T.sotto}</p>
          <p className={`mt-2 text-center text-[12px] ${sommesso}`}>
            {T.privacy.testo} ·{" "}
            <a href={T.privacy.link} className="underline underline-offset-2 hover:text-brand">
              {T.privacy.etichettaLink}
            </a>
          </p>
        </div>
      </form>
    </section>
  );
}
