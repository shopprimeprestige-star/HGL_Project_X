/** ── LA FINESTRA «SPEDISCI» (dialoghi/DialogoSpedisci.tsx) ──────────────────────
 *  Rilascio 2, T64 (PIANO-R2 D55; SPEC 8A n. 2). Il corriere si sceglie dall'elenco e il numero di tracking si scrive in un campo di testo con tetto
 *  (da 5 a 40 caratteri, come il server); oppure «senza tracking». Un solo tasto pieno; durante l'invio si spegne (`inInvio`).
 *  I controlli sono quelli di `controllaFormSpedisci` (ordini-ui): gli stessi del server. Non ha chiave di richiesta: spedire due volte è già un «nessun cambio».
 *  shortcut: il menu dei corrieri è l'elenco di partenza (i sei nomi del seme di S5); se il titolare ne ha cambiato l'elenco il server rifiuta un nome
 *  che non c'è e lo dice. Da leggere dal database (GET ?spedizioni) quando la scheda «Spedizioni» (T65) lo condividerà. */
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RisultatoAzioneR2 } from "../client";
import type { Ordine } from "../ordine";
import { controllaFormSpedisci, esitoAzioneR2 } from "../ordini-ui";
import { CORRIERI_DI_PARTENZA, NUMERO_MAX } from "../tracking";
import { Finestra, PiedeFinestra } from "./Finestra";

const CLASSE_MENU =
  "min-h-11 rounded-md border border-input bg-background px-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9";

export function FormSpedisci({
  ordine,
  spedisci,
  inInvio,
  onFatto,
  onChiudi,
}: {
  ordine: Ordine;
  spedisci: (d: {
    corriere?: string;
    numero?: string;
    senzaTracking?: boolean;
  }) => Promise<RisultatoAzioneR2>;
  inInvio: boolean;
  onFatto: (r: RisultatoAzioneR2) => void;
  onChiudi: () => void;
}) {
  const [corriere, setCorriere] = useState("");
  const [numero, setNumero] = useState("");
  const [senzaTracking, setSenzaTracking] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const inVolo = useRef(false);

  const invia = async (ev: FormEvent) => {
    ev.preventDefault();
    if (inVolo.current) return;
    const r = controllaFormSpedisci(ordine, { corriere, numero, senzaTracking });
    if (!r.ok) return setErrore(r.errore);
    setErrore(null);
    inVolo.current = true;
    try {
      const esito = await spedisci({
        corriere: r.corriere,
        numero: r.numero,
        senzaTracking: r.senzaTracking,
      });
      if (esito.ok) onFatto(esito);
      else setErrore(esitoAzioneR2(esito, "spedisci").testo);
    } finally {
      inVolo.current = false;
    }
  };

  return (
    <form onSubmit={(e) => void invia(e)} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1 text-[12px] font-medium">
        Corriere
        <select
          value={corriere}
          onChange={(e) => setCorriere(e.target.value)}
          disabled={inInvio || senzaTracking}
          className={CLASSE_MENU}
        >
          <option value="" disabled>
            Scegli…
          </option>
          {CORRIERI_DI_PARTENZA.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-medium">
        Numero di tracking
        <Input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          maxLength={NUMERO_MAX}
          autoComplete="off"
          disabled={inInvio || senzaTracking}
          className="min-h-11 text-[13px] sm:min-h-9"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-[13px] sm:min-h-8">
        <input
          type="checkbox"
          checked={senzaTracking}
          onChange={(e) => setSenzaTracking(e.target.checked)}
          disabled={inInvio}
          className="h-5 w-5 shrink-0"
        />
        Spedito senza tracking
      </label>
      <p className="text-[11.5px] text-muted-foreground">
        Se l&apos;email «Ordine spedito» è accesa e approvata, parte da sola al cliente.
      </p>
      <PiedeFinestra errore={errore} inInvio={inInvio} onChiudi={onChiudi}>
        <Button type="submit" disabled={inInvio} className="min-h-11 text-[13px] sm:min-h-9">
          {inInvio ? "Invio in corso…" : "Segna come spedito"}
        </Button>
      </PiedeFinestra>
    </form>
  );
}

export function DialogoSpedisci({
  ordine,
  spedisci,
  inInvio,
  onFatto,
  onChiudi,
}: {
  ordine: Ordine;
  spedisci: (d: {
    corriere?: string;
    numero?: string;
    senzaTracking?: boolean;
  }) => Promise<RisultatoAzioneR2>;
  inInvio: boolean;
  onFatto: (r: RisultatoAzioneR2) => void;
  onChiudi: () => void;
}) {
  return (
    <Finestra
      titolo={`Spedisci l'ordine ${ordine.ref}`}
      descrizione="Scegli il corriere e scrivi il numero di tracking, oppure segna che è partito senza."
      inInvio={inInvio}
      onChiudi={onChiudi}
    >
      <FormSpedisci
        ordine={ordine}
        spedisci={spedisci}
        inInvio={inInvio}
        onFatto={onFatto}
        onChiudi={onChiudi}
      />
    </Finestra>
  );
}
