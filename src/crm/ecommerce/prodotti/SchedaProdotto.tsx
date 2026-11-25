/** ── LA SCHEDA DI UN PRODOTTO (SchedaProdotto.tsx) · IL GUSCIO ────────────────────
 *  Commessa 2026-11-20-shop-completo T15, rifatta in 2026-11-25-editor-prodotti (E7, SPEC §3). Qui stanno lo stato, il salvataggio e le scritture;
 *  i riquadri (`scheda/`) mostrano soltanto: ricevono dati, funzioni e pezzi già costruiti da qui (gli editor di foto e varianti, i tasti «Applica
 *  prezzo» e «Pubblica»). Testata in stile Shopify, due colonne dal computer (una sola sul telefono, con la barra fissa in basso).
 *  Le props le fissa T14: `id` (il prodotto), `negozio` (l'archivio unico, `useNegozio()`), `apri` (`apri(null)` torna all'elenco, `apri(altroId)` apre un altro).
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · «Pubblica» salva PRIMA (`await subito()`) e parte solo se ha restituito `true`; il tasto è spento finché `bloccanti.length > 0` (le frasi del server).
 *  · UN SOLO tasto pieno per schermata: «Pubblica» (testata dal computer, barra dal telefono). Il resto è di contorno.
 *  · Il salvataggio automatico manda solo i campi CAMBIATI e mai un campo con un errore; le scritture sul prodotto passano da UNA coda (la versione è una).
 *  · Un prodotto PUBBLICATO: i testi vanno in «bozza di modifica» (il sito resta com'è finché non si preme «Pubblica le modifiche»); il prezzo si
 *    applica col suo tasto (subito, sul sito); varianti e foto subito. SKU e indirizzo non si cambiano più.
 *  · Conflitto di versione («409»): «Qualcun altro ha modificato questo prodotto», con «Ricarica». Mai una scrittura sopra.
 *  · Nessun campo per il prezzo barrato, lo sconto, le stelle o il best seller. Invisible Derm (D39) non ha un campo prezzo.
 *  · Parole da non usare: un avviso accanto al campo, che non blocca. Una cifra vicino a «Invisible Derm», «sconto del»…: un errore che blocca.
 *
 *  ── IL PRODOTTO SEMPLICE E LA VARIANTE «UNICA» (PIANO §1.2) ─────────────────
 *  Un prodotto senza opzioni è una variante chiamata «Unica» con lo SKU del prodotto. Prezzo, peso e barcode stanno sul PRODOTTO; SKU, giacenza e
 *  costo sulla Unica. Il guscio la crea se manca e la riaccende se è spenta (aprendo una bozza), in bozza allinea il suo SKU a quello del prodotto,
 *  scrive il costo con `variante_salva` nello stesso salvataggio automatico dei testi, scrive la quantità come movimento registrato
 *  (`giacenza_imposta`) quando si esce dal campo. Passando alle opzioni la Unica si DISATTIVA (mai cancellata): lo fa `EditorVarianti` (E8) subito dopo aver generato le righe.
 *  ⚠️ Nessun log da qui, mai.
 *  shortcut: gli SKU degli altri prodotti per il controllo «già usato» sono quelli dell'elenco caricato (le varianti di altri prodotti le controlla
 *  il server al momento di pubblicare); si cambia quando l'elenco porterà anche gli SKU delle varianti. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Copy, Eye, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { porteBrowser } from "@/crm/ecommerce/client";
import { creaAutosalva } from "@/crm/negozio/autosalva";
import type { ErroreNegozio, SchedaProdotto as DatiScheda } from "@/crm/negozio/client";
import { centDaEuro, type Media, type Prodotto, type Variante } from "@/shop/cms/modello";
import type { SkuUsato, Voce } from "@/shop/cms/pubblicazione";
import { EditorMedia } from "./EditorMedia";
import { EditorVarianti } from "./EditorVarianti";
import { proponiCopia } from "./elenco-puro";
import { leggiStatoShop } from "./interruttore-puro";
import {
  apertoDiPartenza,
  conteggiPerRiquadro,
  riquadroDi,
  segnoRiquadro,
  type RiquadroId,
} from "./riquadri-puro";
import {
  avvisiCampi,
  campiDaModulo,
  controlloLive,
  eInvisibleDerm,
  haBozza,
  idCampo,
  indirizzoAnteprima,
  moduloDaProdotto,
  patchCampi,
  prezzoInTesto,
  type CampiScheda,
  type Modulo,
} from "./scheda-pura";
import {
  AvvisiScheda,
  ErroreLettura,
  SchedaInCarico,
  type EsitoScheda,
} from "./scheda/AvvisiScheda";
import { ColonnaLaterale } from "./scheda/ColonnaLaterale";
import { movimentoDaScrivere, testoQuantita } from "./scheda/giacenza-puro";
import { FinestraAnteprima, FinestraArchivia, type VistaAnteprima } from "./scheda/FinestreScheda";
import { PrimaDiPubblicare } from "./scheda/PrimaDiPubblicare";
import { RiquadroContenuto, type RiquadroRichiudibile } from "./scheda/RiquadroContenuto";
import { RiquadroFoto } from "./scheda/RiquadroFoto";
import { RiquadroGiacenza } from "./scheda/RiquadroGiacenza";
import { RiquadroPrezzo } from "./scheda/RiquadroPrezzo";
import { CampoTesto } from "./scheda/RiquadroCampi";
import { RiquadroSeo } from "./scheda/RiquadroSeo";
import { RiquadroSpedizione } from "./scheda/RiquadroSpedizione";
import { RiquadroTitolo } from "./scheda/RiquadroTitolo";
import { RiquadroVarianti } from "./scheda/RiquadroVarianti";
import { TestataScheda } from "./scheda/TestataScheda";
import { Banner, BadgeStato, CLASSI_TASTO, PaginaScheda } from "./scheda/polaris";
import {
  cambioQuantita,
  euroInTesto,
  modalitaDi,
  statoUnica,
  trovaUnica,
  type MotivoGiacenza,
} from "./semplice-puro";
import { SLOT_EDITOR } from "./media-puro";
import type { Negozio } from "./tipi";

export interface PropsSchedaProdotto {
  id: string;
  negozio: Negozio;
  apri: (id: string | null) => void;
}

type Esito = EsitoScheda;
/** I riquadri che si chiudono, com'è la scheda di un prodotto già salvato (`apertoDiPartenza`). */
const APERTI_DI_PARTENZA: Record<RiquadroRichiudibile | "cataloghi", boolean> = {
  caratteristiche: apertoDiPartenza("caratteristiche", { nuovo: false }),
  uso: apertoDiPartenza("uso", { nuovo: false }),
  reso: apertoDiPartenza("reso", { nuovo: false }),
  cataloghi: apertoDiPartenza("cataloghi", { nuovo: false }),
};
type Lettura =
  | { stato: "carico" }
  | { stato: "errore"; errore: ErroreNegozio }
  | { stato: "ok"; scheda: DatiScheda };

/** «manca 1 cosa» / «mancano 3 cose»: lo dice la barra del telefono quando «Pubblica» è spento. */
const quanteMancano = (n: number) => (n === 1 ? "Manca 1 cosa" : `Mancano ${n} cose`);

/** Ciò che il salvataggio automatico tiene d'occhio: i testi del prodotto, il costo (sulla Unica) e l'immagine di condivisione. */
interface Contenuto {
  m: Modulo;
  costo: string;
  seo: string;
}

/* ══ LA LETTURA ═════════════════════════════════════════════════════════════ */

export function SchedaProdotto({ id, negozio, apri }: PropsSchedaProdotto) {
  const [giro, setGiro] = useState(0);
  const [lettura, setLettura] = useState<Lettura>({ stato: "carico" });
  const leggi = negozio.scheda;
  useEffect(() => {
    let vivo = true;
    setLettura({ stato: "carico" });
    void leggi(id).then((r) => {
      if (vivo)
        setLettura(
          r.ok ? { stato: "ok", scheda: r.scheda } : { stato: "errore", errore: r.errore },
        );
    });
    return () => {
      vivo = false;
    };
  }, [id, giro, leggi]);

  if (lettura.stato === "carico") return <SchedaInCarico />;
  if (lettura.stato === "errore")
    return (
      <ErroreLettura
        errore={lettura.errore}
        torna={() => apri(null)}
        riprova={() => setGiro((g) => g + 1)}
      />
    );
  return (
    <SchedaAperta
      key={`${id}-${giro}`}
      scheda={lettura.scheda}
      negozio={negozio}
      apri={apri}
      ricarica={() => setGiro((g) => g + 1)}
    />
  );
}

/* ══ LA SCHEDA APERTA ═══════════════════════════════════════════════════════ */

interface DatiVivi {
  prodotto: Prodotto;
  varianti: Variante[];
  media: Media[];
  categorie: string[];
  /** Il costo di ogni variante in centesimi (`null` = non scritto). Solo del CRM: mai sul sito. */
  costi: Record<string, number | null>;
}

/** Esportata solo perché la prova la disegna da sola (la lettura è un'altra cosa): in produzione la usa `SchedaProdotto`. */
export function SchedaAperta({
  scheda,
  negozio,
  apri,
  ricarica,
}: {
  scheda: DatiScheda;
  negozio: Negozio;
  apri: (id: string | null) => void;
  ricarica: () => void;
}) {
  const prodotto0 = scheda.prodotto as unknown as Prodotto;
  const id = prodotto0.id;
  const varianti0 = scheda.varianti as unknown as Variante[];
  const unica0 = trovaUnica(varianti0, prodotto0.sku);
  /** Server vecchio (campo assente) = come senza migrazione: il costo resta spento. */
  const costoDisp = scheda.costoDisponibile === true;
  const eCosto = (k: number | null | undefined) => (typeof k === "number" ? euroInTesto(k) : "");
  const seo0 =
    (prodotto0.stato === "pubblicato" &&
    prodotto0.bozzaModifiche &&
    "seoMediaId" in prodotto0.bozzaModifiche
      ? prodotto0.bozzaModifiche.seoMediaId
      : prodotto0.seoMediaId) ?? "";

  const [dati, setDati] = useState<DatiVivi>({
    prodotto: prodotto0,
    varianti: varianti0,
    media: scheda.media as unknown as Media[],
    categorie: scheda.categorie,
    costi: scheda.costi ?? {},
  });
  const [modulo, setModulo] = useState<Modulo>(() => moduloDaProdotto(prodotto0));
  const [costo, setCosto] = useState(() => eCosto(unica0 ? scheda.costi?.[unica0.id] : null));
  const [seo, setSeo] = useState(seo0);
  const [quantita, setQuantita] = useState("");
  const [toccata, setToccata] = useState(false);
  const [motivoGiac, setMotivoGiac] = useState<MotivoGiacenza | null>(null);
  const [soglia, setSoglia] = useState<number | null>(null);
  const [stato, setStato] = useState(prodotto0.stato);
  const [origine, setOrigine] = useState(prodotto0.origine);
  const [conBozza, setConBozza] = useState(
    prodotto0.stato === "pubblicato" && haBozza(prodotto0.bozzaModifiche),
  );
  const [conflitto, setConflitto] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<Esito>(null);
  const [erroreSalva, setErroreSalva] = useState<string | null>(null);
  const [rifiutoServer, setRifiutoServer] = useState<Voce[]>([]);
  const [letturaFallita, setLetturaFallita] = useState(false);
  const [aperti, setAperti] = useState(APERTI_DI_PARTENZA);
  const [pannello, setPannello] = useState(false);
  const [vai, setVai] = useState<{ ids: string[]; n: number } | null>(null);
  const [anteprima, setAnteprima] = useState<{ url: string; vista: VistaAnteprima } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [archivia, setArchivia] = useState(false);
  const [elencoCategorie, setElencoCategorie] = useState<{ id: string; nome: string }[] | null>(
    null,
  );
  const [categorieErrore, setCategorieErrore] = useState<string | null>(null);
  const [salvandoCategorie, setSalvandoCategorie] = useState(false);
  const [senzaStorico, setSenzaStorico] = useState(false);

  const negozioRef = useRef(negozio);
  negozioRef.current = negozio;
  const ricaricaRef = useRef(ricarica);
  ricaricaRef.current = ricarica;
  const versione = useRef(scheda.versione);
  const statoRef = useRef(stato);
  statoRef.current = stato;
  const origineRef = useRef(origine);
  origineRef.current = origine;
  /** I dati vivi per le funzioni che restano in vita più di un disegno (il salvataggio automatico nasce una volta sola). */
  const viva = useRef(dati);
  viva.current = dati;
  const salvati = useRef<Partial<CampiScheda>>(campiDaModulo(moduloDaProdotto(prodotto0)).campi);
  const salvatoSeo = useRef(seo0 || null);
  const coda = useRef<Promise<unknown>>(Promise.resolve());
  const conflittoRef = useRef(false);
  conflittoRef.current = conflitto;

  /** TUTTE le scritture passano da qui (anche quelle degli editor): se il server dice `storico: false` il dato è salvo ma
   *  la riga dello storico (chi, quando, prima e dopo) no, e il titolare lo deve sapere. */
  const scrivi = useCallback<Negozio["esegui"]>(async (azione, dati) => {
    const r = await negozioRef.current.esegui(azione, dati);
    if (r.ok && r.dati.storico === false) setSenzaStorico(true);
    return r;
  }, []);

  /** Le scritture sul prodotto (versione condivisa) una dopo l'altra. */
  const serializza = useCallback(<T,>(f: () => Promise<T>): Promise<T> => {
    const p = coda.current.then(() => f());
    coda.current = p.catch(() => undefined);
    return p;
  }, []);

  /** Un errore di una scrittura: il conflitto ha il suo avviso, il resto una frase. */
  const riferisci = useCallback((e: ErroreNegozio, doveVa: (t: string) => void) => {
    if (e.tipo === "conflitto") return setConflitto(true);
    if (e.tipo === "non_pubblicabile" && e.bloccanti?.length) setRifiutoServer(e.bloccanti);
    doveVa(e.messaggio);
  }, []);
  const nuovaVersione = (dati: Record<string, unknown>) => {
    if (typeof dati.versione === "string") versione.current = dati.versione;
  };

  /* ── rileggere varianti, foto e costi dopo le scritture ── */
  const rileggi = useCallback(async () => {
    const r = await negozioRef.current.scheda(id);
    if (!r.ok) return setLetturaFallita(true);
    setLetturaFallita(false);
    //  Un ritiro per liberatoria ha riportato il prodotto in bozza (e cambiato la sua versione): si riparte da quello che c'è.
    if ((r.scheda.prodotto as unknown as Prodotto).stato !== statoRef.current)
      return ricaricaRef.current();
    viva.current = {
      ...viva.current,
      varianti: r.scheda.varianti as unknown as Variante[],
      media: r.scheda.media as unknown as Media[],
      categorie: r.scheda.categorie,
      costi: r.scheda.costi ?? {},
    };
    setDati(viva.current);
  }, [id]);

  /** Il costo e lo SKU della Unica, e la Unica stessa se manca: l'ultimo passo del salvataggio automatico. `false` = non scritto. */
  const scriviUnica = async (c: Contenuto): Promise<boolean> => {
    const v = viva.current;
    if (origineRef.current === "codice" || modalitaDi(v.varianti) !== "semplice") return true;
    const sku = salvati.current.sku ?? v.prodotto.sku;
    const unica = trovaUnica(v.varianti, v.prodotto.sku);
    const campi: Record<string, unknown> = unica ? {} : { sku, nome: "Unica", opzioni: {} };
    //  In bozza lo SKU della Unica segue quello del prodotto; su un pubblicato lo SKU non si cambia più.
    if (unica && !v.prodotto.pubblicatoIl && unica.sku !== sku) campi.sku = sku;
    //  Un costo che non è una cifra non parte (lo dice il campo); vuoto = «non scritto» (`null`).
    const nuovoCosto = c.costo.trim() === "" ? null : centDaEuro(c.costo);
    const costoValido = c.costo.trim() === "" || nuovoCosto !== null;
    const senzaCosto = !costoDisp || eInvisibleDerm(c.m.nome, c.m.slug) || !costoValido;
    if (!senzaCosto && nuovoCosto !== (unica ? (v.costi[unica.id] ?? null) : null))
      campi.costoCent = nuovoCosto;
    if (Object.keys(campi).length === 0) return true;
    const r = await scrivi("variante_salva", {
      prodottoId: id,
      variante: unica ? { id: unica.id, ...campi } : campi,
    });
    if (!r.ok) {
      riferisci(r.errore, setErroreSalva);
      return false;
    }
    await rileggi();
    return true;
  };

  /* ── il salvataggio automatico (T13) ── */
  const [auto] = useState(() =>
    creaAutosalva<Contenuto>({
      porte: porteBrowser(),
      contenutoIniziale: { m: moduloDaProdotto(prodotto0), costo, seo },
      salva: (c) =>
        serializza(async () => {
          if (conflittoRef.current) return false;
          const pubblicato = statoRef.current === "pubblicato";
          const patch = patchCampi(salvati.current, campiDaModulo(c.m).campi, { pubblicato });
          const nuovaSeo = c.seo || null;
          const daMandare =
            nuovaSeo === salvatoSeo.current ? patch : { ...patch, seoMediaId: nuovaSeo };
          if (Object.keys(daMandare).length > 0) {
            const r = await scrivi("prodotto_salva", {
              prodottoId: id,
              versione: versione.current,
              campi: daMandare,
            });
            if (!r.ok) {
              riferisci(r.errore, setErroreSalva);
              return false;
            }
            nuovaVersione(r.dati);
            salvati.current = { ...salvati.current, ...patch };
            salvatoSeo.current = nuovaSeo;
            if (r.dati.bozza === true) setConBozza(true);
          }
          const fatto = await scriviUnica(c);
          if (fatto) setErroreSalva(null);
          return fatto;
        }),
    }),
  );
  const statoAuto = useSyncExternalStore(auto.iscrivi, auto.stato, auto.stato);
  //  Lasciando la scheda si salva ciò che è in coda (nessuna `ferma()`: con il doppio montaggio di sviluppo la ucciderebbe).
  useEffect(
    () => () => {
      void auto.subito();
    },
    [auto],
  );
  useEffect(() => {
    if (
      statoAuto.fase !== "in_attesa" &&
      statoAuto.fase !== "salvando" &&
      statoAuto.fase !== "errore"
    )
      return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [statoAuto.fase]);

  const modifica = (p: Partial<Contenuto>) => {
    setEsito(null);
    auto.modifica({ m: modulo, costo, seo, ...p });
  };
  const cambia = (p: Partial<Modulo>) => {
    const nuovo = { ...modulo, ...p };
    setModulo(nuovo);
    setRifiutoServer([]);
    modifica({ m: nuovo });
  };
  const cambiaCosto = (t: string) => (setCosto(t), modifica({ costo: t }));
  const cambiaImmagine = (m: string) => (setSeo(m), modifica({ seo: m }));

  /* ── una bozza senza Unica (o con la Unica spenta) la ritrova aprendo la scheda ── */
  const riparata = useRef(false);
  useEffect(() => {
    if (riparata.current || prodotto0.origine === "codice" || prodotto0.stato !== "bozza") return;
    const s = statoUnica(varianti0, prodotto0.sku);
    if (s !== "assente" && s !== "disattivata") return;
    riparata.current = true;
    void serializza(async () => {
      const u = trovaUnica(varianti0, prodotto0.sku);
      const r = u
        ? await scrivi("variante_attiva", { prodottoId: id, varianteId: u.id, attiva: true })
        : await scrivi("variante_salva", {
            prodottoId: id,
            variante: { sku: prodotto0.sku, nome: "Unica", opzioni: {} },
          });
      //  Anche dopo un errore si rilegge: un'altra persona può aver sistemato la Unica un attimo prima (SKU «duplicato»). L'errore si
      //  mostra solo se la Unica manca ancora: chi ha solo aperto la scheda non deve vedere un errore per ciò che non ha fatto.
      await rileggi();
      const ancora = statoUnica(viva.current.varianti, prodotto0.sku);
      if (!r.ok && (ancora === "assente" || ancora === "disattivata"))
        setEsito({ tono: "errore", testo: r.errore.messaggio });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── le categorie e la soglia di scorta bassa ── */
  useEffect(() => {
    let vivo = true;
    void negozioRef.current.categorie().then((r) => {
      if (!vivo) return;
      if (!r.ok || !Array.isArray(r.dati.categorie))
        return setCategorieErrore(r.ok ? "Non riesco a leggere le categorie." : r.errore.messaggio);
      setElencoCategorie(
        (r.dati.categorie as unknown[]).flatMap((k) => {
          const o = k as { id?: unknown; nome?: unknown } | null;
          return o && typeof o.id === "string" && typeof o.nome === "string"
            ? [{ id: o.id, nome: o.nome }]
            : [];
        }),
      );
    });
    //  Se la lettura fallisce la riga della soglia non si mostra (non è un errore della scheda).
    void negozioRef.current.interruttori().then((r) => {
      if (vivo && r.ok) setSoglia(leggiStatoShop(r.dati)?.soglia ?? null);
    });
    return () => {
      vivo = false;
    };
  }, []);
  const scegliCategoria = async (categoriaId: string, acceso: boolean) => {
    if (salvandoCategorie || conflitto) return;
    const nuove = acceso
      ? [...dati.categorie, categoriaId]
      : dati.categorie.filter((x) => x !== categoriaId);
    setSalvandoCategorie(true);
    setCategorieErrore(null);
    const r = await serializza(() =>
      scrivi("prodotto_categorie", {
        prodottoId: id,
        categorie: nuove,
        versione: versione.current,
      }),
    );
    setSalvandoCategorie(false);
    if (!r.ok) return riferisci(r.errore, setCategorieErrore);
    nuovaVersione(r.dati);
    setDati((d) => ({ ...d, categorie: nuove }));
  };

  /* ── il pannello «Prima di pubblicare», in tempo reale ── */
  const pubblicato = stato === "pubblicato";
  const { campi, errori } = useMemo(() => campiDaModulo(modulo), [modulo]);
  const avvisi = useMemo(() => avvisiCampi(modulo), [modulo]);
  const altriSku = useMemo<SkuUsato[]>(
    () => negozio.prodotti.map((r) => ({ sku: r.sku, prodottoId: r.id })),
    [negozio.prodotti],
  );
  const live = useMemo(
    () =>
      controlloLive({
        base: dati.prodotto,
        campi,
        errori,
        varianti: dati.varianti,
        media: dati.media,
        categorie: dati.categorie,
        altriSku,
        pubblicato,
      }),
    [dati, campi, errori, altriSku, pubblicato],
  );
  const bloccanti = useMemo(() => {
    const viste = new Set(live.bloccanti.map((v) => v.frase));
    return [...live.bloccanti, ...rifiutoServer.filter((v) => !viste.has(v.frase))];
  }, [live.bloccanti, rifiutoServer]);
  const informativi = live.informativi;

  const vecchio = origine === "codice";
  const archiviato = stato === "archiviato";
  const modificheInCorso =
    conBozza || (pubblicato && (statoAuto.fase === "in_attesa" || statoAuto.fase === "salvando"));
  const nonPubblicabile = bloccanti.length > 0 || conflitto || vecchio || archiviato;
  const senzaModifiche = pubblicato && !modificheInCorso;
  const spento = occupato || conflitto;
  const senzaPrezzo = eInvisibleDerm(modulo.nome, modulo.slug);
  /** Già pubblicato una volta: lo SKU e l'indirizzo non si cambiano più (anche se oggi è tornato in bozza). */
  const bloccoSkuIndirizzo = !!dati.prodotto.pubblicatoIl;

  const modalita = modalitaDi(dati.varianti);
  const unica = trovaUnica(dati.varianti, dati.prodotto.sku);
  const ctxRiquadri = { nome: modulo.nome, sku: dati.prodotto.sku, modalita };
  const conti = useMemo(
    () => conteggiPerRiquadro(bloccanti, informativi, ctxRiquadri),
    [bloccanti, informativi, modulo.nome, dati.prodotto.sku, modalita], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const segno = (r: RiquadroId) => segnoRiquadro(conti[r]);

  /* ── il costo e la quantità del prodotto semplice ── */
  const costoErrore =
    costo.trim() !== "" && centDaEuro(costo) === null
      ? "Scrivi il costo in euro, per esempio 10,40."
      : undefined;
  const giacenzaAttuale = unica?.giacenza ?? 0;
  const testoQ = testoQuantita({ letta: giacenzaAttuale, testo: quantita, toccata });
  const proposta = cambioQuantita(giacenzaAttuale, testoQ);
  const motivo: MotivoGiacenza =
    motivoGiac ?? (proposta.ok ? proposta.motivo : null) ?? "rettifica";
  /** Il fuoco esce da quantità + motivo: se la quantità è stata toccata e cambia, ora diventa un movimento registrato. */
  const confermaQuantita = () => {
    const m = movimentoDaScrivere({
      letta: giacenzaAttuale,
      testo: quantita,
      toccata,
      motivo: motivoGiac,
    });
    if (!m || conflitto) return;
    if (!unica)
      return setEsito({
        tono: "errore",
        testo: "Questo prodotto non ha ancora la sua variante: salva prima il prodotto.",
      });
    setToccata(false); // prima di scrivere: un secondo «esci dal campo» non rimanda lo stesso movimento
    void (async () => {
      const r = await scrivi("giacenza_imposta", {
        varianteId: unica.id,
        valore: m.valore,
        motivo: m.motivo,
      });
      if (!r.ok) return setEsito({ tono: "errore", testo: r.errore.messaggio });
      setMotivoGiac(null);
      await rileggi();
      setEsito({
        tono: "ok",
        testo: `Giacenza aggiornata: ${m.valore} ${m.valore === 1 ? "pezzo" : "pezzi"}.`,
      });
    })();
  };

  /* ── andare al campo ── */
  const vaiA = (v: Voce) => {
    //  La frase sulla spedizione sta in «Reso, consulenza e consegna» (come nella scheda di prima)
    const riquadro = v.campo === "spedizione" ? "reso" : riquadroDi(v, ctxRiquadri);
    if (Object.hasOwn(aperti, riquadro)) setAperti((a) => ({ ...a, [riquadro]: true }));
    //  Il campo di una voce può non esserci (la variante mancante senza opzioni sta nello SKU): si ripiega, alla fine, sul pannello del riquadro.
    const ids = [
      idCampo(v.campo),
      ...(v.campo === "varianti" && modalita === "semplice" ? ["f-sku"] : []),
      `pan-${riquadro}`,
    ];
    setVai((x) => ({ ids, n: (x?.n ?? 0) + 1 }));
  };
  /** Dalla barra del telefono: apre «Prima di pubblicare» e ci porta. */
  const mostraPrima = () => {
    setPannello(true);
    setVai((x) => ({ ids: ["prima-di-pubblicare"], n: (x?.n ?? 0) + 1 }));
  };
  useEffect(() => {
    if (!vai) return;
    const el = vai.ids.map((i) => document.getElementById(i)).find((x) => x !== null);
    if (!el) return;
    const ridotto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: ridotto ? "auto" : "smooth" });
    const diretto = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || el.tabIndex >= 0;
    (diretto ? el : el.querySelector<HTMLElement>("input, textarea, select, button"))?.focus({
      preventScroll: true,
    });
  }, [vai]);

  /* ── le azioni ── */
  const lavora = async (f: () => Promise<void>) => {
    if (occupato) return;
    setOccupato(true);
    setEsito(null);
    try {
      await f();
    } finally {
      setOccupato(false);
    }
  };
  const nonSalvato = (cosa: string): Esito => ({
    tono: "errore",
    testo: `Non sono riuscito a salvare le ultime modifiche: controlla la connessione e riprova. ${cosa}`,
  });

  const salvaOra = () =>
    lavora(async () => {
      const ok = await auto.subito();
      setEsito(
        ok
          ? {
              tono: "ok",
              testo: pubblicato
                ? "Salvato: le modifiche restano in bozza finché non le pubblichi."
                : "Bozza salvata.",
            }
          : nonSalvato("Premi di nuovo «Salva»."),
      );
    });

  async function pubblica() {
    if (occupato) return;
    setOccupato(true);
    setEsito(null);
    setRifiutoServer([]);
    try {
      if (!(await auto.subito()))
        return setEsito(nonSalvato("Non ho pubblicato niente: premi di nuovo «Pubblica»."));
      const sulSito = statoRef.current === "pubblicato";
      const r = await serializza(() =>
        scrivi(sulSito ? "prodotto_pubblica_modifiche" : "prodotto_stato", {
          prodottoId: id,
          versione: versione.current,
          ...(sulSito ? {} : { stato: "pubblicato" }),
        }),
      );
      if (!r.ok) return riferisci(r.errore, (testo) => setEsito({ tono: "errore", testo }));
      nuovaVersione(r.dati);
      statoRef.current = "pubblicato"; // subito: `rileggi()` qui sotto confronta con questo, non con il prossimo disegno
      setStato("pubblicato");
      setConBozza(false);
      setEsito({
        tono: "ok",
        testo: sulSito
          ? "Modifiche pubblicate: sul sito entro un minuto."
          : "Pubblicato: lo vedi sul sito entro un minuto.",
      });
      await rileggi();
    } finally {
      setOccupato(false);
    }
  }

  const scarta = () =>
    lavora(async () => {
      if (!(await auto.subito())) return setEsito(nonSalvato("Non ho scartato niente."));
      const r = await serializza(() =>
        scrivi("prodotto_scarta_modifiche", {
          prodottoId: id,
          versione: versione.current,
        }),
      );
      if (!r.ok) return riferisci(r.errore, (testo) => setEsito({ tono: "errore", testo }));
      ricarica(); // il modulo riparte da ciò che è sul sito
    });

  const applicaPrezzo = () =>
    lavora(async () => {
      const cent = campi.prezzoCent;
      if (!cent || errori.prezzo)
        return setEsito({
          tono: "errore",
          testo:
            errori.prezzo ?? "Scrivi il prezzo in euro, per esempio 19,90 (zero non è un prezzo).",
        });
      const r = await serializza(() =>
        scrivi("prodotto_salva", {
          prodottoId: id,
          versione: versione.current,
          campi: { prezzoCent: cent },
        }),
      );
      if (!r.ok) return riferisci(r.errore, (testo) => setEsito({ tono: "errore", testo }));
      nuovaVersione(r.dati);
      salvati.current = { ...salvati.current, prezzoCent: cent };
      setDati((d) => ({ ...d, prodotto: { ...d.prodotto, prezzoCent: cent } }));
      setEsito({ tono: "ok", testo: "Prezzo cambiato: sul sito entro un minuto." });
    });

  const cambiaStato = (nuovo: "bozza" | "archiviato") =>
    lavora(async () => {
      if (!(await auto.subito())) return setEsito(nonSalvato("Non ho cambiato lo stato."));
      const r = await serializza(() =>
        scrivi("prodotto_stato", {
          prodottoId: id,
          stato: nuovo,
          versione: versione.current,
        }),
      );
      setArchivia(false);
      if (!r.ok) return riferisci(r.errore, (testo) => setEsito({ tono: "errore", testo }));
      if (nuovo === "archiviato") return apri(null);
      ricarica();
    });

  const duplica = () =>
    lavora(async () => {
      if (!(await auto.subito())) return setEsito(nonSalvato("Non ho duplicato niente."));
      const skuUsati = new Set(negozioRef.current.prodotti.map((r) => r.sku));
      const slugUsati = new Set(negozioRef.current.prodotti.map((r) => r.slug));
      let ultimo = "Non sono riuscito a duplicare il prodotto.";
      for (let prova = 0; prova < 3; prova++) {
        //  Come nell'elenco: SKU e indirizzo con lo stesso suffisso (shop_prodotti.slug è UNIQUE, senza indirizzo nuovo la seconda copia darebbe «duplicato»).
        const { sku, slug } = proponiCopia(
          dati.prodotto.sku,
          dati.prodotto.slug,
          skuUsati,
          slugUsati,
        );
        const r = await scrivi("prodotto_duplica", { prodottoId: id, sku, slug });
        skuUsati.add(sku);
        slugUsati.add(slug);
        if (r.ok) {
          const nuovo = r.dati.prodotto as { id?: unknown } | undefined;
          return typeof nuovo?.id === "string" ? apri(nuovo.id) : apri(null);
        }
        ultimo = r.errore.messaggio;
        if (r.errore.tipo !== "duplicato") break;
      }
      setEsito({ tono: "errore", testo: ultimo });
    });

  const adotta = () =>
    lavora(async () => {
      const r = await serializza(() => scrivi("prodotto_adotta", { prodottoId: id }));
      if (!r.ok) return riferisci(r.errore, (testo) => setEsito({ tono: "errore", testo }));
      nuovaVersione(r.dati);
      setOrigine(null);
      setEsito({
        tono: "ok",
        testo: "Ora è un tuo prodotto. Completalo e pubblicalo quando è pronto.",
      });
    });

  /** Un link di anteprima (24 ore) per QUESTA bozza, già salvata. `null` se qualcosa non va (e dice cosa). */
  const ottieniLink = async (): Promise<string | null> => {
    if (!(await auto.subito())) {
      setEsito(nonSalvato("L'anteprima mostra ciò che è salvato."));
      return null;
    }
    const r = await scrivi("anteprima_chiave", { prodottoId: id });
    if (!r.ok) {
      setEsito({ tono: "errore", testo: r.errore.messaggio });
      return null;
    }
    const url = indirizzoAnteprima(window.location.origin, r.dati.url);
    if (!url)
      setEsito({
        tono: "errore",
        testo: "Non riesco a preparare l'indirizzo dell'anteprima: riprova.",
      });
    return url;
  };
  const apriAnteprima = () =>
    lavora(async () => {
      const url = await ottieniLink();
      if (url) setAnteprima({ url, vista: "telefono" });
    });
  const copiaLink = () =>
    lavora(async () => {
      const url = await ottieniLink();
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        setLink(null);
        setEsito({
          tono: "ok",
          testo: "Link copiato: vale 24 ore e mostra la bozza. Incollalo nel telefono.",
        });
      } catch {
        setLink(url); // la pagina non può scrivere negli appunti: si mostra il link da copiare a mano
      }
    });

  /* ── i pezzi che ripeto ── */
  const prezzoVivo = dati.prodotto.prezzoCent;
  const prezzoPerVarianti = pubblicato ? prezzoVivo : (campi.prezzoCent ?? prezzoVivo);
  const tastoPubblica = pubblicato ? "Pubblica le modifiche" : "Pubblica";
  const tastoSalva = pubblicato ? "Salva" : "Salva bozza";
  const base = { modulo, cambia, errori, avvisi };
  const immagini = dati.media
    .filter((m) => m.tipo === "foto" && !m.rimossoIl)
    .map((m) => ({
      id: m.id,
      nome: `${SLOT_EDITOR.find((s) => s.slot === m.slot)?.etichetta ?? m.slot}${m.alt ? ` · ${m.alt}` : ""}`,
    }));
  /** Il tasto «Applica il nuovo prezzo» (un prodotto pubblicato cambia il sito subito): sta nel riquadro Prezzo o, con le opzioni, in Varianti. */
  const azionePrezzo = (
    <Button
      type="button"
      variant="outline"
      className={CLASSI_TASTO}
      disabled={spento || !!errori.prezzo || !campi.prezzoCent || campi.prezzoCent === prezzoVivo}
      onClick={() => void applicaPrezzo()}
    >
      Applica il nuovo prezzo
    </Button>
  );
  /** Le props che il nuovo EditorVarianti (E8) accetta: il costo per riga e il «Prezzo di base» (campo, errore e tasto «Applica»). Passate come
   *  gruppo: finché l'editor è quello vecchio non le legge (nessun errore); dopo l'unione con E8 lavorano da sole. */
  const propsNuoveVarianti = {
    costi: dati.costi,
    costoDisponibile: costoDisp,
    prezzoBase:
      modalita === "opzioni" && !senzaPrezzo
        ? {
            testo: modulo.prezzo,
            cambia: (t: string) => cambia({ prezzo: t }),
            errore: errori.prezzo,
            azione: pubblicato ? azionePrezzo : undefined,
          }
        : undefined,
  };
  const tastoSalvaGrande = (
    <Button
      type="button"
      variant="outline"
      className={cn(CLASSI_TASTO, "flex-1 md:flex-none")}
      disabled={spento}
      onClick={() => void salvaOra()}
    >
      {tastoSalva}
    </Button>
  );

  return (
    <div className="pb-44 md:pb-0">
      <PaginaScheda
        testata={
          <>
            <TestataScheda
              titolo={modulo.nome.trim() || dati.prodotto.nome}
              stato={stato}
              salvataggio={statoAuto.testo}
              conflitto={conflitto}
              storico={scheda.storico}
              link={link}
              indietro={() => apri(null)}
              spento={spento}
              vecchio={vecchio}
              azioni={{
                copiaLink: () => void copiaLink(),
                duplica: () => void duplica(),
                archivia: () => setArchivia(true),
                rimettiInBozza: () => void cambiaStato("bozza"),
                rendiMio: () => void adotta(),
              }}
              prima={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={CLASSI_TASTO}
                    disabled={spento}
                    onClick={() => void apriAnteprima()}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Anteprima
                  </Button>
                  <div className="hidden md:block">{tastoSalvaGrande}</div>
                </>
              }
              principale={
                <Button
                  type="button"
                  className={cn(CLASSI_TASTO, "hidden md:inline-flex")}
                  disabled={nonPubblicabile || senzaModifiche || spento}
                  onClick={() => void pubblica()}
                >
                  {tastoPubblica}
                </Button>
              }
            />
            <AvvisiScheda
              conflitto={conflitto}
              ricarica={ricarica}
              vecchio={vecchio}
              adotta={() => void adotta()}
              spento={spento}
              letturaFallita={letturaFallita}
              erroreSalva={erroreSalva}
              esito={esito}
            />
            {senzaStorico && (
              <Banner tono="attenzione">
                La modifica è salvata, ma non è rimasta traccia nello storico (chi l'ha fatta e
                quando). Avvisa chi gestisce il database.
              </Banner>
            )}
            {pubblicato && modificheInCorso && (
              <Banner
                tono="attenzione"
                titolo="Hai modifiche non pubblicate"
                azione={
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={CLASSI_TASTO}
                      disabled={nonPubblicabile || spento}
                      onClick={() => void pubblica()}
                    >
                      Pubblica le modifiche
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={CLASSI_TASTO}
                      disabled={spento}
                      onClick={() => void scarta()}
                    >
                      Scarta
                    </Button>
                  </div>
                }
              >
                Il sito resta com'è finché non le pubblichi.
              </Banner>
            )}
          </>
        }
        principale={
          <>
            <RiquadroTitolo
              {...base}
              segno={segno("titolo")}
              avviso={
                senzaPrezzo && (
                  <Banner tono="attenzione">
                    Non scrivere prezzi nelle descrizioni: Invisible Derm non ha un prezzo nello
                    shop (il costo si vede in consulenza), e il testo libero il sistema non lo può
                    controllare del tutto.
                  </Banner>
                )
              }
            />
            <RiquadroFoto nuovo={false} segno={segno("foto")} subito={pubblicato}>
              <EditorMedia
                prodotto={{ id, nome: modulo.nome, pubblicato }}
                media={dati.media}
                esegui={scrivi}
                aggiorna={rileggi}
              />
            </RiquadroFoto>
            <RiquadroPrezzo
              {...base}
              segno={segno("prezzo")}
              modalita={modalita}
              invisibleDerm={senzaPrezzo}
              pubblicato={pubblicato}
              prezzoVivo={prezzoInTesto(prezzoVivo)}
              costo={costo}
              cambiaCosto={cambiaCosto}
              costoErrore={costoErrore}
              costoDisponibile={costoDisp}
              azionePrezzo={azionePrezzo}
            />
            <RiquadroGiacenza
              {...base}
              segno={segno("giacenza")}
              modalita={modalita}
              invisibleDerm={senzaPrezzo}
              nuovo={false}
              skuBloccato={bloccoSkuIndirizzo}
              giacenzaAttuale={giacenzaAttuale}
              quantita={testoQ}
              cambiaQuantita={(t) => {
                setQuantita(t);
                setToccata(true);
                setEsito(null);
              }}
              motivo={motivo}
              cambiaMotivo={setMotivoGiac}
              soglia={soglia ? soglia : null}
              linkSoglia={
                <Button
                  type="button"
                  variant="link"
                  className="h-auto min-h-11 p-0 text-[13px] md:min-h-0"
                  onClick={() => apri(null)}
                >
                  Apri l'elenco prodotti
                </Button>
              }
              confermaQuantita={confermaQuantita}
            />
            <RiquadroSpedizione
              {...base}
              segno={segno("spedizione")}
              modalita={modalita}
              invisibleDerm={senzaPrezzo}
            />
            <RiquadroVarianti segno={segno("varianti")} pubblicato={pubblicato}>
              <EditorVarianti
                prodotto={{
                  id,
                  sku: dati.prodotto.sku,
                  nome: modulo.nome,
                  slug: modulo.slug,
                  prezzoCent: prezzoPerVarianti,
                  pubblicato,
                  versione: versione.current,
                }}
                varianti={dati.varianti}
                esegui={scrivi}
                aggiorna={rileggi}
                {...propsNuoveVarianti}
              />
            </RiquadroVarianti>
            <RiquadroSeo
              {...base}
              segno={segno("seo")}
              pubblicato={bloccoSkuIndirizzo}
              dominio={typeof window === "undefined" ? "il tuo sito" : window.location.hostname}
              immagini={immagini.length > 0 ? immagini : undefined}
              immagineId={seo}
              cambiaImmagine={immagini.length > 0 ? cambiaImmagine : undefined}
            />
            <RiquadroContenuto
              {...base}
              aperti={aperti}
              alterna={(r) => setAperti((a) => ({ ...a, [r]: !a[r] }))}
              segni={{
                caratteristiche: segno("caratteristiche"),
                uso: segno("uso"),
                reso: segno("reso"),
              }}
              correlabili={negozio.prodotti
                .filter((r) => r.id !== id && r.stato !== "archiviato" && r.origine !== "codice")
                .map((r) => ({ id: r.id, nome: r.nome }))}
            />
          </>
        }
        laterale={
          <ColonnaLaterale
            {...base}
            stato={stato}
            segni={{
              canali: segno("canali"),
              organizzazione: segno("organizzazione"),
              cataloghi: segno("cataloghi"),
              note: segno("note"),
            }}
            categorie={{
              elenco: elencoCategorie,
              scelte: dati.categorie,
              scegli: (k, acceso) => void scegliCategoria(k, acceso),
              errore: categorieErrore,
              occupato: salvandoCategorie || spento,
            }}
            cataloghiAperto={aperti.cataloghi}
            alternaCataloghi={() => setAperti((a) => ({ ...a, cataloghi: !a.cataloghi }))}
            prima={
              <PrimaDiPubblicare
                bloccanti={bloccanti}
                informativi={informativi}
                vai={vaiA}
                archiviato={archiviato}
                vecchio={vecchio}
                aperto={pannello}
                alterna={() => setPannello((x) => !x)}
              />
            }
          />
        }
      />

      {/* ── Telefono: la barra fissa (se «Pubblica» è spento dice perché e porta a «Prima di pubblicare») ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
        {bloccanti.length > 0 && (
          <button
            type="button"
            onClick={mostraPrima}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-[13px] font-medium text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {quanteMancano(bloccanti.length)} prima di pubblicare
            <span className="underline">Vedi</span>
          </button>
        )}
        <div className="flex gap-2">
          {tastoSalvaGrande}
          <Button
            type="button"
            className={cn(CLASSI_TASTO, "flex-1")}
            disabled={nonPubblicabile || senzaModifiche || spento}
            onClick={() => void pubblica()}
          >
            {tastoPubblica}
          </Button>
        </div>
      </div>

      <FinestraAnteprima
        anteprima={anteprima}
        cambiaVista={(vista) => anteprima && setAnteprima({ ...anteprima, vista })}
        chiudi={() => setAnteprima(null)}
      />
      <FinestraArchivia
        aperta={archivia}
        nome={dati.prodotto.nome}
        occupato={occupato}
        chiudi={() => setArchivia(false)}
        conferma={() => void cambiaStato("archiviato")}
      />
    </div>
  );
}
