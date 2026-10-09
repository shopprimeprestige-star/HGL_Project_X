/** ─────────────────────────────────────────────────────────────────────────
 *  I MATTONI DEL PANNELLO IMPOSTAZIONI DI MEETLY
 *
 *  Il pannello di Meetly è scuro (fondo blu notte, testo chiaro). Le schede che
 *  sono arrivate qui dal gestionale portavano con sé l'aspetto chiaro del CRM:
 *  bordi grigi, fondi bianchi, testo nero. Invece di ridisegnare a occhio ogni
 *  riquadro, le forme ricorrenti stanno qui una volta sola — riquadro, finestra
 *  di conferma, elenco prima → dopo, pastiglia del prezzo — e si vestono come le
 *  schede che nel pannello c'erano già.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, type ReactNode } from "react";
import { AlertTriangle, Check, X, type LucideIcon } from "lucide-react";
import { formatPrice } from "@/shop/catalog";

/** Le stesse classi dei campi già presenti nel pannello: un campo nuovo che
 *  somiglia agli altri non si nota, ed è esattamente quello che deve fare. */
export const CAMPO =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none";
export const ETICHETTA = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/45";

/* ── IL RIQUADRO ────────────────────────────────────────────────────────── */

export function Riquadro({
  id,
  icona: Icona,
  titolo,
  nota,
  azioni,
  senzaPadding,
  children,
}: {
  /** appiglio per i riquadri numerici in cima, che ci portano dentro */
  id?: string;
  icona?: LucideIcon;
  titolo: string;
  nota?: ReactNode;
  azioni?: ReactNode;
  /** per gli elenchi divisi da righe, che devono toccare i bordi */
  senzaPadding?: boolean;
  children: ReactNode;
}) {
  return (
    <div id={id} className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          {Icona && <Icona className="h-4 w-4 text-brand" />} {titolo}
        </h3>
        {azioni && <div className="ml-auto flex flex-wrap items-center gap-2">{azioni}</div>}
      </div>
      {nota && <p className="px-4 pt-1 text-xs leading-relaxed text-white/50">{nota}</p>}
      <div className={senzaPadding ? "mt-3" : "p-4 pt-3"}>{children}</div>
    </div>
  );
}

/* ── I RICHIAMI ─────────────────────────────────────────────────────────── */

export function Avviso({
  tono = "attenzione",
  children,
}: {
  tono?: "attenzione" | "grave" | "neutro";
  children: ReactNode;
}) {
  const stile =
    tono === "grave"
      ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
      : tono === "neutro"
        ? "border-white/10 bg-white/[0.04] text-white/70"
        : "border-amber-400/40 bg-amber-400/10 text-amber-100";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${stile}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function Pastiglia({
  tono = "neutro",
  children,
}: {
  tono?: "neutro" | "sospeso" | "buono" | "brutto";
  children: ReactNode;
}) {
  const stile = {
    neutro: "border-white/15 bg-white/5 text-white/60",
    sospeso: "border-amber-400/40 bg-amber-400/15 text-amber-200",
    buono: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
    brutto: "border-rose-400/40 bg-rose-400/15 text-rose-200",
  }[tono];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${stile}`}
    >
      {children}
    </span>
  );
}

/** Il bottoncino a pillola: filtri, quantità, interruttori a due stati. È lo
 *  stesso oggetto delle schede in cima al pannello, in piccolo. */
export function Segmento({
  attivo,
  onClick,
  titolo,
  conteggio,
  children,
}: {
  attivo: boolean;
  onClick: () => void;
  titolo?: string;
  conteggio?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      aria-pressed={attivo}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
        attivo
          ? "bg-brand text-white"
          : "border border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
      }`}
    >
      {children}
      {conteggio != null && conteggio > 0 && (
        <span
          className={`rounded-full px-1.5 text-[10px] font-semibold ${
            attivo ? "bg-white/20" : "bg-white/10 text-white/70"
          }`}
        >
          {conteggio}
        </span>
      )}
    </button>
  );
}

/** Il riquadro numerico in cima a una scheda: una cifra grande e cosa vuol
 *  dire. Premibile quando serve anche da filtro. */
export function Numero({
  etichetta,
  valore,
  nota,
  tono = "neutro",
  attivo,
  onClick,
}: {
  etichetta: string;
  valore: ReactNode;
  nota?: string;
  tono?: "neutro" | "sospeso" | "buono";
  attivo?: boolean;
  onClick?: () => void;
}) {
  const bordo =
    attivo || tono === "sospeso"
      ? "border-amber-400/40 bg-amber-400/10"
      : tono === "buono"
        ? "border-emerald-400/35 bg-emerald-400/10"
        : "border-white/10 bg-white/[0.03]";
  const contenuto = (
    <>
      <span className="block text-[11px] font-medium uppercase tracking-wide text-white/45">
        {etichetta}
      </span>
      <span className="mt-1 block text-xl font-semibold tabular-nums text-white">{valore}</span>
      {nota && <span className="mt-0.5 block text-[11px] leading-snug text-white/40">{nota}</span>}
    </>
  );
  const classe = `rounded-2xl border p-3 text-left ${bordo}`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${classe} transition hover:bg-white/[0.07]`}
    >
      {contenuto}
    </button>
  ) : (
    <div className={classe}>{contenuto}</div>
  );
}

/** Lo stato del salvataggio, sempre nello stesso angolo. Tre parole in croce,
 *  ma sono quelle che dicono se si può chiudere il pannello. */
export function StatoSalvataggio({
  quanti,
  salvatoAlle,
  caricamento,
}: {
  quanti: number;
  salvatoAlle: Date | null;
  caricamento?: boolean;
}) {
  if (caricamento) return null;
  if (quanti > 0)
    return (
      <Pastiglia tono="sospeso">
        {quanti} {quanti === 1 ? "modifica da salvare" : "modifiche da salvare"}
      </Pastiglia>
    );
  if (salvatoAlle)
    return (
      <Pastiglia tono="buono">
        <Check className="h-3 w-3" /> Salvato alle{" "}
        {salvatoAlle.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
      </Pastiglia>
    );
  return <Pastiglia>Nessuna modifica in sospeso</Pastiglia>;
}

/* ── L'ANTEPRIMA DEL PREZZO ─────────────────────────────────────────────── */

/** Stessa logica di <PromoPrice/> nella pagina del preventivo: GRATIS in verde,
 *  promozione in ambra con il prezzo pieno barrato di rosso, prezzo normale nel
 *  blu del marchio. È la pastiglia esatta che vedrà il cliente. */
export function AnteprimaPrezzo({
  prezzo,
  pieno,
  senzaPiu,
}: {
  prezzo: number;
  /** prezzo di listino barrato; compare solo se è maggiore del prezzo */
  pieno?: number | null;
  /** le soluzioni base si scrivono senza il "+" davanti */
  senzaPiu?: boolean;
}) {
  const gratis = prezzo === 0;
  const promo = pieno != null && pieno > prezzo;
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-2 py-1 align-middle">
      {promo && (
        <span className="text-[11px] font-semibold text-white/70 line-through decoration-red-400/90 decoration-2">
          {formatPrice(pieno)}
        </span>
      )}
      <span
        className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
          gratis
            ? "bg-emerald-500/20 text-emerald-300"
            : promo
              ? "bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/50"
              : "bg-brand/20 text-brand"
        }`}
      >
        {gratis ? "GRATIS" : (senzaPiu ? "" : "+") + formatPrice(prezzo)}
      </span>
    </span>
  );
}

/* ── LA FINESTRA DI CONFERMA ────────────────────────────────────────────── */

/** L'ultimo posto in cui un errore costa ancora zero. Sta sopra il pannello
 *  (z più alto del suo) e, quando è `bloccante`, non si chiude cliccando fuori:
 *  una conferma che sparisce con un clic distratto non è una conferma. */
export function FinestraScura({
  aperta,
  onChiudi,
  icona: Icona,
  titolo,
  contesto,
  larghezza = "md",
  bloccante,
  azioni,
  children,
}: {
  aperta: boolean;
  onChiudi: () => void;
  icona?: LucideIcon;
  titolo: string;
  contesto?: ReactNode;
  larghezza?: "sm" | "md";
  bloccante?: boolean;
  azioni?: ReactNode;
  children: ReactNode;
}) {
  //  L'ascolto di Esc sta SOPRA il ritorno anticipato: un hook dentro un ramo
  //  condizionale cambia l'ordine degli hook e fa esplodere il componente
  //  proprio quando la finestra si apre.
  useEffect(() => {
    if (!aperta) return;
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [aperta, onChiudi]);

  if (!aperta) return null;

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!bloccante) onChiudi();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a1428] text-white shadow-2xl ${
          larghezza === "sm" ? "max-w-lg" : "max-w-2xl"
        }`}
      >
        <div className="flex items-start gap-2 border-b border-white/10 px-4 py-3">
          {Icona && <Icona className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{titolo}</h3>
            {contesto && <p className="mt-0.5 text-[11.5px] text-white/45">{contesto}</p>}
          </div>
          <button
            type="button"
            onClick={onChiudi}
            title="Chiudi"
            className="ml-auto rounded-md border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {azioni && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
            {azioni}
          </div>
        )}
      </div>
    </div>
  );
}

/** I due bottoni delle finestre: uno che riporta indietro, uno che scrive. */
export function BottoneChiaro({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function BottonePieno({
  onClick,
  disabled,
  tono = "brand",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tono?: "brand" | "rosso";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 ${
        tono === "rosso" ? "bg-rose-600" : "bg-brand"
      }`}
    >
      {children}
    </button>
  );
}

/* ── L'ELENCO PRIMA → DOPO ──────────────────────────────────────────────── */

export interface CambioMostrato {
  campo: string;
  prima: string;
  dopo: string;
  avviso?: string;
}

/** Voce per voce, cosa c'era e cosa ci sarà. È la stessa promessa fatta in
 *  tutte le conferme del pannello: prima di scrivere si legge. */
export function ElencoCambi({
  cambi,
  children,
}: {
  cambi: CambioMostrato[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      {children}
      <ul className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        {cambi.map((c) => (
          <li key={c.campo} className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
            <span className="text-white/45">{c.campo}:</span>
            <span className="text-white/45 line-through">{c.prima}</span>
            <span className="text-white/30">→</span>
            <span className="font-semibold text-white">{c.dopo}</span>
            {c.avviso && (
              <span className="rounded-md border border-amber-300/40 bg-amber-400/15 px-1.5 text-[11px] font-medium text-amber-200">
                {c.avviso}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La nota in coda a una finestra: quello che vale la pena sapere prima di
 *  premere, non un avvertimento in più da saltare. */
export function NotaFinestra({
  tono = "neutro",
  icona: Icona,
  children,
}: {
  tono?: "neutro" | "attenzione";
  icona?: LucideIcon;
  children: ReactNode;
}) {
  const stile =
    tono === "attenzione"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
      : "border-white/10 bg-white/[0.04] text-white/60";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] ${stile}`}>
      {Icona && <Icona className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/* ── UNA SEGNALAZIONE CHE NON SI PUÒ PERDERE ────────────────────────────── */

/** Avvisa prima di perdere delle modifiche: chiudere la scheda del browser con
 *  dei prezzi non salvati è il modo più silenzioso di buttare via mezz'ora. */
export function useAvvisoModificheNonSalvate(quante: number) {
  useEffect(() => {
    if (quante < 1) return;
    const avvisa = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [quante]);
}
