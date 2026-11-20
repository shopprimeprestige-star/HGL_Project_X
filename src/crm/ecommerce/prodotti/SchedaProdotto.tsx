/** ── LA SCHEDA DI UN PRODOTTO (SchedaProdotto.tsx) ───────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T15 (Design §4.10.2). Undici sezioni apribili, ognuna col suo segno «a posto / da sistemare
 *  (n)»; a destra (sul telefono in cima, chiusa) la colonna «Prima di pubblicare», che si aggiorna mentre si scrive e porta al
 *  campo da sistemare; l'anteprima a 390 e 1440 px; «Copia il link per il telefono»; il salvataggio automatico di T13; la striscia
 *  «Hai modifiche non pubblicate»; «Archivia» e «Duplica» nel menu «…». Sul telefono: una colonna e la barra fissa in basso.
 *
 *  ── LE PROPS (le fissa T14, restano così) ───────────────────────────────────
 *   · `id`      il prodotto aperto.   · `negozio` l'archivio unico della pagina (`useNegozio()`).
 *   · `apri`    `apri(null)` torna all'elenco (dopo «Archivia»), `apri(altroId)` apre un altro prodotto (dopo «Duplica»).
 *  Il link «← Tutti i prodotti» lo mette il guscio: qui non ce n'è un secondo.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · «Pubblica» salva PRIMA (`await subito()`) e parte solo se ha restituito `true`: con `false` dice chiaro che non ha pubblicato
 *    niente, e il tasto si può ripremere. Il tasto è spento finché `bloccanti.length > 0` (le stesse frasi del server).
 *  · Il salvataggio automatico manda solo i campi CAMBIATI e mai un campo con un errore. Le scritture sul prodotto (testi, categorie,
 *    prezzo, stato) passano da UNA coda: due insieme litigherebbero sulla versione.
 *  · Un prodotto PUBBLICATO: i testi vanno in «bozza di modifica» (il sito resta com'è finché non si preme «Pubblica le modifiche»);
 *    il prezzo si applica con il suo tasto (subito, sul sito); varianti e foto subito. Lo SKU e l'indirizzo non si cambiano più.
 *  · Conflitto di versione («409»): «Qualcun altro ha modificato questo prodotto», con «Ricarica». Mai una scrittura sopra.
 *  · Per costruzione non c'è un campo per il prezzo barrato, lo sconto, le stelle o il best seller. Invisible Derm (D39) non ha
 *    un campo prezzo: il suo costo si vede in consulenza.
 *  · Parole da non usare: un avviso accanto al campo, che non blocca. Una cifra vicino a «Invisible Derm», «sconto del»…: un errore
 *    accanto al campo, che blocca.
 *  ⚠️ Nessun log da qui, mai.
 *  shortcut: gli SKU degli altri prodotti per il controllo «già usato» sono quelli dell'elenco caricato (le varianti di altri
 *  prodotti le controlla il server al momento di pubblicare); si cambia quando l'elenco porterà anche gli SKU delle varianti. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Info,
  MoreHorizontal,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chip } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { Avviso } from "@/crm/ecommerce/Avviso";
import { porteBrowser } from "@/crm/ecommerce/client";
import { creaAutosalva } from "@/crm/negozio/autosalva";
import type { ErroreNegozio, SchedaProdotto as DatiScheda } from "@/crm/negozio/client";
import { centDaEuro, slugDa, type Media, type Prodotto, type Variante } from "@/shop/cms/modello";
import type { SkuUsato, Voce } from "@/shop/cms/pubblicazione";
import { EditorMedia } from "./EditorMedia";
import { EditorVarianti } from "./EditorVarianti";
import { proponiSkuCopia } from "./elenco-puro";
import {
  SEZIONI,
  avvisiCampi,
  campiDaModulo,
  conteggiPerSezione,
  controlloLive,
  eInvisibleDerm,
  haBozza,
  idCampo,
  indirizzoAnteprima,
  moduloDaProdotto,
  patchCampi,
  prezzoInTesto,
  sezioneDi,
  statoSezione,
  type CampiScheda,
  type CampoModulo,
  type Modulo,
  type SezioneId,
} from "./scheda-pura";
import type { Negozio } from "./tipi";

export interface PropsSchedaProdotto {
  id: string;
  negozio: Negozio;
  apri: (id: string | null) => void;
}

const campo =
  "min-h-11 w-full rounded-md border border-border bg-card px-2.5 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 md:text-[12.5px]";
const tastoGrande = "h-11 text-[13px] md:h-9 md:text-[12px]";

type Esito = { tono: "ok" | "errore"; testo: string } | null;
type Lettura =
  | { stato: "carico" }
  | { stato: "errore"; errore: ErroreNegozio }
  | { stato: "ok"; scheda: DatiScheda };

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

  if (lettura.stato === "carico")
    return (
      <div role="status" aria-label="Carico la scheda" className="flex flex-col gap-3">
        <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>
    );
  if (lettura.stato === "errore") {
    const e = lettura.errore;
    const nonTrovato = e.tipo === "non_trovato";
    return (
      <Avviso
        errore
        azione={
          nonTrovato ? (
            <Button
              type="button"
              variant="outline"
              className={tastoGrande}
              onClick={() => apri(null)}
            >
              Torna ai prodotti
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className={tastoGrande}
              onClick={() => setGiro((g) => g + 1)}
            >
              Riprova
            </Button>
          )
        }
      >
        {e.messaggio}
      </Avviso>
    );
  }
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
}

function SchedaAperta({
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
  const [dati, setDati] = useState<DatiVivi>({
    prodotto: prodotto0,
    varianti: scheda.varianti as unknown as Variante[],
    media: scheda.media as unknown as Media[],
    categorie: scheda.categorie,
  });
  const [modulo, setModulo] = useState<Modulo>(() => moduloDaProdotto(prodotto0));
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
  const [aperte, setAperte] = useState<ReadonlySet<SezioneId>>(new Set<SezioneId>(["identita"]));
  const [pannello, setPannello] = useState(false);
  const [vai, setVai] = useState<{ id: string; sezione: SezioneId; n: number } | null>(null);
  const [anteprima, setAnteprima] = useState<{
    url: string;
    vista: "telefono" | "computer";
  } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [archivia, setArchivia] = useState(false);
  const [elencoCategorie, setElencoCategorie] = useState<{ id: string; nome: string }[] | null>(
    null,
  );
  const [categorieErrore, setCategorieErrore] = useState<string | null>(null);
  const [salvandoCategorie, setSalvandoCategorie] = useState(false);

  const negozioRef = useRef(negozio);
  negozioRef.current = negozio;
  const versione = useRef(scheda.versione);
  const statoRef = useRef(stato);
  statoRef.current = stato;
  const salvati = useRef<Partial<CampiScheda>>(campiDaModulo(moduloDaProdotto(prodotto0)).campi);
  const coda = useRef<Promise<unknown>>(Promise.resolve());
  const conflittoRef = useRef(false);
  conflittoRef.current = conflitto;

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

  /* ── il salvataggio automatico (T13) ── */
  const [auto] = useState(() =>
    creaAutosalva<Modulo>({
      porte: porteBrowser(),
      contenutoIniziale: moduloDaProdotto(prodotto0),
      salva: (m) =>
        serializza(async () => {
          if (conflittoRef.current) return false;
          const pubblicato = statoRef.current === "pubblicato";
          const patch = patchCampi(salvati.current, campiDaModulo(m).campi, { pubblicato });
          if (Object.keys(patch).length === 0) return true;
          const r = await negozioRef.current.esegui("prodotto_salva", {
            prodottoId: id,
            versione: versione.current,
            campi: patch,
          });
          if (!r.ok) {
            riferisci(r.errore, setErroreSalva);
            return false;
          }
          nuovaVersione(r.dati);
          salvati.current = { ...salvati.current, ...patch };
          if (r.dati.bozza === true) setConBozza(true);
          setErroreSalva(null);
          return true;
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

  const cambia = (p: Partial<Modulo>) => {
    const nuovo = { ...modulo, ...p };
    setModulo(nuovo);
    setRifiutoServer([]);
    setEsito(null);
    auto.modifica(nuovo);
  };

  /* ── rileggere varianti e foto dopo le scritture degli editor ── */
  const rileggi = useCallback(async () => {
    const r = await negozioRef.current.scheda(id);
    if (!r.ok) return setLetturaFallita(true);
    setLetturaFallita(false);
    const p = r.scheda.prodotto as unknown as Prodotto;
    //  Un ritiro per liberatoria ha riportato il prodotto in bozza (e cambiato la sua versione): si riparte da quello che c'è.
    if (p.stato !== statoRef.current) return ricarica();
    setDati((d) => ({
      ...d,
      varianti: r.scheda.varianti as unknown as Variante[],
      media: r.scheda.media as unknown as Media[],
      categorie: r.scheda.categorie,
    }));
  }, [id, ricarica]);

  /* ── le categorie ── */
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
      negozioRef.current.esegui("prodotto_categorie", {
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
  const ctx = { nome: modulo.nome, sku: dati.prodotto.sku };
  const conti = useMemo(
    () => conteggiPerSezione(bloccanti, informativi, ctx),
    [bloccanti, informativi, modulo.nome, dati.prodotto.sku],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const vecchio = origine === "codice";
  const archiviato = stato === "archiviato";
  const modificheInCorso =
    conBozza || (pubblicato && (statoAuto.fase === "in_attesa" || statoAuto.fase === "salvando"));
  const nonPubblicabile = bloccanti.length > 0 || conflitto || vecchio || archiviato;
  const senzaModifiche = pubblicato && !modificheInCorso;
  const spento = occupato || conflitto;
  const senzaPrezzo = eInvisibleDerm(modulo.nome);

  /* ── andare al campo ── */
  const vaiA = (v: Voce) => {
    const sezione = sezioneDi(v, ctx);
    setAperte((a) => new Set(a).add(sezione));
    setVai((x) => ({ id: idCampo(v.campo), sezione, n: (x?.n ?? 0) + 1 }));
  };
  useEffect(() => {
    if (!vai) return;
    const el = document.getElementById(vai.id) ?? document.getElementById(`sez-${vai.sezione}`);
    if (!el) return;
    const ridotto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: ridotto ? "auto" : "smooth" });
    const diretto = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || el.tabIndex >= 0;
    (diretto ? el : document.getElementById(`sez-${vai.sezione}`))?.focus({ preventScroll: true });
  }, [vai]);
  const alternaSezione = (s: SezioneId) =>
    setAperte((a) => (a.has(s) ? new Set([...a].filter((x) => x !== s)) : new Set(a).add(s)));

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
        negozioRef.current.esegui(sulSito ? "prodotto_pubblica_modifiche" : "prodotto_stato", {
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
        negozioRef.current.esegui("prodotto_scarta_modifiche", {
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
      if (cent === undefined || errori.prezzo)
        return setEsito({
          tono: "errore",
          testo: errori.prezzo ?? "Scrivi il prezzo in euro, per esempio 19,90.",
        });
      const r = await serializza(() =>
        negozioRef.current.esegui("prodotto_salva", {
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
        negozioRef.current.esegui("prodotto_stato", {
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
      const usati = new Set(negozioRef.current.prodotti.map((r) => r.sku));
      let ultimo = "Non sono riuscito a duplicare il prodotto.";
      for (let prova = 0; prova < 3; prova++) {
        const sku = proponiSkuCopia(dati.prodotto.sku, usati);
        const r = await negozioRef.current.esegui("prodotto_duplica", { prodottoId: id, sku });
        usati.add(sku);
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
      const r = await serializza(() =>
        negozioRef.current.esegui("prodotto_adotta", { prodottoId: id }),
      );
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
    const r = await negozioRef.current.esegui("anteprima_chiave", { prodottoId: id });
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
  const testoStato = archiviato ? "Archiviato" : pubblicato ? "Pubblicato" : "Bozza";
  const tastoPubblica = pubblicato ? "Pubblica le modifiche" : "Pubblica";
  const tastoSalva = pubblicato ? "Salva" : "Salva bozza";
  const sezione = (s: SezioneId, children: ReactNode, subito?: boolean) => {
    const def = SEZIONI.find((x) => x.id === s)!;
    return (
      <Sezione
        key={s}
        id={s}
        titolo={def.titolo}
        segno={statoSezione(conti[s])}
        aperta={aperte.has(s)}
        alterna={() => alternaSezione(s)}
        subito={subito && pubblicato}
      >
        {children}
      </Sezione>
    );
  };
  const mostra = (k: CampoModulo) => ({ errore: errori[k], avvisi: avvisi[k]?.avvisi ?? [] });
  const testo = (
    k:
      | "nome"
      | "marca"
      | "rigaPresentazione"
      | "descrizioneBreve"
      | "descrizioneLunga"
      | "perChi"
      | "seoTitolo"
      | "seoDescrizione",
    etichetta: string,
    extra?: {
      aiuto?: string;
      max?: number;
      area?: boolean;
      righe?: number;
      disabilitato?: boolean;
    },
  ) => (
    <Campo
      k={k}
      etichetta={etichetta}
      aiuto={extra?.aiuto}
      contatore={extra?.max ? { n: modulo[k].length, max: extra.max } : undefined}
      {...mostra(k)}
    >
      {(p) =>
        extra?.area ? (
          <textarea
            {...p}
            rows={extra.righe ?? 3}
            value={modulo[k]}
            onChange={(e) => cambia({ [k]: e.target.value })}
            className={cn(campo, "py-2")}
          />
        ) : (
          <input
            {...p}
            value={modulo[k]}
            disabled={extra?.disabilitato}
            onChange={(e) => cambia({ [k]: e.target.value })}
            className={campo}
          />
        )
      }
    </Campo>
  );
  const lista = (k: "passi" | "confezione" | "avvertenze", etichetta: string, aiuto: string) => (
    <Campo k={k} etichetta={etichetta} aiuto={aiuto} {...mostra(k)}>
      {(p) => (
        <textarea
          {...p}
          rows={4}
          value={modulo[k]}
          onChange={(e) => cambia({ [k]: e.target.value })}
          className={cn(campo, "py-2")}
        />
      )}
    </Campo>
  );
  const bloccoServer = erroreSalva ? (
    <Avviso errore>{erroreSalva} Premi «Salva» per riprovare.</Avviso>
  ) : null;

  const barra = (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(tastoGrande, "flex-1 md:flex-none")}
        disabled={spento}
        onClick={() => void salvaOra()}
      >
        {tastoSalva}
      </Button>
      <Button
        type="button"
        className={cn(tastoGrande, "flex-1 md:flex-none")}
        disabled={nonPubblicabile || senzaModifiche || spento}
        onClick={() => void pubblica()}
      >
        {tastoPubblica}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-3 pb-24 md:pb-0">
      {/* ── Intestazione ── */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight">
              {dati.prodotto.nome}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Chip tono={archiviato ? "chiusa" : pubblicato ? "vinta" : "neutro"}>
                {testoStato}
              </Chip>
              <span className="text-[12px] text-muted-foreground" role="status" aria-live="polite">
                {conflitto
                  ? "Non salvato: qualcun altro ha modificato il prodotto."
                  : statoAuto.testo || (statoAuto.fase === "fermo" ? "Si salva da solo." : "")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">{barra}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-11 p-0 md:h-9 md:w-9"
                  aria-label="Altre azioni"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="crm-theme bg-white text-foreground">
                <DropdownMenuItem
                  className="min-h-11 md:min-h-8"
                  disabled={spento}
                  onSelect={() => void duplica()}
                >
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Duplica
                </DropdownMenuItem>
                {archiviato ? (
                  <DropdownMenuItem
                    className="min-h-11 md:min-h-8"
                    disabled={spento}
                    onSelect={() => void cambiaStato("bozza")}
                  >
                    Rimetti in bozza
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="min-h-11 md:min-h-8"
                    disabled={spento}
                    onSelect={() => setArchivia(true)}
                  >
                    Archivia
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={tastoGrande}
            disabled={spento}
            onClick={() => void apriAnteprima()}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Anteprima
          </Button>
          <Button
            type="button"
            variant="outline"
            className={tastoGrande}
            disabled={spento}
            onClick={() => void copiaLink()}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Copia il link per il telefono
          </Button>
        </div>
        {link && (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-[12.5px]">
            <label htmlFor="link-anteprima" className="font-medium">
              Copia questo link a mano (vale 24 ore)
            </label>
            <input
              id="link-anteprima"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className={campo}
            />
          </div>
        )}
      </header>

      {/* ── Avvisi in cima ── */}
      {conflitto && (
        <Avviso
          errore
          azione={
            <Button type="button" variant="outline" className={tastoGrande} onClick={ricarica}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Ricarica
            </Button>
          }
        >
          Qualcun altro ha modificato questo prodotto mentre lo guardavi. Ricarica per vedere la sua
          versione: le tue ultime modifiche non salvate andranno perse. Finché non ricarichi non
          salvo niente.
        </Avviso>
      )}
      {vecchio && (
        <Avviso
          azione={
            <Button
              type="button"
              variant="outline"
              className={tastoGrande}
              disabled={spento}
              onClick={() => void adotta()}
            >
              Usa questo prodotto
            </Button>
          }
        >
          Questo articolo viene dal vecchio catalogo: per pubblicarlo devi prima farne un tuo
          prodotto.
        </Avviso>
      )}
      {letturaFallita && (
        <Avviso>
          Non riesco a rileggere la scheda: i numeri che vedi potrebbero essere indietro. Ricarica
          la pagina se qualcosa non torna.
        </Avviso>
      )}
      {bloccoServer}
      {esito && <Avviso errore={esito.tono === "errore"}>{esito.testo}</Avviso>}
      {pubblicato && modificheInCorso && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900"
        >
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">Hai modifiche non pubblicate.</strong> Il sito resta
            com'è finché non le pubblichi.
          </p>
          <Button
            type="button"
            className={tastoGrande}
            disabled={nonPubblicabile || spento}
            onClick={() => void pubblica()}
          >
            Pubblica le modifiche
          </Button>
          <Button
            type="button"
            variant="outline"
            className={tastoGrande}
            disabled={spento}
            onClick={() => void scarta()}
          >
            Scarta
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ── Prima di pubblicare ── */}
        <aside
          aria-label="Prima di pubblicare"
          className="rounded-xl border border-border bg-card lg:sticky lg:top-3 lg:col-start-2 lg:row-start-1"
        >
          <button
            type="button"
            aria-expanded={pannello}
            aria-controls="prima-di-pubblicare"
            onClick={() => setPannello((x) => !x)}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-[13px] font-semibold lg:hidden"
          >
            <span>
              Prima di pubblicare ·{" "}
              {bloccanti.length === 0
                ? "tutto a posto"
                : bloccanti.length === 1
                  ? "manca 1 cosa"
                  : `mancano ${bloccanti.length} cose`}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform motion-reduce:transition-none",
                pannello && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
          <div
            id="prima-di-pubblicare"
            className={cn("flex flex-col gap-3 p-3", !pannello && "hidden lg:flex")}
          >
            <h2 className="hidden text-[13px] font-semibold lg:block">Prima di pubblicare</h2>
            {bloccanti.length === 0 ? (
              <p className="flex items-start gap-2 text-[12.5px] text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {archiviato
                  ? "Il prodotto è archiviato: rimettilo in bozza per pubblicarlo."
                  : vecchio
                    ? "Prima usa questo prodotto dal vecchio catalogo."
                    : "Tutto a posto: puoi pubblicare."}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5" aria-label="Cose da sistemare">
                {bloccanti.map((v, k) => (
                  <li key={`${v.campo}-${k}`}>
                    <VoceLink voce={v} tono="blocco" vai={() => vaiA(v)} />
                  </li>
                ))}
              </ul>
            )}
            {informativi.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                <h3 className="text-[12px] font-semibold text-muted-foreground">
                  Da sapere (non ferma la pubblicazione)
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {informativi.map((v, k) => (
                    <li key={`${v.campo}-${k}`}>
                      <VoceLink voce={v} tono="info" vai={() => vaiA(v)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* ── Le undici sezioni ── */}
        <div className="flex min-w-0 flex-col gap-2 lg:col-start-1 lg:row-start-1">
          {sezione(
            "identita",
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">{testo("nome", "Nome", { max: 120 })}</div>
              <Campo k="tipo" etichetta="Tipo" {...mostra("tipo")}>
                {(p) => (
                  <select
                    {...p}
                    value={modulo.tipo}
                    onChange={(e) => cambia({ tipo: e.target.value as Modulo["tipo"] })}
                    className={campo}
                  >
                    <option value="patch">Patch</option>
                    <option value="cura">Cura</option>
                    <option value="kit">Kit</option>
                  </select>
                )}
              </Campo>
              {testo("marca", "Marca")}
              <Campo
                k="sku"
                etichetta="SKU"
                aiuto={
                  dati.prodotto.pubblicatoIl
                    ? "Già pubblicato: lo SKU non si cambia più."
                    : "Maiuscolo, senza spazi (per esempio HG-T01). È il codice che usano le vendite e le piattaforme."
                }
                {...mostra("sku")}
              >
                {(p) => (
                  <input
                    {...p}
                    value={modulo.sku}
                    disabled={!!dati.prodotto.pubblicatoIl}
                    autoCapitalize="characters"
                    onChange={(e) => cambia({ sku: e.target.value.toUpperCase() })}
                    className={campo}
                  />
                )}
              </Campo>
              <Campo
                k="slug"
                etichetta="Indirizzo"
                aiuto={
                  dati.prodotto.pubblicatoIl
                    ? "Già pubblicato: l'indirizzo non si cambia più, i link condivisi funzionano."
                    : `Nel sito: /shop/prodotto/${modulo.slug || "…"}`
                }
                {...mostra("slug")}
              >
                {(p) => (
                  <div className="flex gap-2">
                    <input
                      {...p}
                      value={modulo.slug}
                      disabled={!!dati.prodotto.pubblicatoIl}
                      onChange={(e) => cambia({ slug: e.target.value.toLowerCase() })}
                      className={campo}
                    />
                    {!dati.prodotto.pubblicatoIl && (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(tastoGrande, "shrink-0")}
                        onClick={() => cambia({ slug: slugDa(modulo.nome) })}
                      >
                        Dal nome
                      </Button>
                    )}
                  </div>
                )}
              </Campo>
            </div>,
          )}
          {sezione(
            "categorie",
            <fieldset
              id={idCampo("categoria")}
              tabIndex={-1}
              className="flex flex-col gap-1 outline-none"
            >
              <legend className="mb-1 text-[12.5px] text-muted-foreground">
                Scegli almeno una categoria: il prodotto si trova lì nel sito.
              </legend>
              {categorieErrore && (
                <p role="alert" className="text-[12.5px] text-rose-800">
                  {categorieErrore}
                </p>
              )}
              {elencoCategorie === null && !categorieErrore && (
                <p role="status" className="text-[12.5px] text-muted-foreground">
                  Carico le categorie…
                </p>
              )}
              {elencoCategorie?.length === 0 && (
                <p className="text-[12.5px]">
                  Non c'è ancora nessuna categoria: creala sotto l'elenco dei prodotti, in
                  «Categorie».
                </p>
              )}
              {elencoCategorie?.map((k) => (
                <label
                  key={k.id}
                  className="flex min-h-11 items-center gap-3 rounded-md px-1 text-[13px] md:min-h-9"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[color:var(--primary)]"
                    checked={dati.categorie.includes(k.id)}
                    disabled={salvandoCategorie || spento}
                    onChange={(e) => void scegliCategoria(k.id, e.target.checked)}
                  />
                  {k.nome}
                </label>
              ))}
            </fieldset>,
          )}
          {sezione(
            "descrizione",
            <div className="flex flex-col gap-3">
              {testo("rigaPresentazione", "Riga di presentazione", {
                max: 90,
                aiuto: "Una frase sotto il nome.",
              })}
              {testo("descrizioneBreve", "Descrizione breve (obbligatoria)", {
                max: 300,
                area: true,
                righe: 3,
                aiuto: "Si legge in elenco e nella scheda.",
              })}
              {testo("descrizioneLunga", "Descrizione lunga", { area: true, righe: 6 })}
              {testo("perChi", "Per chi è", { max: 200 })}
            </div>,
          )}
          {sezione(
            "caratteristiche",
            <Caratteristiche
              modulo={modulo}
              cambia={cambia}
              errore={errori.caratteristiche}
              avvisi={avvisi.caratteristiche?.avvisi ?? []}
            />,
          )}
          {sezione(
            "prezzo",
            senzaPrezzo ? (
              <p className="text-[13px]">
                Invisible Derm non ha un prezzo nello shop: il costo si vede in consulenza.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Campo
                  k="prezzo"
                  etichetta="Prezzo in euro"
                  aiuto="Il prezzo di ogni variante, se è diverso, si scrive nelle varianti. Vuoto = vale questo."
                  {...mostra("prezzo")}
                >
                  {(p) => (
                    <input
                      {...p}
                      inputMode="decimal"
                      value={modulo.prezzo}
                      onChange={(e) => cambia({ prezzo: e.target.value })}
                      placeholder="19,90"
                      className={cn(campo, "md:max-w-48")}
                    />
                  )}
                </Campo>
                {pubblicato && (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[12.5px] text-muted-foreground">
                      Sul sito ora:{" "}
                      <strong className="text-foreground">
                        € {prezzoInTesto(prezzoVivo) || "0,00"}
                      </strong>
                    </p>
                    <Button
                      type="button"
                      className={tastoGrande}
                      disabled={
                        spento || centDaEuro(modulo.prezzo) === prezzoVivo || !!errori.prezzo
                      }
                      onClick={() => void applicaPrezzo()}
                    >
                      Applica il nuovo prezzo
                    </Button>
                  </div>
                )}
              </div>
            ),
            true,
          )}
          {sezione(
            "varianti",
            <EditorVarianti
              prodotto={{
                id,
                sku: dati.prodotto.sku,
                nome: modulo.nome,
                prezzoCent: prezzoPerVarianti,
                pubblicato,
                versione: versione.current,
              }}
              varianti={dati.varianti}
              esegui={negozio.esegui}
              aggiorna={rileggi}
            />,
            true,
          )}
          {sezione(
            "foto",
            <EditorMedia
              prodotto={{ id, nome: modulo.nome, pubblicato }}
              media={dati.media}
              esegui={negozio.esegui}
              aggiorna={rileggi}
            />,
            true,
          )}
          {sezione(
            "uso",
            <div className="flex flex-col gap-3">
              {lista("passi", "Come si usa", "Un passo per riga.")}
              {lista("confezione", "Nella confezione", "Una voce per riga.")}
              {lista("avvertenze", "Avvertenze", "Una per riga.")}
              <Domande
                modulo={modulo}
                cambia={cambia}
                errore={errori.faq}
                avvisi={avvisi.faq?.avvisi ?? []}
              />
            </div>,
          )}
          {sezione(
            "reso",
            <div className="grid gap-3 md:grid-cols-2">
              <Campo k="reso" etichetta="Reso" {...mostra("reso")}>
                {(p) => (
                  <select
                    {...p}
                    value={modulo.reso}
                    onChange={(e) => cambia({ reso: e.target.value as Modulo["reso"] })}
                    className={campo}
                  >
                    <option value="">Non deciso</option>
                    <option value="si">Si può rendere</option>
                    <option value="no">Non si rende</option>
                  </select>
                )}
              </Campo>
              <Campo k="resoGiorni" etichetta="Giorni per il reso" {...mostra("resoGiorni")}>
                {(p) => (
                  <input
                    {...p}
                    inputMode="numeric"
                    disabled={modulo.reso !== "si"}
                    value={modulo.resoGiorni}
                    onChange={(e) => cambia({ resoGiorni: e.target.value })}
                    className={campo}
                  />
                )}
              </Campo>
              <div className="md:col-span-2">
                <Campo
                  k="boxConsulenza"
                  etichetta="Box «consulenza»"
                  aiuto="Si mostra solo sulle patch."
                  {...mostra("boxConsulenza")}
                >
                  {(p) => (
                    <label className="flex min-h-11 items-center gap-3 text-[13px] md:min-h-9">
                      <Switch
                        id={p.id}
                        aria-describedby={p["aria-describedby"]}
                        checked={modulo.boxConsulenza}
                        onCheckedChange={(x) => cambia({ boxConsulenza: x })}
                      />
                      {modulo.boxConsulenza ? "Acceso" : "Spento"}
                    </label>
                  )}
                </Campo>
              </div>
              <div className="md:col-span-2">
                <Campo
                  k="correlatoId"
                  etichetta="«Ti serve anche»"
                  aiuto="Un altro prodotto da proporre insieme (al massimo uno)."
                  {...mostra("correlatoId")}
                >
                  {(p) => (
                    <select
                      {...p}
                      value={modulo.correlatoId}
                      onChange={(e) => cambia({ correlatoId: e.target.value })}
                      className={campo}
                    >
                      <option value="">Nessuno</option>
                      {negozio.prodotti
                        .filter(
                          (r) => r.id !== id && r.stato !== "archiviato" && r.origine !== "codice",
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                    </select>
                  )}
                </Campo>
              </div>
              <p
                id={idCampo("spedizione")}
                className="text-[12.5px] text-muted-foreground md:col-span-2"
              >
                Costo e tempi di spedizione si impostano insieme alla cassa: non servono per
                pubblicare adesso.
              </p>
            </div>,
          )}
          {sezione(
            "canali",
            <fieldset
              id={idCampo("canali")}
              tabIndex={-1}
              className="flex flex-col gap-1 outline-none"
            >
              <legend className="mb-1 text-[12.5px] text-muted-foreground">
                Accendi almeno un canale.
              </legend>
              {(
                [
                  ["sito", "Sito"],
                  ["meta", "Meta (Facebook e Instagram)"],
                  ["google", "Google Merchant"],
                  ["tiktok", "TikTok"],
                ] as const
              ).map(([c, nome]) => (
                <label
                  key={c}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-md px-1 text-[13px] md:min-h-9"
                >
                  {nome}
                  <Switch
                    checked={modulo.canali[c]}
                    onCheckedChange={(x) => cambia({ canali: { ...modulo.canali, [c]: x } })}
                    aria-label={nome}
                  />
                </label>
              ))}
            </fieldset>,
          )}
          {sezione(
            "ricerca",
            <div className="flex flex-col gap-3">
              {testo("seoTitolo", "Titolo per Google", {
                max: 60,
                aiuto: "Oltre 60 segni Google lo taglia. Vuoto = si usa il nome.",
              })}
              {testo("seoDescrizione", "Descrizione per Google", {
                max: 155,
                area: true,
                righe: 3,
                aiuto: "Oltre 155 segni Google la taglia.",
              })}
            </div>,
          )}
        </div>
      </div>

      {/* ── Telefono: la barra fissa ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
        {barra}
      </div>

      {/* ── Anteprima ── */}
      <Dialog open={anteprima !== null} onOpenChange={(v) => !v && setAnteprima(null)}>
        <DialogContent className="crm-theme max-h-[92vh] max-w-[96vw] overflow-auto bg-white text-foreground md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Anteprima della bozza</DialogTitle>
            <DialogDescription>
              Mostra ciò che hai salvato, come lo vedrebbe un cliente. Non è ancora sul sito.
            </DialogDescription>
          </DialogHeader>
          {anteprima && (
            <AnteprimaVista
              url={anteprima.url}
              vista={anteprima.vista}
              cambia={(vista) => setAnteprima({ ...anteprima, vista })}
            />
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={tastoGrande}
              onClick={() => setAnteprima(null)}
            >
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archivia ── */}
      <Dialog open={archivia} onOpenChange={(v) => !v && !occupato && setArchivia(false)}>
        <DialogContent className="crm-theme bg-white text-foreground">
          <DialogHeader>
            <DialogTitle>Archiviare «{dati.prodotto.nome}»?</DialogTitle>
            <DialogDescription>
              Sparisce dal sito e dall'elenco normale. Non si cancella niente: lo ritrovi in «Tutti»
              e lo puoi rimettere in bozza.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className={tastoGrande}
              disabled={occupato}
              onClick={() => setArchivia(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              className={tastoGrande}
              disabled={occupato}
              onClick={() => void cambiaStato("archiviato")}
            >
              Archivia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══ PEZZI PICCOLI ══════════════════════════════════════════════════════════ */

function Sezione({
  id,
  titolo,
  segno,
  aperta,
  alterna,
  subito,
  children,
}: {
  id: SezioneId;
  titolo: string;
  segno: { tono: "ok" | "da_sistemare" | "da_controllare"; testo: string };
  aperta: boolean;
  alterna: () => void;
  subito?: boolean;
  children: ReactNode;
}) {
  const Icona =
    segno.tono === "ok" ? CheckCircle2 : segno.tono === "da_sistemare" ? AlertTriangle : Info;
  return (
    <section className="rounded-xl border border-border bg-card">
      <h2 className="m-0">
        <button
          type="button"
          id={`sez-${id}`}
          aria-expanded={aperta}
          aria-controls={`pan-${id}`}
          onClick={alterna}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">
            {titolo}
            {subito && (
              <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
                si applica subito
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                segno.tono === "ok" && "bg-emerald-50 text-emerald-900",
                segno.tono === "da_sistemare" && "bg-rose-50 text-rose-900",
                segno.tono === "da_controllare" && "bg-amber-50 text-amber-900",
              )}
            >
              <Icona className="h-3 w-3" aria-hidden="true" />
              {segno.testo}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform motion-reduce:transition-none",
                aperta && "rotate-180",
              )}
              aria-hidden="true"
            />
          </span>
        </button>
      </h2>
      <div id={`pan-${id}`} hidden={!aperta} className="border-t border-border p-3 md:p-4">
        {children}
      </div>
    </section>
  );
}

function VoceLink({ voce, tono, vai }: { voce: Voce; tono: "blocco" | "info"; vai: () => void }) {
  return (
    <button
      type="button"
      onClick={vai}
      className={cn(
        "flex min-h-11 w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-[12.5px] leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tono === "blocco"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {tono === "blocco" ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">{voce.frase}</span>
      <span className="flex shrink-0 items-center gap-0.5 font-medium">
        Vai
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}

/** Un campo con etichetta, aiuto, contatore, errore e avvisi, collegati al controllo con `aria-describedby`. */
function Campo({
  k,
  etichetta,
  aiuto,
  contatore,
  errore,
  avvisi,
  children,
}: {
  k: CampoModulo;
  etichetta: string;
  aiuto?: string;
  contatore?: { n: number; max: number };
  errore?: string;
  avvisi?: string[];
  children: (p: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
  }) => ReactNode;
}) {
  const id = idCampo(k);
  const descr =
    [aiuto && `${id}-aiuto`, errore && `${id}-errore`, avvisi?.length && `${id}-avvisi`]
      .filter(Boolean)
      .join(" ") || undefined;
  const troppo = contatore ? contatore.n > contatore.max : false;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium">
          {etichetta}
        </label>
        {contatore && (
          <span
            className={cn(
              "text-[11.5px] tabular-nums",
              troppo ? "font-semibold text-rose-800" : "text-muted-foreground",
            )}
          >
            {contatore.n}/{contatore.max}
          </span>
        )}
      </div>
      {children({ id, "aria-describedby": descr, "aria-invalid": !!errore })}
      {aiuto && (
        <p id={`${id}-aiuto`} className="text-[12px] text-muted-foreground">
          {aiuto}
        </p>
      )}
      {errore && (
        <p
          id={`${id}-errore`}
          role="alert"
          className="flex items-start gap-1.5 text-[12.5px] text-rose-800"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {errore}
        </p>
      )}
      {avvisi && avvisi.length > 0 && (
        <ul id={`${id}-avvisi`} className="flex flex-col gap-0.5">
          {avvisi.map((a) => (
            <li key={a} className="flex items-start gap-1.5 text-[12.5px] text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Caratteristiche({
  modulo,
  cambia,
  errore,
  avvisi,
}: {
  modulo: Modulo;
  cambia: (p: Partial<Modulo>) => void;
  errore?: string;
  avvisi: string[];
}) {
  const righe = modulo.caratteristiche;
  const imposta = (k: number, p: Partial<Modulo["caratteristiche"][number]>) =>
    cambia({ caratteristiche: righe.map((r, i) => (i === k ? { ...r, ...p } : r)) });
  return (
    <div id={idCampo("caratteristiche")} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <p className="text-[12.5px] text-muted-foreground">
        Le righe «da confermare» non si mostrano mai ai clienti. Per confermarne una serve la fonte
        (la scheda del fornitore).
      </p>
      {righe.length === 0 && (
        <p className="text-[12.5px]">Non c'è ancora nessuna caratteristica.</p>
      )}
      {righe.map((r, k) => (
        <div
          key={k}
          className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2.5 md:grid-cols-[1fr_1fr_11rem_1fr_auto] md:items-end"
        >
          <label className="flex flex-col gap-1 text-[12px] font-medium">
            Nome
            <input
              value={r.etichetta}
              onChange={(e) => imposta(k, { etichetta: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">
            Valore
            <input
              value={r.valore}
              onChange={(e) => imposta(k, { valore: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">
            Stato
            <select
              value={r.stato}
              onChange={(e) =>
                imposta(k, { stato: e.target.value as "confermato" | "da_confermare" })
              }
              className={campo}
            >
              <option value="da_confermare">Da confermare</option>
              <option value="confermato">Confermata</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">
            Fonte
            <input
              value={r.fonte ?? ""}
              onChange={(e) => imposta(k, { fonte: e.target.value })}
              className={campo}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className={tastoGrande}
            onClick={() => cambia({ caratteristiche: righe.filter((_, i) => i !== k) })}
          >
            Togli la riga
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          className={tastoGrande}
          onClick={() =>
            cambia({
              caratteristiche: [
                ...righe,
                { etichetta: "", valore: "", stato: "da_confermare", fonte: null },
              ],
            })
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Aggiungi una caratteristica
        </Button>
      </div>
      {errore && (
        <p role="alert" className="text-[12.5px] text-rose-800">
          {errore}
        </p>
      )}
      {avvisi.map((a) => (
        <p key={a} className="text-[12.5px] text-amber-900">
          {a}
        </p>
      ))}
    </div>
  );
}

function Domande({
  modulo,
  cambia,
  errore,
  avvisi,
}: {
  modulo: Modulo;
  cambia: (p: Partial<Modulo>) => void;
  errore?: string;
  avvisi: string[];
}) {
  const righe = modulo.faq;
  const imposta = (k: number, p: Partial<{ d: string; r: string }>) =>
    cambia({ faq: righe.map((f, i) => (i === k ? { ...f, ...p } : f)) });
  return (
    <div id={idCampo("faq")} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <h3 className="text-[12.5px] font-medium">Domande frequenti</h3>
      {righe.map((f, k) => (
        <div key={k} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
          <label className="flex flex-col gap-1 text-[12px] font-medium">
            Domanda
            <input
              value={f.d}
              onChange={(e) => imposta(k, { d: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium">
            Risposta
            <textarea
              rows={3}
              value={f.r}
              onChange={(e) => imposta(k, { r: e.target.value })}
              className={cn(campo, "py-2")}
            />
          </label>
          <div>
            <Button
              type="button"
              variant="outline"
              className={tastoGrande}
              onClick={() => cambia({ faq: righe.filter((_, i) => i !== k) })}
            >
              Togli la domanda
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          className={tastoGrande}
          onClick={() => cambia({ faq: [...righe, { d: "", r: "" }] })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Aggiungi una domanda
        </Button>
      </div>
      {errore && (
        <p role="alert" className="text-[12.5px] text-rose-800">
          {errore}
        </p>
      )}
      {avvisi.map((a) => (
        <p key={a} className="text-[12.5px] text-amber-900">
          {a}
        </p>
      ))}
    </div>
  );
}

/** L'anteprima: un riquadro a 390 px (telefono) o a 1440 px rimpicciolito per entrare nella finestra (computer). */
function AnteprimaVista({
  url,
  vista,
  cambia,
}: {
  url: string;
  vista: "telefono" | "computer";
  cambia: (v: "telefono" | "computer") => void;
}) {
  const larghezza = vista === "telefono" ? 390 : 1440;
  const altezza = vista === "telefono" ? 720 : 900;
  const disponibile = Math.min(typeof window === "undefined" ? 1000 : window.innerWidth, 920) - 64;
  const scala = Math.min(1, disponibile / larghezza);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Come guardarla">
        {(
          [
            ["telefono", "Telefono (390 px)"],
            ["computer", "Computer (1440 px)"],
          ] as const
        ).map(([v, nome]) => (
          <Button
            key={v}
            type="button"
            variant={vista === v ? "default" : "outline"}
            aria-pressed={vista === v}
            className={tastoGrande}
            onClick={() => cambia(v)}
          >
            {nome}
          </Button>
        ))}
      </div>
      <div
        className="mx-auto overflow-hidden rounded-lg border border-border"
        style={{ width: larghezza * scala, height: altezza * scala }}
      >
        <iframe
          key={vista}
          title={`Anteprima della bozza, vista ${vista}`}
          src={url}
          referrerPolicy="no-referrer"
          style={{
            width: larghezza,
            height: altezza,
            transform: `scale(${scala})`,
            transformOrigin: "0 0",
            border: 0,
          }}
        />
      </div>
    </div>
  );
}
