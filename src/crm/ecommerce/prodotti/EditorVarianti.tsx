/** ── LE VARIANTI DI UN PRODOTTO (EditorVarianti.tsx) ─────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T15 (Design §4.10.4); rifatta in stile Shopify da 2026-11-25-editor-prodotti, E8 (SPEC §3.3 riquadro 6).
 *  Le opzioni (Colore, Misura, Lunghezza) con i valori come etichette (si aggiunge con Invio), la tabella delle combinazioni che nasce da sola
 *  (`varianti_genera`) con Variante · Prezzo · Giacenza · SKU · Barcode · Peso · Costo · Attiva, e «Imposta il prezzo / lo stock di tutte».
 *  Lo usa `SchedaProdotto`. I pezzi stanno in `scheda/` (tabella, opzioni, azioni di tutte, regole pure e scritture).
 *
 *  ── LE PROPS (le fissa T14, restano così: le nuove sono solo opzionali) ─────
 *   · `prodotto`  `{ id, sku, nome, slug, prezzoCent, pubblicato, versione }`. `prezzoCent` è il prezzo di base del prodotto.
 *   · `varianti`  quelle lette con la scheda.   · `esegui` `negozio.esegui` (l'esito lo leggo io).   · `aggiorna` rilegge la scheda.
 *   · `costi?` `{ varianteId: centesimi|null }` e `costoDisponibile?` (E4): senza `costi` la colonna del costo non c'è.
 *   · `prezzoBase?` il campo «Prezzo di base» legato al guscio (`applicaPrezzo`): senza, si vede il prezzo del prodotto in sola lettura.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Al massimo 3 opzioni e 50 combinazioni: i limiti sono scritti, e il tasto resta spento con la frase del perché.
 *  · Una variante NON si cancella: si disattiva (D5). Generare di nuovo non tocca quelle che ci sono già.
 *  · Il prezzo vuoto vale il prezzo di base; «Imposta il prezzo di tutte» lo scrive su ogni riga. Dopo aver creato le varianti NON si scrive
 *    il prezzo da soli (50 scritture, e se una fallisce?): restano vuote e valgono il prezzo di base.
 *  · Ogni riga ha il suo nome (vuoto = quello dalle opzioni) e, se i pezzi cambiano, il motivo del movimento (Carico, Rettifica, Reso).
 *  · Passando dal prodotto semplice alle opzioni, la variante «Unica» si spegne (e sta in una riga chiusa): i suoi pezzi non si spostano da soli.
 *  · Su un prodotto pubblicato prezzo, varianti e giacenza si applicano SUBITO (D27): lo dice la riga in cima, e il server rifiuta
 *    un cambio che renderebbe il prodotto non pubblicabile.
 *  · Invisible Derm non ha un prezzo pubblico (D39): la colonna del prezzo non c'è.
 *  · Il campione di colore (la pallina di ogni colore) non si carica da qui: la firma di questo editor non porta i media. */
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { OpzioneInput, Variante } from "@/shop/cms/modello";
import { cn } from "@/lib/utils";
import {
  anteprimaCombinazioni,
  eInvisibleDerm,
  opzioniDaVarianti,
  prezzoInTesto,
} from "./scheda-pura";
import {
  avvisoPassaggioAOpzioni,
  cambioQuantita,
  statoUnica,
  trovaUnica,
  type MotivoGiacenza,
} from "./semplice-puro";
import type { Negozio } from "./tipi";
import { AzioniDiTutte } from "./scheda/AzioniDiTutte";
import { OpzioniVarianti } from "./scheda/OpzioniVarianti";
import { Banner, CampoP, CLASSI_CAMPO, CLASSI_TASTO } from "./scheda/polaris";
import { TabellaVarianti } from "./scheda/TabellaVarianti";
import {
  errore,
  generaVarianti,
  impostaPrezzoDiTutte,
  impostaStockDiTutte,
  salvaRighe,
  type Esito,
} from "./scheda/varianti-azioni";
import {
  campiCambiati,
  dividiRighe,
  erroriRiga,
  lavoroRiga,
  nomeDalleOpzioni,
  rigaDa,
  testiInUso,
  valoriCompleti,
  type CampoRiga,
  type ErroriRiga,
  type OpzioneScritta,
  type RigaTesto,
} from "./scheda/varianti-puro";

export interface PropsEditorVarianti {
  prodotto: {
    id: string;
    sku: string;
    nome: string;
    slug: string;
    prezzoCent: number;
    pubblicato: boolean;
    versione: string;
  };
  varianti: Variante[];
  esegui: Negozio["esegui"];
  aggiorna: () => Promise<void>;
  /** Il costo di ogni variante, in centesimi (E4). Assente = la colonna del costo non si mostra. */
  costi?: Record<string, number | null>;
  /** `false` = manca la migrazione del costo: la colonna c'è, spenta, con la sua frase. */
  costoDisponibile?: boolean;
  /** Il «Prezzo di base» scritto dal guscio: testo, cosa fare quando cambia, l'eventuale errore e il tasto «Applica prezzo» (nodo del guscio). */
  prezzoBase?: { testo: string; cambia: (t: string) => void; errore?: string; azione?: ReactNode };
}

export function EditorVarianti({
  prodotto,
  varianti,
  esegui,
  aggiorna,
  costi,
  costoDisponibile,
  prezzoBase,
}: PropsEditorVarianti) {
  const senzaPrezzo = eInvisibleDerm(prodotto.nome, prodotto.slug);
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<Esito>(null);

  /** Una azione alla volta: i tasti restano spenti finché non è finita. */
  const lavora = async (f: () => Promise<Esito>) => {
    if (occupato) return;
    setOccupato(true);
    setEsito(null);
    try {
      setEsito(await f());
    } finally {
      setOccupato(false);
    }
  };

  /* ── le opzioni ── */
  const [opzioni, setOpzioni] = useState<OpzioneScritta[]>(() =>
    opzioniDaVarianti(varianti).map((x) => ({ nome: x.nome, valori: x.valori, bozza: "" })),
  );
  const { righe, unicaSpenta } = dividiRighe(varianti, prodotto.sku);
  const scritte: OpzioneInput[] = opzioni.map((o) => ({ nome: o.nome, valori: valoriCompleti(o) }));
  const anteprima = anteprimaCombinazioni(prodotto.sku, scritte, varianti);
  const cambiaOpzione = (k: number, p: Partial<OpzioneScritta>) =>
    setOpzioni((o) => o.map((x, i) => (i === k ? { ...x, ...p } : x)));
  const usato = (nome: string, valore?: string) =>
    varianti.some(
      (v) =>
        Object.hasOwn(v.opzioni ?? {}, nome) &&
        (valore === undefined || v.opzioni[nome] === valore),
    );
  const unica = trovaUnica(varianti, prodotto.sku);
  const eSemplice = statoUnica(varianti, prodotto.sku) === "attiva";
  const avviso = eSemplice ? avvisoPassaggioAOpzioni(unica) : null;

  const genera = () =>
    lavora(async () => {
      setOpzioni((o) => o.map((x) => ({ ...x, valori: valoriCompleti(x), bozza: "" })));
      const e = await generaVarianti(esegui, prodotto.id, scritte, eSemplice ? unica : null);
      await aggiorna();
      return e;
    });

  const aggiungiUnica = () =>
    lavora(async () => {
      const r = await esegui("variante_salva", {
        prodottoId: prodotto.id,
        variante: { sku: prodotto.sku, nome: "Unica", opzioni: {} },
      });
      if (!r.ok) return errore(r.errore);
      await aggiorna();
      return { tono: "ok", testo: "Ho aggiunto la variante unica: ora scrivi prezzo e giacenza." };
    });

  const attiva = (v: Variante, valore: boolean) =>
    lavora(async () => {
      const r = await esegui("variante_attiva", {
        prodottoId: prodotto.id,
        varianteId: v.id,
        attiva: valore,
      });
      if (!r.ok) return errore(r.errore);
      await aggiorna();
      return {
        tono: "ok",
        testo: valore ? "Variante attiva." : "Variante disattivata: non si vende.",
      };
    });

  /* ── le righe: i testi cambiati si tengono qui finché non si salvano ── */
  const [cambiati, setCambiati] = useState<Record<string, Partial<RigaTesto>>>({});
  const [motivi, setMotivi] = useState<Record<string, MotivoGiacenza>>({});
  const [scelte, setScelte] = useState<ReadonlySet<string>>(new Set());
  const costoPresente = costi !== undefined;
  const costoAcceso = costoPresente && costoDisponibile !== false;
  const base: Record<string, RigaTesto> = {};
  const ora: Record<string, RigaTesto> = {};
  const errori: Record<string, ErroriRiga> = {};
  /** Il motivo del movimento, solo per le righe dove i pezzi cambiano: quello scelto, o quello proposto. */
  const motiviOra: Record<string, MotivoGiacenza> = {};
  const sporche: Variante[] = [];
  for (const v of righe) {
    base[v.id] = rigaDa(v, costi?.[v.id]);
    ora[v.id] = testiInUso(base[v.id], cambiati[v.id]);
    if (campiCambiati(base[v.id], ora[v.id]).length) {
      sporche.push(v);
      errori[v.id] = erroriRiga(ora[v.id], costoAcceso, nomeDalleOpzioni(v.opzioni));
      const q = cambioQuantita(v.giacenza, ora[v.id].giacenza);
      if (q.ok && q.motivo) motiviOra[v.id] = motivi[v.id] ?? q.motivo;
    }
  }
  const cambiaCampo = (id: string, campo: CampoRiga, valore: string) =>
    setCambiati((c) => ({ ...c, [id]: { ...c[id], [campo]: valore } }));
  /** Toglie i testi cambiati di quelle righe (tutti, o solo i `campi` dati): dopo un salvataggio o un «Annulla». */
  const dimentica = (ids: readonly string[], campi?: CampoRiga[]) => {
    if (!campi || campi.includes("giacenza"))
      setMotivi((m) => Object.fromEntries(Object.entries(m).filter(([id]) => !ids.includes(id))));
    setCambiati((c) =>
      Object.fromEntries(
        Object.entries(c).flatMap(([id, t]) => {
          if (!ids.includes(id)) return [[id, t]];
          const resto = campi
            ? Object.entries(t).filter(([k]) => !campi.includes(k as CampoRiga))
            : [];
          return resto.length ? [[id, Object.fromEntries(resto)]] : [];
        }),
      ),
    );
  };

  const salva = () =>
    lavora(async () => {
      const lavori = sporche.flatMap((v) => {
        const l = lavoroRiga(v, base[v.id], ora[v.id], {
          senzaPrezzo,
          costoDisponibile: costoAcceso,
          motivo: motivi[v.id],
        });
        return l ? [{ v, lavoro: l }] : [];
      });
      if (lavori.length < sporche.length)
        return {
          tono: "errore",
          testo: "Ci sono righe con un errore: correggile (sono segnate) e riprova.",
        };
      const { esito: e, fatte } = await salvaRighe(
        esegui,
        prodotto.id,
        lavori,
        prodotto.pubblicato,
      );
      await aggiorna();
      dimentica(fatte);
      return e;
    });

  const bersaglio = scelte.size ? righe.filter((v) => scelte.has(v.id)) : righe;
  const prezzoDiTutte = (testo: string) =>
    lavora(async () => {
      const e = await impostaPrezzoDiTutte(esegui, prodotto.id, bersaglio, testo);
      await aggiorna();
      dimentica(
        bersaglio.map((v) => v.id),
        ["prezzo"],
      );
      return e;
    });
  const stockDiTutte = (testo: string, motivo: Parameters<typeof impostaStockDiTutte>[3]) =>
    lavora(async () => {
      const e = await impostaStockDiTutte(esegui, bersaglio, testo, motivo);
      await aggiorna();
      dimentica(
        bersaglio.map((v) => v.id),
        ["giacenza"],
      );
      return e;
    });

  const prezzoBaseTesto = prezzoInTesto(prodotto.prezzoCent);
  const senzaBase =
    prodotto.prezzoCent <= 0 && righe.some((v) => v.attiva && v.prezzoCent === null);
  const [aperte, setAperte] = useState(false);
  const editorAperto = opzioni.length > 0 || aperte;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-[13px] leading-snug text-muted-foreground">
        Le varianti non si cancellano: si disattivano.
        {prodotto.pubblicato && (
          <strong className="font-semibold text-foreground">
            {" "}
            Il prodotto è sul sito: ogni cambio qui si applica subito.
          </strong>
        )}
      </p>

      {!editorAperto ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[14px] font-semibold">Aggiungi opzioni come colore o misura</p>
          <p className="text-[13px] text-muted-foreground">
            Se il prodotto esiste in più colori, misure o lunghezze, ogni combinazione avrà il suo
            prezzo, i suoi pezzi e il suo SKU.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 text-[13px] md:h-9"
              onClick={() => {
                setOpzioni([{ nome: "Colore", valori: [], bozza: "" }]);
                setAperte(true);
              }}
            >
              Aggiungi opzioni
            </Button>
            {varianti.length === 0 && (
              <Button
                type="button"
                variant="outline"
                className={CLASSI_TASTO}
                disabled={occupato}
                onClick={() => void aggiungiUnica()}
              >
                Il prodotto non ha opzioni: aggiungi la variante unica
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {avviso && <Banner tono="attenzione">{avviso}</Banner>}
          <OpzioniVarianti
            opzioni={opzioni}
            cambia={cambiaOpzione}
            togli={(k) => setOpzioni((o) => o.filter((_, i) => i !== k))}
            aggiungi={() => setOpzioni((o) => [...o, { nome: "", valori: [], bozza: "" }])}
            usato={usato}
            anteprima={anteprima}
            occupato={occupato}
            genera={() => void genera()}
          />
        </>
      )}

      {esito && <Banner tono={esito.tono === "errore" ? "errore" : "info"}>{esito.testo}</Banner>}

      {righe.length > 0 && (
        <>
          {!senzaPrezzo && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <CampoP
                id="prezzo-base"
                etichetta="Prezzo di base (per le righe senza prezzo)"
                aiuto="Una riga con il prezzo vuoto vale questo prezzo."
                errore={prezzoBase?.errore}
              >
                {(a) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      {...a}
                      inputMode="decimal"
                      readOnly={!prezzoBase}
                      value={prezzoBase ? prezzoBase.testo : prezzoBaseTesto}
                      onChange={(e) => prezzoBase?.cambia(e.target.value)}
                      className={cn(CLASSI_CAMPO, "md:w-32")}
                    />
                    {prezzoBase?.azione}
                  </div>
                )}
              </CampoP>
              {senzaBase && (
                <p className="text-[13px] text-amber-900">
                  Il prezzo di base è zero e alcune righe hanno il prezzo vuoto: scrivi il prezzo di
                  base o quello di ogni riga, altrimenti il prodotto non si pubblica.
                </p>
              )}
            </div>
          )}
          <AzioniDiTutte
            quante={righe.length}
            scelte={scelte.size}
            senzaPrezzo={senzaPrezzo}
            occupato={occupato}
            impostaPrezzo={(t) => void prezzoDiTutte(t)}
            impostaStock={(t, m) => void stockDiTutte(t, m)}
          />
          <TabellaVarianti
            righe={righe}
            base={base}
            ora={ora}
            errori={errori}
            cambia={cambiaCampo}
            motivi={motiviOra}
            cambiaMotivo={(id, m) => setMotivi((x) => ({ ...x, [id]: m }))}
            prezzoBase={prezzoBaseTesto}
            senzaPrezzo={senzaPrezzo}
            conCosto={costoPresente}
            costoDisponibile={costoAcceso}
            scelte={scelte}
            alternaScelta={(id) =>
              setScelte((s) => new Set(s.has(id) ? [...s].filter((x) => x !== id) : [...s, id]))
            }
            sceltaTutte={(si) => setScelte(si ? new Set(righe.map((v) => v.id)) : new Set())}
            attiva={(v, x) => void attiva(v, x)}
            spento={occupato}
            unicaSpenta={unicaSpenta}
          />
          {sporche.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-[13px] md:h-9"
                disabled={occupato}
                onClick={() => void salva()}
              >
                {prodotto.pubblicato
                  ? "Applica subito"
                  : sporche.length === 1
                    ? "Salva la riga"
                    : `Salva le ${sporche.length} righe`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={CLASSI_TASTO}
                disabled={occupato}
                onClick={() => dimentica(sporche.map((v) => v.id))}
              >
                Annulla le modifiche
              </Button>
              <p className="text-[13px] text-muted-foreground">
                {sporche.length === 1
                  ? "1 riga cambiata, non ancora salvata."
                  : `${sporche.length} righe cambiate, non ancora salvate.`}
              </p>
            </div>
          )}
        </>
      )}
      <p className="text-[13px] text-muted-foreground">
        Il campione di colore (la pallina di ogni colore) non si carica da qui.
      </p>
    </div>
  );
}
