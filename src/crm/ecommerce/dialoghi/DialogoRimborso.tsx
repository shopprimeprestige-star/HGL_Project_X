/** ── LA FINESTRA «RIMBORSA» (dialoghi/DialogoRimborso.tsx) ──────────────────────
 *  Rilascio 2, T64 (PIANO-R2 D55; SPEC 7.4 n. 5). Importo (di partenza il residuo, in euro), motivo, e una conferma esplicita: un rimborso non si annulla.
 *  `apriDialogo()` si chiama UNA volta, quando la finestra si monta (all'apertura): la chiave della richiesta nasce lì e resta la stessa per tutti gli
 *  invii di questa finestra; riaprirla ne dà una nuova. Chi la monta lo fa con `key={ordine.id}`, così un ordine diverso non eredita ciò che si è scritto.
 *  Un solo tasto pieno; durante l'invio si spegne (`inInvio`). I controlli sono quelli di `controllaFormRimborso` (ordini-ui): gli stessi del server. */
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RisultatoAzioneR2 } from "../client";
import type { Ordine } from "../ordine";
import { controllaFormRimborso, esitoAzioneR2 } from "../ordini-ui";
import { euro } from "../pagina";
import { massimoRimborsabileCent, MOTIVO_MAX } from "../rimborso";
import { Finestra, PiedeFinestra } from "./Finestra";

/** Ciò che serve dal dialogo dell'archivio (T61): la chiave e l'invio. */
export interface DialogoDiRimborso {
  chiaveRichiesta: string;
  rimborso: (d: {
    importoCent: number;
    motivo: string;
    conferma: true;
  }) => Promise<RisultatoAzioneR2>;
}

const virgola = (cent: number): string => (cent / 100).toFixed(2).replace(".", ",");

export function FormRimborso({
  ordine,
  rimborsi,
  dialogo,
  inInvio,
  onFatto,
  onChiudi,
}: {
  ordine: Ordine;
  rimborsi: unknown;
  dialogo: DialogoDiRimborso;
  inInvio: boolean;
  onFatto: (r: RisultatoAzioneR2) => void;
  onChiudi: () => void;
}) {
  const massimo = massimoRimborsabileCent(ordine, rimborsi);
  const [importo, setImporto] = useState(() => (massimo > 0 ? virgola(massimo) : ""));
  const [motivo, setMotivo] = useState("");
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  //  Il secondo clic prima che il primo abbia finito non parte: il blocco è una variabile, lo stato di React arriva un attimo dopo.
  const inVolo = useRef(false);

  const invia = async (ev: FormEvent) => {
    ev.preventDefault();
    if (inVolo.current) return;
    const r = controllaFormRimborso(
      ordine,
      { importo, motivo, conferma },
      rimborsi,
      dialogo.chiaveRichiesta,
    );
    if (!r.ok) return setErrore(r.errore);
    setErrore(null);
    inVolo.current = true;
    try {
      const esito = await dialogo.rimborso({
        importoCent: r.importoCent,
        motivo: r.motivo,
        conferma: true,
      });
      if (esito.ok) onFatto(esito);
      else setErrore(esitoAzioneR2(esito, "rimborso").testo);
    } finally {
      inVolo.current = false;
    }
  };

  return (
    <form onSubmit={(e) => void invia(e)} className="flex flex-col gap-3" noValidate>
      <p className="text-[13px]">
        Si può rimborsare al massimo{" "}
        <span className="font-semibold tabular-nums">{euro(massimo / 100)}</span>.
      </p>
      <label className="flex flex-col gap-1 text-[12px] font-medium">
        Importo da rimborsare (€)
        <Input
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          disabled={inInvio}
          className="min-h-11 text-[13px] tabular-nums sm:min-h-9"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-medium">
        Motivo (resta nello storico)
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_MAX}
          rows={3}
          disabled={inInvio}
          className="text-[13px]"
        />
      </label>
      <label className="flex items-start gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={conferma}
          onChange={(e) => setConferma(e.target.checked)}
          disabled={inInvio}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        Ho capito: il rimborso torna al cliente tramite Stripe e non si può annullare.
      </label>
      <PiedeFinestra errore={errore} inInvio={inInvio} onChiudi={onChiudi}>
        <Button type="submit" disabled={inInvio} className="min-h-11 text-[13px] sm:min-h-9">
          {inInvio ? "Invio in corso…" : "Rimborsa"}
        </Button>
      </PiedeFinestra>
    </form>
  );
}

export function DialogoRimborso({
  ordine,
  rimborsi,
  apriDialogo,
  inInvio,
  onFatto,
  onChiudi,
}: {
  ordine: Ordine;
  rimborsi: unknown;
  apriDialogo: () => DialogoDiRimborso;
  inInvio: boolean;
  onFatto: (r: RisultatoAzioneR2) => void;
  onChiudi: () => void;
}) {
  //  Una volta sola, all'apertura: la chiave della richiesta nasce qui.
  const [dialogo] = useState(() => apriDialogo());
  return (
    <Finestra
      titolo={`Rimborsa l'ordine ${ordine.ref}`}
      descrizione="Il rimborso torna al cliente tramite Stripe. Un rimborso non si può annullare."
      inInvio={inInvio}
      onChiudi={onChiudi}
    >
      <FormRimborso
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
