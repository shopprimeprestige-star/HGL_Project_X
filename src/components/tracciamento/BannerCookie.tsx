/*  ── IL BANNER DEI COOKIE (UNO SOLO PER TUTTO IL SITO) ─────────────────────────────
    Shop R1 · T27 · PIANO D10, D15; Design §3.2, §4.5.12. Lo monta il provider, solo dove `bannerAmmesso` dice sì.

    ⚠️ Tre bottoni IDENTICI (stessa classe, stessa larghezza, 44 px) in ordine Accetta · Rifiuta · Scegli: nessuno
       è «quello giusto». Nessuna X: non si chiude senza scegliere. Esc non accetta niente: se la scelta c'è già
       (banner riaperto dal piè di pagina) chiude e basta, altrimenti non fa niente.
    ⚠️ Non ruba il fuoco quando compare da solo (`aria-modal="false"`, la pagina resta usabile). Il fuoco si sposta
       solo se è stato l'utente a chiederlo (link «Gestisci cookie») o a premere «Scegli».
    ⚠️ Mai bianco su `bg-brand` (3,3:1) né testo sotto gli 11 px: contorno bianco su blu notte, 14 px. */
import { useEffect, useId, useRef, useState } from "react";
import { TESTI } from "./testi-cookie";

export type SceltaBanner = { statistiche: boolean; marketing: boolean };

type Props = {
  /** La scelta di adesso (banner riaperto); `null` se non c'è mai stata. */
  attuale: SceltaBanner | null;
  /** Salva la scelta. */
  onScelta: (s: SceltaBanner) => void;
  /** Il banner può andarsene (dopo la conferma, o con Esc a scelta già fatta). */
  onChiudi: () => void;
  /** `ok` = la scelta è stata salvata (si mostra la conferma); `errore` = il browser non lascia salvare. */
  esito?: "ok" | "errore" | null;
  /** Da dove si parte: la domanda o le scelte (riaperto dal piè di pagina). */
  vistaIniziale?: "domanda" | "scelte";
  /** È stato l'utente a chiedere di aprirlo: il fuoco va sul banner. */
  daUtente?: boolean;
};

/** Lo stesso identico stile per i tre bottoni: contorno bianco 2 px, 14/600, 44 px. */
const BOTTONE =
  "inline-flex min-h-11 w-full items-center justify-center rounded-md border-2 border-white px-2 text-center text-sm font-semibold leading-tight text-white motion-safe:transition-colors hover:bg-white/10 active:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const CASELLA = "mt-0.5 h-5 w-5 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function BannerCookie({ attuale, onScelta, onChiudi, esito = null, vistaIniziale = "domanda", daUtente = false }: Props) {
  const idTitolo = useId();
  const idCorpo = useId();
  const [vista, setVista] = useState<"domanda" | "scelte">(vistaIniziale);
  const [statistiche, setStatistiche] = useState(attuale?.statistiche === true);
  const [marketing, setMarketing] = useState(attuale?.marketing === true);
  const scheda = useRef<HTMLDivElement>(null);
  const primaCasella = useRef<HTMLInputElement>(null);
  const fuocoSulleScelte = useRef(false);

  useEffect(() => {
    if (daUtente) scheda.current?.focus();
  }, [daUtente]);
  useEffect(() => {
    if (vista === "scelte" && fuocoSulleScelte.current) primaCasella.current?.focus();
  }, [vista]);
  // la conferma resta qualche secondo e poi se ne va da sola: non c'è niente da premere
  useEffect(() => {
    if (esito !== "ok") return;
    const t = window.setTimeout(onChiudi, 6000);
    return () => window.clearTimeout(t);
  }, [esito, onChiudi]);

  const conferma = esito === "ok";
  return (
    <div
      ref={scheda}
      role="dialog"
      aria-modal="false"
      {...(conferma ? { "aria-label": TESTI.ariaDialogo } : { "aria-labelledby": idTitolo, "aria-describedby": idCorpo })}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && attuale) onChiudi();
      }}
      className="fixed inset-x-0 bottom-0 z-50 outline-none sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-full sm:max-w-md"
    >
      <div className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-xl border-t border-white/15 bg-[#081634] px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white shadow-galleggiante sm:rounded-xl sm:border sm:pb-5">
        {conferma ? (
          <p role="status" className="text-sm leading-relaxed text-white/90">
            {TESTI.salvata}
          </p>
        ) : (
          <>
            <h2 id={idTitolo} className="text-base font-semibold">
              {TESTI.titolo}
            </h2>
            <p id={idCorpo} className="mt-2 text-sm leading-relaxed text-white/85">
              {TESTI.corpo}{" "}
              <a href="/cookie-policy" className="underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {TESTI.linkPolicy}
              </a>
            </p>
            {esito === "errore" && (
              <p role="alert" className="mt-3 rounded-md border border-[#FF6B6B] px-3 py-2 text-sm leading-snug text-[#FF6B6B]">
                {TESTI.errore}
              </p>
            )}
            {vista === "scelte" && (
              <fieldset className="mt-3 border-t border-white/15 pt-2">
                <legend className="sr-only">{TESTI.categorie}</legend>
                <label className="flex min-h-11 items-start gap-3 py-2">
                  <input type="checkbox" checked disabled readOnly className={CASELLA} />
                  <span>
                    <span className="block text-sm font-semibold">{TESTI.necessari.nome}</span>
                    <span className="block text-[13px] leading-snug text-white/75">{TESTI.necessari.descrizione}</span>
                  </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                  <input ref={primaCasella} type="checkbox" checked={statistiche} onChange={(e) => setStatistiche(e.target.checked)} className={CASELLA} />
                  <span>
                    <span className="block text-sm font-semibold">{TESTI.statistiche.nome}</span>
                    <span className="block text-[13px] leading-snug text-white/75">{TESTI.statistiche.descrizione}</span>
                  </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                  <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className={CASELLA} />
                  <span>
                    <span className="block text-sm font-semibold">{TESTI.marketing.nome}</span>
                    <span className="block text-[13px] leading-snug text-white/75">{TESTI.marketing.descrizione}</span>
                  </span>
                </label>
              </fieldset>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" className={BOTTONE} onClick={() => onScelta({ statistiche: true, marketing: true })}>
                {TESTI.accetta}
              </button>
              <button type="button" className={BOTTONE} onClick={() => onScelta({ statistiche: false, marketing: false })}>
                {TESTI.rifiuta}
              </button>
              {vista === "domanda" ? (
                <button
                  type="button"
                  className={BOTTONE}
                  onClick={() => {
                    fuocoSulleScelte.current = true;
                    setVista("scelte");
                  }}
                >
                  {TESTI.scegli}
                </button>
              ) : (
                <button type="button" className={BOTTONE} onClick={() => onScelta({ statistiche, marketing })}>
                  {TESTI.salva}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
