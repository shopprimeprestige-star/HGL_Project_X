/** ── LE CATEGORIE (Categorie.tsx) ────────────────────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T17 (Design §4.10.5, D36). Sta sotto l'elenco dei prodotti, nella linguetta «Prodotti».
 *  Elenco ordinabile con frecce da 44 px: nome, indirizzo (bloccato dopo la pubblicazione), frase, foto, visibile sì/no,
 *  «n prodotti pubblicati» e «Nascosta dal sito» se la categoria non si vede. NESSUNA cancellazione: una categoria si nasconde.
 *
 *  ── COSA STA DOVE ───────────────────────────────────────────────────────────
 *  Le regole senza schermo (lettura dell'elenco, spostamento, perché è nascosta, le tre misure della foto, il corpo delle
 *  azioni) sono in `categorie-puro.ts` e si provano da sole. Le letture e le scritture passano da `negozio`; l'unica
 *  eccezione è il permesso per caricare la foto (`chiediPermesso`, con `fetchCRM`) e il caricamento stesso, che va allo Storage
 *  con l'indirizzo firmato SENZA il gettone del CRM. Il ridimensionamento è quello di T13 (`ridimensiona.ts`): qui c'è solo
 *  la porta del canvas, cioè il pennello del browser.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Una lettura che fallisce NON svuota l'elenco: resta l'ultima lettura buona con l'errore accanto e «Riprova». Senza permesso
 *    o sessione non si disegna niente (l'elenco dei prodotti lo dice già).
 *  · Conflitto di versione (409): si dice che un'altra persona ha cambiato la categoria, si rilegge, si riprova a mano.
 *  · S1 assente («migrazione»): è una cosa da fare, non un guasto.
 *  · L'indirizzo non si cambia più dopo la pubblicazione (i link già condivisi smetterebbero di funzionare).
 *  · La foto vuole la descrizione per chi non la vede; parte in tre misure, mai l'originale. Un file già caricato non si
 *    ricarica se si riprova (la ripresa tiene i percorsi); i file caricati e mai agganciati restano nello Storage.
 *  ⚠️ Nessun log da qui, mai.
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `negozio`  `Pick<Negozio, "categorie" | "esegui">`.
 *   · `cambiate` da chiamare dopo ogni modifica riuscita: l'elenco dei prodotti rilegge i nomi per il suo filtro. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Lock, Pencil, Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chip, Vuoto } from "@/crm/ui";
import { fetchCRM } from "@/crm/AuthContext";
import { Avviso } from "@/crm/ecommerce/Avviso";
import { caricaConPermesso, chiediPermesso, type ErroreNegozio } from "@/crm/negozio/client";
import { controllaFile, disegnaMisure, pianoFoto, type Piano, type PortaCanvas } from "@/crm/negozio/ridimensiona";
import { slugDa, TETTI } from "@/shop/cms/modello";
import {
  ETICHETTA_NASCOSTA,
  MAX_FRASE,
  MAX_NOME,
  assegnaPercorsi,
  corpoFoto,
  corpoSalva,
  fraseProdotti,
  leggiCategorie,
  motivoNascosta,
  spostaId,
  urlFoto,
  type CategoriaVista,
} from "./categorie-puro";
import type { Negozio } from "./tipi";

export interface PropsCategorie {
  negozio: Pick<Negozio, "categorie" | "esegui">;
  cambiate: () => void;
}

type Esegui = Negozio["esegui"];
/** Dove stanno le foto pubbliche (`…/storage/v1/object/public/shop-media`). Senza, si vede un riquadro al posto della miniatura. */
const BASE_FOTO = import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL as string}/storage/v1/object/public/shop-media` : undefined;

interface Lettura {
  elenco: CategoriaVista[] | null;
  errore: ErroreNegozio | null;
  letto: boolean;
}
interface Esito {
  tono: "ok" | "errore";
  testo: string;
}

const tastoRiprova = (riprova: () => void) => (
  <Button size="sm" variant="outline" className="h-11 text-[12px] md:h-8" onClick={riprova}>
    Riprova
  </Button>
);

/** Le frasi dei fallimenti di un'azione sulle categorie, nostre dove il client ne dice una sbagliata per le categorie. */
function fraseErrore(e: ErroreNegozio): string {
  if (e.tipo === "conflitto") return "Un'altra persona ha cambiato questa categoria nel frattempo: ho aggiornato l'elenco. Controlla e riprova.";
  return e.messaggio;
}

export function Categorie({ negozio, cambiate }: PropsCategorie) {
  const { categorie, esegui } = negozio;
  const [lettura, setLettura] = useState<Lettura>({ elenco: null, errore: null, letto: false });
  const [esito, setEsito] = useState<Esito | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [annuncio, setAnnuncio] = useState("");
  const [finestra, setFinestra] = useState<{ id: string | null } | null>(null);
  const sequenza = useRef(0);
  const vivo = useRef(true);
  const fuoco = useRef<string | null>(null);

  const carica = useCallback(async () => {
    const n = ++sequenza.current;
    const r = await categorie();
    if (!vivo.current || n !== sequenza.current) return;
    if (!r.ok) {
      const negato = r.errore.tipo === "permesso" || r.errore.tipo === "sessione";
      setLettura((p) => ({ ...p, elenco: negato ? null : p.elenco, errore: r.errore, letto: true }));
      return;
    }
    const elenco = leggiCategorie(r.dati);
    setLettura((p) =>
      elenco
        ? { elenco, errore: null, letto: true }
        : { ...p, errore: { tipo: "server", messaggio: "Non capisco la risposta del server: riprova tra un momento." }, letto: true },
    );
  }, [categorie]);

  useEffect(() => {
    vivo.current = true;
    void carica();
    return () => {
      vivo.current = false;
    };
  }, [carica]);

  //  Dopo uno spostamento il fuoco torna sul tasto premuto (o sull'altra freccia, se la riga è arrivata al bordo).
  useEffect(() => {
    const id = fuoco.current;
    if (!id) return;
    fuoco.current = null;
    const el = document.getElementById(id) as HTMLButtonElement | null;
    (el && !el.disabled ? el : document.getElementById(id.replace(/-(su|giu)-/, (_m, d: string) => (d === "su" ? "-giu-" : "-su-"))))?.focus();
  }, [lettura.elenco]);

  const elenco = lettura.elenco;
  /** Dopo ogni modifica riuscita: si rilegge l'elenco e si avvisa l'elenco dei prodotti. */
  const fatto = useCallback(async () => {
    cambiate();
    await carica();
  }, [cambiate, carica]);

  /** Un'azione dell'elenco (ordine, visibilità). Il conflitto rilegge; lo storico non scritto si dice. */
  async function lancia(azione: string, dati: Record<string, unknown>, annunciata: string) {
    setLavoro(true);
    setEsito(null);
    const r = await esegui(azione, dati);
    if (!vivo.current) return;
    setLavoro(false);
    if (!r.ok) {
      setEsito({ tono: "errore", testo: fraseErrore(r.errore) });
      if (r.errore.tipo === "conflitto" || r.errore.tipo === "rete") await carica();
      return;
    }
    if (r.dati.storico === false && typeof r.dati.avvisoStorico === "string") setEsito({ tono: "errore", testo: r.dati.avvisoStorico });
    setAnnuncio(annunciata);
    await fatto();
  }

  if (!lettura.letto)
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">Carico le categorie…</span>
        {[0, 1].map((i) => (
          <div key={i} aria-hidden="true" className="h-20 animate-pulse rounded-xl border border-border bg-muted/50 motion-reduce:animate-none" />
        ))}
      </div>
    );
  if (!elenco && (lettura.errore?.tipo === "permesso" || lettura.errore?.tipo === "sessione")) return null;
  if (!elenco)
    return lettura.errore?.tipo === "migrazione" ? (
      <Vuoto
        icona={Tags}
        titolo="Le categorie non sono ancora pronte"
        testo={`${lettura.errore.messaggio} Gli ordini e il resto del CRM funzionano come sempre.`}
        azione={tastoRiprova(() => void carica())}
      />
    ) : (
      <Vuoto titolo="Non riesco a leggere le categorie" testo={lettura.errore?.messaggio} azione={tastoRiprova(() => void carica())} />
    );

  const ids = elenco.map((c) => c.id);
  const sposta = (i: number, verso: -1 | 1) => {
    const nuovo = spostaId(ids, i, verso);
    if (!nuovo || lavoro) return;
    fuoco.current = `cat-${verso === -1 ? "su" : "giu"}-${ids[i]}`;
    void lancia("categoria_ordina", { ids: nuovo }, `«${elenco[i].nome}» è in posizione ${i + 1 + verso} su ${elenco.length}.`);
  };
  const corrente = finestra?.id ? (elenco.find((c) => c.id === finestra.id) ?? null) : null;

  return (
    <section aria-labelledby="categorie-titolo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="categorie-titolo" className="text-[15px] font-semibold tracking-tight">
            Categorie
          </h2>
          <p className="text-[12.5px] text-muted-foreground">L&apos;ordine qui è quello del sito. Una categoria non si toglie: si nasconde.</p>
        </div>
        <Button type="button" className="min-h-11 text-[12.5px] sm:min-h-9" onClick={() => setFinestra({ id: null })}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuova categoria
        </Button>
      </div>

      {lettura.errore && <Avviso errore azione={tastoRiprova(() => void carica())}>Non riesco ad aggiornare le categorie: quelle che vedi sono l&apos;ultima lettura buona. {lettura.errore.messaggio}</Avviso>}
      {esito && <Avviso errore={esito.tono === "errore"}>{esito.testo}</Avviso>}
      <p role="status" className="sr-only">
        {annuncio}
      </p>

      {elenco.length === 0 ? (
        <Vuoto
          icona={Tags}
          titolo="Non c'è ancora nessuna categoria."
          testo="Le categorie raggruppano i prodotti sul sito (per esempio «Patch» e «Cura»)."
          azione={
            <Button type="button" className="min-h-11 text-[12.5px] sm:min-h-9" onClick={() => setFinestra({ id: null })}>
              Crea la prima categoria
            </Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {elenco.map((c, i) => {
            const perche = motivoNascosta(c);
            const foto = urlFoto(BASE_FOTO, c.fotoPath);
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      id={`cat-su-${c.id}`}
                      aria-label={`Sposta «${c.nome}» in alto`}
                      disabled={i === 0 || lavoro}
                      onClick={() => sposta(i, -1)}
                      className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      id={`cat-giu-${c.id}`}
                      aria-label={`Sposta «${c.nome}» in basso`}
                      disabled={i === elenco.length - 1 || lavoro}
                      onClick={() => sposta(i, 1)}
                      className="mt-1 flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                    {foto ? (
                      <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-sky-700" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-semibold leading-snug">
                      <span className="break-words">{c.nome}</span>
                      {perche && (
                        <Chip tono="in_sospeso" punto>
                          {ETICHETTA_NASCOSTA}
                        </Chip>
                      )}
                    </p>
                    <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      {c.slugBloccato && <Lock className="h-3 w-3 shrink-0" aria-label="Indirizzo bloccato" />}
                      <span className="break-all">/shop/c/{c.slug}</span>
                    </p>
                    {c.frase && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-foreground/80">{c.frase}</p>}
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                      {fraseProdotti(c.quanti)}
                      {perche && <span> · {perche}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2 sm:justify-end sm:border-0 sm:pt-0">
                  <label className="flex min-h-11 items-center gap-2 text-[12.5px] font-medium">
                    <Switch
                      checked={c.visibile}
                      disabled={lavoro || !c.versione}
                      onCheckedChange={(v) =>
                        void lancia("categoria_visibile", { id: c.id, visibile: v, versione: c.versione }, v ? `«${c.nome}» è visibile.` : `«${c.nome}» è spenta.`)
                      }
                      aria-label={`Mostra «${c.nome}» sul sito`}
                    />
                    Visibile
                  </label>
                  <Button type="button" variant="outline" className="min-h-11 text-[12.5px] sm:min-h-9" onClick={() => setFinestra({ id: c.id })}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Modifica
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {finestra && (finestra.id === null || corrente) && (
        <FinestraCategoria
          // una finestra nuova per ogni categoria aperta: i campi ripartono dai valori letti
          key={finestra.id ?? "nuova"}
          categoria={corrente}
          esegui={esegui}
          fatto={fatto}
          chiudi={() => setFinestra(null)}
          rileggi={carica}
        />
      )}
    </section>
  );
}

/* ══ NOME, INDIRIZZO, FRASE (e la foto, per una categoria che c'è già) ═══════════════════════════ */

function FinestraCategoria({
  categoria,
  esegui,
  fatto,
  chiudi,
  rileggi,
}: {
  categoria: CategoriaVista | null;
  esegui: Esegui;
  fatto: () => Promise<void>;
  chiudi: () => void;
  rileggi: () => Promise<void>;
}) {
  const nuova = categoria === null;
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [slug, setSlug] = useState(categoria?.slug ?? "");
  const [slugToccato, setSlugToccato] = useState(!nuova);
  const [frase, setFrase] = useState(categoria?.frase ?? "");
  //  La versione che la finestra ha visto: si aggiorna solo dopo ciò che la finestra stessa ha scritto (la foto).
  const [versione, setVersione] = useState(categoria?.versione ?? null);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const bloccato = categoria?.slugBloccato ?? false;

  const salva = async () => {
    const corpo = corpoSalva(categoria ? { ...categoria, versione } : null, { nome, slug, frase });
    if ("errore" in corpo) return setErrore(corpo.errore as string);
    setInvio(true);
    setErrore(null);
    const r = await esegui("categoria_salva", corpo);
    setInvio(false);
    if (!r.ok) {
      setErrore(fraseErrore(r.errore));
      if (r.errore.tipo === "conflitto") await rileggi();
      return;
    }
    await fatto();
    chiudi();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !invio && chiudi()}>
      <DialogContent className="crm-theme max-h-[92vh] overflow-y-auto bg-white text-foreground">
        <DialogHeader>
          <DialogTitle>{nuova ? "Nuova categoria" : `Categoria «${categoria.nome}»`}</DialogTitle>
          <DialogDescription>
            {nuova ? "Nasce nascosta: la accendi dall'elenco quando ci sono prodotti da mostrare." : "Nome, indirizzo e frase si salvano con «Salva». La foto si salva da sola con il suo tasto."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            Nome
            <Input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (!slugToccato) setSlug(slugDa(e.target.value));
              }}
              maxLength={MAX_NOME}
              autoComplete="off"
              className="min-h-11 text-[14px] font-normal sm:min-h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            <span className="flex items-center gap-1.5">
              Indirizzo
              {bloccato && <Lock className="h-3 w-3" aria-hidden="true" />}
            </span>
            <span className="flex items-center gap-1 text-[13px] font-normal">
              <span className="shrink-0 text-muted-foreground">/shop/c/</span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase());
                  setSlugToccato(true);
                }}
                disabled={bloccato || invio}
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="categoria-slug-aiuto"
                className="min-h-11 text-[14px] sm:min-h-9"
              />
            </span>
            <span id="categoria-slug-aiuto" className="text-[11.5px] font-normal text-muted-foreground">
              {bloccato ? "L'indirizzo non si cambia più: la categoria è già uscita sul sito e i link condivisi smetterebbero di funzionare." : "Solo lettere minuscole, numeri e trattini. Dopo la pubblicazione non si potrà più cambiare."}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            Frase
            <Textarea value={frase} onChange={(e) => setFrase(e.target.value)} maxLength={MAX_FRASE} rows={2} className="text-[14px] font-normal" />
            <span className="text-[11.5px] font-normal tabular-nums text-muted-foreground">
              {frase.trim().length}/{MAX_FRASE}
            </span>
          </label>
          {errore && (
            <p role="alert" className="text-[12.5px] text-rose-800">
              {errore}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={invio} onClick={chiudi}>
              Chiudi
            </Button>
            <Button type="submit" className="min-h-11 sm:min-h-9" disabled={invio}>
              {invio ? "Salvo…" : nuova ? "Crea la categoria" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
        {categoria ? (
          <FotoCategoria categoria={{ ...categoria, versione }} esegui={esegui} fatto={fatto} nuovaVersione={setVersione} />
        ) : (
          <p className="text-[12px] text-muted-foreground">La foto si aggiunge dopo aver creato la categoria.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ══ LA FOTO DELLA CATEGORIA: TRE MISURE, DAL TELEFONO ═══════════════════════════════════════════ */

/** Il pennello del browser per `disegnaMisure` (T13): un canvas quadrato per misura. Tutta la matematica è in `ridimensiona.ts`. */
const portaCanvas: PortaCanvas = {
  crea(lato) {
    const tela = document.createElement("canvas");
    tela.width = lato;
    tela.height = lato;
    const x = tela.getContext("2d");
    if (!x) throw new Error("Il browser non riesce a preparare la foto: provane un altro.");
    return {
      disegna(sorgente, r, sfondo) {
        x.fillStyle = sfondo;
        x.fillRect(0, 0, lato, lato);
        x.drawImage(sorgente as CanvasImageSource, r.x, r.y, r.lato, r.lato, 0, 0, lato, lato);
      },
      aBlob: (tipo, qualita) => new Promise((ok) => tela.toBlob(ok, tipo, qualita)),
    };
  },
};
/** La `fetch` del browser SENZA il gettone del CRM: il file va allo Storage con il permesso firmato. */
const fetchNudo = (url: string, init?: RequestInit) => window.fetch(url, init); // dentro una funzione: sul server `window` non esiste

interface Scelta {
  bitmap: ImageBitmap;
  piano: Piano;
  anteprima: string;
}

function FotoCategoria({
  categoria,
  esegui,
  fatto,
  nuovaVersione,
}: {
  categoria: CategoriaVista;
  esegui: Esegui;
  fatto: () => Promise<void>;
  nuovaVersione: (v: string | null) => void;
}) {
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [alt, setAlt] = useState("");
  const [fase, setFase] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [avvisi, setAvvisi] = useState<string[]>([]);
  const [salvata, setSalvata] = useState<string | null>(null);
  //  Percorsi già caricati per lato: se si riprova dopo un errore non si ricarica ciò che è già arrivato.
  const caricati = useRef(new Map<number, string>());
  const anteprima = useRef<string | null>(null);
  const attuale = urlFoto(BASE_FOTO, categoria.fotoPath);

  const liberaAnteprima = () => {
    if (anteprima.current) URL.revokeObjectURL(anteprima.current);
    anteprima.current = null;
  };
  useEffect(() => liberaAnteprima, []);

  const scegli = async (file: File | undefined) => {
    if (!file) return;
    setErrore(null);
    setSalvata(null);
    setAvvisi([]);
    const idoneo = controllaFile({ tipo: "foto", mime: file.type, byte: file.size });
    if (!idoneo.ok) return setErrore(idoneo.frase);
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return setErrore("Non riesco a leggere questa foto: provane un'altra.");
    }
    const p = pianoFoto(bitmap.width, bitmap.height);
    if (!p.ok) return setErrore(p.frase);
    liberaAnteprima();
    anteprima.current = URL.createObjectURL(file);
    caricati.current = new Map();
    setScelta({ bitmap, piano: p.piano, anteprima: anteprima.current });
    setAvvisi(p.piano.avvisi.map((a) => a.frase));
  };

  const salva = async () => {
    if (!scelta) return;
    setErrore(null);
    try {
      setFase("Preparo la foto…");
      const file = await disegnaMisure(scelta.bitmap, scelta.piano, portaCanvas);
      const percorsi: string[] = [];
      for (const [i, m] of file.entries()) {
        let path = caricati.current.get(m.lato);
        if (!path) {
          setFase(`Carico la foto ${i + 1} di ${file.length}…`);
          const permesso = await chiediPermesso(fetchCRM, { tipo: "foto", mime: m.blob.type || "image/jpeg", peso: m.blob.size });
          if (!permesso.ok) return fallita(permesso.errore.messaggio);
          const su = await caricaConPermesso(fetchNudo, permesso.permesso, m.blob);
          if (!su.ok) return fallita(su.errore.messaggio);
          path = permesso.permesso.path;
          caricati.current.set(m.lato, path);
        }
        percorsi.push(path);
      }
      const tre = assegnaPercorsi(file, percorsi);
      const corpo = tre ? corpoFoto(categoria, tre, alt) : null;
      if (!corpo) return fallita("La foto non è completa o manca la descrizione: scegli di nuovo la foto e descrivila.");
      setFase("Salvo la foto…");
      const r = await esegui("categoria_foto", corpo);
      if (!r.ok) return fallita(r.errore.tipo === "conflitto" ? "Un'altra persona ha cambiato questa categoria nel frattempo: ho aggiornato l'elenco. Salva di nuovo la foto." : r.errore.messaggio, r.errore.tipo === "conflitto");
      const k = r.dati.categoria as { versione?: unknown } | undefined;
      if (typeof k?.versione === "string") nuovaVersione(k.versione);
      const dette = Array.isArray(r.dati.avvisi) ? (r.dati.avvisi as unknown[]).filter((x): x is string => typeof x === "string") : [];
      setAvvisi([...dette, ...(r.dati.storico === false && typeof r.dati.avvisoStorico === "string" ? [r.dati.avvisoStorico] : [])]);
      setSalvata("Foto salvata.");
      setScelta(null);
      setAlt("");
      liberaAnteprima();
      setFase(null);
      await fatto();
    } catch (e) {
      fallita(e instanceof Error ? e.message : "Non sono riuscito a preparare la foto: provane un'altra.");
    }
  };
  /** Un fallimento: la frase e «Riprova». Con `rileggere` anche l'elenco si aggiorna (e con lui la versione). */
  function fallita(frase: string, rileggere = false) {
    setFase(null);
    setErrore(frase);
    if (rileggere) void fatto();
  }

  const altOk = alt.trim().length > 0 && alt.trim().length <= TETTI.alt;
  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-3" disabled={fase !== null}>
      <legend className="sr-only">Foto della categoria</legend>
      <p className="text-[12.5px] font-medium">Foto della categoria</p>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg ${scelta || attuale ? "border border-border" : "border-2 border-dashed border-sky-400 bg-sky-50"}`}
        >
          {scelta || attuale ? (
            <img src={scelta?.anteprima ?? attuale ?? ""} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-sky-700" aria-hidden="true" />
          )}
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-[12.5px] font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring sm:min-h-9">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => {
              void scegli(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {attuale || scelta ? "Cambia foto" : "+ Carica foto"}
        </label>
      </div>
      {scelta && (
        <label className="flex flex-col gap-1 text-[12.5px] font-medium">
          Descrizione per chi non vede la foto
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={TETTI.alt}
            placeholder="Per esempio: una patch rosa su una mano"
            className="min-h-11 text-[14px] font-normal sm:min-h-9"
          />
          <span className="text-[11.5px] font-normal tabular-nums text-muted-foreground">
            {alt.trim().length}/{TETTI.alt} · obbligatoria
          </span>
        </label>
      )}
      {avvisi.map((a) => (
        <p key={a} className="text-[12.5px] text-amber-900">
          {a}
        </p>
      ))}
      {fase && (
        <p role="status" className="text-[12.5px] text-muted-foreground">
          {fase}
        </p>
      )}
      {salvata && (
        <p role="status" className="text-[12.5px] text-emerald-800">
          {salvata}
        </p>
      )}
      {errore && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-[12.5px] text-rose-800">
          <span className="min-w-0 flex-1">{errore}</span>
          {scelta && (
            <Button type="button" size="sm" variant="outline" className="h-11 text-[12px] md:h-8" onClick={() => void salva()}>
              Riprova
            </Button>
          )}
        </div>
      )}
      {scelta && (
        <div>
          <Button type="button" className="min-h-11 sm:min-h-9" disabled={!altOk || fase !== null} onClick={() => void salva()}>
            Salva la foto
          </Button>
        </div>
      )}
    </fieldset>
  );
}
