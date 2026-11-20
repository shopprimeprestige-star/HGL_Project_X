/** ── FOTO E VIDEO DI UN PRODOTTO (EditorMedia.tsx) · T16 ─────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (Design §4.10.3). Una griglia di SLOT FISSI (2 colonne sul telefono, 4 più in largo): foto
 *  principale*, foto 2-5 con il ruolo, foto di scala, video breve, foto della confezione. Lo usa `SchedaProdotto` (T15).
 *
 *  ── LE PROPS (invariate rispetto al segnaposto di T14) ───────────────────────
 *   · `prodotto`  `{ id, nome, pubblicato }`: il nome precompila la descrizione; `pubblicato` dice «si applica subito».
 *   · `media`     i media della scheda, già senza quelli rimossi.
 *   · `esegui`    `negozio.esegui`: `media_registra`, `media_ordina`, `media_alt`, `media_flag`, `media_rimuovi`.
 *   · `aggiorna`  rilegge la scheda dopo ogni scrittura riuscita.
 *
 *  ── COME FUNZIONA ───────────────────────────────────────────────────────────
 *  1. Si scelgono uno o PIÙ file (galleria o fotocamera). Ognuno diventa una BOZZA nel primo slot libero: anteprima, ritaglio
 *     quadrato spostabile, descrizione per chi non vede (obbligatoria, 0/125, precompilata), ruolo, persone e liberatoria.
 *  2. «Salva» ridimensiona nel browser (le tre misure, mai ingrandite, sfondo bianco, orientamento corretto), chiede un permesso
 *     firmato per ogni misura, invia, e solo alla fine registra. L'ORIGINALE NON ESCE dal browser e il suo nome non si legge mai.
 *  3. Se un passo fallisce si vede dove, e «Riprova» riparte da lì (ciò che è già salito non si rimanda). Al terzo tentativo si
 *     sceglie di nuovo il file: niente ritentativi da soli.
 *  Le regole senza schermo sono in `media-puro.ts`, la parte del canvas e del video in `media-browser.ts`.
 *  «Togli» non cancella: il media si ritira (`media_rimuovi`) e il file resta nello Storage (D5).
 *  ⚠️ Riordino: si scambiano di posto le foto 2-5 con `media_ordina` (campo `ordine`). Frecce (anche col telefono) e trascinamento.
 *  ⚠️ Nessun log da qui, mai. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avviso } from "@/crm/ecommerce/Avviso";
import { fetchCRM } from "@/crm/AuthContext";
import { caricaConPermesso, chiediPermesso, type PermessoCaricamento } from "@/crm/negozio/client";
import {
  controllaFile,
  disegnaMisure,
  pianoFoto,
  type FileMisura,
} from "@/crm/negozio/ridimensiona";
import { cn } from "@/lib/utils";
import type { Media, SottoRuolo } from "@/shop/cms/modello";
import { leggiImmagine, leggiVideo, portaCanvas } from "./media-browser";
import { pulisciVideo, tipoDaFirma } from "./video-pulito";
import {
  GALLERIA,
  MAX_ALT,
  MAX_TENTATIVI,
  RUOLI,
  SLOT_EDITOR,
  altProposto,
  assegnaSlot,
  contaAlt,
  controllaAlt,
  eseguiLavoro,
  fraseInEccesso,
  galleria,
  mediaPerSlot,
  nuovoLavoro,
  ordineSposta,
  ordineTrascina,
  slotLiberiFoto,
  urlMedia,
  type DefSlot,
  type FileDaCaricare,
  type Lavoro,
  type PorteCarico,
  type SlotEditor,
} from "./media-puro";
import type { Negozio } from "./tipi";

export interface PropsEditorMedia {
  prodotto: { id: string; nome: string; pubblicato: boolean };
  media: Media[];
  esegui: Negozio["esegui"];
  aggiorna: () => Promise<void>;
}

/** Lo slot vuoto è AZZURRO e tratteggiato, mai grigio: invita a caricare, non sembra spento. */
const SLOT_VUOTO =
  "flex min-h-44 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50 px-3 py-4 text-sm font-medium text-sky-900 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 motion-reduce:transition-none";
const CAMPO = "w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm";
const ACCETTA_FOTO = "image/jpeg,image/png,image/webp,image/avif";
const BASE_MEDIA = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/shop-media`
  : "";

/** Una foto o un video scelto e non ancora salvato. `file` resta nel browser: al server arrivano solo le misure. */
interface Bozza {
  id: string;
  slot: SlotEditor;
  tipo: "foto" | "video";
  file: File;
  anteprima: string;
  larghezza: number;
  altezza: number;
  punto: { x: number; y: number };
  avvisi: string[];
  alt: string;
  sottoRuolo: SottoRuolo | null;
  ritraePersone: boolean;
  liberatoriaOk: boolean;
  muto: boolean;
  sottotitoliOk: boolean;
  testoParlato: string;
  durataS: number | null;
  copertina: Blob | null;
  /** Solo per il video: i byte SENZA metadati (niente posizione) e col tipo letto dalla firma. È questo che parte, mai `file`. */
  pulito: Blob | null;
  copertinaUrl: string | null;
  /** Il caricamento a passi: ricorda cosa è già salito, per riprendere da dove si è fermato. */
  lavoro: Lavoro | null;
  fase: "pronta" | "in_corso" | "fallita";
  passo: { fatti: number; totale: number };
  frase: string | null;
  definitivo: boolean;
}
type Messaggio = { tono: "ok" | "avviso" | "errore"; testo: string };

const porte = (esegui: Negozio["esegui"]): PorteCarico => ({
  permesso: (f) => chiediPermesso(fetchCRM, f),
  carica: (p, blob) => caricaConPermesso((u, i) => fetch(u, i), p as PermessoCaricamento, blob),
  esegui: (azione, dati) => esegui(azione, dati),
});

export function EditorMedia({ prodotto, media, esegui, aggiorna }: PropsEditorMedia) {
  const [bozze, setBozze] = useState<Bozza[]>([]);
  const [messaggio, setMessaggio] = useState<Messaggio | null>(null);
  const [aperta, setAperta] = useState<string | null>(null);
  const [daTogliere, setDaTogliere] = useState<string | null>(null);
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const conta = useRef(0);
  const bozzeRef = useRef<Bozza[]>([]);
  bozzeRef.current = bozze;
  const inFoto = useRef<HTMLInputElement>(null);
  const inScatta = useRef<HTMLInputElement>(null);
  const inVideo = useRef<HTMLInputElement>(null);
  const inCopertina = useRef<HTMLInputElement>(null);
  const slotScelto = useRef<SlotEditor | null>(null);
  const copertinaDi = useRef<string | null>(null);

  //  Le anteprime sono indirizzi del browser: si rilasciano quando la bozza sparisce o la scheda si chiude.
  useEffect(
    () => () => {
      for (const b of bozzeRef.current) {
        URL.revokeObjectURL(b.anteprima);
        if (b.copertinaUrl) URL.revokeObjectURL(b.copertinaUrl);
      }
    },
    [],
  );

  const perSlot = useMemo(() => mediaPerSlot(media), [media]);
  const agg = (id: string, patch: Partial<Bozza>) =>
    setBozze((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const scarta = (id: string) => {
    const b = bozzeRef.current.find((x) => x.id === id);
    if (b) {
      URL.revokeObjectURL(b.anteprima);
      if (b.copertinaUrl) URL.revokeObjectURL(b.copertinaUrl);
    }
    setBozze((l) => l.filter((x) => x.id !== id));
  };

  /* ── scegliere i file ─────────────────────────────────────────────── */

  async function bozzaFoto(
    file: File,
    slot: SlotEditor,
    n: number,
    rifiuti: string[],
  ): Promise<Bozza | null> {
    const no = (frase: string): null => (rifiuti.push(`Foto ${n}: ${frase}`), null);
    const idoneo = controllaFile({ tipo: "foto", mime: file.type, byte: file.size });
    if (!idoneo.ok) return no(idoneo.frase);
    try {
      const img = await leggiImmagine(file);
      img.chiudi();
      const piano = pianoFoto(img.larghezza, img.altezza);
      if (!piano.ok) return no(piano.frase);
      conta.current++;
      return {
        id: `b${conta.current}`,
        slot,
        tipo: "foto",
        file,
        anteprima: URL.createObjectURL(file),
        larghezza: img.larghezza,
        altezza: img.altezza,
        punto: { x: 0.5, y: 0.5 },
        avvisi: piano.piano.avvisi.map((a) => a.frase),
        alt: altProposto(prodotto.nome, slot, null),
        sottoRuolo: null,
        ritraePersone: false,
        liberatoriaOk: false,
        muto: false,
        sottotitoliOk: false,
        testoParlato: "",
        durataS: null,
        copertina: null,
        pulito: null,
        copertinaUrl: null,
        lavoro: null,
        fase: "pronta",
        passo: { fatti: 0, totale: 0 },
        frase: null,
        definitivo: false,
      };
    } catch (e) {
      return no(e instanceof Error ? e.message : "non riesco a leggerla.");
    }
  }

  async function sceltaFoto(elenco: FileList | null, forzato: SlotEditor | null) {
    const files = Array.from(elenco ?? []);
    if (!files.length) return;
    const occupatiDaBozze = new Set(bozzeRef.current.map((b) => b.slot));
    const liberi = slotLiberiFoto(media).filter((s) => !occupatiDaBozze.has(s));
    const { slot, inEccesso } = forzato
      ? { slot: [forzato], inEccesso: files.length - 1 }
      : assegnaSlot(files.length, liberi);
    const rifiuti: string[] = [];
    const nuove: Bozza[] = [];
    for (const [i, s] of slot.entries()) {
      const b = await bozzaFoto(files[i], s, i + 1, rifiuti);
      if (b) nuove.push(b);
    }
    setBozze((l) => [...l, ...nuove]);
    const avvisi = [
      ...rifiuti,
      ...(inEccesso > 0 ? [fraseInEccesso(slot.length, inEccesso)] : []),
      ...(slot.length === 0 ? ["Non c'è più posto per altre foto: togline una."] : []),
    ];
    setMessaggio(avvisi.length ? { tono: "avviso", testo: avvisi.join(" ") } : null);
  }

  async function sceltaVideo(elenco: FileList | null) {
    const file = elenco?.[0];
    if (!file) return;
    try {
      //  Il tipo si legge dalla FIRMA del file (`ftyp`), non da ciò che dice il browser; peso e tipo si controllano subito, la durata dopo.
      const mime = tipoDaFirma(new Uint8Array(await file.slice(0, 4096).arrayBuffer()));
      const prima = controllaFile({ tipo: "video", mime, byte: file.size, durataS: 1 });
      if (!prima.ok) return setMessaggio({ tono: "errore", testo: prima.frase });
      const v = await leggiVideo(file);
      const idoneo = controllaFile({ tipo: "video", mime, byte: file.size, durataS: v.durataS });
      if (!idoneo.ok) return setMessaggio({ tono: "errore", testo: idoneo.frase });
      //  Fuori la posizione e gli altri dati nascosti: se non si riesce, il video NON si carica.
      const pulito = pulisciVideo(new Uint8Array(await file.arrayBuffer()));
      if (!pulito.ok) return setMessaggio({ tono: "errore", testo: pulito.frase });
      conta.current++;
      const bozza: Bozza = {
        id: `b${conta.current}`,
        slot: "video",
        tipo: "video",
        file,
        anteprima: URL.createObjectURL(file),
        larghezza: 0,
        altezza: 0,
        punto: { x: 0.5, y: 0.5 },
        avvisi: v.copertina
          ? []
          : ["Non sono riuscito a prendere la copertina dal video: puoi sceglierne una tu."],
        alt: altProposto(prodotto.nome, "video", null),
        sottoRuolo: null,
        ritraePersone: false,
        liberatoriaOk: false,
        muto: false,
        sottotitoliOk: false,
        testoParlato: "",
        durataS: v.durataS,
        copertina: v.copertina,
        pulito: new Blob([pulito.dati as BlobPart], { type: pulito.mime }),
        copertinaUrl: v.copertina ? URL.createObjectURL(v.copertina) : null,
        lavoro: null,
        fase: "pronta",
        passo: { fatti: 0, totale: 0 },
        frase: null,
        definitivo: false,
      };
      setBozze((l) => [...l.filter((b) => b.slot !== "video"), bozza]);
      setMessaggio(null);
    } catch (e) {
      setMessaggio({
        tono: "errore",
        testo: e instanceof Error ? e.message : "Non riesco a leggere il video: provane un altro.",
      });
    }
  }

  async function sceltaCopertina(elenco: FileList | null) {
    const file = elenco?.[0];
    const id = copertinaDi.current;
    if (!file || !id) return;
    const idoneo = controllaFile({ tipo: "copertina", mime: file.type, byte: file.size });
    if (!idoneo.ok) return setMessaggio({ tono: "errore", testo: idoneo.frase });
    const vecchia = bozzeRef.current.find((b) => b.id === id)?.copertinaUrl;
    if (vecchia) URL.revokeObjectURL(vecchia);
    agg(id, { copertina: file, copertinaUrl: URL.createObjectURL(file) });
  }

  const scegli = (slot: SlotEditor | null, input: React.RefObject<HTMLInputElement | null>) => {
    slotScelto.current = slot;
    input.current?.click();
  };

  /* ── salvare una bozza ────────────────────────────────────────────── */

  /** Dal file scelto ai blob delle misure (nel browser; l'originale resta qui). */
  async function preparaFile(b: Bozza): Promise<FileDaCaricare[]> {
    const dal = async (sorgente: Blob, punto: { x: number; y: number }): Promise<FileMisura[]> => {
      const img = await leggiImmagine(sorgente);
      try {
        const piano = pianoFoto(img.larghezza, img.altezza, punto);
        if (!piano.ok) throw new Error(piano.frase);
        return await disegnaMisure(img.sorgente, piano.piano, portaCanvas);
      } finally {
        img.chiudi();
      }
    };
    if (b.tipo === "foto") {
      const misure = await dal(b.file, b.punto);
      return misure.map((m) => ({
        chiave: String(m.lato),
        tipo: "foto" as const,
        blob: m.blob,
        mime: "image/jpeg",
        per: m.per,
      }));
    }
    if (!b.pulito)
      throw new Error("Non riesco a preparare questo video: esportalo di nuovo dal telefono.");
    const file: FileDaCaricare[] = [
      { chiave: "video", tipo: "video", blob: b.pulito, mime: b.pulito.type },
    ];
    if (b.copertina) {
      //  shortcut: la copertina si ritaglia al centro e si carica alla misura 960 (un solo file); da rendere spostabile se serve.
      const misure = await dal(b.copertina, { x: 0.5, y: 0.5 });
      const m = misure.find((x) => x.per.includes(960)) ?? misure[misure.length - 1];
      file.push({
        chiave: "copertina",
        tipo: "copertina",
        blob: m.blob,
        mime: "image/jpeg",
        per: [960],
      });
    }
    return file;
  }

  async function salva(b: Bozza) {
    const alt = controllaAlt(b.alt);
    if (!alt.ok) return setMessaggio({ tono: "errore", testo: alt.frase });
    agg(b.id, { fase: "in_corso", frase: null });
    let lavoro = b.lavoro;
    try {
      if (!lavoro) {
        lavoro = nuovoLavoro({
          prodottoId: prodotto.id,
          slot: b.slot,
          sottoRuolo: b.sottoRuolo,
          alt: alt.alt,
          tipo: b.tipo,
          file: await preparaFile(b),
          durataS: b.durataS,
          muto: b.muto,
          testoParlato: b.muto ? null : b.testoParlato,
          ritraePersone: b.ritraePersone,
          liberatoriaOk: b.liberatoriaOk,
          sottotitoliOk: !b.muto && b.sottotitoliOk,
        });
        agg(b.id, { lavoro });
      }
    } catch (e) {
      return agg(b.id, {
        fase: "fallita",
        frase:
          e instanceof Error
            ? e.message
            : "Non sono riuscito a preparare la foto: provane un'altra.",
        definitivo: true,
      });
    }
    const esito = await eseguiLavoro(lavoro, porte(esegui), (fatti, totale) =>
      agg(b.id, { passo: { fatti, totale } }),
    );
    if (!esito.ok)
      return agg(b.id, { fase: "fallita", frase: esito.frase, definitivo: esito.definitivo });
    scarta(b.id);
    setMessaggio(
      esito.avviso
        ? { tono: "avviso", testo: esito.avviso }
        : { tono: "ok", testo: b.tipo === "video" ? "Video salvato." : "Foto salvata." },
    );
    await aggiorna();
  }

  /* ── agire su ciò che c'è già ─────────────────────────────────────── */

  async function azione(nome: string, dati: Record<string, unknown>, ok?: string) {
    setOccupato(true);
    const r = await esegui(nome, { prodottoId: prodotto.id, ...dati });
    setOccupato(false);
    if (!r.ok) {
      setMessaggio({ tono: "errore", testo: r.errore.messaggio });
      return false;
    }
    const avviso = typeof r.dati.avviso === "string" ? r.dati.avviso : null;
    setMessaggio(
      avviso ? { tono: "avviso", testo: avviso } : ok ? { tono: "ok", testo: ok } : null,
    );
    await aggiorna();
    return true;
  }
  /** La descrizione si controlla anche qui, non solo sul tasto: senza una descrizione valida `media_alt` non parte. */
  async function cambiaAlt(mediaId: string, alt: string) {
    const v = controllaAlt(alt);
    if (!v.ok) {
      setMessaggio({ tono: "errore", testo: v.frase });
      return false;
    }
    return azione("media_alt", { mediaId, alt: v.alt }, "Descrizione salvata.");
  }
  const riordina = (ordine: string[] | null) =>
    ordine ? azione("media_ordina", { ordine }) : Promise.resolve(false);

  /* ── la griglia ───────────────────────────────────────────────────── */

  //  Le foto 2-5 si mostrano nel loro ordine (`ordine`), e il numero è la posizione: dopo i media, gli spazi liberi.
  const tessere: { def: DefSlot; etichetta: string; m: Media | null }[] = [];
  for (const def of SLOT_EDITOR) {
    if (!(GALLERIA as readonly string[]).includes(def.slot))
      tessere.push({ def, etichetta: def.etichetta, m: perSlot.get(def.slot) ?? null });
  }
  const galleriaOra = galleria(media);
  const vuoti = SLOT_EDITOR.filter(
    (d) => (GALLERIA as readonly string[]).includes(d.slot) && !perSlot.has(d.slot),
  );
  const dellaGalleria = [
    ...galleriaOra.map((m) => ({ def: SLOT_EDITOR.find((d) => d.slot === m.slot) as DefSlot, m })),
    ...vuoti.map((def) => ({ def, m: null as Media | null })),
  ];
  tessere.splice(1, 0, ...dellaGalleria.map((t, i) => ({ ...t, etichetta: `Foto ${i + 2}` })));

  const pieno = slotLiberiFoto(media).length === 0;
  return (
    <section aria-labelledby="titolo-media" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="titolo-media" className="text-[15px] font-semibold tracking-tight">
            Foto e video
          </h3>
          <p className="text-[12.5px] text-muted-foreground">
            Le foto diventano quadrate e leggere prima di partire: l'originale resta nel tuo
            telefono.
            {prodotto.pubblicato
              ? " Il prodotto è pubblicato: le foto cambiano subito sul sito."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pieno}
            onClick={() => scegli(null, inFoto)}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Aggiungi foto
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pieno}
            onClick={() => scegli(null, inScatta)}
          >
            <Camera className="h-4 w-4" aria-hidden="true" /> Scatta
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => scegli(null, inVideo)}
          >
            <Video className="h-4 w-4" aria-hidden="true" /> Aggiungi video
          </Button>
        </div>
      </div>

      <input
        ref={inFoto}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Scegli le foto"
        onChange={(e) => {
          void sceltaFoto(e.target.files, slotScelto.current);
          e.target.value = "";
        }}
      />
      <input
        ref={inScatta}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Scatta una foto"
        onChange={(e) => {
          void sceltaFoto(e.target.files, null);
          e.target.value = "";
        }}
      />
      <input
        ref={inVideo}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Scegli il video"
        onChange={(e) => {
          void sceltaVideo(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={inCopertina}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Scegli la copertina"
        onChange={(e) => {
          void sceltaCopertina(e.target.files);
          e.target.value = "";
        }}
      />

      <div aria-live="polite">
        {messaggio?.tono === "ok" && (
          <p role="status" className="text-[12.5px] font-medium text-emerald-800">
            {messaggio.testo}
          </p>
        )}
        {messaggio && messaggio.tono !== "ok" && (
          <Avviso errore={messaggio.tono === "errore"}>{messaggio.testo}</Avviso>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tessere.map(({ def, etichetta, m }) => {
          const bozza = bozze.find((b) => b.slot === def.slot);
          const largo = !!bozza || (m !== null && aperta === m.id);
          return (
            <li
              key={m?.id ?? def.slot}
              className={cn("min-w-0", largo && "col-span-2 md:col-span-4")}
              draggable={m !== null && (GALLERIA as readonly string[]).includes(def.slot) && !largo}
              onDragStart={() => m && setTrascinato(m.id)}
              onDragOver={(e) =>
                trascinato &&
                m &&
                (GALLERIA as readonly string[]).includes(def.slot) &&
                e.preventDefault()
              }
              onDrop={() => {
                if (trascinato && m) void riordina(ordineTrascina(media, trascinato, m.id));
                setTrascinato(null);
              }}
              onDragEnd={() => setTrascinato(null)}
            >
              {bozza ? (
                <PannelloBozza
                  def={def}
                  etichetta={etichetta}
                  nome={prodotto.nome}
                  b={bozza}
                  agg={(p) => agg(bozza.id, p)}
                  salva={() => void salva(bozza)}
                  scarta={() => scarta(bozza.id)}
                  cambiaCopertina={() => {
                    copertinaDi.current = bozza.id;
                    inCopertina.current?.click();
                  }}
                />
              ) : m ? (
                <TesseraMedia
                  def={def}
                  etichetta={etichetta}
                  m={m}
                  occupato={occupato}
                  aperta={aperta === m.id}
                  daTogliere={daTogliere === m.id}
                  eGalleria={(GALLERIA as readonly string[]).includes(def.slot)}
                  prima={ordineSposta(media, m.id, -1) !== null}
                  dopo={ordineSposta(media, m.id, 1) !== null}
                  apri={() => setAperta(aperta === m.id ? null : m.id)}
                  sposta={(v) => void riordina(ordineSposta(media, m.id, v))}
                  sostituisci={() => scegli(def.slot, def.tipo === "video" ? inVideo : inFoto)}
                  chiediToglierla={() => setDaTogliere(m.id)}
                  annullaTogli={() => setDaTogliere(null)}
                  togli={async () => {
                    setDaTogliere(null);
                    await azione("media_rimuovi", { mediaId: m.id }, "Tolta dal prodotto.");
                  }}
                  salvaAlt={(alt) => cambiaAlt(m.id, alt)}
                  flag={(f) => azione("media_flag", { mediaId: m.id, flag: f })}
                />
              ) : (
                <button
                  type="button"
                  className={SLOT_VUOTO}
                  onClick={() => scegli(def.slot, def.tipo === "video" ? inVideo : inFoto)}
                  aria-label={`${etichetta}: carica`}
                >
                  <span className="text-base font-semibold">+ Carica</span>
                  <span className="text-[13px]">
                    {etichetta}
                    {def.obbligatorio && <span aria-hidden="true"> *</span>}
                  </span>
                  {def.obbligatorio && <span className="sr-only">(obbligatoria)</span>}
                  {def.aiuto && (
                    <span className="text-[12px] font-normal text-sky-900">{def.aiuto}</span>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ═══ una bozza: anteprima, ritaglio, descrizione, e il caricamento ═══════════════════ */

function Campo({
  id,
  etichetta,
  aiuto,
  children,
}: {
  id: string;
  etichetta: string;
  aiuto?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {etichetta}
      </label>
      {children}
      {aiuto && <p className="text-[12px] text-muted-foreground">{aiuto}</p>}
    </div>
  );
}

function Interruttore({
  id,
  etichetta,
  valore,
  cambia,
  spento,
}: {
  id: string;
  etichetta: string;
  valore: boolean;
  cambia: (v: boolean) => void;
  spento?: boolean;
}) {
  //  Tutta la riga è l'etichetta: si tocca ovunque, non solo sull'interruttore (che è piccolo).
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-[13px]"
    >
      <span>{etichetta}</span>
      <Switch id={id} checked={valore} onCheckedChange={cambia} disabled={spento} />
    </label>
  );
}

function PannelloBozza({
  def,
  etichetta,
  nome,
  b,
  agg,
  salva,
  scarta,
  cambiaCopertina,
}: {
  def: DefSlot;
  etichetta: string;
  nome: string;
  b: Bozza;
  agg: (p: Partial<Bozza>) => void;
  salva: () => void;
  scarta: () => void;
  cambiaCopertina: () => void;
}) {
  const verifica = controllaAlt(b.alt);
  const altOk = verifica.ok;
  const inCorso = b.fase === "in_corso";
  const asse = b.larghezza > b.altezza ? "x" : b.altezza > b.larghezza ? "y" : null;
  const p = b.punto;
  const pct = b.passo.totale ? Math.round((b.passo.fatti / b.passo.totale) * 100) : 0;
  const id = `bozza-${b.id}`;
  return (
    <div className="space-y-3 rounded-xl border border-sky-300 bg-sky-50/50 p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[14px] font-semibold">
          {etichetta}
          {def.obbligatorio && <span aria-hidden="true"> *</span>}
        </h4>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900">
          Non ancora salvata
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_1fr]">
        <div className="space-y-2">
          {b.tipo === "foto" ? (
            <div className="aspect-square w-full max-w-64 overflow-hidden rounded-lg bg-white ring-1 ring-sky-200">
              <img
                src={b.anteprima}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: `${p.x * 100}% ${p.y * 100}%` }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <video
                src={b.anteprima}
                controls
                muted
                playsInline
                preload="metadata"
                className="max-h-64 w-full rounded-lg bg-white ring-1 ring-sky-200"
              />
              <div className="flex items-center gap-3">
                {b.copertinaUrl ? (
                  <img
                    src={b.copertinaUrl}
                    alt="La copertina scelta"
                    className="h-16 w-16 rounded-md object-cover ring-1 ring-sky-200"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={inCorso}
                  onClick={cambiaCopertina}
                >
                  Cambia copertina
                </Button>
              </div>
              {b.durataS !== null && (
                <p className="text-[12px] text-muted-foreground">
                  Durata: {Math.round(b.durataS)} secondi. La copertina è il fotogramma a 1 secondo.
                  Prima di caricarlo tolgo dal video la posizione e gli altri dati nascosti.
                </p>
              )}
            </div>
          )}
          {b.tipo === "foto" && asse && (
            <div className="space-y-1">
              <label htmlFor={`${id}-ritaglio`} className="block text-[13px] font-medium">
                Sposta il ritaglio ({asse === "x" ? "a sinistra o a destra" : "in alto o in basso"})
              </label>
              <input
                id={`${id}-ritaglio`}
                type="range"
                min={0}
                max={100}
                value={Math.round(p[asse] * 100)}
                disabled={inCorso}
                className="h-11 w-full touch-pan-y accent-sky-600"
                onChange={(e) => agg({ punto: { ...p, [asse]: Number(e.target.value) / 100 } })}
              />
            </div>
          )}
          {b.avvisi.map((a) => (
            <p key={a} className="text-[12px] text-amber-900">
              {a}
            </p>
          ))}
        </div>
        <div className="space-y-3">
          <Campo
            id={`${id}-alt`}
            etichetta="Descrizione per chi non vede (obbligatoria)"
            aiuto={
              <>
                <span
                  className={cn(
                    "tabular-nums",
                    !altOk && b.alt.length > MAX_ALT && "font-medium text-rose-800",
                  )}
                >
                  {contaAlt(b.alt)}
                </span>
                {" · Scrivi cosa si vede, in modo semplice."}
              </>
            }
          >
            <Textarea
              id={`${id}-alt`}
              value={b.alt}
              rows={2}
              disabled={inCorso}
              aria-invalid={!altOk}
              aria-describedby={`${id}-alt-errore`}
              className={CAMPO}
              onChange={(e) => agg({ alt: e.target.value })}
            />
            <p
              id={`${id}-alt-errore`}
              className="text-[12px] text-rose-800"
              role={altOk ? undefined : "alert"}
            >
              {altOk ? "" : verifica.frase}
            </p>
          </Campo>
          {def.conRuolo && (
            <Campo id={`${id}-ruolo`} etichetta="Che foto è">
              <select
                id={`${id}-ruolo`}
                value={b.sottoRuolo ?? ""}
                disabled={inCorso}
                className={cn(CAMPO, "min-h-11")}
                onChange={(e) => {
                  //  Se la descrizione è ancora quella proposta, segue il ruolo; se l'ha scritta lui, non si tocca.
                  const r = (e.target.value || null) as SottoRuolo | null;
                  agg({
                    sottoRuolo: r,
                    ...(b.alt === altProposto(nome, b.slot, b.sottoRuolo)
                      ? { alt: altProposto(nome, b.slot, r) }
                      : {}),
                  });
                }}
              >
                <option value="">Scegli…</option>
                {RUOLI.map((r) => (
                  <option key={r.valore} value={r.valore}>
                    {r.etichetta}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {b.tipo === "video" && (
            <>
              <Interruttore
                id={`${id}-muto`}
                etichetta="È muto"
                valore={b.muto}
                spento={inCorso}
                cambia={(v) => agg({ muto: v })}
              />
              {!b.muto && (
                <>
                  <Interruttore
                    id={`${id}-sott`}
                    etichetta="Ho messo i sottotitoli nel video"
                    valore={b.sottotitoliOk}
                    spento={inCorso}
                    cambia={(v) => agg({ sottotitoliOk: v })}
                  />
                  {!b.sottotitoliOk && (
                    <p className="text-[12px] text-amber-900">
                      Un video con la voce ha bisogno dei sottotitoli per stare sul sito.
                    </p>
                  )}
                  <Campo id={`${id}-parlato`} etichetta="Testo parlato">
                    <Textarea
                      id={`${id}-parlato`}
                      value={b.testoParlato}
                      rows={3}
                      disabled={inCorso}
                      className={CAMPO}
                      onChange={(e) => agg({ testoParlato: e.target.value })}
                    />
                  </Campo>
                </>
              )}
            </>
          )}
          <Persone
            video={b.tipo === "video"}
            persone={b.ritraePersone}
            liberatoria={b.liberatoriaOk}
            id={id}
            spento={inCorso}
            cambia={agg}
          />
        </div>
      </div>

      {inCorso && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label="Avanzamento del caricamento"
            aria-valuemin={0}
            aria-valuemax={b.passo.totale}
            aria-valuenow={b.passo.fatti}
            className="h-2 overflow-hidden rounded-full bg-sky-100"
          >
            <div
              className="h-full rounded-full bg-sky-600 transition-[width] motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[12.5px]">
            Carico… {b.passo.fatti} di {b.passo.totale}
          </p>
        </div>
      )}
      {b.fase === "fallita" && b.frase && (
        <Avviso errore>
          {b.frase}
          {b.definitivo ? "" : ` Puoi riprovare: al massimo ${MAX_TENTATIVI} tentativi in tutto.`}
        </Avviso>
      )}

      <div className="flex flex-wrap gap-2">
        {b.fase === "fallita" && b.definitivo ? (
          <Button type="button" className="min-h-11" onClick={scarta}>
            Scarta e scegli di nuovo
          </Button>
        ) : (
          <Button type="button" className="min-h-11" disabled={!altOk || inCorso} onClick={salva}>
            {b.fase === "fallita"
              ? "Riprova"
              : b.tipo === "video"
                ? "Salva il video"
                : "Salva la foto"}
          </Button>
        )}
        {!(b.fase === "fallita" && b.definitivo) && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={inCorso}
            onClick={scarta}
          >
            Annulla
          </Button>
        )}
      </div>
    </div>
  );
}

function Persone({
  video,
  persone,
  liberatoria,
  id,
  spento,
  cambia,
}: {
  video?: boolean;
  persone: boolean;
  liberatoria: boolean;
  id: string;
  spento?: boolean;
  cambia: (p: Partial<Bozza>) => void;
}) {
  return (
    <div>
      <Interruttore
        id={`${id}-persona`}
        etichetta={video ? "Nel video c'è una persona" : "Nella foto c'è una persona"}
        valore={persone}
        spento={spento}
        cambia={(v) => cambia({ ritraePersone: v, ...(v ? {} : { liberatoriaOk: false }) })}
      />
      {persone && (
        <>
          <Interruttore
            id={`${id}-liberatoria`}
            etichetta="Ho la liberatoria scritta di chi è ritratto"
            valore={liberatoria}
            spento={spento}
            cambia={(v) => cambia({ liberatoriaOk: v })}
          />
          {!liberatoria && (
            <p className="text-[12px] text-amber-900">
              Senza liberatoria {video ? "questo video" : "questa foto"} non esce sul sito.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ═══ un media già caricato ══════════════════════════════════════════════════════════ */

function TesseraMedia({
  def,
  etichetta,
  m,
  occupato,
  aperta,
  daTogliere,
  eGalleria,
  prima,
  dopo,
  apri,
  sposta,
  sostituisci,
  chiediToglierla,
  annullaTogli,
  togli,
  salvaAlt,
  flag,
}: {
  def: DefSlot;
  etichetta: string;
  m: Media;
  occupato: boolean;
  aperta: boolean;
  daTogliere: boolean;
  eGalleria: boolean;
  prima: boolean;
  dopo: boolean;
  apri: () => void;
  sposta: (v: -1 | 1) => void;
  sostituisci: () => void;
  chiediToglierla: () => void;
  annullaTogli: () => void;
  togli: () => void;
  salvaAlt: (alt: string) => Promise<boolean>;
  flag: (f: Record<string, unknown>) => Promise<boolean>;
}) {
  const [alt, setAlt] = useState(m.alt);
  const [parlato, setParlato] = useState(m.testoParlato ?? "");
  useEffect(() => setAlt(m.alt), [m.alt]);
  useEffect(() => setParlato(m.testoParlato ?? ""), [m.testoParlato]);
  const verifica = controllaAlt(alt);
  const miniatura = urlMedia(BASE_MEDIA, def.tipo === "video" ? m.pathCopertina : m.path480);
  const video = def.tipo === "video";
  const nascosta = m.ritraePersone && !m.liberatoriaOk;
  const id = `media-${m.id}`;
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-2 md:p-3",
        aperta ? "space-y-3" : "space-y-2",
        eGalleria && !aperta && "cursor-grab",
      )}
    >
      <div className={cn(aperta && "grid gap-3 md:grid-cols-[minmax(0,12rem)_1fr]")}>
        <div className="space-y-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white ring-1 ring-sky-200">
            {miniatura ? (
              <img
                src={miniatura}
                alt={m.alt}
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center p-2 text-center text-[12px] text-muted-foreground">
                {video ? "Video caricato" : "Anteprima non disponibile"}
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-1">
            <p className="min-w-0 text-[13px] font-medium">
              {etichetta}
              {def.obbligatorio && <span aria-hidden="true"> *</span>}
            </p>
            {eGalleria && (
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  disabled={!prima || occupato}
                  onClick={() => sposta(-1)}
                  aria-label={`Sposta ${etichetta} prima`}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  disabled={!dopo || occupato}
                  onClick={() => sposta(1)}
                  aria-label={`Sposta ${etichetta} dopo`}
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
          {nascosta && (
            <p className="text-[12px] text-amber-900">Non esce sul sito: manca la liberatoria.</p>
          )}
          {!aperta && (
            <p className="line-clamp-2 text-[12px] text-muted-foreground">
              {m.alt || "Manca la descrizione."}
            </p>
          )}
        </div>

        {aperta && (
          <div className="space-y-3">
            <Campo
              id={`${id}-alt`}
              etichetta="Descrizione per chi non vede (obbligatoria)"
              aiuto={<span className="tabular-nums">{contaAlt(alt)}</span>}
            >
              <Textarea
                id={`${id}-alt`}
                value={alt}
                rows={2}
                aria-invalid={!verifica.ok}
                className={CAMPO}
                onChange={(e) => setAlt(e.target.value)}
              />
              <p className="text-[12px] text-rose-800" role={verifica.ok ? undefined : "alert"}>
                {verifica.ok ? "" : verifica.frase}
              </p>
            </Campo>
            <Button
              type="button"
              className="min-h-11"
              disabled={!verifica.ok || occupato || (verifica.ok && verifica.alt === m.alt)}
              onClick={() => void salvaAlt(alt)}
            >
              Salva la descrizione
            </Button>
            {m.sottoRuolo && (
              <p className="text-[12.5px] text-muted-foreground">
                Ruolo: {RUOLI.find((r) => r.valore === m.sottoRuolo)?.etichetta ?? m.sottoRuolo}.
              </p>
            )}
            {video && (
              <>
                <Interruttore
                  id={`${id}-muto`}
                  etichetta="È muto"
                  valore={m.muto}
                  spento={occupato}
                  cambia={(v) => void flag({ muto: v })}
                />
                {!m.muto && (
                  <>
                    <Interruttore
                      id={`${id}-sott`}
                      etichetta="Ho messo i sottotitoli nel video"
                      valore={m.sottotitoliOk}
                      spento={occupato}
                      cambia={(v) => void flag({ sottotitoliOk: v })}
                    />
                    <Campo id={`${id}-parlato`} etichetta="Testo parlato">
                      <Textarea
                        id={`${id}-parlato`}
                        value={parlato}
                        rows={3}
                        className={CAMPO}
                        onChange={(e) => setParlato(e.target.value)}
                      />
                    </Campo>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={occupato || parlato.trim() === (m.testoParlato ?? "")}
                      onClick={() => void flag({ testoParlato: parlato.trim() || null })}
                    >
                      Salva il testo parlato
                    </Button>
                  </>
                )}
              </>
            )}
            <Persone
              video={video}
              persone={m.ritraePersone}
              liberatoria={m.liberatoriaOk}
              id={id}
              spento={occupato}
              cambia={(p) =>
                void flag({
                  ...(p.ritraePersone !== undefined ? { ritraePersone: p.ritraePersone } : {}),
                  ...(p.liberatoriaOk !== undefined ? { liberatoriaOk: p.liberatoriaOk } : {}),
                })
              }
            />
          </div>
        )}
      </div>

      {daTogliere ? (
        <div className="space-y-2" role="group" aria-label={`Togliere ${etichetta}?`}>
          <p className="text-[12.5px]">
            Vuoi togliere questa {video ? "video" : "foto"} dal prodotto?
            {def.obbligatorio ? " Senza foto principale il prodotto non può stare sul sito." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={occupato}
              onClick={togli}
            >
              Sì, togli
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={annullaTogli}>
              No
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-expanded={aperta}
            onClick={apri}
          >
            {aperta ? "Chiudi" : "Modifica"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={occupato}
            onClick={sostituisci}
          >
            Sostituisci
          </Button>
          <Button
            type="button"
            variant="outline"
            className="col-span-2 min-h-11"
            disabled={occupato}
            onClick={chiediToglierla}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Togli
          </Button>
        </div>
      )}
    </div>
  );
}
