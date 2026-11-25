/** ── I PEZZI COMUNI DEI RIQUADRI (scheda/RiquadroCampi.tsx) ───────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3 e §3.4). Il modulo che si scrive (`Modulo`), le sue funzioni e i campi di testo che i
 *  riquadri hanno in comune: un solo posto per il campo (etichetta, aiuto, contatore, errore, avvisi), così ogni riquadro è corto.
 *  ⚠️ Solo presentazione: nessuna rete, nessuna scrittura; i cambi risalgono con `cambia` e li salva il guscio. I riquadri NON importano da
 *  `client.ts`: i loro tipi di props sono qui e nei riquadri stessi. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CampoModulo, Errori, Modulo, TonoSezione } from "../scheda-pura";
import { CLASSI_CAMPO, CampoP } from "./polaris";

/** Gli avvisi («parole da non usare») accanto a ogni campo: la forma di `avvisiCampi` di `scheda-pura.ts`. */
export type AvvisiScheda = Partial<Record<CampoModulo, { avvisi: string[] }>>;

/** Il segno «a posto / da sistemare (n)» accanto al titolo del riquadro (lo calcola il guscio con `conteggiPerRiquadro`). */
export type SegnoRiquadroProps = { tono: TonoSezione; testo: string };

/** Ciò che ricevono tutti i riquadri di testo: il modulo, come cambiarlo, gli errori e gli avvisi per campo. */
export interface ProprietaRiquadro {
  modulo: Modulo;
  cambia: (p: Partial<Modulo>) => void;
  errori: Errori;
  avvisi: AvvisiScheda;
  segno?: SegnoRiquadroProps;
}

/** I campi del modulo che si scrivono come testo (restano fuori i menu, gli interruttori e le liste). */
export type CampoDiTesto = Exclude<
  {
    [K in CampoModulo]: Modulo[K] extends string ? K : never;
  }[CampoModulo],
  "tipo" | "reso" | "correlatoId"
>;

const idDi = (k: string) => `f-${k}`;

/** Un campo di testo (riga o area) del modulo, con l'etichetta, l'aiuto, il contatore e le frasi d'errore e d'avviso. */
export function CampoTesto({
  k,
  p,
  etichetta,
  aiuto,
  max,
  area,
  righe,
  disabilitato,
  facoltativo,
  inputMode,
  placeholder,
  trasforma,
  accanto,
  classi,
}: {
  k: CampoDiTesto;
  p: Pick<ProprietaRiquadro, "modulo" | "cambia" | "errori" | "avvisi">;
  etichetta: string;
  aiuto?: string;
  max?: number;
  area?: boolean;
  righe?: number;
  disabilitato?: boolean;
  facoltativo?: boolean;
  inputMode?: "decimal" | "numeric" | "text";
  placeholder?: string;
  /** Per lo SKU (maiuscolo) e l'indirizzo (minuscolo). */
  trasforma?: (v: string) => string;
  /** Un tasto accanto al campo (per esempio «Dal nome»), passato dal chiamante. */
  accanto?: ReactNode;
  classi?: string;
}) {
  const valore = p.modulo[k];
  const cambiaTesto = (v: string) =>
    p.cambia({ [k]: trasforma ? trasforma(v) : v } as Partial<Modulo>);
  return (
    <CampoP
      id={idDi(k)}
      etichetta={etichetta}
      aiuto={aiuto}
      contatore={max ? { n: valore.length, max } : undefined}
      errore={p.errori[k]}
      avvisi={p.avvisi[k]?.avvisi}
      facoltativo={facoltativo}
    >
      {(a) =>
        area ? (
          <textarea
            {...a}
            rows={righe ?? 3}
            value={valore}
            disabled={disabilitato}
            onChange={(e) => cambiaTesto(e.target.value)}
            className={cn(CLASSI_CAMPO, "py-2", classi)}
          />
        ) : (
          <div className="flex gap-2">
            <input
              {...a}
              value={valore}
              disabled={disabilitato}
              inputMode={inputMode}
              placeholder={placeholder}
              onChange={(e) => cambiaTesto(e.target.value)}
              className={cn(CLASSI_CAMPO, classi)}
            />
            {accanto}
          </div>
        )
      }
    </CampoP>
  );
}
