/** ── PaginaCarrello · VETRINA V1 · T98 (SPEC §4.5.5, V1-K1…K5, V1-T8, V1-T9, D89) ───────────────────────────────
 *  Il carrello nuovo (solo con `cms`: lo smistatore è in `src/routes/shop.carrello.tsx`, il carrello di oggi non cambia).
 *  Tiene in UN punto carrello, rivalida, tariffa ed eventi: i componenti di T89 sono puri e ricevono solo callback.
 *  · Motore di oggi: `useCart`, `useRivalidaCarrello("cms")`, `useTariffa(true)`. Righe e riepilogo leggono lo STESSO `stato` di rivalida:
 *    una cifra solo con «ok», «…» in controllo, «—» se non si sa (`righeVista`, `riepilogo` di T79). Mai il prezzo ricordato dal browser.
 *  · Il vuoto si decide su `vista.righe.length`, non sul conteggio del carrello: righe vecchie e Invisible Derm non si vedono mai.
 *    Vuoto = due ingressi (pieno + contorno) e il link alla consulenza; con righe NESSUN invito alla consulenza (V1-K5).
 *  · `AvvisoCarrello` è sempre montato, nello stesso posto fra le righe e il vuoto: una regione che nasce già piena non viene letta.
 *  · «Togli»: `RemoveFromCart` PRIMA di `remove` (la riga si cerca per chiave); la quantità va subito a `setQty`; `ViewCart` una volta, a controllo finito.
 *  · Barra fissa «Totale · Vai alla cassa» (`BarraCarrello`, T84a): sta nello slot in fondo al guscio (dopo il piè di pagina, fuori da `main`),
 *    ci si arriva con `createPortal` dopo il montaggio. Lo slot è `<div data-slot-barra-fissa />`, ultimo figlio del guscio (T93, stesso contratto di T97b).
 *    Senza slot (pagina fuori dal guscio nuovo) nessuna barra e nessun errore.
 *  · «Ti serve anche»: una sola card, dal `correlato` del primo prodotto del carrello che ne ha uno non ancora nel carrello.
 *    Quando si aggiunge una riga la rivalida riparte (`aggiungibile` è un'istantanea del server).
 *  Nessuna barra di spedizione gratuita, nessuna soglia: la spedizione è la tariffa del server. Parole: `testi-shop.ts`; «Il carrello non si può
 *  controllare» e «alcuni prodotti non sono più disponibili» sono quelli di R2 (`cassa.ts`). Nessun dato di clienti negli eventi. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, TriangleAlert } from "lucide-react";
import { BarraCarrello } from "@/components/shop/guscio/BarreFisse";
import { AvvisoCarrello, RigaCarrelloShop } from "@/components/shop/carrello/RigaCarrelloShop";
import { RiepilogoOrdine } from "@/components/shop/carrello/RiepilogoOrdine";
import { StatoVuoto } from "@/components/shop/StatoVuoto";
import { TiServeAnche, type Correlato } from "@/components/shop/TiServeAnche";
import { riempi, TESTI_SHOP } from "@/landing/testi-shop";
import { emettiEvento, emettiSoloContatore } from "@/lib/tracciamento/api";
import { useCart, type CartLine } from "@/shop/CartContext";
import { schedaProdotto } from "@/shop/cms/catalogo.functions";
import { MSG_NON_VERIFICABILE, MSG_RIMOSSE } from "@/shop/cms/cassa";
import { eventoCarrello, eventoRimuovi } from "@/shop/cms/vetrina-eventi";
import { avvisiRiga, ingressiCarrelloVuoto, righeVista, riepilogo, type AvvisoRiga } from "@/shop/cms/vetrina-carrello";
import { useRivalidaCarrello } from "@/shop/useRivalidaCarrello";
import { useTariffa } from "@/shop/useTariffa";

const PannelloProblemi = lazy(() => import("@/components/landing/consulenza/PannelloProblemi"));

/** Lo slot in fondo al guscio dove sta la barra fissa (regola (a) di T93). */
export const SLOT_BARRA_FISSA = "[data-slot-barra-fissa]";

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const formatta = (cent: number) => EURO.format(cent / 100);

/** Quanti prodotti si interrogano, al massimo, per trovare un «Ti serve anche». shortcut: tre schede in fila, non tutte; si alza se il catalogo ha pochi collegamenti. */
const MAX_SCHEDE_CORRELATO = 3;

/** Dopo il controllo, cerca il «Ti serve anche» dei primi prodotti del carrello. Un guasto non si dice: la card è un di più. */
function useCorrelato(slug: readonly string[], attiva: boolean): Correlato | null {
  const [correlato, setCorrelato] = useState<Correlato | null>(null);
  const chiave = slug.join("|");
  useEffect(() => {
    if (!attiva || !chiave) {
      setCorrelato(null);
      return;
    }
    let vivo = true;
    const elenco = chiave.split("|");
    // Una sola card (SPEC §4.5.5): il primo `correlato` che non è già nel carrello. `TiServeAnche` scarta da sé senza prezzo e Invisible Derm.
    const nuovo = (c: Correlato | null): c is Correlato => !!c && !elenco.includes(c.slug);
    void (async () => {
      const trovati: (Correlato | null)[] = [];
      for (const s of elenco.slice(0, MAX_SCHEDE_CORRELATO)) {
        try {
          const r = await schedaProdotto({ data: { slug: s, chiave: "" } });
          trovati.push(r.esito === "trovato" ? r.prodotto.correlato : null);
        } catch {
          trovati.push(null);
        }
        if (!vivo) return;
        if (trovati.some(nuovo)) break;
      }
      if (vivo) setCorrelato(trovati.find(nuovo) ?? null);
    })();
    return () => {
      vivo = false;
    };
  }, [chiave, attiva]);
  return correlato;
}

/** Il nodo in fondo al guscio, cercato dopo il montaggio: `null` sul server, al primo disegno e se non c'è. */
function useSlotBarra(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.querySelector<HTMLElement>(SLOT_BARRA_FISSA)), []);
  return slot;
}

function ErroreControllo() {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-[#B3261E]/40 bg-white px-3 py-2 text-sm text-[#B3261E]">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      {MSG_NON_VERIFICABILE}
    </p>
  );
}

export function PaginaCarrello() {
  const t = TESTI_SHOP.carrello;
  const { lines, setQty, remove } = useCart();
  const { stato, avviso, controlla } = useRivalidaCarrello("cms");
  const tariffa = useTariffa(true);
  // Lo stesso `stato` per righe e riepilogo: le cifre non si mischiano («ok» da una parte, «…» dall'altra).
  const vista = useMemo(() => righeVista(lines, stato), [lines, stato]);
  const conti = useMemo(() => riepilogo(vista, tariffa), [vista, tariffa]);
  const conRighe = vista.righe.length > 0;

  // ── gli avvisi: righe tolte o ridotte dal controllo (le righe di prima si ricordano finché si controlla) ──
  const prima = useRef<CartLine[]>([]);
  const [esito, setEsito] = useState<{ avvisi: AvvisoRiga[]; ripulite: number }>({ avvisi: [], ripulite: 0 });
  useEffect(() => {
    // carrello svuotato (anche dal cliente, durante il controllo): niente da confrontare, altrimenti la riga tolta da lui passerebbe per «non più disponibile»
    if (lines.length === 0) {
      prima.current = [];
      return;
    }
    if (stato === "controllo") {
      prima.current = lines;
      return;
    }
    if (stato !== "ok" || prima.current.length === 0) return;
    const r = avvisiRiga(prima.current, lines);
    prima.current = [];
    if (r.avvisi.length > 0 || r.ripulite > 0) setEsito(r);
  }, [stato, lines]);
  const tolte = esito.avvisi.filter((a) => a.tipo === "tolta").map((a) => a.testo);
  const avvisoDiRiga = new Map(esito.avvisi.filter((a) => a.tipo === "quantita").map((a) => [a.key, a.testo]));
  // La frase del gancio resta a schermo dopo la ripulitura (`vista.frase` sparisce: le righe vecchie sono già tolte); non si ripete se le righe tolte hanno già il loro nome.
  const generale = avviso === MSG_RIMOSSE && tolte.length > 0 && esito.ripulite === 0 ? null : (avviso ?? vista.frase);
  const testoAvviso = [...tolte, generale].filter(Boolean).join(" ") || null;

  // ── eventi: ViewCart una volta, a controllo finito (il valore è quello del server); RemoveFromCart prima di togliere ──
  const viste = useRef(lines);
  viste.current = lines;
  const emessa = useRef(false);
  useEffect(() => {
    if (emessa.current) return;
    const e = eventoCarrello(viste.current, stato);
    if (!e) return;
    emessa.current = true;
    emettiEvento(e.nome, e.dati);
  }, [stato, lines.length]);
  const togli = (chiave: string) => {
    const riga = lines.find((l) => l.key === chiave);
    const e = riga ? eventoRimuovi(riga, stato) : null;
    if (e) emettiEvento(e.nome, e.dati);
    remove(chiave);
  };

  // Una riga in più (la card «Ti serve anche»): si ricontrolla, `aggiungibile` è la fotografia di un momento.
  const nRighe = useRef(lines.length);
  useEffect(() => {
    if (stato === "ok" && lines.length > nRighe.current) void controlla();
    nRighe.current = lines.length;
  }, [lines.length, stato, controlla]);

  const slugRighe = useMemo(() => [...new Set(vista.righe.map((r) => r.slug))], [vista.righe]);
  const trovato = useCorrelato(slugRighe, conRighe && stato === "ok");
  const correlato = trovato && !slugRighe.includes(trovato.slug) ? trovato : null; // una card appena aggiunta non resta a schermo

  // ── la consulenza (solo nel vuoto): il flusso che esiste, in ritardo, come nell'header ──
  const [pannello, setPannello] = useState<"chiuso" | "montato" | "aperto">("chiuso");
  const apriConsulenza = () => {
    emettiSoloContatore("ClickConsulenza", { punto: "carrello" });
    setPannello("aperto");
  };

  const slot = useSlotBarra();
  const barra = <BarraCarrello righe={vista.righe.length} totale={conti.totale} formatta={formatta} />;
  const vuoto = ingressiCarrelloVuoto();

  // `min-h`: le righe arrivano da `localStorage` dopo il primo disegno (vuoto). Con l'altezza di uno schermo (meno 3 rem, sempre meno dell'header) il piè di pagina sta
  // sotto la piega prima e dopo e non scende (CLS 0,27 a 320). shortcut: il carrello vuoto ha più spazio sotto; si cambia se il Design chiede il piè visibile nel vuoto.
  return (
    <div className="mx-auto min-h-[calc(100svh-3rem)] w-full max-w-6xl px-4 py-8 min-[360px]:px-6 lg:py-12">
      {conRighe && (
        <header>
          <h1 className="text-2xl font-bold leading-[1.1] tracking-tight text-[#0A1430] md:text-4xl">{t.titolo}</h1>
          <p className="mt-2 text-base text-ink-muted">{t.sottotitolo}</p>
        </header>
      )}
      <div className={conRighe && testoAvviso ? "mt-4" : ""}>
        <AvvisoCarrello testo={testoAvviso} />
      </div>
      {stato === "non_verificabile" && conRighe && (
        <div className="mt-3">
          <ErroreControllo />
        </div>
      )}

      {conRighe ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
          <div className="flex flex-col gap-8">
            <ul role="list" className="border-t border-ink/10">
              {vista.righe.map((riga) => (
                <RigaCarrelloShop key={riga.key} riga={riga} avviso={avvisoDiRiga.get(riga.key)} formatta={formatta} onQuantita={setQty} onTogli={togli} />
              ))}
            </ul>
            <Link to="/shop" className="shop-anello inline-flex min-h-11 items-center self-start rounded-sm text-sm font-medium text-brand-scuro underline underline-offset-4 hover:text-ink">
              {t.continua}
            </Link>
            {correlato && <TiServeAnche correlato={correlato} titolo={riempi(t.tiServeAnche, { nome: correlato.nome })} />}
          </div>
          <div className="lg:sticky lg:top-24">
            <RiepilogoOrdine riepilogo={conti} formatta={formatta} />
          </div>
        </div>
      ) : (
        <div className="py-8 sm:py-12">
          <StatoVuoto
            livello="h1"
            icona={ShoppingBag}
            titolo={vuoto.titolo}
            testo={vuoto.testo}
            azioni={[
              ...vuoto.ingressi.map((i) => ({ testo: i.testo, href: i.href, aspetto: i.aspetto })),
              { testo: vuoto.consulenza.testo, onClick: apriConsulenza, aspetto: "link" as const },
            ]}
          />
        </div>
      )}

      {pannello !== "chiuso" && (
        <Suspense fallback={null}>
          <PannelloProblemi aperto={pannello === "aperto"} onApertoChange={(a) => setPannello(a ? "aperto" : "montato")} provenienza="stock" punto="pannello" />
        </Suspense>
      )}
      {slot ? createPortal(barra, slot) : null}
    </div>
  );
}

export default PaginaCarrello;
