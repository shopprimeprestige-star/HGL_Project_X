/** ── PASSO 2 DELL'IMPORT: CONTROLLO (PassoControllo.tsx) ─────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E10 (SPEC §2.3, §6.4). L'anteprima: il riepilogo («12 prodotti · 41 varianti · 9 nuovi · …»), la tabella dei
 *  prodotti con il filtro «solo gli errori», gli errori riga per riga (numero di riga come in Excel), gli avvisi e le colonne ignorate.
 *  Qui NON è stato scritto niente: il tasto «Importa» è l'unico che scrive, ed è l'unico pieno. Solo presentazione, niente rete.
 *  Il tasto resta spento, con la frase, se manca la funzione del database o se non c'è niente di nuovo. */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLASSI_TASTO } from "../scheda/polaris";
import { euroInTesto } from "../semplice-puro";
import {
  FRASE_NON_DISPONIBILE,
  fraseRiepilogo,
  frasePerPersona,
  haRigheDaCorreggere,
  soloErrori,
  type Analisi,
  type RigaTabella,
} from "./importa-flusso";

/** Quante righe di errori e di avvisi si scrivono a schermo. shortcut: tetto fisso, da alzare se serve; gli altri stanno nel file delle righe da correggere. */
const MAX_MOSTRATE = 100;

const TIPI: Record<string, string> = { patch: "Patch", cura: "Cura", kit: "Kit" };

/** L'esito di una riga: il testo c'è sempre, il colore e l'icona sono un aiuto. */
function EsitoRiga({ riga, apri }: { riga: RigaTabella; apri?: (id: string) => void }) {
  if (riga.esito === "nuovo")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-900">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Nuovo
      </span>
    );
  if (riga.esito === "errore")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[12px] font-medium text-rose-900">
        <CircleAlert className="h-3 w-3" aria-hidden="true" />
        Errore
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="rounded-full border border-border px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
        Già presente
      </span>
      {riga.prodottoId && apri && (
        <button
          type="button"
          onClick={() => apri(riga.prodottoId as string)}
          className="rounded text-[12px] font-medium text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Apri il prodotto<span className="sr-only"> {riga.titolo}</span>
        </button>
      )}
    </span>
  );
}

function TabellaProdotti({ righe, apri }: { righe: RigaTabella[]; apri?: (id: string) => void }) {
  const intestazione = "px-3 py-2 text-[12px] font-medium text-muted-foreground";
  return (
    // Sul telefono la tabella scorre dentro il suo riquadro (con la tastiera si raggiunge con Tab).
    <div
      role="region"
      aria-label="Prodotti letti dal file"
      tabIndex={0}
      className="max-h-80 overflow-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
        <caption className="sr-only">Prodotti letti dal file, con l'esito di ciascuno</caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th scope="col" className={intestazione}>
              Indirizzo
            </th>
            <th scope="col" className={intestazione}>
              Titolo
            </th>
            <th scope="col" className={intestazione}>
              Tipo
            </th>
            <th scope="col" className={cn(intestazione, "text-right")}>
              Prezzo
            </th>
            <th scope="col" className={cn(intestazione, "text-right")}>
              Varianti
            </th>
            <th scope="col" className={cn(intestazione, "text-right")}>
              Giacenza
            </th>
            <th scope="col" className={intestazione}>
              Esito
            </th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={`${r.riga}-${r.handle}`} className="border-t border-border align-top">
              <td className="max-w-[10rem] break-words px-3 py-2 font-mono text-[12px]">
                {r.handle || "—"}
              </td>
              <td className="max-w-[16rem] break-words px-3 py-2">{r.titolo || "—"}</td>
              <td className="px-3 py-2">{r.tipo ? (TIPI[r.tipo] ?? r.tipo) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.prezzoCent === undefined ? "—" : `${euroInTesto(r.prezzoCent)} €`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.varianti ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.giacenza ?? "—"}</td>
              <td className="px-3 py-2">
                <EsitoRiga riga={r} apri={apri} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PassoControllo({
  analisi,
  apriProdotto,
  cambiaFile,
  scaricaErrori,
  importa,
}: {
  analisi: Analisi;
  /** Apre la scheda di un prodotto già presente. */
  apriProdotto?: (id: string) => void;
  cambiaFile: () => void;
  scaricaErrori: () => void;
  importa: () => void;
}) {
  const [soloErr, setSoloErr] = useState(false);
  const { nuovi, errori, avvisi, righe, lettura, importaDisponibile } = analisi;
  const visibili = soloErr ? soloErrori(righe) : righe;
  const puoImportare = importaDisponibile && nuovi.length > 0;
  const perche = !importaDisponibile
    ? FRASE_NON_DISPONIBILE
    : nuovi.length === 0
      ? "Non c'è niente di nuovo da importare: i prodotti del file sono già presenti oppure hanno errori."
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <p className="text-[15px] font-semibold">{fraseRiepilogo(analisi)}</p>
        <p className="mt-0.5 break-words text-[13px] text-muted-foreground">
          File «{analisi.nomeFile}». Non è stato scritto niente: i prodotti entrano solo quando
          premi «Importa».
        </p>
      </div>

      {errori.length > 0 && (
        <section aria-labelledby="titolo-errori" className="flex flex-col gap-2">
          <h3
            id="titolo-errori"
            className="flex items-center gap-1.5 text-[14px] font-semibold text-rose-900"
          >
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            Errori ({errori.length})
          </h3>
          <p className="text-[13px] text-muted-foreground">
            Un prodotto con un errore non entra, nemmeno le sue varianti: gli altri sì. Correggi il
            file e ricaricalo.
          </p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {errori.slice(0, MAX_MOSTRATE).map((e, i) => (
              <li key={`${e.riga}-${i}`} className="break-words">
                {frasePerPersona(e)}
              </li>
            ))}
          </ul>
          {errori.length > MAX_MOSTRATE && (
            <p className="text-[13px] text-muted-foreground">
              …e altri {errori.length - MAX_MOSTRATE} errori: li trovi tutti nel file delle righe da
              correggere.
            </p>
          )}
        </section>
      )}

      {righe.length > 0 && (
        <section aria-labelledby="titolo-tabella" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="titolo-tabella" className="text-[14px] font-semibold">
              Prodotti del file
            </h3>
            {errori.length > 0 && (
              <label className="flex min-h-11 items-center gap-2 text-[13px] md:min-h-9">
                <input
                  type="checkbox"
                  checked={soloErr}
                  onChange={(e) => setSoloErr(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Mostra solo gli errori
              </label>
            )}
          </div>
          {visibili.length > 0 ? (
            <TabellaProdotti righe={visibili} apri={apriProdotto} />
          ) : (
            <p className="text-[13px] text-muted-foreground">Nessun prodotto con errori.</p>
          )}
        </section>
      )}

      {avvisi.length > 0 && (
        <details className="rounded-xl border border-border px-3 py-2 text-[13px]">
          <summary className="flex min-h-9 cursor-pointer items-center gap-1.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
            Avvisi ({avvisi.length}): non bloccano
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {avvisi.slice(0, MAX_MOSTRATE).map((a, i) => (
              <li key={`${a.riga}-${i}`} className="break-words">
                {frasePerPersona(a)}
              </li>
            ))}
          </ul>
          {avvisi.length > MAX_MOSTRATE && (
            <p className="mt-2 text-muted-foreground">
              …e altri {avvisi.length - MAX_MOSTRATE} avvisi.
            </p>
          )}
        </details>
      )}

      {lettura.colonneIgnorate.length > 0 && (
        <p className="break-words text-[13px] text-muted-foreground">
          Colonne che ignoro: {lettura.colonneIgnorate.join(", ")}.
        </p>
      )}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-1 pt-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={cambiaFile}>
            Scegli un altro file
          </Button>
          {haRigheDaCorreggere(errori) && (
            <Button
              type="button"
              variant="outline"
              className={CLASSI_TASTO}
              onClick={scaricaErrori}
            >
              <FileDown aria-hidden="true" />
              Scarica le righe da correggere
            </Button>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            className={CLASSI_TASTO}
            disabled={!puoImportare}
            aria-describedby={perche ? "perche-spento" : undefined}
            onClick={importa}
          >
            {nuovi.length === 1
              ? "Importa 1 prodotto in bozza"
              : `Importa ${nuovi.length} prodotti in bozza`}
          </Button>
          {perche && (
            <p id="perche-spento" className="max-w-xs text-right text-[12px] text-muted-foreground">
              {perche}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
