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
 *
 *  Per la pagina `/soluzioni` (foglio del modulo) ha prop in più, tutte facoltative: senza,
 *  il disegno è quello di oggi, byte per byte (prova: `prove/sito/modulo.mjs` contro la fotografia G1).
 *  `testi` cambia parole e misure (campi da 56 px, bottone blu notte su blu, rosso degli errori
 *  invariato); `interesse` va nel lead e negli eventi; `mostraProblema={false}` toglie le otto voci
 *  (una scelta già fatta in sessione parte lo stesso); `mostraTitolo={false}` lascia il titolo al foglio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBookingPhrase } from "@/lib/date-format";
import { FASCE, PROBLEMI, TESTI_CONSULENZA, TESTI_MODULO_CORTO as T, type Fascia, type IdProblema } from "@/landing/testi-sito";
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
import { caricaCalendarioSicuro, ProteggiCalendario, type PropsCalendario } from "./calendario-sicuro";
import { controllaModulo, telefonoDaInviare, type CampoErrore, type ModuloCortoDati, type PuntoSito } from "@/landing/sito/richiesta";
import { nomeEventoModulo } from "@/landing/sito/eventi";
import { traccia, usaVariante } from "@/landing/sito/traccia";

//  Il calendario: lo stesso di oggi, in modo «solo-calendario» (B7). Caricato solo al tocco,
//  e se non arriva non rompe la pagina (`calendario-sicuro.tsx`).
const importaCalendario = () =>
  import("./BookingFunnel").then((m) => ({ default: m.BookingFunnel as unknown as ComponentType<PropsCalendario> }));

/** Da quale delle tre strade è partita la richiesta (pagina `/soluzioni`). Va nel lead e negli eventi.
 *  shortcut: copia di `Interesse` in `soluzioni/regole.ts` (S1.0); si toglie e si importa da lì quando S1 è unito. */
export type Interesse = "trapianto" | "invisible-derm" | "non-so";

/** Le parole del modulo sulla pagina `/soluzioni` (3.4). `TESTI_SOLUZIONI.modulo` ne ha almeno queste.
 *  Privacy e testo del promemoria WhatsApp restano sempre quelli di oggi. */
export interface TestiModuloCorto {
  nome: { etichetta: string; segnaposto: string };
  telefono: { etichetta: string; segnaposto: string; aiuto: string };
  fascia: { etichetta: string };
  bottone: string;
  sotto: string;
  errori: { nome: string; telefono: string; fascia: string; invio: string };
  conferma: { titolo: string; testo: string };
}

export interface ModuloCortoProps {
  origine: Provenienza;
  punto: PuntoSito;
  problemaObbligatorio: boolean;
  titolo: string;
  variant?: "light" | "dark";
  onInviato?: () => void;
  /** Da dove è partita la richiesta: «Interesse: …» nel lead, `interesse` negli eventi del modulo. */
  interesse?: Interesse;
  /** Parole e misure della pagina `/soluzioni`. Senza, il modulo è quello di oggi. */
  testi?: TestiModuloCorto;
  /** `false`: niente otto voci (una scelta già fatta in sessione parte lo stesso). */
  mostraProblema?: boolean;
  /** `false`: il titolo è dell'involucro (l'H2 del foglio); `titolo` resta il nome accessibile. */
  mostraTitolo?: boolean;
  /** L'id del contenitore. Il foglio passa `null`: niente id, l'ancora `#modulo` non c'è due volte. */
  ancora?: string | null;
  /** Dice all'involucro se ci sono dati scritti: con dati scritti il foglio non si chiude con un gesto sbagliato. */
  onModifica?: (haDati: boolean) => void;
}

type Fase = "modulo" | "inviato";
type MessaggioCalendario = null | "occupato" | "non_valido" | "fissata";

const CLIENTE = supabase as unknown as ClienteLead;

export function ModuloCorto({
  origine,
  punto,
  problemaObbligatorio,
  titolo,
  variant = "light",
  onInviato,
  interesse,
  testi,
  mostraProblema = true,
  mostraTitolo = true,
  ancora = "modulo",
  onModifica,
}: ModuloCortoProps) {
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

  //  Un componente nuovo a ogni giro: se il caricamento è fallito, il tocco successivo riprova davvero.
  const Calendario = useMemo(() => lazy(() => caricaCalendarioSicuro(importaCalendario)), [giro]);

  const inizioFatto = useRef(false);
  const fissandoRif = useRef(false);
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
      if (nomeEvento) traccia(nomeEvento, { origine, punto, ...(interesse ? { interesse } : {}), ...extra });
    },
    [origine, punto, interesse],
  );

  //  L'involucro (il foglio) vuole sapere se c'è qualcosa di scritto: solo conteggio, mai il contenuto.
  useEffect(() => {
    onModifica?.(Boolean(nome.trim() || telefono.trim() || fascia));
  }, [nome, telefono, fascia, onModifica]);

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
    const e = controllaModulo(dati(), { problemaObbligatorio: mostraProblema && problemaObbligatorio });
    //  Con i testi della pagina, gli errori dei campi hanno le sue parole (stessi campi, stesse regole).
    if (testi) for (const k of ["nome", "telefono", "fascia"] as const) if (e[k]) e[k] = testi.errori[k];
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
        sito: { origine, punto, prodotto, ...(interesse ? { interesse } : {}) },
        fonte: captureSourceData(),
        percorso: buildJourneySnapshot(),
      });
      const esito = await inviaRichiesta(CLIENTE, [pieno, senzaConsenso, riserva]);
      if (typeof esito === "object") {
        setErroreInvio(testi?.errori.invio ?? T.errori.invio);
        return;
      }
      conservaRichiesta(r, esito);
      annunciaLead(r.eventId, { nome, telefono: telefonoDaInviare(telefono) });
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
    //  Un ref blocca subito il secondo tocco; lo stato `fissando` arriverebbe dopo il disegno.
    if (!richiesta || fissandoRif.current) return;
    fissandoRif.current = true;
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
      fissandoRif.current = false;
      setFissando(false);
    }
  };

  //  Il calendario non si carica o si rompe: si chiude, la richiesta è salvata e la conferma resta.
  const calendarioNonDisponibile = () => {
    setCalendarioAperto(false);
    setGiro((g) => g + 1);
  };

  /* ── Aspetto ─────────────────────────────────────────────────────────── */
  const guscio = chiaro ? "bg-white text-ink border border-ink/10" : "bg-navy-light/40 text-white border border-white/10";
  const sommesso = chiaro ? "text-ink-muted" : "text-white/70";
  const rosso = chiaro ? "text-red-700" : "text-red-300";
  //  Sulla pagina `/soluzioni` il modulo sta già dentro il foglio: niente scheda dentro la scheda, fuoco e selezione blu notte.
  const fuoco = testi ? "focus-visible:ring-[#0A1430]" : "focus-visible:ring-brand";
  const selezione = testi ? "border-[#0B5FB0] bg-[#0B5FB0]/10 " : "border-brand bg-brand/10 ";
  const altezzaCampo = testi ? "h-14" : "h-12";
  const campo = chiaro
    ? `bg-white text-ink border-ink/30 placeholder:text-ink-muted/60 ${fuoco}`
    : `bg-white/10 text-white border-white/30 placeholder:text-white/50 ${fuoco}`;
  //  Un campo sbagliato prende il bordo rosso (oltre al testo e all'icona sotto): il rosso del modulo chiaro di oggi.
  const campoDi = (k: CampoErrore) => (testi && errori[k] ? campo.replace(/border-(ink|white)\/30/, "border-red-700") : campo);
  const opzione = (attiva: boolean) =>
    `flex ${testi ? "min-h-14" : "min-h-12"} items-center justify-center rounded-lg border px-3 py-2 text-left text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${fuoco} focus-visible:ring-offset-2 ${
      chiaro ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-[#0a1a3a]"
    } ${
      attiva
        ? selezione + (chiaro ? "text-ink" : "text-white")
        : chiaro
          ? "border-ink/25 bg-white text-ink hover:border-ink/50"
          : "border-white/25 bg-white/[0.04] text-white hover:border-white/50"
    }`;
  const etichetta = `block text-[15px] font-semibold ${chiaro ? "text-ink" : "text-white"}`;
  const errore = (k: CampoErrore) =>
    errori[k] ? (
      <p id={`mc-err-${k}`} role="alert" className={`mt-1.5 text-[13px] font-medium ${rosso}${testi ? " flex items-start gap-1.5 text-[14px]" : ""}`}>
        {testi && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        {errori[k]}
      </p>
    ) : null;
  const contenitore = testi ? "w-full text-[#0A1430]" : `w-full rounded-xl p-5 sm:p-6 ${guscio}`;

  /* ── Dopo l'invio ────────────────────────────────────────────────────── */
  if (fase === "inviato") {
    return (
      <section id={ancora ?? undefined} data-barra-nascondi="vista" aria-labelledby="mc-conferma" className={contenitore}>
        <div ref={confermaRif} tabIndex={-1} role="status" aria-live="polite" className="space-y-1 outline-none">
          <h3 id="mc-conferma" className="text-xl font-bold leading-tight">
            {testi?.conferma.titolo ?? T.conferma.titolo}
          </h3>
          <p className={`text-[15px] ${sommesso}`}>{testi?.conferma.testo ?? T.conferma.testo}</p>
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
                  <ProteggiCalendario alErrore={calendarioNonDisponibile}>
                    <Calendario variant={variant} modo="solo-calendario" onOrarioScelto={orarioScelto} alErrore={calendarioNonDisponibile} />
                  </ProteggiCalendario>
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
    <section
      id={ancora ?? undefined}
      data-barra-nascondi="vista"
      aria-labelledby={mostraTitolo ? "mc-titolo" : undefined}
      aria-label={mostraTitolo ? undefined : titolo}
      className={contenitore}
    >
      {mostraTitolo && (
        <h3 id="mc-titolo" className="text-xl font-bold leading-tight">
          {titolo}
        </h3>
      )}

      <form
        noValidate
        className={mostraTitolo ? "mt-5 space-y-5" : "space-y-5"}
        onSubmit={(ev) => {
          ev.preventDefault();
          void invia();
        }}
      >
        <div>
          <label htmlFor="mc-nome" className={etichetta}>
            {testi?.nome.etichetta ?? T.nome}
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
            placeholder={testi?.nome.segnaposto}
            value={nome}
            onFocus={primoTocco}
            onChange={(ev) => setNome(ev.target.value)}
            aria-invalid={!!errori.nome}
            aria-describedby={errori.nome ? "mc-err-nome" : undefined}
            className={`mt-1.5 ${altezzaCampo} w-full rounded-lg border px-3.5 text-base focus-visible:outline-none focus-visible:ring-2 ${campoDi("nome")}`}
          />
          {errore("nome")}
        </div>

        <div>
          <label htmlFor="mc-tel" className={etichetta}>
            {testi?.telefono.etichetta ?? T.telefono}
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
            placeholder={testi?.telefono.segnaposto ?? "333 1234567"}
            value={telefono}
            onFocus={primoTocco}
            onChange={(ev) => setTelefono(ev.target.value)}
            aria-invalid={telefonoNonValido}
            aria-describedby={
              [testi && "mc-aiuto-tel", telefonoNonValido && "mc-err-telefono"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={`mt-1.5 ${altezzaCampo} w-full rounded-lg border px-3.5 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 ${campoDi("telefono")}`}
          />
          {testi && (
            <p id="mc-aiuto-tel" className={`mt-1.5 text-[14px] ${sommesso}`}>
              {testi.telefono.aiuto}
            </p>
          )}
          {errore("telefono")}
        </div>

        <fieldset aria-describedby={errori.fascia ? "mc-err-fascia" : undefined}>
          <legend className={etichetta}>{testi?.fascia.etichetta ?? T.fascia}</legend>
          <div role="radiogroup" aria-label={testi?.fascia.etichetta ?? T.fascia} aria-invalid={!!errori.fascia} className="mt-1.5 grid grid-cols-3 gap-2">
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

        {mostraProblema && (
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
        )}

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
            className={
              testi
                ? "h-14 w-full rounded-lg border border-[#0B5FB0] bg-[#0F90FE] text-[17px] font-semibold text-[#0A1430] hover:bg-[#5CB6FF] focus-visible:ring-2 focus-visible:ring-[#0A1430] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                : "h-12 w-full rounded-xl text-base font-bold"
            }
            size="lg"
          >
            {inviando ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Invio in corso" />
            ) : testi ? (
              testi.bottone
            ) : variante === "B" ? (
              T.bottoneB
            ) : (
              T.bottoneA
            )}
          </Button>
          <p className={`mt-2 text-center text-[13px] ${sommesso}`}>{testi?.sotto ?? T.sotto}</p>
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
