/** ── SezioniScheda1 · VETRINA V1 · T88a ──────────────────────────────────────
 *  Le sezioni sotto il blocco d'acquisto, prima parte: «Il colore, alla luce del giorno» (solo patch), «Nella confezione» (sul kit
 *  «Cosa contiene»), «Come si usa» (passi numerati), «Scheda tecnica» (tabella) e «Avvertenze» (dopo la scheda tecnica, prima delle FAQ).
 *  Quali ci sono e in che ordine lo decide `bloccheScheda` (T78): qui si disegnano i blocchi che si conoscono e si ignorano gli altri
 *  (FAQ, box, «Ti serve anche» sono di `SezioniScheda2`). Nessuna sezione vuota: senza dati niente titolo; un testo provvisorio svuotato
 *  dal copywriter ha il suo testo di riserva. Slot vuoti (V1-T5): il blocco perde il media e tiene il testo; un video senza copertina non si disegna.
 *  Le voci ancora senza conferma (segnaposto aperto) non arrivano mai al DOM (secondo cancello dopo `bloccheScheda`).
 *  Contratto: `blocchi` = `bloccheScheda(prodotto, …)`, `testi`/`media` = `testiDi(contenuto)`/`mediaDi(contenuto)` (T80), tutti e due facoltativi.
 *  `parte`: «media» = colore e confezione, «testo» = come si usa, scheda tecnica, avvertenze (sul computer la pagina mette i primi sotto la
 *  galleria); senza, tutte in ordine. `onConsulenza`: se la pagina la dà, la frase di chiusura del colore diventa il bottone che apre la consulenza. */
import { useId, type ReactNode } from "react";
import { FotoShop } from "@/components/shop/FotoShop";
import { Trascrizione } from "@/components/landing/blocchi";
import { VideoSlot } from "@/components/landing/invisible-derm/VideoSlot";
import { TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { slotUsabile } from "@/shop/cms/vetrina-contenuto";
import type { Blocco } from "@/shop/cms/vetrina-scheda";

type Riga = ProdottoPubblico["caratteristiche"][number];
type Contenuto = Record<string, string | null | undefined>;

export interface SezioniScheda1Props {
  prodotto: ProdottoPubblico;
  blocchi: readonly Blocco[];
  testi?: Contenuto;
  media?: Contenuto;
  parte?: "media" | "testo";
  onConsulenza?: () => void;
}

/** Un testo da mostrare: non vuoto e non ancora senza conferma: niente segnaposto aperto (come le righe di `bloccheScheda`). */
// shortcut: la regola è ripetuta da `vetrina-scheda.ts` (lì non è esportata), da unificare quando T78 la esporta
const DA_SISTEMARE = /\{\{|da\s+confermare/i;
const vero = (s: unknown): s is string => typeof s === "string" && s.trim() !== "" && !DA_SISTEMARE.test(s);
const rigaVera = (r: Riga) => vero(r?.etichetta) && vero(r?.valore);
/** Il titolo provvisorio (non del documento): svuotato dal copywriter, vale il testo di riserva. */
const titolo = (provvisorio: string | undefined, riserva: string) => provvisorio?.trim() || riserva;

const H2 = "text-xl font-bold tracking-tight text-[#0A1430]";
const TESTO = "text-base leading-relaxed text-ink-muted";
const PANNELLO = "@container rounded-[14px] bg-light-panel p-5 sm:p-8";
/** La copertina del video sta in un riquadro 4:5 largo al più 320 px (`max-w-xs`): le misure riservano il posto, il riquadro decide l'aspetto. */
const MISURE_COPERTINA = { width: 320, height: 400 };

/** Le due colonne (media a sinistra) solo quando la sezione stessa è larga: sotto la galleria sul computer resta una colonna. */
const Colonne = ({ media, children }: { media: ReactNode; children: ReactNode }) =>
  media ? (
    <div className="grid gap-6 @2xl:grid-cols-2 @2xl:items-center @2xl:gap-10">
      <div className="flex flex-col gap-4">{media}</div>
      <div>{children}</div>
    </div>
  ) : (
    <div>{children}</div>
  );

function Colore({ testi, media, onConsulenza }: { testi: Contenuto; media: Contenuto; onConsulenza?: () => void }) {
  const id = useId();
  const T = TESTI_SHOP.scheda;
  const foto = slotUsabile(media["shop.coloriFoto"], testi["shop.coloriFoto.alt"]);
  const video = slotUsabile(media["shop.coloriVideo"], testi["shop.coloriVideo.alt"]);
  const copertina = slotUsabile(media["shop.coloriPoster"], testi["shop.coloriPoster.alt"]);
  const testoParlato = vero(testi["shop.coloriTrascrizione"]) ? testi["shop.coloriTrascrizione"] : "";
  const conVideo = video && copertina; // video senza copertina = non si disegna (e con lui il testo parlato)
  return (
    <section aria-labelledby={id} className={PANNELLO}>
      <Colonne
        media={
          (foto || conVideo) && (
            <>
              {foto && <FotoShop src={foto.src} alt={foto.alt} uso="colori" className="w-full rounded-md" />}
              {conVideo && (
                <div className="w-full max-w-xs">
                  <VideoSlot src={video.src} poster={copertina.src} alt={video.alt} titolo={T.coloreLink} misure={MISURE_COPERTINA} />
                  <Trascrizione testo={testoParlato ?? ""} />
                </div>
              )}
            </>
          )
        }
      >
        <h2 id={id} className={H2}>
          {T.coloreTitolo}
        </h2>
        <p className={`mt-3 ${TESTO}`}>{T.coloreTesto}</p>
        {onConsulenza ? (
          <button
            type="button"
            onClick={onConsulenza}
            className="shop-anello mt-2 inline-flex min-h-11 items-center text-left text-base font-semibold text-[#0A1430] underline underline-offset-4"
          >
            {T.coloreChiusura}
          </button>
        ) : (
          <p className={`mt-3 ${TESTO}`}>{T.coloreChiusura}</p>
        )}
      </Colonne>
    </section>
  );
}

function Confezione({ prodotto, titolo: chiave, voci, testi, media }: { prodotto: ProdottoPubblico; titolo: "confezione" | "cosaContiene"; voci: string[]; testi: Contenuto; media: Contenuto }) {
  const id = useId();
  // la foto del prodotto vince; senza, quella globale `shop.pacco`; senza nessuna resta l'elenco
  const sua = prodotto.media.find((m) => m.slot === "confezione" && m.src?.w480);
  const globale = slotUsabile(media["shop.pacco"], testi["shop.pacco.alt"]);
  const foto = sua ? <FotoShop foto={sua.src} alt={sua.alt} uso="pacco" className="w-full rounded-md" /> : globale && <FotoShop src={globale.src} alt={globale.alt} uso="pacco" className="w-full rounded-md" />;
  return (
    <section aria-labelledby={id} className={PANNELLO}>
      <Colonne media={foto}>
        <h2 id={id} className={H2}>
          {chiave === "cosaContiene" ? titolo(TESTI_PROVVISORI.scheda.cosaContiene, "Cosa contiene") : TESTI_SHOP.scheda.confezione}
        </h2>
        <ul role="list" className="mt-4 divide-y divide-ink/10 border-y border-ink/10 text-base text-[#0A1430]">
          {voci.map((v, i) => (
            <li key={i} className="py-3">
              {v}
            </li>
          ))}
        </ul>
      </Colonne>
    </section>
  );
}

function ComeSiUsa({ passi }: { passi: string[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="@container">
      <h2 id={id} className={H2}>
        {TESTI_SHOP.scheda.comeSiUsa}
      </h2>
      {/* `role="list"`: con `list-none` Safari smette di annunciare la lista */}
      <ol role="list" className="mt-4 grid list-none gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {passi.map((p, i) => (
          <li key={i} className="relative rounded-[14px] border border-ink/10 bg-white p-5 pr-20">
            <span className="ng-pillar__num" aria-hidden="true">
              {i + 1}
            </span>
            <p className="text-base leading-relaxed text-[#0A1430]">{p}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SchedaTecnica({ righe }: { righe: Riga[] }) {
  const id = useId();
  const nome = TESTI_SHOP.scheda.schedaTecnica;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={H2}>
        {nome}
      </h2>
      <table className="mt-4 w-full max-w-3xl border-collapse text-left text-base">
        <caption className="sr-only">{nome}</caption>
        <tbody className="divide-y divide-ink/10 border-y border-ink/10">
          {righe.map((r, i) => (
            <tr key={i}>
              <th scope="row" className="w-2/5 py-3 pr-4 align-top font-medium text-ink-muted">
                {r.etichetta}
              </th>
              <td className="py-3 align-top text-[#0A1430]">{r.valore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Avvertenze({ voci }: { voci: string[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={H2}>
        {titolo(TESTI_PROVVISORI.scheda.avvertenze, "Avvertenze")}
      </h2>
      <ul className={`mt-4 max-w-3xl list-disc space-y-2 pl-5 marker:text-ink-muted text-base leading-relaxed text-[#0A1430]`}>
        {voci.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </section>
  );
}

export function SezioniScheda1({ prodotto, blocchi, testi = {}, media = {}, parte, onConsulenza }: SezioniScheda1Props) {
  const inMedia = parte !== "testo";
  const inTesto = parte !== "media";
  const sezioni: ReactNode[] = [];
  for (const b of blocchi) {
    // il colore è solo delle patch (V1-S5): anche se la pagina passa il blocco per errore, sulla cura non c'è
    if (b.id === "colore" && inMedia && prodotto.tipo === "patch") sezioni.push(<Colore key={b.id} testi={testi} media={media} onConsulenza={onConsulenza} />);
    else if (b.id === "confezione" && inMedia) {
      const voci = (b.voci ?? []).filter(vero);
      if (voci.length) sezioni.push(<Confezione key={b.id} prodotto={prodotto} titolo={b.titolo} voci={voci} testi={testi} media={media} />);
    } else if (b.id === "comeSiUsa" && inTesto) {
      const passi = (prodotto.passi ?? []).filter(vero);
      if (passi.length) sezioni.push(<ComeSiUsa key={b.id} passi={passi} />);
    } else if (b.id === "schedaTecnica" && inTesto) {
      const righe = (b.righe ?? []).filter(rigaVera);
      if (righe.length) sezioni.push(<SchedaTecnica key={b.id} righe={righe} />);
    } else if (b.id === "avvertenze" && inTesto) {
      const voci = (b.voci ?? []).filter(vero);
      if (voci.length) sezioni.push(<Avvertenze key={b.id} voci={voci} />);
    }
  }
  return sezioni.length ? <div className="flex flex-col gap-8 sm:gap-10">{sezioni}</div> : null;
}
