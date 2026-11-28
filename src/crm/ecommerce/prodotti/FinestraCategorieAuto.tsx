/** ── LA FINESTRA «METTI LE CATEGORIE» (FinestraCategorieAuto.tsx) ─────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E16. Si apre dal tasto dell'elenco con i prodotti scelti. Tre momenti: leggo i prodotti (sola lettura),
 *  anteprima (prodotto → categoria proposta, con un menu per cambiarla riga per riga), scrivo (barra di avanzamento, poi l'esito con «Riprova»).
 *  Le regole sono in `categorie-auto.ts`, le scritture in `categorie-auto-flusso.ts`: qui c'è solo lo schermo.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Fino a «Metti le categorie» non si scrive niente. L'anteprima dice quali categorie si creeranno («Creo le categorie: …»): nascoste dal sito.
 *  · Le categorie si AGGIUNGONO a quelle che il prodotto ha già. La descrizione breve e il canale «sito» sono caselle già spuntate e si applicano
 *    solo dove il campo è vuoto (e solo alle bozze): non sovrascrivono mai.
 *  · Mentre si scrive la finestra non si chiude. Se qualcosa non riesce: la frase, e «Riprova» rifà SOLO i mancanti.
 *  · «Da fare a mano»: quello che non si può riempire da soli (la foto, la spedizione) resta scritto in finestra, prima e dopo.
 *  ⚠️ Nessun log da qui, mai. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CATEGORIE_AUTO,
  categorieDaCreare,
  decidi,
  fraseDaFareAMano,
  proponiCategoria,
  restaAMano,
  trovaCategoria,
  type CategoriaNota,
  type Opzioni,
} from "./categorie-auto";
import {
  applica,
  avanzamento,
  corsaVuota,
  leggiTutti,
  mancanti,
  riepilogo,
  type Corsa,
  type LetturaProdotto,
  type Porte,
  type Scelta,
} from "./categorie-auto-flusso";

const CENTO = 100;

export interface ProdottoScelto {
  id: string;
  nome: string;
  tipo: string;
}

type Fase =
  | { passo: "leggo"; letti: number; totale: number }
  | { passo: "anteprima" }
  | { passo: "scrivo" | "fine"; corsa: Corsa }
  | { passo: "errore"; frase: string };

const frasePiu = (n: number, uno: string, molti: string) =>
  n === 1 ? `1 ${uno}` : `${n} ${molti}`;

export function FinestraCategorieAuto({
  aperta,
  chiudi,
  prodotti,
  porte,
}: {
  aperta: boolean;
  /** `cambiato`: qualcosa è stato scritto (l'elenco va riletto). */
  chiudi: (cambiato: boolean) => void;
  prodotti: readonly ProdottoScelto[];
  porte: Porte;
}) {
  const [fase, setFase] = useState<Fase>({ passo: "leggo", letti: 0, totale: prodotti.length });
  const [note, setNote] = useState<CategoriaNota[]>([]);
  const [letture, setLetture] = useState<Record<string, LetturaProdotto>>({});
  /** La categoria scelta per ogni prodotto (indirizzo); `""` = nessuna. */
  const [scelte, setScelte] = useState<Record<string, string>>({});
  const [opz, setOpz] = useState<Opzioni>({ breve: true, sito: true });
  /** Cambia a ogni apertura e a ogni chiusura: un risultato arrivato in ritardo da un giro vecchio si scarta. */
  const giro = useRef(0);
  const corsaCorrente = useRef<Corsa>(corsaVuota());

  /** Apre: legge le categorie e le schede (sola lettura), poi propone. */
  const carica = async () => {
    const mio = ++giro.current;
    setFase({ passo: "leggo", letti: 0, totale: prodotti.length });
    const k = await porte.categorie();
    if (mio !== giro.current) return;
    if (!k.ok) return setFase({ passo: "errore", frase: k.errore.messaggio });
    const elenco = (Array.isArray(k.dati.categorie) ? k.dati.categorie : []).flatMap((x) => {
      const o = x as { id?: unknown; slug?: unknown; nome?: unknown } | null;
      return o &&
        typeof o.id === "string" &&
        typeof o.slug === "string" &&
        typeof o.nome === "string"
        ? [{ id: o.id, slug: o.slug, nome: o.nome }]
        : [];
    });
    setNote(elenco);
    const lette = await leggiTutti(
      porte,
      prodotti.map((p) => p.id),
      (letti, totale) => {
        if (mio === giro.current) setFase({ passo: "leggo", letti, totale });
      },
    );
    if (mio !== giro.current) return;
    setLetture(lette);
    // la proposta usa l'indirizzo che la categoria ha davvero nel catalogo (può chiamarsi diversamente da quello che diamo noi)
    setScelte(
      Object.fromEntries(
        prodotti.map((p) => {
          const slug = proponiCategoria(p.nome, p.tipo);
          return [p.id, slug ? (trovaCategoria(slug, elenco)?.slug ?? slug) : ""];
        }),
      ),
    );
    setOpz({ breve: true, sito: true });
    corsaCorrente.current = corsaVuota();
    setFase({ passo: "anteprima" });
  };

  useEffect(() => {
    if (aperta) void carica();
    else giro.current++;
    // si rilegge solo all'apertura: i prodotti scelti sono quelli del clic
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta]);
  useEffect(
    () => () => {
      giro.current++;
    },
    [],
  );

  const lista: Scelta[] = useMemo(
    () => prodotti.map((p) => ({ id: p.id, nome: p.nome, categoria: scelte[p.id] || null })),
    [prodotti, scelte],
  );
  const daCreare = useMemo(
    () =>
      categorieDaCreare(
        lista.map((s) => s.categoria),
        note,
      ),
    [lista, note],
  );
  /** Per ogni prodotto letto: cosa farebbe, e cosa resterebbe a mano. */
  const piano = useMemo(
    () =>
      lista.map((s) => {
        const letto = letture[s.id];
        if (!letto?.ok) return { s, letto: null, d: null, resto: [] };
        const id = s.categoria
          ? (trovaCategoria(s.categoria, note)?.id ?? `nuova-${s.categoria}`)
          : null;
        const d = decidi(letto.lettura, id, opz);
        return { s, letto: letto.lettura, d, resto: restaAMano(letto.lettura, d) };
      }),
    [lista, letture, note, opz],
  );
  const nonLetti = prodotti.filter((p) => !letture[p.id]?.ok);
  const fraseNonLetti = nonLetti.flatMap((p) => {
    const l = letture[p.id];
    return l && !l.ok ? [l.frase] : [];
  })[0];
  const conProposta = lista.filter((s) => s.categoria).length;
  /** Dove la casella farebbe qualcosa (campo vuoto, bozza): non dipende dalla casella stessa, così il numero resta leggibile anche spenta. */
  const nBreve = piano.filter(
    (x) => x.letto && decidi(x.letto, null, { breve: true, sito: false }).breve !== null,
  ).length;
  const nSito = piano.filter(
    (x) => x.letto && decidi(x.letto, null, { breve: false, sito: true }).sito,
  ).length;
  const aMano = fraseDaFareAMano(piano.map((x) => x.resto));

  const occupata = fase.passo === "scrivo";
  const esci = () => chiudi(Object.keys(corsaCorrente.current.esiti).length > 0);
  const scrivi = async () => {
    const mio = ++giro.current;
    const parte: Corsa = corsaCorrente.current;
    setFase({ passo: "scrivo", corsa: parte });
    const fine = await applica(porte, lista, opz, parte, {
      aggiorna: (c) => {
        corsaCorrente.current = c;
        if (mio === giro.current) setFase({ passo: "scrivo", corsa: c });
      },
      interrompi: () => mio !== giro.current,
    });
    corsaCorrente.current = fine;
    if (mio === giro.current) setFase({ passo: "fine", corsa: fine });
  };

  const opzioniMenu = [
    ...note.map((k) => ({ slug: k.slug, nome: k.nome })),
    ...CATEGORIE_AUTO.filter((k) => !trovaCategoria(k.slug, note)).map((k) => ({
      slug: k.slug,
      nome: `${k.nome} (nuova)`,
    })),
  ];

  const barra = (c: Corsa | null) => {
    const a = c ? avanzamento(c) : null;
    const letti = fase.passo === "leggo" ? fase : null;
    const percento = a
      ? a.percento
      : letti && letti.totale
        ? Math.floor((letti.letti * CENTO) / letti.totale)
        : 0;
    const nome = a
      ? `Fatti ${a.fatti} di ${a.totale} prodotti`
      : `Letti ${letti?.letti ?? 0} di ${letti?.totale ?? 0} prodotti`;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[14px] font-semibold">
            {fase.passo === "leggo"
              ? "Leggo i prodotti…"
              : fase.passo === "scrivo"
                ? "Scrivo le categorie…"
                : a && a.fatti === a.totale
                  ? "Finito"
                  : "Finito, ma qualcosa manca"}
          </p>
          <p className="text-[13px] tabular-nums text-muted-foreground">
            {a
              ? `${a.fatti} di ${a.totale} prodotti`
              : `${letti?.letti ?? 0} di ${letti?.totale ?? 0} prodotti`}
          </p>
        </div>
        <p className="sr-only" role="status">
          {nome}
        </p>
        <div
          role="progressbar"
          aria-label={nome}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percento}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percento}%` }}
          />
        </div>
        {fase.passo !== "fine" && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {fase.passo === "scrivo"
              ? "Non chiudere la finestra finché non finisce: i prodotti si fanno a gruppi di cinque."
              : "Sto solo leggendo: non cambio niente."}
          </p>
        )}
      </div>
    );
  };

  const fineCorsa = fase.passo === "scrivo" || fase.passo === "fine" ? fase.corsa : null;
  const rie = fineCorsa ? riepilogo(lista, fineCorsa) : null;
  const mancano = fineCorsa ? mancanti(lista, fineCorsa) : [];
  const restoFinale = rie ? fraseDaFareAMano(rie.resto) : null;

  return (
    <Dialog open={aperta} onOpenChange={(v) => !v && !occupata && esci()}>
      <DialogContent className="crm-theme max-h-[92vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto bg-white p-4 text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle>Metti le categorie</DialogTitle>
          <DialogDescription>
            {frasePiu(prodotti.length, "prodotto scelto", "prodotti scelti")}. Propongo una
            categoria dal nome di ognuno; la cambi riga per riga. Le categorie che il prodotto ha
            già restano: aggiungo, non tolgo.
          </DialogDescription>
        </DialogHeader>

        {fase.passo === "errore" && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-[13.5px] text-rose-800">
              {fase.frase}
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                className="h-11 text-[13px] md:h-9"
                onClick={() => void carica()}
              >
                Riprova
              </Button>
            </div>
          </div>
        )}

        {fase.passo === "leggo" && barra(null)}

        {fase.passo === "anteprima" && (
          <div className="flex flex-col gap-4">
            <p className="text-[13.5px]" aria-live="polite">
              {frasePiu(prodotti.length, "prodotto", "prodotti")}: {conProposta} con una categoria,{" "}
              {prodotti.length - conProposta} senza (restano come sono).
            </p>

            {nonLetti.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-950">
                <p role="alert">
                  {frasePiu(
                    nonLetti.length,
                    "prodotto non si è letto",
                    "prodotti non si sono letti",
                  )}
                  {": "}
                  {fraseNonLetti ?? "riprova."} Senza lettura non scrivo niente su di loro.
                </p>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-11 text-[12px] md:h-8"
                    onClick={() => void carica()}
                  >
                    Rileggi i prodotti
                  </Button>
                </div>
              </div>
            )}

            <p className="text-[13.5px]">
              {daCreare.length > 0 ? (
                <>
                  <strong className="font-semibold">
                    Creo le categorie: {daCreare.map((k) => k.nome).join(", ")}.
                  </strong>{" "}
                  Nascono nascoste dal sito: le accendi tu da «Categorie».
                </>
              ) : (
                "Non creo nessuna categoria nuova: ci sono già tutte."
              )}
            </p>

            <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <legend className="px-1 text-[12.5px] font-medium text-muted-foreground">
                Già spuntato, solo dove manca
              </legend>
              <label className="flex items-start gap-2.5 text-[13.5px]">
                <input
                  type="checkbox"
                  checked={opz.breve}
                  onChange={(e) => setOpz({ ...opz, breve: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-sky-600"
                />
                <span>
                  <span className="font-medium">Descrizione breve</span> · presa dalla descrizione
                  per Google già salvata, o dalla prima frase della descrizione lunga (
                  {frasePiu(nBreve, "prodotto", "prodotti")}). Dove è già scritta non la tocco.
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-[13.5px]">
                <input
                  type="checkbox"
                  checked={opz.sito}
                  onChange={(e) => setOpz({ ...opz, sito: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-sky-600"
                />
                <span>
                  <span className="font-medium">Canale «sito» acceso</span> · dove tutti i canali
                  sono spenti ({frasePiu(nSito, "prodotto", "prodotti")}). I prodotti restano in
                  bozza: si pubblicano solo con «Pubblica».
                </span>
              </label>
              <p className="text-[12.5px] text-muted-foreground">
                Sulle bozze soltanto: un prodotto già pubblicato non lo cambio.
              </p>
            </fieldset>

            <ul
              aria-label="Prodotti e categoria proposta"
              className="max-h-[38vh] divide-y divide-border overflow-y-auto rounded-lg border border-border"
            >
              {piano.map(({ s, letto }) => {
                const gia =
                  letto?.categorie
                    .map((id) => note.find((k) => k.id === id)?.nome)
                    .filter(Boolean) ?? [];
                const idSelect = `cat-auto-${s.id}`;
                return (
                  <li
                    key={s.id}
                    className="grid gap-1.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0">
                      <label htmlFor={idSelect} className="block truncate text-[13px] font-medium">
                        {s.nome}
                      </label>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {!letto
                          ? "Non letto: non lo cambio."
                          : gia.length
                            ? `Ha già: ${gia.join(", ")}`
                            : "Nessuna categoria per ora"}
                      </p>
                    </div>
                    <select
                      id={idSelect}
                      value={scelte[s.id] ?? ""}
                      disabled={!letto}
                      onChange={(e) => setScelte({ ...scelte, [s.id]: e.target.value })}
                      className={cn(
                        "h-11 w-full rounded-md border border-border bg-card px-2 text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8",
                        !scelte[s.id] && "text-muted-foreground",
                      )}
                    >
                      <option value="">Nessuna proposta: non cambio</option>
                      {opzioniMenu.map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>

            <p className="text-[13px] text-muted-foreground">
              {aMano ?? "Da fare a mano: niente che io veda."} La spedizione del negozio (costo e
              tempi) si imposta in «Spedizioni», non da qui.
            </p>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-[13px] md:h-9"
                onClick={esci}
              >
                Annulla
              </Button>
              <Button
                type="button"
                className="h-11 text-[13px] md:h-9"
                disabled={
                  piano.every((x) => !x.letto) || (conProposta === 0 && !opz.breve && !opz.sito)
                }
                onClick={() => void scrivi()}
              >
                Metti le categorie
              </Button>
            </DialogFooter>
          </div>
        )}

        {fineCorsa && rie && (
          <div className="flex flex-col gap-4">
            {barra(fineCorsa)}
            {fase.passo === "fine" && (
              <div className="flex flex-col gap-1 text-[13.5px]">
                <p className="text-[15px] font-semibold" role="status">
                  {rie.errori.length === 0 && !fineCorsa.fermo
                    ? `Fatto: ${frasePiu(avanzamento(fineCorsa).fatti, "prodotto sistemato", "prodotti sistemati")}.`
                    : `Fatti ${avanzamento(fineCorsa).fatti} di ${avanzamento(fineCorsa).totale}: ${frasePiu(mancano.length, "prodotto manca", "prodotti mancano")}.`}
                </p>
                <p>
                  Categoria messa a {rie.categorie} · descrizione breve scritta in {rie.breve} ·
                  canale «sito» acceso in {rie.sito}.
                </p>
                {rie.nomiCreate.length > 0 && (
                  <p>Categorie create (nascoste dal sito): {rie.nomiCreate.join(", ")}.</p>
                )}
                {restoFinale && <p className="text-muted-foreground">{restoFinale}</p>}
              </div>
            )}
            {fase.passo === "fine" && (fineCorsa.fermo || rie.errori.length > 0) && (
              <div className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-950">
                {fineCorsa.fermo && (
                  <p role="alert">{fineCorsa.fermo} Chi non è partito resta com'era.</p>
                )}
                {rie.errori.length > 0 && (
                  <ul className="list-disc pl-5">
                    {rie.errori.slice(0, 10).map((e) => (
                      <li key={e.nome}>
                        <span className="font-medium">{e.nome}</span>: {e.frase}
                      </li>
                    ))}
                    {rie.errori.length > 10 && <li>… e altri {rie.errori.length - 10}.</li>}
                  </ul>
                )}
                <div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 text-[12px] md:h-8"
                    onClick={() => void scrivi()}
                  >
                    Riprova i {mancano.length} mancanti
                  </Button>
                </div>
              </div>
            )}
            {fase.passo === "fine" && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-[13px] md:h-9"
                  onClick={esci}
                >
                  Chiudi
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
