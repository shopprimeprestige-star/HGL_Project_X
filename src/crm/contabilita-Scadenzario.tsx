/** ── LE SCADENZE, IN PAGINA ────────────────────────────────────────────────
 *
 *  Il calendario fiscale del periodo, con quanto manca a ognuna. Le date e le
 *  regole — compreso lo slittamento del sabato e delle feste — stanno tutte in
 *  `crm/contabilita-scadenze`: qui si disegna e basta.
 *
 *  ── ⚠️ LA PRIMA È GRANDE, LE ALTRE NO ─────────────────────────────────────
 *  Un elenco di otto scadenze tutte uguali si guarda una volta e poi diventa
 *  arredamento. Quella che viene prima ha la sua riga, con il conto alla
 *  rovescia scritto in chiaro e il colore che cambia man mano che si avvicina;
 *  le altre stanno sotto, piccole, perché servono a sapere che ci sono — non a
 *  essere lette tutti i giorni.
 *  ───────────────────────────────────────────────────────────────────────── */
import { AlertTriangle, CalendarClock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Scheda, dataBreve } from "./ui";
import { useChiusure } from "./contabilita-chiusure";
import {
  PREAVVISO_AVVISO,
  prossimeScadenze,
  type RegimeLiquidazione,
  type TipoScadenza,
} from "./contabilita-scadenze";

/** Il colore lo dà QUANTO MANCA, non il tipo di scadenza: una liquidazione
 *  fra due mesi non è un allarme, e una comunicazione fra due giorni sì. */
function tinta(mancano: number) {
  if (mancano <= 3) return "border-rose-200 bg-rose-50 text-rose-900";
  if (mancano <= PREAVVISO_AVVISO) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

const ETICHETTA: Record<TipoScadenza, string> = {
  iva: "IVA",
  lipe: "LIPE",
  estero: "Estero",
  intrastat: "INTRASTAT",
  imposte: "Imposte",
  acconto: "Acconto",
  dichiarazione: "Dichiarazione",
};

const quanto = (g: number) =>
  g < 0 ? `${-g} giorni fa` : g === 0 ? "oggi" : g === 1 ? "domani" : `fra ${g} giorni`;

export function Scadenzario({
  oggi,
  regime,
  onCambiaRegime,
}: {
  oggi: string;
  regime: RegimeLiquidazione;
  onCambiaRegime: (r: RegimeLiquidazione) => void;
}) {
  //  ⚠️ QUI SI MOSTRANO ANCHE QUELLE FATTE: sapere che una cosa è stata fatta
  //   è un'informazione, e una scadenza che sparisce dall'elenco appena si
  //   spunta fa dubitare di averla spuntata. A saltarle sono il badge del menu
  //   e la striscia di «Da fare oggi», cioè chi INSISTE — non chi racconta.
  const { chiuse, segna } = useChiusure();
  const prossime = prossimeScadenze(oggi, regime, 7);
  const prima = prossime[0];
  const fattaIl = prima ? chiuse[prima.id] : undefined;

  return (
    <Scheda
      titolo="Scadenze"
      nota="Le date ordinarie di una S.r.l.s. con esercizio solare. Le proroghe dell'ultimo minuto le sa il commercialista"
      icona={CalendarClock}
      azioni={
        <div className="flex rounded-md border border-slate-200 p-0.5">
          {(["trimestrale", "mensile"] as RegimeLiquidazione[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onCambiaRegime(r)}
              className={cn(
                "rounded px-2 py-1 text-[11.5px] font-medium capitalize transition",
                regime === r ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              IVA {r}
            </button>
          ))}
        </div>
      }
      senzaPadding
    >
      {prima && (
        <div
          className={cn(
            "border-b px-4 py-3",
            fattaIl ? "border-emerald-200 bg-emerald-50 text-emerald-900" : tinta(prima.mancano),
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-semibold">{prima.titolo}</span>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums">
              {quanto(prima.mancano)}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed opacity-90">
            {dataBreve(prima.giorno)}
            {prima.giorno !== prima.giornoLegale && (
              <>
                {" "}
                — cadeva il {dataBreve(prima.giornoLegale)}, che è sabato o festa: slitta al primo
                giorno lavorativo
              </>
            )}
          </p>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed">{prima.cosa}</p>
          {prima.dettaglio && (
            <p className="mt-1 text-[12px] leading-relaxed opacity-80">{prima.dettaglio}</p>
          )}
          {/*  ⚠️ SOLO SULLA LIQUIDAZIONE. «Chiudi la contabilità del periodo»
              è la cosa da fare prima di versare l'IVA; sull'invio delle
              fatture estere allo SDI non c'entra niente — lì la cosa da fare
              è mandarle, e lo dicono già le due righe qui sopra. Una
              raccomandazione fuori posto insegna a saltare anche quelle
              giuste. */}
          {prima.tipo === "iva" && prima.mancano <= PREAVVISO_AVVISO && !fattaIl && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-medium">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Chiudi la contabilità di {prima.periodo}: carica le fatture che mancano e controlla
              che ogni costo abbia il suo documento.
            </p>
          )}
          {/*  ── ⚠️ «ME NE SONO OCCUPATO», NON «LO STATO HA INCASSATO» ──────
              La spunta la mette una persona e si può togliere: il CRM non sa
              se l'F24 è andato a buon fine e non fa finta di saperlo. Da qui
              in poi questa scadenza non chiede più niente — il conto alla
              rovescia nel menu e la striscia di «Da fare oggi» la saltano. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {fattaIl ? (
              <>
                <span className="flex items-center gap-1.5 text-[12px] font-medium">
                  <Check className="h-3.5 w-3.5" />
                  Segnata come fatta il {dataBreve(fattaIl)}: non te la ricordo più
                </span>
                <button
                  type="button"
                  onClick={() => void segna(prima.id, false)}
                  className="rounded-full border border-emerald-300 px-2.5 py-0.5 text-[11.5px] font-medium hover:bg-emerald-100"
                >
                  Non era vero, riaprila
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void segna(prima.id, true)}
                className="rounded-full border border-current/30 bg-white/70 px-3 py-1 text-[12px] font-semibold transition hover:bg-white"
              >
                Fatto: me ne sono occupato
              </button>
            )}
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {prossime.slice(1).map((s) => (
          /*  La spiegazione in parole normali sta nel tooltip: nell'elenco
              servirebbero otto righe di testo per dire otto cose che, oggi,
              non riguardano nessuno. */
          <li
            key={s.id}
            title={`${s.cosa}${s.dettaglio ? `\n\n${s.dettaglio}` : ""}`}
            className="flex items-baseline gap-3 px-4 py-2 text-[12.5px]"
          >
            <span className="w-[86px] shrink-0 rounded bg-slate-100 px-1.5 py-px text-center text-[10.5px] font-semibold uppercase tracking-wide text-slate-600">
              {ETICHETTA[s.tipo]}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.titolo}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {dataBreve(s.giorno)}
            </span>
            <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
              {chiuse[s.id] ? "fatta" : quanto(s.mancano)}
            </span>
          </li>
        ))}
      </ul>
    </Scheda>
  );
}
