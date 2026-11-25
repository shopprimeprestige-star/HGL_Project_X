/** ── I TRE RIQUADRI RICHIUDIBILI (scheda/RiquadroContenuto.tsx) ───────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadri 8-10): «Caratteristiche», «Come si usa e cosa c'è dentro» (passi, confezione,
 *  avvertenze, domande frequenti) e «Reso, consulenza e consegna» (reso, giorni, box consulenza, «Ti serve anche»).
 *  Si aprono e si chiudono: lo stato (`aperti`) lo tiene il guscio, così «Vai» da «Prima di pubblicare» può aprirli; in un prodotto nuovo
 *  partono chiusi (`apertoDiPartenza`). Il prodotto collegato sta solo qui (non anche in «Organizzazione»): un campo, un posto. */
import { Switch } from "@/components/ui/switch";
import { CLASSI_CAMPO, CampoP, RiquadroPolaris } from "./polaris";
import { Caratteristiche, Domande } from "./pezzi";
import { CampoTesto, type ProprietaRiquadro, type SegnoRiquadroProps } from "./RiquadroCampi";

export type RiquadroRichiudibile = "caratteristiche" | "uso" | "reso";

export function RiquadroContenuto({
  aperti,
  alterna,
  segni,
  correlabili,
  ...p
}: Omit<ProprietaRiquadro, "segno"> & {
  aperti: Record<RiquadroRichiudibile, boolean>;
  alterna: (id: RiquadroRichiudibile) => void;
  segni?: Partial<Record<RiquadroRichiudibile, SegnoRiquadroProps>>;
  /** Gli altri prodotti che si possono proporre insieme (non archiviati, non questo). */
  correlabili: { id: string; nome: string }[];
}) {
  const { modulo, cambia, errori, avvisi } = p;
  return (
    <>
      <RiquadroPolaris
        id="caratteristiche"
        titolo="Caratteristiche"
        segno={segni?.caratteristiche}
        aperto={aperti.caratteristiche}
        alterna={() => alterna("caratteristiche")}
      >
        <Caratteristiche
          modulo={modulo}
          cambia={cambia}
          errore={errori.caratteristiche}
          avvisi={avvisi.caratteristiche?.avvisi ?? []}
        />
      </RiquadroPolaris>

      <RiquadroPolaris
        id="uso"
        titolo="Come si usa e cosa c'è dentro"
        segno={segni?.uso}
        aperto={aperti.uso}
        alterna={() => alterna("uso")}
      >
        <CampoTesto
          k="passi"
          p={p}
          etichetta="Come si usa"
          area
          righe={4}
          facoltativo
          aiuto="Un passo per riga."
        />
        <CampoTesto
          k="confezione"
          p={p}
          etichetta="Nella confezione"
          area
          righe={4}
          facoltativo
          aiuto="Una voce per riga."
        />
        <CampoTesto
          k="avvertenze"
          p={p}
          etichetta="Avvertenze"
          area
          righe={4}
          facoltativo
          aiuto="Una per riga."
        />
        <Domande
          modulo={modulo}
          cambia={cambia}
          errore={errori.faq}
          avvisi={avvisi.faq?.avvisi ?? []}
        />
      </RiquadroPolaris>

      <RiquadroPolaris
        id="reso"
        titolo="Reso, consulenza e consegna"
        segno={segni?.reso}
        aperto={aperti.reso}
        alterna={() => alterna("reso")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <CampoP id="f-reso" etichetta="Reso" errore={errori.reso}>
            {(a) => (
              <select
                {...a}
                value={modulo.reso}
                onChange={(e) => cambia({ reso: e.target.value as typeof modulo.reso })}
                className={CLASSI_CAMPO}
              >
                <option value="">Non deciso</option>
                <option value="si">Si può rendere</option>
                <option value="no">Non si rende</option>
              </select>
            )}
          </CampoP>
          <CampoTesto
            k="resoGiorni"
            p={p}
            etichetta="Giorni per il reso"
            inputMode="numeric"
            disabilitato={modulo.reso !== "si"}
          />
        </div>
        <CampoP
          id="f-boxConsulenza"
          etichetta="Box «consulenza»"
          aiuto="Si mostra solo sulle patch."
          errore={errori.boxConsulenza}
        >
          {(a) => (
            <label className="flex min-h-11 items-center gap-3 text-[13px] md:min-h-9">
              <Switch
                id={a.id}
                aria-describedby={a["aria-describedby"]}
                checked={modulo.boxConsulenza}
                onCheckedChange={(x) => cambia({ boxConsulenza: x })}
              />
              {modulo.boxConsulenza ? "Acceso" : "Spento"}
            </label>
          )}
        </CampoP>
        <CampoP
          id="f-correlatoId"
          etichetta="«Ti serve anche»"
          aiuto="Un altro prodotto da proporre insieme (al massimo uno)."
          errore={errori.correlatoId}
        >
          {(a) => (
            <select
              {...a}
              value={modulo.correlatoId}
              onChange={(e) => cambia({ correlatoId: e.target.value })}
              className={CLASSI_CAMPO}
            >
              <option value="">Nessuno</option>
              {correlabili.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          )}
        </CampoP>
        <p id="f-spedizione" className="text-[13px] text-muted-foreground">
          Costo e tempi di spedizione si impostano insieme alla cassa: non servono per pubblicare
          adesso.
        </p>
      </RiquadroPolaris>
    </>
  );
}
