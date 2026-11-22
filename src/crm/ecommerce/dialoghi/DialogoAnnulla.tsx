/** ── LA FINESTRA «ANNULLA L'ORDINE» (dialoghi/DialogoAnnulla.tsx) ───────────────
 *  Rilascio 2, T64 (PIANO-R2 D55; SPEC 8A n. 2). Motivo obbligatorio; se l'ordine è pagato, DUE scelte esplicite e nessuna di partenza:
 *  «rimborsa ora» o «nessun rimborso dovuto», e «rimetti in magazzino» sì o no. Se è ancora in attesa, basta il motivo (la sessione su Stripe si chiude).
 *  `apriDialogo()` una volta sola, all'apertura (la chiave serve al rimborso «ora»); chi la monta lo fa con `key={ordine.id}`.
 *  Un solo tasto pieno; durante l'invio si spegne (`inInvio`). I controlli sono quelli di `controllaFormAnnulla` (ordini-ui): gli stessi del server. */
import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RisultatoAzioneR2 } from "../client";
import type { Ordine } from "../ordine";
import type { FormAnnulla } from "../ordini-ui";
import { controllaFormAnnulla, esitoAzioneR2, scelteAnnulla } from "../ordini-ui";
import { euro } from "../pagina";
import { massimoRimborsabileCent, MOTIVO_MAX } from "../rimborso";
import { Finestra, PiedeFinestra } from "./Finestra";

/** Ciò che serve dal dialogo dell'archivio (T61): la chiave si usa da sé dentro `annulla`. */
export interface DialogoDiAnnulla {
  annulla: (d: {
    motivo: string;
    rimborso: "ora" | "nessuno";
    rimettiInMagazzino: boolean;
  }) => Promise<RisultatoAzioneR2>;
  chiaveRichiesta: string;
}

/** Due scelte che si fanno con un clic ciascuna: nessuna è già scelta. */
function Scelta({
  titolo,
  nome,
  valore,
  onCambia,
  disabilitata,
  opzioni,
}: {
  titolo: string;
  nome: string;
  valore: string;
  onCambia: (v: string) => void;
  disabilitata: boolean;
  opzioni: { valore: string; testo: ReactNode }[];
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabilitata}>
      <legend className="mb-1 text-[12px] font-medium">{titolo}</legend>
      {opzioni.map((x) => (
        <label key={x.valore} className="flex min-h-11 items-center gap-2 text-[13px] sm:min-h-8">
          <input
            type="radio"
            name={nome}
            value={x.valore}
            checked={valore === x.valore}
            onChange={() => onCambia(x.valore)}
            className="h-4 w-4 shrink-0"
          />
          {x.testo}
        </label>
      ))}
    </fieldset>
  );
}

export function FormAnnulla({
  ordine,
  rimborsi,
  dialogo,
  inInvio,
  onFatto,
  onChiudi,
}: {
  ordine: Ordine;
  rimborsi: unknown;
  dialogo: DialogoDiAnnulla;
  inInvio: boolean;
  onFatto: (r: RisultatoAzioneR2) => void;
  onChiudi: () => void;
}) {
  const scelte = scelteAnnulla(ordine, rimborsi);
  const [f, setF] = useState<FormAnnulla>({ motivo: "", rimborso: "", magazzino: "" });
  const [errore, setErrore] = useState<string | null>(null);
  const inVolo = useRef(false);

  const invia = async (ev: FormEvent) => {
    ev.preventDefault();
    if (inVolo.current) return;
    const r = controllaFormAnnulla(ordine, f, rimborsi, dialogo.chiaveRichiesta);
    if (!r.ok) return setErrore(r.errore);
    setErrore(null);
    inVolo.current = true;
    try {
      const esito = await dialogo.annulla({
        motivo: r.motivo,
        rimborso: r.rimborso,
        rimettiInMagazzino: r.rimettiInMagazzino,
      });
      if (esito.ok) onFatto(esito);
      else setErrore(esitoAzioneR2(esito, "annulla").testo);
    } finally {
      inVolo.current = false;
    }
  };

  return (
    <form onSubmit={(e) => void invia(e)} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1 text-[12px] font-medium">
        Motivo dell&apos;annullo (resta nello storico)
        <Textarea
          value={f.motivo}
          onChange={(e) => setF({ ...f, motivo: e.target.value })}
          maxLength={MOTIVO_MAX}
          rows={3}
          disabled={inInvio}
          className="text-[13px]"
        />
      </label>
      {ordine.statoPagamento === "in_attesa" && (
        <p className="text-[12.5px] text-muted-foreground">
          L&apos;ordine non è ancora pagato: la sessione di pagamento su Stripe viene chiusa.
        </p>
      )}
      {scelte.rimborso && (
        <Scelta
          titolo="Il cliente ha già pagato: i soldi?"
          nome="rimborso"
          valore={f.rimborso}
          onCambia={(v) => setF({ ...f, rimborso: v as FormAnnulla["rimborso"] })}
          disabilitata={inInvio}
          opzioni={[
            {
              valore: "ora",
              testo: `Rimborsa ora (${euro(massimoRimborsabileCent(ordine, rimborsi) / 100)})`,
            },
            { valore: "nessuno", testo: "Nessun rimborso dovuto" },
          ]}
        />
      )}
      {scelte.magazzino && !scelte.rimborso && (
        <p className="text-[12.5px] text-muted-foreground">
          Non c&apos;è più niente da rimborsare su questo ordine.
        </p>
      )}
      {scelte.magazzino && (
        <Scelta
          titolo="I pezzi tornano in magazzino?"
          nome="magazzino"
          valore={f.magazzino}
          onCambia={(v) => setF({ ...f, magazzino: v as FormAnnulla["magazzino"] })}
          disabilitata={inInvio}
          opzioni={[
            { valore: "si", testo: "Sì, rimettili in magazzino" },
            { valore: "no", testo: "No, non rimetterli" },
          ]}
        />
      )}
      <PiedeFinestra errore={errore} inInvio={inInvio} onChiudi={onChiudi}>
        <Button
          type="submit"
          variant="destructive"
          disabled={inInvio}
          className="min-h-11 text-[13px] sm:min-h-9"
        >
          {inInvio ? "Invio in corso…" : "Annulla l'ordine"}
        </Button>
      </PiedeFinestra>
    </form>
  );
}

export function DialogoAnnulla({
  ordine,
  rimborsi,
  apriDialogo,
  inInvio,
  onFatto,
  onChiudi,
}: {
  ordine: Ordine;
  rimborsi: unknown;
  apriDialogo: () => DialogoDiAnnulla;
  inInvio: boolean;
  onFatto: (r: RisultatoAzioneR2) => void;
  onChiudi: () => void;
}) {
  //  Una volta sola, all'apertura: la chiave della richiesta nasce qui.
  const [dialogo] = useState(() => apriDialogo());
  return (
    <Finestra
      titolo={`Annullare l'ordine ${ordine.ref}?`}
      descrizione="L'ordine resta nell'elenco e nello storico, ma non conta più fra gli ordini. Per riattivarlo servirà «Correggi lo stato», con il motivo."
      inInvio={inInvio}
      onChiudi={onChiudi}
    >
      <FormAnnulla
        ordine={ordine}
        rimborsi={rimborsi}
        dialogo={dialogo}
        inInvio={inInvio}
        onFatto={onFatto}
        onChiudi={onChiudi}
      />
    </Finestra>
  );
}
