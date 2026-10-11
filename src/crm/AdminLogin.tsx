/** SCHERMATA DI ACCESSO AL CRM ───────────────────────────────────────────────
 *  Si sceglie il proprio nome, si digita il PIN, si entra. Niente email, niente
 *  password, niente registrazione: le stesse quattro cifre che il consulente usa
 *  già in Meetly per entrare come presentatore, e lo stesso disegno di quella
 *  schermata — chi passa dall'una all'altra riconosce il gesto senza impararlo
 *  due volte.
 *
 *  IL TASTIERINO INVECE DEL CAMPO DI TESTO. Il CRM si apre quasi sempre da
 *  telefono, spesso in piedi e con una mano sola: un campo di testo aprirebbe la
 *  tastiera di sistema, che copre metà schermo e mostra lettere che qui non
 *  servono. I tasti grandi si centrano al primo colpo, e la tastiera fisica
 *  continua comunque a funzionare per chi è alla scrivania.
 *
 *  L'ACCESSO DEL TITOLARE resta in fondo, dietro un tocco: i PIN si assegnano
 *  DA DENTRO il CRM, quindi finché non ne esiste nemmeno uno la porta col PIN
 *  non si apre e senza questa via di servizio il titolare resterebbe chiuso
 *  fuori dal proprio archivio.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Delete, Lock, ShieldCheck, UserRound, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { cn } from "@/lib/utils";
import logoBrand from "@/assets/logo-hair-genius.png";

interface ConsulenteInElenco {
  id: string;
  nome: string;
  iniziali: string;
}

const PIN_MIN = 4;
const PIN_MAX = 8;

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, "0")}`;

export function AdminLogin() {
  const { user, accediConPin, signIn } = useAuth();
  const navigate = useNavigate();

  const [elenco, setElenco] = useState<ConsulenteInElenco[] | null>(null);
  const [sel, setSel] = useState<ConsulenteInElenco | null>(null);
  const [pin, setPin] = useState("");
  const [errore, setErrore] = useState("");
  const [busy, setBusy] = useState(false);
  const [attesa, setAttesa] = useState(0);
  const [modoTitolare, setModoTitolare] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/CRM" });
  }, [user, navigate]);

  useEffect(() => {
    fetch("/api/crm/accesso")
      .then((r) => r.json())
      .then((j) => setElenco((j?.consulenti as ConsulenteInElenco[]) ?? []))
      .catch(() => setElenco([]));
  }, []);

  // Il conto alla rovescia del blocco: un pulsante che continua a rifiutare
  // senza dire per quanto è il modo più rapido per far riprovare all'infinito.
  useEffect(() => {
    if (attesa <= 0) return;
    const t = setTimeout(() => {
      setAttesa(attesa - 1);
      // Finita l'attesa sparisce anche il messaggio: lasciarlo lì farebbe
      // credere che l'accesso sia ancora chiuso.
      if (attesa <= 1) setErrore("");
    }, 1000);
    return () => clearTimeout(t);
  }, [attesa]);

  const digita = useCallback((c: string) => {
    setErrore("");
    setPin((p) => (p.length >= PIN_MAX ? p : p + c));
  }, []);

  const entra = useCallback(async () => {
    if (!sel || pin.length < PIN_MIN || busy || attesa > 0) return;
    setBusy(true);
    setErrore("");
    const esito = await accediConPin(sel.id, pin);
    if (esito.ok) return; // la schermata sparisce da sola: il guscio vede la sessione
    setPin("");
    setErrore(esito.motivo ?? "Accesso non riuscito.");
    if (esito.attesaSec) setAttesa(esito.attesaSec);
    setBusy(false);
  }, [sel, pin, busy, attesa, accediConPin]);

  // Tastiera fisica: chi è al computer digita il PIN senza cercare il mouse.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        digita(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPin((p) => p.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        void entra();
      } else if (e.key === "Escape") {
        setSel(null);
        setPin("");
        setErrore("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, digita, entra]);

  const caselle = Math.min(PIN_MAX, Math.max(PIN_MIN, pin.length));
  const nessunPin = elenco !== null && elenco.length === 0;
  const titolare = modoTitolare || nessunPin;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#071228] via-[#050f24] to-[#03081a] px-5 py-10 text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <img
            src={logoBrand}
            alt="Hair Genius Labs"
            className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1.5 shadow-lg shadow-black/30"
          />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">CRM</p>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Hair Genius Labs SRLS
            </h1>
          </div>
        </div>

        {titolare ? (
          <AccessoTitolare
            nessunPin={nessunPin}
            onIndietro={nessunPin ? null : () => setModoTitolare(false)}
            signIn={signIn}
          />
        ) : elenco === null ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[58px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
              />
            ))}
          </div>
        ) : !sel ? (
          <>
            <p className="mb-3 text-center text-sm text-white/50">
              Scegli il tuo nome e inserisci il PIN.
            </p>
            <div className="space-y-2">
              {elenco.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSel(c);
                    setPin("");
                    setErrore("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-brand/50 hover:bg-brand/10 focus-visible:border-brand/60 focus-visible:outline-none"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[12px] font-semibold text-brand">
                    {c.iniziali}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.nome}</span>
                  <UserRound className="h-4 w-4 shrink-0 text-white/30" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <button
              type="button"
              onClick={() => {
                setSel(null);
                setPin("");
                setErrore("");
              }}
              className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-white/50 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Cambia consulente
            </button>

            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[12px] font-semibold text-brand">
                {sel.iniziali}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{sel.nome}</div>
                <div className="flex items-center gap-1 text-[11px] text-white/40">
                  <Lock className="h-3 w-3" /> PIN di accesso
                </div>
              </div>
            </div>

            {/* I pallini crescono col PIN: quattro cifre o otto sono entrambe
                valide, e mostrare otto caselle vuote farebbe credere che ne
                servano otto. */}
            <div className="mb-4 flex justify-center gap-2.5" aria-label="Cifre inserite">
              {Array.from({ length: caselle }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3 w-3 rounded-full border transition",
                    i < pin.length ? "border-brand bg-brand" : "border-white/25 bg-transparent",
                  )}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <TastoCifra key={n} onClick={() => digita(n)} disabled={attesa > 0}>
                  {n}
                </TastoCifra>
              ))}
              <TastoCifra
                onClick={() => {
                  setPin("");
                  setErrore("");
                }}
                disabled={attesa > 0 || !pin}
                etichetta="Svuota"
              >
                <X className="h-4 w-4" />
              </TastoCifra>
              <TastoCifra onClick={() => digita("0")} disabled={attesa > 0}>
                0
              </TastoCifra>
              <TastoCifra
                onClick={() => setPin((p) => p.slice(0, -1))}
                disabled={attesa > 0 || !pin}
                etichetta="Cancella l'ultima cifra"
              >
                <Delete className="h-4 w-4" />
              </TastoCifra>
            </div>

            {errore && (
              <p className="mt-3 text-center text-[12px] leading-snug text-rose-300">{errore}</p>
            )}
            {attesa > 0 && (
              <p className="mt-1 text-center text-[12px] tabular-nums text-white/50">
                Riprova fra {mmss(attesa)}
              </p>
            )}

            <button
              type="button"
              onClick={() => void entra()}
              disabled={busy || attesa > 0 || pin.length < PIN_MIN}
              className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Verifica…" : "Entra"}
            </button>
          </div>
        )}

        {!titolare && elenco !== null && (
          <button
            type="button"
            onClick={() => setModoTitolare(true)}
            className="mx-auto mt-6 flex items-center gap-1.5 text-[11px] text-white/25 transition hover:text-white/60"
          >
            <ShieldCheck className="h-3 w-3" /> Accesso titolare
          </button>
        )}
      </div>
    </div>
  );
}

/** Tasto del tastierino: alto abbastanza da centrarlo col pollice senza
 *  guardare, e con `type="button"` perché non deve mai inviare nulla da solo. */
function TastoCifra({
  children,
  onClick,
  disabled,
  etichetta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  etichetta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etichetta}
      className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-xl font-medium tabular-nums text-white transition active:scale-[0.97] active:bg-brand/20 hover:border-white/20 hover:bg-white/10 disabled:opacity-30 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}

/** ── VIA DI SERVIZIO PER IL TITOLARE ───────────────────────────────────────
 *  Non è la porta principale e non deve sembrarlo: serve la prima volta, quando
 *  nessun PIN esiste ancora, e nei casi in cui il titolare non ha una scheda
 *  consulente. La registrazione non c'è più: gli account del CRM si creano da
 *  Impostazioni, non da una schermata di accesso aperta a chiunque. */
function AccessoTitolare({
  nessunPin,
  onIndietro,
  signIn,
}: {
  nessunPin: boolean;
  onIndietro: (() => void) | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState("");

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrore("");
    const { error } = await signIn(email, password);
    if (error) {
      setErrore("Credenziali non valide.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={invia} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      {onIndietro && (
        <button
          type="button"
          onClick={onIndietro}
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Torna ai consulenti
        </button>
      )}

      <div className="mb-4">
        <div className="text-sm font-semibold">Accesso titolare</div>
        <p className="mt-1 text-[12px] leading-snug text-white/45">
          {nessunPin
            ? "Nessun consulente ha ancora un PIN. Entra come titolare e assegnali da Collaboratori."
            : "Riservato a chi amministra il CRM."}
        </p>
      </div>

      <label
        className="mb-1 block text-[11px] uppercase tracking-wide text-white/40"
        htmlFor="email"
      >
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-brand focus:outline-none"
      />

      <label
        className="mb-1 block text-[11px] uppercase tracking-wide text-white/40"
        htmlFor="password"
      >
        Password
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={6}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-brand focus:outline-none"
      />

      {errore && <p className="mt-3 text-center text-[12px] text-rose-300">{errore}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Attendere…" : "Accedi"}
      </button>
    </form>
  );
}
