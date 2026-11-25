/** ── LA SCHEDA NUOVA (SchedaNuova.tsx) ────────────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E9 (SPEC §2.1, criterio 1). «Aggiungi prodotto» apre questa scheda VUOTA, con i riquadri di `scheda/`:
 *  nel database non nasce niente finché non si preme «Salva bozza». Allora parte UNA sola `prodotto_crea` completa (prodotto, variante «Unica»,
 *  giacenza iniziale, costo, categorie) e si apre la scheda vera del prodotto creato.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Titolo → SKU e indirizzo si propongono da soli e si possono cambiare (le regole sono in `scheda-nuova-puro.ts`).
 *  · Gli errori si vedono dopo il primo «Salva bozza» (una pagina vuota non parte già piena di rimproveri) e da lì si aggiornano mentre si scrive.
 *  · Se il prodotto c'è ma un passo dopo è fallito (`parziale`) NON si rifà «Salva bozza»: un avviso dice cosa manca e un tasto apre il prodotto.
 *  · Foto e video si aggiungono dopo, dalla scheda del prodotto salvato. UN solo tasto pieno: «Salva bozza» (testata dal computer, barra dal telefono).
 *  ⚠️ Sola presentazione e raccolta dei dati: la rete passa SOLO da `negozio` (`categorie` all'apertura, `esegui` dentro `creaBozza`). Nessun log. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Banner, BadgeStato, CLASSI_TASTO, PaginaScheda } from "./scheda/polaris";
import { ColonnaLaterale } from "./scheda/ColonnaLaterale";
import { RiquadroFoto } from "./scheda/RiquadroFoto";
import { RiquadroGiacenza } from "./scheda/RiquadroGiacenza";
import { RiquadroPrezzo } from "./scheda/RiquadroPrezzo";
import { RiquadroSeo } from "./scheda/RiquadroSeo";
import { RiquadroSpedizione } from "./scheda/RiquadroSpedizione";
import { RiquadroTitolo } from "./scheda/RiquadroTitolo";
import { avvisiCampi, eInvisibleDerm, type Modulo } from "./scheda-pura";
import {
  applicaCambio,
  controllaBozza,
  creaBozza,
  dopoCreazione,
  eScritta,
  elencoCategorie,
  fraseMancanti,
  moduloVuoto,
  primoCampoDaSistemare,
  type Categoria,
  type DatiBozza,
  type ErroriBozza,
} from "./scheda-nuova-puro";
import type { Negozio } from "./tipi";

export interface PropsSchedaNuova {
  /** L'archivio unico della pagina: qui si legge l'elenco delle categorie e, solo da «Salva bozza», si crea il prodotto. */
  negozio: Pick<Negozio, "esegui" | "categorie">;
  /** Apre la scheda del prodotto appena creato. */
  apri: (id: string) => void;
  /** Torna all'elenco senza salvare niente. */
  torna: () => void;
}

const ESITO_VUOTO = { campi: {} } as const;

export function SchedaNuova({ negozio, apri, torna }: PropsSchedaNuova) {
  const [modulo, setModulo] = useState<Modulo>(moduloVuoto);
  const [quantita, setQuantita] = useState("");
  const [costo, setCosto] = useState("");
  const [costoSpento, setCostoSpento] = useState(false);
  const [scelte, setScelte] = useState<string[]>([]);
  const [categorie, setCategorie] = useState<Categoria[] | null>(null);
  const [erroreCategorie, setErroreCategorie] = useState<string | null>(null);
  const [cataloghiAperto, setCataloghiAperto] = useState(false);
  const [dominio, setDominio] = useState("il tuo sito");
  /** Dopo il primo «Salva bozza» gli errori si vedono e si aggiornano mentre si scrive. */
  const [provato, setProvato] = useState(false);
  const [invio, setInvio] = useState(false);
  /** Ciò che il server ha rifiutato (SKU o indirizzo già usati): sta accanto al campo finché non si cambia qualcosa. */
  const [dalServer, setDalServer] = useState<ErroriBozza>(ESITO_VUOTO);
  const [fermo, setFermo] = useState<string | null>(null);
  const [fatto, setFatto] = useState<{ id: string | null; mancanti: string[] } | null>(null);
  const titolo = useRef<HTMLHeadingElement>(null);
  const occupato = useRef(false);

  // Aperta la scheda, il focus va al titolo della pagina (e la pagina in cima): chi usa la tastiera o la sintesi vocale sa dov'è.
  useEffect(() => titolo.current?.focus(), []);
  useEffect(() => setDominio(window.location.hostname), []);
  //  Le categorie: l'unica lettura all'apertura. Se fallisce lo dice il riquadro, e il prodotto si salva lo stesso (senza categorie).
  const leggiCategorie = negozio.categorie;
  useEffect(() => {
    let vivo = true;
    void leggiCategorie().then((r) => {
      if (!vivo) return;
      if (r.ok) setCategorie(elencoCategorie(r.dati.categorie));
      else setErroreCategorie(r.errore.messaggio);
    });
    return () => {
      vivo = false;
    };
  }, [leggiCategorie]);

  const dati: DatiBozza = {
    modulo,
    quantita,
    costo,
    costoDisponibile: !costoSpento,
    categorie: scelte,
  };
  const controllo = controllaBozza(dati);
  const scritta = eScritta(dati);

  //  F5 o chiusura della scheda con dei dati scritti e non salvati: il browser chiede conferma. Scheda non toccata, in salvataggio o già creata: nessun avviso.
  useEffect(() => {
    if (!scritta || invio || fatto) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [scritta, invio, fatto]);
  const avvisi = useMemo(() => avvisiCampi(modulo), [modulo]);
  const errori = {
    ...(provato && !controllo.ok ? controllo.errori.campi : {}),
    ...dalServer.campi,
  };
  const senzaPrezzo = eInvisibleDerm(modulo.nome, modulo.slug);

  /** Ogni modifica toglie gli errori e gli avvisi arrivati dal server: erano su ciò che c'era prima. */
  const modificato = () => {
    setDalServer(ESITO_VUOTO);
    setFermo(null);
  };
  const cambia = (p: Partial<Modulo>) => {
    modificato();
    setModulo((m) => applicaCambio(m, p));
  };
  const scegli = (id: string, acceso: boolean) =>
    setScelte((s) => (acceso ? [...s.filter((x) => x !== id), id] : s.filter((x) => x !== id)));
  const aFuoco = (e: ErroriBozza) => {
    const id = primoCampoDaSistemare(e);
    if (id) document.getElementById(id)?.focus();
  };

  const salva = async () => {
    if (occupato.current) return;
    setProvato(true);
    modificato();
    if (!controllo.ok) return aFuoco(controllo.errori);
    occupato.current = true;
    setInvio(true);
    let esito;
    try {
      esito = await creaBozza(negozio.esegui, dati);
    } catch {
      return setFermo(
        "Non so se il prodotto sia stato salvato: guarda nell'elenco prima di riprovare.",
      );
    } finally {
      occupato.current = false;
      setInvio(false);
    }
    if (esito.tipo === "creato") {
      const dopo = dopoCreazione(esito);
      return dopo.tipo === "apri"
        ? apri(dopo.id)
        : setFatto({ id: dopo.id, mancanti: dopo.mancanti });
    }
    if (esito.tipo === "errori") {
      setDalServer(esito.errori);
      return aFuoco(esito.errori);
    }
    if (esito.tipo === "costo_spento") {
      setCostoSpento(true);
      setCosto("");
      return setFermo(
        `${esito.frase} Ho spento il campo: premi di nuovo «Salva bozza» per creare il prodotto senza costo.`,
      );
    }
    setFermo(esito.frase);
  };

  /** «← Prodotti»: se c'è qualcosa di scritto e non salvato, prima si chiede. */
  const esci = () => {
    if (
      scritta &&
      !window.confirm("Hai scritto dei dati che non sono salvati. Uscire senza salvare?")
    )
      return;
    torna();
  };

  // Il prodotto c'è ma un passo dopo è fallito, o non si sa dove sia: si dice, e non si offre di salvare di nuovo.
  if (fatto)
    return (
      <PaginaScheda
        principale={
          <>
            <Banner tono="attenzione" titolo="Il prodotto è stato creato">
              {fatto.id
                ? fraseMancanti(fatto.mancanti)
                : "Non riesco ad aprirlo da qui: lo trovi nell'elenco, in bozza. Non salvarlo di nuovo."}
            </Banner>
            <div>
              <Button
                type="button"
                className={CLASSI_TASTO}
                onClick={() => (fatto.id ? apri(fatto.id) : torna())}
              >
                {fatto.id ? "Apri il prodotto" : "Torna ai prodotti"}
              </Button>
            </div>
          </>
        }
      />
    );

  const tastoSalva = (classi: string) => (
    <Button
      type="button"
      className={cn(CLASSI_TASTO, classi)}
      disabled={invio}
      onClick={() => void salva()}
    >
      {invio ? "Salvo…" : "Salva bozza"}
    </Button>
  );
  const proprieta = { modulo, cambia, errori, avvisi };

  return (
    <div className="pb-20 md:pb-0">
      <PaginaScheda
        testata={
          <header className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cn(CLASSI_TASTO, "-ml-3 px-3")}
                disabled={invio}
                onClick={esci}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Prodotti
              </Button>
              {tastoSalva("hidden md:inline-flex")}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1
                ref={titolo}
                tabIndex={-1}
                className="m-0 text-[20px] font-semibold focus-visible:outline-none"
              >
                Nuovo prodotto
              </h1>
              <BadgeStato stato="bozza" />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Non è ancora salvato: nel database non nasce niente finché non premi «Salva bozza».
            </p>
            {fermo && <Banner tono="errore">{fermo}</Banner>}
          </header>
        }
        principale={
          <>
            <RiquadroTitolo
              {...proprieta}
              avviso={
                senzaPrezzo && (
                  <Banner tono="attenzione">
                    Non scrivere prezzi nelle descrizioni: Invisible Derm non ha un prezzo nello
                    shop, e il testo libero il sistema non lo può controllare del tutto.
                  </Banner>
                )
              }
            />
            <RiquadroFoto nuovo />
            <RiquadroPrezzo
              {...proprieta}
              modalita="semplice"
              invisibleDerm={senzaPrezzo}
              pubblicato={false}
              costo={costo}
              cambiaCosto={(t) => {
                modificato();
                setCosto(t);
              }}
              costoErrore={provato && !controllo.ok ? controllo.errori.costo : undefined}
              costoDisponibile={!costoSpento}
            />
            <RiquadroGiacenza
              {...proprieta}
              modalita="semplice"
              invisibleDerm={senzaPrezzo}
              nuovo
              skuBloccato={false}
              giacenzaAttuale={0}
              quantita={quantita}
              cambiaQuantita={(t) => {
                modificato();
                setQuantita(t);
              }}
              motivo="carico"
              cambiaMotivo={() => undefined}
              soglia={null}
            />
            <RiquadroSpedizione {...proprieta} modalita="semplice" invisibleDerm={senzaPrezzo} />
            <RiquadroSeo {...proprieta} pubblicato={false} dominio={dominio} />
          </>
        }
        laterale={
          <ColonnaLaterale
            {...proprieta}
            stato="bozza"
            categorie={{
              elenco: categorie,
              scelte,
              scegli,
              errore: erroreCategorie,
              occupato: invio,
            }}
            cataloghiAperto={cataloghiAperto}
            alternaCataloghi={() => setCataloghiAperto((x) => !x)}
          />
        }
      />
      {/* Telefono: «Salva bozza» resta in basso, sotto il pollice */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
        {tastoSalva("w-full")}
      </div>
    </div>
  );
}
