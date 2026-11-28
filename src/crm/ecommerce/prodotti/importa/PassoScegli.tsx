/** ── PASSO 1 DELL'IMPORT: SCEGLI IL FILE (PassoScegli.tsx) ───────────────────
 *  Commessa 2026-11-25-editor-prodotti, E10 (SPEC §2.3). Si trascina o si sceglie un file .csv, si può scaricare il file modello e si legge
 *  cosa il negozio legge e cosa ignora. Solo presentazione: il file lo legge `FinestraImporta` (che chiama `analizzaFile`), niente rete qui.
 *  Il tasto pieno è uno solo: «Scegli il file». Il file non viene mai salvato: vive nella memoria del browser finché la finestra è aperta. */
import { useRef, useState, type DragEvent } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Banner, CLASSI_TASTO, RiquadroPolaris } from "../scheda/polaris";

export function PassoScegli({
  leggo,
  errore,
  scegli,
  scaricaModello,
}: {
  /** Sto leggendo il file e chiedendo al server cosa c'è già (sola lettura). */
  leggo: boolean;
  /** Perché il file è stato respinto, in una frase. */
  errore?: string;
  scegli: (file: File) => void;
  scaricaModello: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [sopra, setSopra] = useState(false);
  const [guida, setGuida] = useState(true);

  const lascia = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSopra(false);
    const file = e.dataTransfer.files[0];
    if (file && !leggo) scegli(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!leggo) setSopra(true);
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={lascia}
        aria-busy={leggo}
        className={cn(
          "flex min-w-0 flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center",
          sopra ? "border-primary bg-accent" : "border-muted-foreground/70 bg-muted/40",
        )}
      >
        <FileSpreadsheet className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-[14px] font-semibold">Trascina qui il file .csv</p>
          <p className="text-[13px] text-muted-foreground">
            oppure sceglilo dal computer. Il file si legge qui, nel tuo browser, e non viene
            salvato.
          </p>
        </div>
        <Button
          type="button"
          className={CLASSI_TASTO}
          disabled={leggo}
          onClick={() => campo.current?.click()}
        >
          {leggo ? "Leggo il file…" : "Scegli il file"}
        </Button>
        {/* Il campo vero è nascosto: il tasto sopra lo apre (da tastiera e da telefono). */}
        <input
          ref={campo}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-label="File CSV dei prodotti"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // così si può scegliere di nuovo lo stesso file dopo averlo corretto
            if (file) scegli(file);
          }}
        />
      </div>

      {leggo && (
        <Banner tono="info">
          Leggo il file e controllo cosa c'è già nel catalogo. Non viene scritto niente.
        </Banner>
      )}
      {errore && (
        <Banner tono="errore" titolo="Questo file non va">
          {errore}
        </Banner>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={scaricaModello}>
          <Download aria-hidden="true" />
          Scarica il file modello
        </Button>
        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
          Un CSV con le colonne giuste e due prodotti d'esempio inventati: uno semplice e uno con
          varianti.
        </p>
      </div>

      <RiquadroPolaris
        id="leggo-ignoro"
        titolo="Cosa leggo e cosa ignoro"
        aperto={guida}
        alterna={() => setGuida((x) => !x)}
      >
        <div className="flex flex-col gap-3 text-[13px] leading-snug">
          <div>
            <h3 className="font-semibold">Leggo</h3>
            <p className="text-muted-foreground">
              Titolo e indirizzo (Handle), descrizione (diventa testo semplice), marca, tipo,
              categorie, fornitore, testi per i motori di ricerca, opzioni e varianti, SKU, prezzo,
              giacenza, peso, barcode e costo. Le foto di Shopify (fino a 5 per prodotto) le carico
              dopo i prodotti.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Ignoro</h3>
            <p className="text-muted-foreground">
              Foto e video che non vengono da Shopify: si aggiungono a mano dalla scheda del
              prodotto. Published e Status: tutto entra in bozza e si pubblica dalla scheda. Compare
              At Price, Tags e le altre colonne che il negozio non usa.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Limiti</h3>
            <p className="text-muted-foreground">
              Fino a 2 MB, 5000 righe e 300 prodotti. Solo file CSV: da Excel scegli «Salva con
              nome» e poi «CSV UTF-8». Un prodotto con un indirizzo già presente viene sovrascritto
              dal file (anche se era nel Cestino): le varianti tolte dal file si spengono, la
              giacenza che c'era resta.
            </p>
          </div>
        </div>
      </RiquadroPolaris>
    </div>
  );
}
