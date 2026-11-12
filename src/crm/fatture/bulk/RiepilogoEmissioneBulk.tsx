/** ── FATTURE BULK · RIEPILOGO PRIMA E DOPO L'EMISSIONE ────────────────────
 *  Commessa 2026-11-12-fatture-bulk, T13. Nessuna fattura parte senza passare da
 *  questa finestra, e la finestra dice cosa sta per succedere in numeri, non in
 *  generale: quante, quanto, da quale numero a quale, con che date, quante restano
 *  fuori, quante avranno una data più vecchia di una già emessa.
 *
 *  ⚠️ I NUMERI «DAL X AL Y» SONO UNA STIMA: li assegna il server riga per riga.
 *   Si calcolano con la stessa regola di `prossimoNumeroSu` (il più grande fra le
 *   impostazioni e l'ultimo in archivio più uno, per anno e sezionale) solo per
 *   mostrarli prima; se nel frattempo un'altra scheda emette, il riepilogo finale
 *   lo dice.
 *  ⚠️ I TOTALI SONO IN CENTESIMI INTERI, sommati e poi divisi: sommare euro
 *   decimali fa comparire un centesimo che non c'è.
 *  ⚠️ Qui non si ricalcola IVA né stato: gli importi arrivano da `valutaLotto`. */
import { useMemo } from "react";
import { AlertTriangle, Download, FileSpreadsheet, FileCheck2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DatoFinestra,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  SezioneFinestra,
} from "@/crm/ui/Finestra";
import { etichettaNumero } from "../archivio";
import { nomeCliente } from "../documento";
import { scaricaTesto } from "../scarica";
import type { DatiAzienda, Fattura } from "../tipi";
import { GIORNI_TERMINE_SDI } from "./chiavi";
import { ordineEmissione } from "./emissione-bulk";
import { NOTE_RIEPILOGO_COMMERCIALISTA, righeRiepilogoCommercialista } from "./regole-lotto";
import { dataItaliana, euroEsatti, rigaAperta } from "./AnteprimaBulk";
import { fraseDi, type RiepilogoEmissione } from "./usa-lotto";
import type { FattiSulleDate, RigaValutata } from "./tipi";

/* ══ 1. I NUMERI DEL RIEPILOGO (funzioni pure) ═════════════════════════════ */

export interface DatiRiepilogo {
  quante: number;
  /** Centesimi interi. */
  totaleCentesimi: number;
  /** Per anno: dal numero X al numero Y (stima). */
  numeri: { anno: number; da: number; a: number }[];
  ultimaEmessa: FattiSulleDate["ultimaEmessa"];
  dataMinima: string;
  dataMassima: string;
  ultimoGiornoUtile: string;
  /** Fra quelle che si emettono ora. */
  conDataAnteriore: number;
  oltreIlTermine: number;
  /** Righe aperte che restano fuori e quante di queste hanno una data anteriore a quelle che si emettono. */
  fuori: number;
  fuoriConDataAnteriore: number;
  /** Fatture il cui totale nel file XML differisce di un centesimo dal pagato. */
  conCentesimo: number;
  ordinePerData: boolean;
}

const centesimi = (n: number | null) => Math.round((n ?? 0) * 100);

export function calcolaRiepilogo(
  righe: RigaValutata[],
  fatti: FattiSulleDate | null,
  emesse: Fattura[],
  azienda: DatiAzienda,
): DatiRiepilogo {
  const aperte = righe.filter(rigaAperta);
  const set = aperte.filter((r) => r.emettibile);
  const fuoriRighe = aperte.filter((r) => !r.emettibile);
  const ordine = ordineEmissione(
    set.map((r) => ({ idRiga: r.idRiga, numero: r.numero, data: r.campi.data })),
  );
  const date = set
    .map((r) => r.campi.data)
    .filter(Boolean)
    .sort();
  const dentro = new Set(set.map((r) => r.idRiga));
  const serie = azienda.serie || "";

  const perAnno = new Map<number, number>();
  for (const o of ordine) {
    const anno = Number(o.data.slice(0, 4));
    perAnno.set(anno, (perAnno.get(anno) ?? 0) + 1);
  }
  const numeri = [...perAnno]
    .sort((x, y) => x[0] - y[0])
    .map(([anno, n]) => {
      const ultimo = emesse
        .filter((f) => f.stato === "emessa" && f.anno === anno && f.serie === serie)
        .reduce((m, f) => Math.max(m, f.numero), 0);
      const daImpostazioni =
        azienda.annoNumerazione === anno ? Math.max(1, azienda.primoNumero) : 1;
      const da = Math.max(ultimo + 1, daImpostazioni);
      return { anno, da, a: da + n - 1 };
    });

  const utili = set
    .map((r) => r.ultimoGiornoUtile)
    .filter((u): u is string => !!u)
    .sort();
  const dataMassima = date[date.length - 1] ?? "";
  return {
    quante: set.length,
    totaleCentesimi: set.reduce((t, r) => t + centesimi(r.campi.importo), 0),
    numeri,
    ultimaEmessa: fatti?.ultimaEmessa ?? null,
    dataMinima: date[0] ?? "",
    dataMassima,
    ultimoGiornoUtile: utili[0] ?? "",
    conDataAnteriore: (fatti?.righeDataAnteriore ?? []).filter((id) => dentro.has(id)).length,
    oltreIlTermine: (fatti?.righeOltreTermine ?? []).filter((id) => dentro.has(id)).length,
    fuori: fuoriRighe.length,
    fuoriConDataAnteriore: fuoriRighe.filter(
      (r) => r.campi.data && dataMassima && r.campi.data < dataMassima,
    ).length,
    conCentesimo: set.filter(
      (r) =>
        r.totaleNelFile !== undefined && centesimi(r.totaleNelFile) !== centesimi(r.campi.importo),
    ).length,
    ordinePerData: ordine.some((o, i) => o.idRiga !== set[i]?.idRiga),
  };
}

/* ══ 2. IL RIEPILOGO PER IL COMMERCIALISTA (CSV) ═══════════════════════════ */

/** Una cella di CSV. Un nome che comincia con «=» o «+» (letto da un'immagine) non deve diventare una formula in Excel. */
const cella = (v: string | number): string => {
  let t = String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};
const numeroIt = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

export function csvCommercialista(fatture: Fattura[], azienda: DatiAzienda): string {
  const righe = righeRiepilogoCommercialista(fatture, azienda);
  const testa = [
    "Numero",
    "Data",
    "Cliente",
    "Codice fiscale",
    "Imponibile",
    "IVA",
    "Totale",
    "Totale nel file XML",
    "Come ha pagato",
    "Riferimento",
    "Mese di competenza IVA",
    "Ultimo giorno utile (stima)",
  ];
  return [
    ...NOTE_RIEPILOGO_COMMERCIALISTA.map((n) => cella(`Nota: ${n}`)),
    "",
    testa.map(cella).join(";"),
    ...righe.map((r) =>
      [
        r.numero,
        dataItaliana(r.data),
        r.cliente,
        r.codiceFiscale,
        numeroIt(r.imponibile),
        numeroIt(r.iva),
        numeroIt(r.totale),
        numeroIt(r.totaleNelFile),
        r.modo,
        r.riferimento,
        r.meseCompetenza,
        dataItaliana(r.ultimoGiornoUtile),
      ]
        .map(cella)
        .join(";"),
    ),
  ].join("\r\n");
}

/* ══ 3. LA FINESTRA ════════════════════════════════════════════════════════ */

/** Se l'emissione si ferma (anche per la rete) l'ultima riga può essere uscita senza che la risposta arrivasse. */
export const AVVISO_ULTIMA_RIGA =
  "L'ultima riga può risultare incerta se la connessione è caduta: la fattura potrebbe essere stata emessa. Controlla nell'elenco delle fatture (o riaprendo il caricamento) prima di riprovare; riprovare non ne emette una seconda.";

export type FaseEmissione = "conferma" | "corso" | "finale";

const euroCentesimi = (c: number) => euroEsatti(c / 100);

export function RiepilogoEmissioneBulk({
  aperta,
  onCambio,
  fase,
  righe,
  fatti,
  emesse,
  azienda,
  avanzamento,
  riepilogo,
  lottoChiuso,
  oggi,
  onEmetti,
  onInterrompi,
  onPrendiControllo,
  onScaricaXml,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  fase: FaseEmissione;
  righe: RigaValutata[];
  fatti: FattiSulleDate | null;
  emesse: Fattura[];
  azienda: DatiAzienda;
  avanzamento: { fatti: number; totale: number } | null;
  riepilogo: RiepilogoEmissione | null;
  lottoChiuso: boolean;
  oggi: string;
  onEmetti: () => void;
  onInterrompi: () => void;
  onPrendiControllo: () => void;
  onScaricaXml: (fatture: Fattura[]) => void;
}) {
  const dati = useMemo(
    () => calcolaRiepilogo(righe, fatti, emesse, azienda),
    [righe, fatti, emesse, azienda],
  );
  const perId = useMemo(() => new Map(emesse.map((f) => [f.id, f])), [emesse]);
  const fatture = useMemo(
    () => (riepilogo?.emesse ?? []).map((e) => perId.get(e.id)).filter((f): f is Fattura => !!f),
    [riepilogo, perId],
  );

  if (fase === "finale" && riepilogo) {
    const n = riepilogo.emesse.length;
    const saltate = riepilogo.saltate.length;
    return (
      <Finestra
        aperta={aperta}
        onCambio={onCambio}
        larghezza="md"
        icona={FileCheck2}
        titolo={
          n === 0 ? "Nessuna fattura emessa" : n === 1 ? "Emessa 1 fattura" : `Emesse ${n} fatture`
        }
        contesto={saltate > 0 ? `${saltate} non emesse perché non erano più in regola` : undefined}
        azioni={
          <Button type="button" className="h-11 sm:h-9" onClick={() => onCambio(false)}>
            Chiudi
          </Button>
        }
      >
        <div className="space-y-3">
          {riepilogo.fermata && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              <span role="alert" className="block">
                {fraseDi(riepilogo.fermata.codice, riepilogo.fermata.messaggio)} Le righe non ancora
                emesse non sono state toccate: puoi riprendere da «Emetti le confermate».
                <span className="mt-2 block font-medium">{AVVISO_ULTIMA_RIGA}</span>
                {riepilogo.fermata.codice === "emittente_occupato" && (
                  <span className="mt-2 block">
                    Se l&apos;altra scheda del CRM è chiusa puoi{" "}
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={onPrendiControllo}
                    >
                      prendere il controllo
                    </button>
                    : l&apos;altra scheda smette di emettere.
                  </span>
                )}
              </span>
            </NotaFinestra>
          )}
          {riepilogo.saltiDiNumeri.length > 0 && (
            <NotaFinestra tono="attenzione" icona={Info}>
              Durante il lavoro sono state emesse da altri le fatture n.{" "}
              {riepilogo.saltiDiNumeri
                .map((s) => (s.da === s.a ? s.da : `${s.da}–${s.a}`))
                .join(", ")}
              . I numeri restano uno dopo l&apos;altro, senza buchi.
            </NotaFinestra>
          )}
          {saltate > 0 && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              {saltate === 1
                ? "Una riga non è stata emessa"
                : `${saltate} righe non sono state emesse`}
              : al momento di emettere non risultavano più in regola. Restano nell&apos;elenco, da
              controllare.
            </NotaFinestra>
          )}

          {n > 0 && (
            <SezioneFinestra titolo="Fatture emesse" nota="In ordine di numero" senzaPadding>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {riepilogo.emesse.map((e) => {
                  const f = perId.get(e.id);
                  return (
                    <li
                      key={e.id}
                      className="flex items-baseline justify-between gap-3 px-4 py-2 text-[12.5px]"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold tabular-nums text-slate-900">
                          n. {f ? etichettaNumero(f) : e.numero}
                        </span>{" "}
                        <span className="text-slate-600">
                          {f ? nomeCliente(f) : dataItaliana(e.data)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-700">
                        {f ? euroEsatti(f.totale) : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SezioneFinestra>
          )}

          {n > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={fatture.length === 0}
                onClick={() => onScaricaXml(fatture)}
                title="L'XML è la fattura vera: è quello che il commercialista importa"
              >
                <Download className="mr-1.5 h-4 w-4" /> Scarica gli XML ({fatture.length})
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={fatture.length === 0}
                onClick={() =>
                  scaricaTesto(
                    `riepilogo-commercialista-${oggi}.csv`,
                    `\uFEFF${csvCommercialista(fatture, azienda)}`,
                    "text/csv;charset=utf-8",
                  )
                }
                title="Un foglio con numero, data, cliente, importi e mese di competenza IVA"
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Riepilogo per il commercialista
              </Button>
            </div>
          )}

          <p className="text-[12px] leading-snug text-slate-500">
            Il CRM non invia le fatture allo SDI: il file XML va dato al commercialista.{" "}
            {lottoChiuso
              ? "Il caricamento è concluso e gli screenshot sono stati cancellati."
              : "Gli screenshot delle righe emesse sono già cancellati; quelli delle righe rimaste restano fino a 30 giorni."}
          </p>
        </div>
      </Finestra>
    );
  }

  if (fase === "corso") {
    const v =
      avanzamento && avanzamento.totale > 0
        ? Math.round((avanzamento.fatti / avanzamento.totale) * 100)
        : 0;
    return (
      <Finestra
        aperta={aperta}
        onCambio={onCambio}
        larghezza="sm"
        bloccante
        icona={FileCheck2}
        titolo="Sto emettendo le fatture"
        contesto="Una alla volta, dal pagamento più vecchio"
        azioni={
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onInterrompi}>
            Interrompi
          </Button>
        }
      >
        <div className="space-y-3" aria-live="polite">
          <Progress
            value={v}
            aria-label="Avanzamento dell'emissione"
            className="h-2 bg-slate-200 [&>div]:bg-slate-700"
          />
          <p className="text-[13px] tabular-nums text-slate-700">
            Emesse {avanzamento?.fatti ?? 0} di {avanzamento?.totale ?? dati.quante}
          </p>
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            Non emettere altre fatture finché finisce, e lascia aperta questa pagina. Se interrompi,
            le righe non ancora emesse restano come sono.
          </NotaFinestra>
        </div>
      </Finestra>
    );
  }

  const unaSolaData = dati.dataMinima && dati.dataMinima === dati.dataMassima;
  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="md"
      bloccante
      icona={FileCheck2}
      titolo={`Emetto ${dati.quante} ${dati.quante === 1 ? "fattura" : "fatture"}?`}
      contesto="Controlla i numeri: dopo non si tolgono senza lasciare un buco"
      azioni={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => onCambio(false)}
          >
            Non ancora
          </Button>
          <Button
            type="button"
            className="h-11 sm:h-9 sm:min-w-40"
            disabled={dati.quante === 0}
            onClick={onEmetti}
          >
            Sì, emetti {dati.quante}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <KpiFinestra etichetta="Fatture" valore={dati.quante} forte />
          <KpiFinestra etichetta="Totale" valore={euroCentesimi(dati.totaleCentesimi)} forte />
        </div>

        <SezioneFinestra titolo="Numeri e date">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            <DatoFinestra etichetta="Numeri (stima)">
              {dati.numeri.length === 0
                ? "—"
                : dati.numeri.map((x) => `${x.anno}: dal ${x.da} al ${x.a}`).join(" · ")}
            </DatoFinestra>
            <DatoFinestra etichetta="Ultima fattura già emessa">
              {dati.ultimaEmessa
                ? `n. ${dati.ultimaEmessa.numero} del ${dataItaliana(dati.ultimaEmessa.data)}`
                : "nessuna"}
            </DatoFinestra>
            <DatoFinestra etichetta="Date dei pagamenti">
              {unaSolaData
                ? dataItaliana(dati.dataMinima)
                : `dal ${dataItaliana(dati.dataMinima)} al ${dataItaliana(dati.dataMassima)}`}
            </DatoFinestra>
            <DatoFinestra etichetta="Ultimo giorno utile più vicino (stima)">
              {dataItaliana(dati.ultimoGiornoUtile)}
            </DatoFinestra>
            <DatoFinestra etichetta="Con data anteriore all'ultima emessa">
              {dati.conDataAnteriore}
            </DatoFinestra>
            <DatoFinestra etichetta={`Oltre ${GIORNI_TERMINE_SDI} giorni dal pagamento`}>
              {dati.oltreIlTermine}
            </DatoFinestra>
          </dl>
        </SezioneFinestra>

        <div className="space-y-2">
          <NotaFinestra icona={Info}>
            Si emette in ordine di data del pagamento
            {dati.ordinePerData
              ? " (diverso dall'ordine di caricamento: a parità di data vale l'ordine di caricamento)"
              : ""}
            : il numero più basso va al pagamento più vecchio.
          </NotaFinestra>
          {dati.fuori > 0 && (
            <NotaFinestra icona={Info}>
              {dati.fuori === 1 ? "Una riga resta fuori" : `${dati.fuori} righe restano fuori`}: non{" "}
              {dati.fuori === 1 ? "è confermata o è" : "sono confermate o sono"} da sistemare.
              {dati.fuoriConDataAnteriore > 0 &&
                ` ${dati.fuoriConDataAnteriore === 1 ? "Ha" : `${dati.fuoriConDataAnteriore} hanno`} una data anteriore a quelle che emetti ora: si potrà emetterle dopo, con un numero più alto della data, previa conferma.`}
            </NotaFinestra>
          )}
          {dati.conCentesimo > 0 && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              In {dati.conCentesimo} {dati.conCentesimo === 1 ? "fattura" : "fatture"} il totale nel
              file XML differisce di un centesimo dal pagato, perché il file ricalcola l&apos;IVA.
              Segnalalo al commercialista (c&apos;è una colonna nel riepilogo che lo mostra).
            </NotaFinestra>
          )}
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            Il termine dei {GIORNI_TERMINE_SDI} giorni finisce all&apos;invio allo SDI fatto dal
            commercialista, non alla numerazione nel CRM. Non si può annullare una fattura emessa
            senza una nota di credito, e il CRM non le invia allo SDI. Mentre emetti, non emettere
            altre fatture da altre parti.
          </NotaFinestra>
        </div>
      </div>
    </Finestra>
  );
}
