/** ── LA PASTIGLIA DEL SECONDO STATO: «STATO DEL CONTATTO» ───────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5. Sta ACCANTO a quella
 *  dello stato di sempre (`PastigliaStato`) e non la tocca mai. Si preme, si
 *  apre una finestra con i sette stati e la storia, si sceglie: la scelta È il
 *  salvataggio (come in `SelettoreStatoDialog`).
 *
 *  Le regole (che stato si vede, quali scelte, quali frasi) sono in
 *  `vista-pannello.ts` e sono provate; qui si disegna e si chiama la rotta.
 *
 *  ⚠️ COLORE E PAROLA INSIEME: la pastiglia scrive sempre l'etichetta per
 *   esteso (e una piccola icona di WhatsApp la distingue dallo stato di sempre,
 *   che ha gli stessi colori). Il tono viene da `TONI_CONTATTO`.
 *  ⚠️ LO STOP LO TOGLIE SOLO CHI HA «impostazioni». Qui si mostra chiuso agli
 *   altri e si dice perché; il rifiuto vero lo dà la rotta (403).
 *  ⚠️ NON SCRIVE LA SCHEDA: chiama `/api/crm/contatto-wa` e restituisce il
 *   secondo stato nuovo con `onCambiato`; chi monta la pastiglia aggiorna la
 *   scheda che ha in mano. Fino ad allora la pastiglia mostra l'ultimo valore
 *   confermato dal server.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata (React #310).
 *  ───────────────────────────────────────────────────────────────────────── */
import { ChevronDown, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePuo } from "@/crm/AuthContext";
import { CLASSE_BADGE_STATO, CLASSI_TONO, PUNTO_TONO } from "@/crm/ui";
import {
  Finestra,
  NotaFinestra,
  SezioneFinestra,
  VoceScelta,
  VuotoFinestra,
} from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";
import type { ContattoWa, LeadData, StatoContattoWa } from "../types";
import { cambiaContattoWa } from "./client-crm";
import { ETICHETTE_CONTATTO } from "./contatto";
import { fraseVoceStoria, sceltePerContatto, vistaContatto } from "./vista-pannello";

type DatiContatto = Pick<Partial<LeadData>, "contattoWa">;

/** La storia in elenco: la voce più nuova in cima. `max` ne mostra solo le
 *  prime (nella scheda); senza, le mostra tutte (nella finestra). */
export function StoriaContatto({
  storia,
  max,
  className,
}: {
  storia: ContattoWa["storia"] | undefined;
  max?: number;
  className?: string;
}) {
  const [tutte, setTutte] = useState(false);
  const voci = storia ?? [];
  const viste = max && !tutte ? voci.slice(0, max) : voci;
  if (voci.length === 0) return null;
  return (
    <div className={className}>
      <ul className="space-y-1">
        {viste.map((v, i) => (
          <li
            key={`${v.il}-${i}`}
            className="break-words text-[12px] leading-snug text-slate-600 first:font-medium first:text-slate-900"
          >
            {fraseVoceStoria(v)}
          </li>
        ))}
      </ul>
      {max && voci.length > max && (
        <button
          type="button"
          onClick={() => setTutte((v) => !v)}
          aria-expanded={tutte}
          className="mt-1.5 text-[12px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {tutte ? "Mostra meno" : `Mostra tutta la storia (${voci.length})`}
        </button>
      )}
    </div>
  );
}

export function PastigliaContatto({
  dati,
  leadId,
  contesto,
  compatta,
  mostraSeVuota,
  adesso,
  onCambiato,
  disabilitata,
  className,
}: {
  /** i campi della scheda: basta `contattoWa` */
  dati: DatiContatto;
  leadId: string;
  /** la riga sotto il titolo della finestra: di solito il nome del cliente */
  contesto?: string;
  /** per le righe delle liste: piccola, senza freccia, e senza niente se la
   *  scheda non ha un secondo stato */
  compatta?: boolean;
  /** forza «Non segnato» anche in forma compatta */
  mostraSeVuota?: boolean;
  adesso?: Date;
  /** il server ha scritto il cambio: ecco il secondo stato nuovo */
  onCambiato?: (contattoWa: ContattoWa) => void;
  disabilitata?: boolean;
  className?: string;
}) {
  const puoTogliereStop = usePuo()("impostazioni");
  const [aperta, setAperta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [daConfermare, setDaConfermare] = useState<StatoContattoWa | null>(null);
  //  L'ultimo valore confermato dal server vale finché la scheda non ne porta
  //  uno suo (cambia `contattoWa` o la scheda).
  const [ultimo, setUltimo] = useState<ContattoWa | null>(null);
  useEffect(() => setUltimo(null), [dati.contattoWa, leadId]);

  const valore = useMemo<DatiContatto>(
    () => ({ contattoWa: ultimo ?? dati.contattoWa }),
    [ultimo, dati.contattoWa],
  );
  const ora = adesso ?? new Date();
  const vista = vistaContatto(valore, ora);
  const scelte = sceltePerContatto(valore, ora, puoTogliereStop);
  const storia = valore.contattoWa?.storia;

  const chiudi = () => {
    setAperta(false);
    setErrore(null);
    setDaConfermare(null);
  };

  const scegli = async (stato: StatoContattoWa) => {
    if (salvando) return;
    if (stato === vista.stato) return chiudi();
    const s = scelte.find((x) => x.stato === stato);
    if (s?.chiedeConferma && daConfermare !== stato) {
      setDaConfermare(stato);
      return;
    }
    setSalvando(true);
    setErrore(null);
    const r = await cambiaContattoWa(leadId, stato);
    setSalvando(false);
    if (!r.ok) {
      setErrore(r.errore);
      return;
    }
    setUltimo(r.dati.contattoWa);
    //  Riuscito ma a metà (es. il numero resta bloccato): lo si dice, non si tace.
    if (r.dati.avviso) toast.warning(r.dati.avviso, { duration: 12_000 });
    onCambiato?.(r.dati.contattoWa);
    chiudi();
  };

  //  Nelle righe una scheda senza contatto non occupa posto (niente scatole
  //  vuote); la si imposta dalla scheda.
  if (compatta && !vista.stato && !mostraSeVuota) return null;

  const nomeStato = vista.etichetta;
  return (
    <>
      <button
        type="button"
        disabled={disabilitata}
        //  Vive dentro righe che si aprono al clic: senza questo si aprirebbe
        //  anche la scheda dietro.
        onClick={(e) => {
          e.stopPropagation();
          //  Un errore arrivato dopo una chiusura non deve ricomparire.
          setErrore(null);
          setAperta(true);
        }}
        title={`Contatto WhatsApp: ${nomeStato}${vista.scaduta ? " (l'attesa è scaduta)" : ""} · cambia`}
        aria-haspopup="dialog"
        aria-label={`Contatto WhatsApp: ${nomeStato}. Cambialo`}
        className={cn(
          CLASSE_BADGE_STATO,
          vista.stato
            ? CLASSI_TONO[vista.tono]
            : "border-dashed border-slate-300 bg-white text-slate-500",
          "cursor-pointer transition hover:brightness-95 disabled:cursor-default disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          compatta ? "h-6 max-w-[11rem]" : "h-7",
          className,
        )}
      >
        <MessageCircle className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        <span className="truncate">{nomeStato}</span>
        {!compatta && <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />}
      </button>

      {/*  La finestra è un portale, ma gli eventi React risalgono comunque l'albero:
          senza questo un clic dentro la finestra arriverebbe all'onClick della
          riga che contiene la pastiglia (e aprirebbe la scheda dietro). */}
      <div className="contents" onClick={(e) => e.stopPropagation()}>
        <Finestra
          aperta={aperta}
          onCambio={(v) => !v && chiudi()}
          titolo="Stato del contatto"
          icona={MessageCircle}
          contesto={contesto ? `${contesto} · adesso: ${nomeStato}` : `Adesso: ${nomeStato}`}
          larghezza="sm"
          azioni={
            daConfermare ? (
              <>
                <Button variant="outline" onClick={() => setDaConfermare(null)} disabled={salvando}>
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void scegli(daConfermare)}
                  disabled={salvando}
                >
                  {salvando ? "Salvo…" : `Metti «${ETICHETTE_CONTATTO[daConfermare]}»`}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={chiudi}>
                Chiudi
              </Button>
            )
          }
        >
          <div className="space-y-3">
            {daConfermare ? (
              <NotaFinestra tono="attenzione">
                Con «{ETICHETTE_CONTATTO[daConfermare]}» il cliente non riceve più nessun messaggio
                automatico, da nessun canale. Poi lo toglie solo chi ha il permesso «impostazioni».
                Vuoi metterlo?
              </NotaFinestra>
            ) : (
              <div className="space-y-1.5" role="group" aria-label="Scegli lo stato del contatto">
                {scelte.map((s) => (
                  <VoceScelta
                    key={s.stato}
                    titolo={s.etichetta}
                    nota={s.nota}
                    punto={PUNTO_TONO[s.tono]}
                    selezionata={s.attuale}
                    disabilitata={!s.abilitata || salvando}
                    onClick={() => void scegli(s.stato)}
                  />
                ))}
              </div>
            )}
            {errore && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-snug text-rose-900"
              >
                {errore}
              </p>
            )}
            {!daConfermare && scelte.some((s) => !s.abilitata) && (
              <NotaFinestra tono="attenzione">{scelte.find((s) => s.perche)?.perche}</NotaFinestra>
            )}
            {!daConfermare && scelte.some((s) => s.abilitata && !s.attuale) && (
              <NotaFinestra>
                «Contattato», «Ha risposto» e «Da ricontattare» sbloccano l'invio automatico: dopo
                uno di questi può ripartire un messaggio anche se il cliente non aveva risposto.
              </NotaFinestra>
            )}
            {!daConfermare && (
              <SezioneFinestra titolo="Storia" nota="la più recente in cima">
                {storia && storia.length > 0 ? (
                  <StoriaContatto storia={storia} />
                ) : (
                  <VuotoFinestra testo="Ancora nessun movimento su WhatsApp." />
                )}
              </SezioneFinestra>
            )}
          </div>
        </Finestra>
      </div>
    </>
  );
}
