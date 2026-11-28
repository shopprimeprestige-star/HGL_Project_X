/** ── PASSO 3 DELL'IMPORT: IMPORTA (PassoImporta.tsx) ─────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E10 (SPEC §2.3). La barra di avanzamento (un gruppo alla volta), «Interrompi» e «Riprendi», e alla fine
 *  «Importati N prodotti (tutti in bozza). Saltati N già presenti. Respinti N con errori», «Scarica le righe da correggere» e il link ai prodotti.
 *  Poi (E13) la seconda barra, «Carico le foto: N di M», con «Foto caricate N · non riuscite M», l'elenco delle non riuscite e «Riprova».
 *  Solo presentazione: lo stato viene da `importa-flusso.ts` e `importa-foto.ts` (macchine pure), la rete la fa `FinestraImporta`. Un solo tasto pieno alla volta. */
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner, CLASSI_TASTO } from "../scheda/polaris";
import {
  avanzamento,
  fraseFinale,
  haRigheDaCorreggere,
  riepilogoFinale,
  type Analisi,
  type StatoImporta,
} from "./importa-flusso";
import { avanzamentoFoto, fraseFoto, nonRiuscite, type StatoFoto } from "./importa-foto";

export function PassoImporta({
  analisi,
  stato,
  inCorso,
  foto = null,
  fotoInCorso = false,
  riprovaFoto,
  interrompi,
  riprendi,
  scaricaErrori,
  vaiAiProdotti,
  chiudi,
}: {
  analisi: Analisi;
  stato: StatoImporta;
  inCorso: boolean;
  /** Le foto dell'import (E13): `null` finché non partono, o se il file non ne ha. */
  foto?: StatoFoto | null;
  fotoInCorso?: boolean;
  riprovaFoto?: () => void;
  interrompi: () => void;
  riprendi: () => void;
  scaricaErrori: () => void;
  vaiAiProdotti: () => void;
  chiudi: () => void;
}) {
  const a = avanzamento(stato);
  const r = riepilogoFinale(analisi, stato);
  const finito = !inCorso && !stato.fermo && a.gruppiFatti === a.gruppiTotali;
  const nome = `Importati ${a.prodottiFatti} di ${a.prodottiTotali} prodotti`;
  const af = foto ? avanzamentoFoto(foto) : null;
  const occupato = inCorso || fotoInCorso;
  const fotoFerme = !!af && !fotoInCorso;
  const nomeFoto = af ? `Carico le foto: ${af.fatte} di ${af.totale}` : "";
  const elencoNo = foto && fotoFerme ? nonRiuscite(foto) : [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[14px] font-semibold">
            {finito
              ? "Importazione finita"
              : inCorso
                ? "Importo i prodotti…"
                : "Importazione ferma"}
          </p>
          <p className="text-[13px] tabular-nums text-muted-foreground">
            {a.prodottiFatti} di {a.prodottiTotali} prodotti · gruppo{" "}
            {Math.min(a.gruppiFatti + (finito ? 0 : 1), a.gruppiTotali)} di {a.gruppiTotali}
          </p>
        </div>
        {/* Sempre montato: chi usa la sintesi vocale sente l'avanzamento (e la fine) senza guardare la barra. */}
        <p className="sr-only" role="status">
          {nome}
        </p>
        <div
          role="progressbar"
          aria-label={nome}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={a.percento}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${a.percento}%` }}
          />
        </div>
        {inCorso && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Non chiudere la finestra finché non finisce: i prodotti entrano cinque alla volta.
          </p>
        )}
      </div>

      {af && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold">
              {fotoInCorso
                ? "Carico le foto…"
                : af.daFare > 0
                  ? "Caricamento delle foto fermo"
                  : "Foto finite"}
            </p>
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {af.fatte} di {af.totale} foto
            </p>
          </div>
          {/* Sempre montato, come quello dei prodotti. */}
          <p className="sr-only" role="status">
            {nomeFoto}
          </p>
          <div
            role="progressbar"
            aria-label={nomeFoto}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={af.percento}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${af.percento}%` }}
            />
          </div>
          {fotoInCorso && (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Non chiudere la finestra: le foto arrivano da Shopify e salgono una alla volta.
            </p>
          )}
          {fotoFerme && (
            <div className="flex flex-col gap-1 text-[13px]">
              <p className="text-[15px] font-semibold">{fraseFoto(af)}</p>
              {af.saltate > 0 && (
                <p className="text-muted-foreground">
                  Saltate {af.saltate} foto: i loro prodotti non sono stati sovrascritti e avevano
                  già delle foto.
                </p>
              )}
              {af.daFare > 0 && (
                <p className="text-muted-foreground">
                  {af.daFare} foto non ancora caricate: premi «Riprendi le foto».
                </p>
              )}
              {elencoNo.length > 0 && (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {elencoNo.map((x, i) => (
                    <li key={`${x.nome}-${x.posizione}-${i}`} className="break-words">
                      {x.nome} · foto {x.posizione}
                      {x.posizione === 1 ? " (principale)" : ""}: {x.frase}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {stato.fermo && !inCorso && (
        <Banner
          tono={stato.fermo.tipo === "interrotto" ? "attenzione" : "errore"}
          titolo={
            stato.fermo.tipo === "interrotto"
              ? "Importazione interrotta"
              : "L'importazione si è fermata"
          }
        >
          <p>{stato.fermo.messaggio}</p>
          {stato.fermo.incerto && (
            <p className="mt-1">
              Non so se l'ultimo gruppo sia entrato per intero: se premi «Riprendi» lo rimando, e
              ciò che era già entrato viene sovrascritto con gli stessi dati, senza doppioni.
            </p>
          )}
          <p className="mt-1">
            Se chiudi, puoi ricaricare lo stesso file: i prodotti già importati vengono
            sovrascritti, senza doppioni.
          </p>
        </Banner>
      )}

      {finito && (
        <div role="status" className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold">{fraseFinale(r)}</p>
          {r.importati > 0 && !foto && (
            <p className="text-[13px] text-muted-foreground">
              Ogni prodotto importato è in bozza e senza foto: controlla testi e prezzo e aggiungi
              le foto dalla scheda prima di pubblicarlo.
            </p>
          )}
          {r.importati > 0 && foto && (
            <p className="text-[13px] text-muted-foreground">
              Ogni prodotto importato è in bozza: controlla testi, prezzo e foto dalla scheda prima
              di pubblicarlo.
            </p>
          )}
          {r.aggiornati > 0 && (
            <p className="text-[13px] text-muted-foreground">
              I prodotti sovrascritti tengono il loro stato: un pubblicato resta pubblicato, uno che
              era nel Cestino torna in bozza. Le varianti che il file non ha più sono spente.
            </p>
          )}
          {r.respinti > 0 && (
            <p className="text-[13px] text-muted-foreground">
              I prodotti respinti non sono entrati: correggi le righe e ricarica il file, i prodotti
              già importati verranno sovrascritti, senza doppioni.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          {occupato && (
            <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={interrompi}>
              Interrompi
            </Button>
          )}
          {fotoFerme && af.nonRiuscite + af.daFare > 0 && riprovaFoto && (
            <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={riprovaFoto}>
              {af.nonRiuscite > 0 ? "Riprova le foto non riuscite" : "Riprendi le foto"}
            </Button>
          )}
          {!occupato && haRigheDaCorreggere(r.errori) && (
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
          {!inCorso && !finito && (
            <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={chiudi}>
              Chiudi
            </Button>
          )}
          {finito && !fotoInCorso && r.importati > 0 && (
            <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={chiudi}>
              Chiudi
            </Button>
          )}
        </div>
        <div>
          {!inCorso && !finito && (
            <Button type="button" className={CLASSI_TASTO} onClick={riprendi}>
              Riprendi
            </Button>
          )}
          {finito && !fotoInCorso && r.importati > 0 && (
            <Button type="button" className={CLASSI_TASTO} onClick={vaiAiProdotti}>
              Vai ai prodotti importati
            </Button>
          )}
          {finito && !fotoInCorso && r.importati === 0 && (
            <Button type="button" className={CLASSI_TASTO} onClick={chiudi}>
              Chiudi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
