/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): la scheda del prossimo (con le risposte del modulo e le note).
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ClipboardList,
  Clock,
  MessageCircle,
  MoreHorizontal,
  Phone,
  PhoneCall,
  RotateCcw,
  Search,
  SkipForward,
  Trash2,
  StickyNote,
  User,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUS_LABEL,
  type Lead,
  type LeadData,
  type LeadStatus,
  type RisposteModulo,
} from "@/crm/types";
import { ICONA_STATO } from "@/crm/SelettoreStatoDialog";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";
import { CLASSE_BADGE_STATO, Scheda, classiStato, dataBreve, etichettaStato } from "@/crm/ui";
import { riassuntoModulo, vociModulo } from "@/crm/modulo-lead";
import { noteDelLead } from "@/crm/import-backup";
import {
  daRifissare,
  etichettaRicarico,
  messaggioRifissa,
  storiaDelRitorno,
  righeRicarico,
  volteRicaricato,
} from "@/crm/importa/ricarico";
import { BarraEsiti } from "@/crm/importa/BarraEsiti";
import { type MotivoDiChiamata } from "@/crm/importa/chi-chiamare";
import { Targhetta } from "@/crm/importa/RigaChiamata";
import { temperaturaLead } from "@/crm/temperatura-lead";

/* ═══════════════════════════════════════════════════════════════════════════
   3. LE NOTE DELLA SCHEDA

   Sono il motivo per cui una telefonata va diversamente dalle altre: «l'ultima
   volta ha detto di richiamarlo dopo le ferie» vale più di qualunque altro
   dato in pagina. Si vedono subito le due più recenti — la storia utile è
   quasi sempre lì — e le altre si aprono, senza cambiare pagina.
   ═════════════════════════════════════════════════════════════════════════ */

/** ── QUELLO CHE HA DETTO LUI, PRIMA DI COMPORRE IL NUMERO ──────────────────
 *  Le risposte date nel modulo dell'inserzione: come vive il problema, se ci
 *  conosce, la zona, e soprattutto QUANDO vuole essere chiamato.
 *  Sta qui e non solo nella scheda perché è qui che si alza la cornetta:
 *  chiamare alle dieci uno che ha scritto «sera» è il modo più veloce di
 *  bruciare un contatto pagato, e quell'informazione c'era già — sepolta in
 *  fondo alle note, dopo un «Dal modulo:».
 *  ⚠️ Niente riquadro quando non c'è niente: una lista caricata a mano non ha
 *   risposte, e un riquadro vuoto in cima alla scheda del prossimo è rumore su
 *   ogni singola telefonata. */
function VociModulo({ modulo }: { modulo?: RisposteModulo }) {
  //  ⚠️ Si legge `moduloLetto` (le risposte salvate + le vecchie + la riga «Dal
  //   modulo:» delle note), non `dati.modulo`: un lead importato prima delle tre
  //   domande nuove ha le risposte solo nelle note, e non va mostrato muto.
  const voci = useMemo(() => vociModulo(modulo), [modulo]);
  if (!voci.length) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        L'ha detto lui nel modulo
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {voci.map((v) => (
          <span
            key={v.campo}
            className="text-[12.5px] leading-snug"
            title={v.testo && v.testo !== v.valore ? v.testo : undefined}
          >
            <span className="text-muted-foreground">{v.titolo}: </span>
            <b
              className={cn(
                "font-semibold",
                v.tono === "buono" ? "text-emerald-700" : "text-foreground",
              )}
            >
              {v.valore}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Note({ dati }: { dati?: Partial<LeadData> | null }) {
  const [tutte, setTutte] = useState(false);
  const note = useMemo(() => noteDelLead(dati), [dati]);
  //  Cambiando lead il riquadro riparte chiuso: restare aperto dal lead
  //  precedente fa credere che le note lunghe siano di questo.
  useEffect(() => setTutte(false), [dati]);

  if (!note.length) return null;
  const visibili = tutte ? note : note.slice(0, 2);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        {note.length === 1 ? "1 nota in scheda" : `${note.length} note in scheda`}
      </div>
      <ul className={cn("space-y-1.5", tutte && "max-h-56 overflow-y-auto overscroll-contain")}>
        {visibili.map((n, i) => (
          <li key={i}>
            {(n.data || n.fonte) && (
              <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">
                {n.data ?? n.fonte}
              </span>
            )}
            <span className="whitespace-pre-wrap break-words text-[12.5px] leading-snug">
              {n.testo}
            </span>
          </li>
        ))}
      </ul>
      {note.length > 2 && (
        <button
          type="button"
          onClick={() => setTutte((v) => !v)}
          className="mt-1.5 text-[11.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {tutte ? "Mostra solo le ultime due" : `Leggi tutte le ${note.length} note`}
        </button>
      )}
    </div>
  );
}

/** ── DUE RIGHE DI SINTESI, IL RESTO A UN TOCCO (28/10/2026) ──────────────────
 *  Prima il riquadro «L'ha detto lui nel modulo» stava aperto in cima alla scheda
 *  e spingeva i pulsanti sotto la piega. Adesso: le due risposte che contano
 *  (`riassuntoModulo`, le stesse della riga «Poi») e «Vedi tutte le risposte» che
 *  apre il riquadro intero. Niente si toglie, si apre con un tocco.
 *  ⚠️ Le risposte sono sempre quelle di `vociModulo`: se la sintesi è vuota non
 *   c'è nemmeno il tasto. */
function SintesiModulo({ modulo }: { modulo?: RisposteModulo }) {
  const [tutte, setTutte] = useState(false);
  const riassunto = useMemo(() => riassuntoModulo(modulo), [modulo]);
  if (!riassunto) return null;
  //  ⚠️ Con le risposte aperte la sintesi di due righe NON si ripete: il riquadro
  //   intero le contiene già, e due volte le stesse risposte sono rumore.
  const bottone = (
    <button
      type="button"
      aria-expanded={tutte}
      onClick={() => setTutte((v) => !v)}
      className="inline-flex min-h-11 items-center text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground md:min-h-0"
    >
      {tutte ? "Nascondi le risposte" : "Vedi tutte le risposte"}
    </button>
  );
  return (
    <div className="space-y-1.5">
      {tutte ? (
        bottone
      ) : (
        <p className="text-[13px] leading-snug">
          <span className="text-muted-foreground">Ha detto: </span>
          <span className="font-medium">{riassunto}</span> {bottone}
        </p>
      )}
      {tutte && <VociModulo modulo={modulo} />}
    </div>
  );
}

/** Le note della scheda, chiuse: «Note (3)» e si aprono. Restano le stesse di
 *  sempre (`Note`), solo più in basso: la telefonata comincia dal numero. */
function NoteChiuse({ dati }: { dati?: Partial<LeadData> | null }) {
  const [aperte, setAperte] = useState(false);
  const n = useMemo(() => noteDelLead(dati).length, [dati]);
  if (n === 0) return null;
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        aria-expanded={aperte}
        onClick={() => setAperte((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground md:min-h-0"
      >
        <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
        Note ({n})
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", aperte && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {aperte && <Note dati={dati} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA SCHEDA DEL PROSSIMO — il cuore della pagina
   ═════════════════════════════════════════════════════════════════════════ */

/** Oltre questa soglia di tentativi a vuoto la domanda cambia: non è più «come
 *  lo raggiungo» ma «vale ancora la pena». Quattro è il numero che il committente
 *  usa a voce; sotto non si dice niente, perché un avviso che compare sempre
 *  smette di essere un avviso. */
const TENTATIVI_TROPPI = 4;

/** I colori del distintivo «che cos'era prima». Gli stessi toni del resto del
 *  CRM, e significano la stessa cosa: verde = è andata bene, ambra = c'è
 *  qualcosa in sospeso, grigio freddo = con noi non ha mai parlato davvero. */
function classiStoria(tono: "neutro" | "buono" | "attesa" | "freddo"): string {
  if (tono === "buono") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (tono === "attesa") return "border-amber-300 bg-amber-50 text-amber-800";
  if (tono === "freddo") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-border bg-muted text-muted-foreground";
}

export function SchedaProssimo({
  lead,
  motivo,
  modulo,
  annuncio,
  origine,
  esiti,
  diRitorno,
  decisione,
  fuoriCoda,
  nomeConsulente,
  posizione,
  totale,
  doveSono = "in coda",
  sopraLaBarra,
  onEsito,
  onAltri,
  esitiAltri,
  onSalta,
  onApri,
  onWhatsAppInviato,
  onElimina,
}: {
  lead: Lead;
  /** ── PERCHÉ È LUI ADESSO ───────────────────────────────────────────────
   *  La targhetta e il suo testo («richiamo alle 15:00, scaduto da 1 h»). `null`
   *  per chi è stato tirato su dalla ricerca senza essere in lista: lì non c'è
   *  nessun motivo da dire, e inventarne uno sarebbe una bugia. */
  motivo: MotivoDiChiamata | null;
  /** Le risposte del modulo, lette da `moduloLetto`. */
  modulo?: RisposteModulo;
  /** «Annuncio · Gruppo», già scritto; vuoto se la lista non ha un annuncio. */
  annuncio: string;
  /** «Google Sheets · Lead HGL» per chi è arrivato dal foglio Google, vuoto per
   *  gli altri: si scrive accanto all'annuncio (crm/importa/origine). */
  origine: string;
  /** gli esiti a un tocco, già filtrati sugli stati validi per questo lead.
   *  Arrivano dalla pagina e non si ricalcolano qui: le scorciatoie 1…4 devono
   *  puntare esattamente ai pulsanti che si vedono, e due elenchi calcolati in
   *  due punti diversi prima o poi si sfasano di una voce. */
  esiti: LeadStatus[];
  /** Gli esiti validi che non stanno in vista: vanno nel menu «Altro». */
  esitiAltri: LeadStatus[];
  /** era già in archivio e il file appena caricato lo ha riportato a galla */
  diRitorno: boolean;
  /** ── LA DECISIONE SUL CONTATTO DI RITORNO ──────────────────────────────
   *  C'è solo quando la scheda aspetta di essere decisa: `null` per tutte le
   *  altre, che sono la stragrande maggioranza e non devono vedere niente.
   *  Le vie sono quelle chieste dal committente: «conferma e rimane così
   *  com'è», «lo sposta fra i da contattare e resetta lo stato», e — aggiunta
   *  dopo — «vedi dopo», che non decide niente e lo manda nella sua linguetta.
   *  ⚠️ La terza non è una scorciatoia per le altre due: è la risposta a «non
   *   lo so adesso», che prima non esisteva e si dava premendo «conferma». */
  decisione?: {
    onConferma: () => void;
    onRimetti: () => void;
    onVediDopo: () => void;
    /** Premuto il tasto di WhatsApp: la pagina ne prende nota e la scheda si
     *  sposta fra gli «Scritti su WhatsApp». Il messaggio si apre comunque. */
    onWhatsApp: () => void;
  } | null;
  /** ── QUESTO NON È IL PROSSIMO DELLA CODA ───────────────────────────────
   *  È qualcuno tirato su dalla ricerca che nella coda di oggi non c'è (ha già
   *  un esito, o una data futura, o non è mai arrivato da una lista). Chi
   *  guarda deve saperlo in una riga, perché tutto il resto della scheda è
   *  identico e senza quella riga si crede di stare avanzando nel giro: il
   *  «2 di 40 in coda» sotto il titolo direbbe una posizione che non esiste.
   *  `onTorna` è la via d'uscita che non scrive niente in archivio. */
  fuoriCoda?: { motivo: string; onTorna: () => void } | null;
  /** Il nome del consulente che segue questa scheda: entra nel messaggio di
   *  WhatsApp come firma. Vuoto = si firma con il solo nome della casa. */
  nomeConsulente?: string;
  posizione: number;
  totale: number;
  /** Con la pillola «Attesa WhatsApp» le righe non sono la coda: lo dice la nota. */
  doveSono?: string;
  /** Una riga sopra i tasti, dentro la barra (l'ultimo esito con «Torna indietro»). */
  sopraLaBarra?: ReactNode;
  onEsito: (stato: LeadStatus) => void;
  onAltri: () => void;
  onSalta: () => void;
  onApri: () => void;
  /** Premuto WhatsApp: la pagina segna il messaggio (crm/importa/attesa-whatsapp)
   *  e il lead compare in «Attesa WhatsApp» finché non ha un esito nuovo. */
  onWhatsAppInviato?: () => void;
  /** ── ELIMINARE IL LEAD DA QUI (richiesta del titolare, 22/10/2026) ─────
   *  «Fai che posso eliminare i lead da lead importati»: si poteva solo da
   *  Altro → Tutta la lista. Qui apre la domanda col nome (la fa la pagina);
   *  manca se chi guarda non ha il permesso (crm/permessi). */
  onElimina?: () => void;
}) {
  const d = lead.data ?? ({} as LeadData);
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  const telefono = String(d.telefono || "");
  const tentativi = Number(d.noRispondeCount) || 0;

  const messaggio = useMemo(() => {
    try {
      return getWhatsAppMessageForStatus(lead);
    } catch {
      //  I modelli dei messaggi sono configurabili: uno rotto non deve
      //  impedire di telefonare, che è il lavoro vero di questa pagina.
      return "";
    }
  }, [lead]);
  const linkWhatsApp = telefono && messaggio ? buildWhatsAppLink(telefono, messaggio) : "";
  //  ── ⚠️ IL MESSAGGIO VA A TUTTI I CONTATTI DI RITORNO ────────────────
  //   Deciso col committente: prima usciva solo per chi aveva avuto un
  //   appuntamento; adesso anche a chi si era solo fatto vivo. Cambia la prima
  //   riga, non il resto — e a chi una consulenza non l'ha mai presa non si
  //   nomina nessuna data. La regola sta in `messaggioRifissa`.
  //   Si firma con il consulente della SCHEDA, non con chi sta al computer:
  //   è la persona che quel cliente ricorda di aver sentito.
  const messaggioRif = useMemo(
    () => messaggioRifissa(d, new Date(), nomeConsulente),
    [d, nomeConsulente],
  );
  const linkRifissa = telefono && messaggioRif ? buildWhatsAppLink(telefono, messaggioRif) : "";

  return (
    <Scheda
      titolo={fuoriCoda ? "Trovato con la ricerca" : "Il prossimo"}
      nota={fuoriCoda ? "fuori dalla coda di oggi" : `${posizione} di ${totale} ${doveSono}`}
      icona={fuoriCoda ? Search : Phone}
    >
      <div className="space-y-3">
        {/*  Prima del nome, perché è la cornice in cui va letto tutto il
            resto: una riga, il tono informativo del CRM (cielo = «si sta
            lavorando adesso»), e il modo di tornare al giro. */}
        {fuoriCoda && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5">
            <p className="flex min-w-0 items-start gap-1.5 text-[12px] text-sky-900">
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fuoriCoda.motivo}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 text-[11.5px] text-sky-900 hover:bg-sky-100"
              onClick={fuoriCoda.onTorna}
            >
              Torna alla coda
            </Button>
          </div>
        )}

        {/* ── CHI È ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[20px] font-semibold leading-tight">{nome}</h3>
              <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                {etichettaStato(d.stato)}
              </span>
              {/*  Il contatto di ritorno si dichiara: cambia il tono della
                  telefonata (non ci si presenta da zero) e cambia gli esiti
                  possibili, che sono quelli di una trattativa. */}
              {(diRitorno || volteRicaricato(d) > 0) && (
                <span
                  className={cn(CLASSE_BADGE_STATO, "border-amber-300 bg-amber-50 text-amber-700")}
                  title="Era già in archivio ed è ricomparso in una lista importata"
                >
                  {/*  Il numero delle volte sta nel distintivo e non in una
                      riga a parte: è la prima cosa che cambia il tono della
                      telefonata — alla terza volta non si chiama come alla
                      prima. */}
                  <RotateCcw className="h-3 w-3 shrink-0" /> {etichettaRicarico(d) || "Di ritorno"}
                </span>
              )}
              {/*  ── ⚠️ E CHE COS'ERA PRIMA ─────────────────────────────────
                  Richiesta del committente: «sui lead di ritorno esca un
                  distintivo: se è stata fatta una consulenza, o se è solo
                  stato caricato, o se non risponde».
                  «Di ritorno» dice che è già passato di qui; questo dice COSA
                  è successo, e sono due telefonate diversissime. La regola sta
                  in `storiaDelRitorno` (crm/importa/ricarico), che legge lo
                  stato di ALLORA quando la scheda è stata rimessa in circolo —
                  altrimenti direbbe «mai chiamato» a chi la consulenza l'aveva
                  fatta. */}
              {(diRitorno || volteRicaricato(d) > 0) && (
                <span
                  className={cn(CLASSE_BADGE_STATO, classiStoria(storiaDelRitorno(d).tono))}
                  title={storiaDelRitorno(d).nota}
                >
                  {storiaDelRitorno(d).etichetta}
                </span>
              )}
            </div>
            {motivo && (
              <Targhetta
                motivo={motivo}
                temperatura={temperaturaLead(modulo, d.qualifica)}
                className="mt-1"
              />
            )}
            <p className="mt-1 text-[12px] text-muted-foreground">
              {[
                d.citta || null,
                d.fonte || null,
                annuncio || null,
                origine || null,
                d.createdAt ? `in lista dal ${dataBreve(d.createdAt)}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "nessun altro dato in scheda"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[17px] font-semibold tabular-nums tracking-wide">
              {telefono || "—"}
            </div>
            {tentativi > 0 && (
              <div
                className={cn(
                  "text-[11.5px]",
                  tentativi >= TENTATIVI_TROPPI
                    ? "font-medium text-rose-600"
                    : "text-muted-foreground",
                )}
              >
                {tentativi === 1 ? "1 tentativo a vuoto" : `${tentativi} tentativi a vuoto`}
              </div>
            )}
          </div>
        </div>

        {tentativi >= TENTATIVI_TROPPI && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700">
            Ha già squillato a vuoto {tentativi} volte. Prima di riprovare, decidi: o si prova a un
            altro orario, o si chiude con «{LEAD_STATUS_LABEL.annullato}» e la lista smette di
            portarselo dietro.
          </p>
        )}

        {/* ── ⚠️ QUESTA PERSONA L'ABBIAMO GIÀ: DECIDI PRIMA DI CHIAMARE ───
            Richiesta del committente: il duplicato finisce qui dentro
            «mantenendo stato attuale, note e tutto», con due vie — conferma e
            resta com'è, oppure torna fra i da contattare con lo stato
            azzerato.
            Sta SOPRA il pulsante che telefona, e non in fondo alla scheda,
            perché è una decisione che cambia la telefonata: alla terza volta
            che una persona ricompare in una lista non si chiama come alla
            prima.
            ⚠️ LE RIGHE QUI DENTRO NON SI POSSONO MODIFICARE, ed è il modo in
             cui è stato chiesto. Non sono un campo protetto: non sono un campo
             affatto — si calcolano da `ricarico` ogni volta che si guardano
             (crm/importa/ricarico.ts), quindi non esiste nessun posto in cui
             riscriverle e non possono sfasarsi dal contatore. */}
        {decisione && (
          <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
              <RotateCcw className="h-3.5 w-3.5" /> Era già in archivio — decidi tu
            </div>
            <ul className="space-y-1">
              {righeRicarico(d).map((r, i) => (
                <li key={i} className="text-[12.5px] leading-snug text-amber-900">
                  {r}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-11 border-amber-300 bg-white text-[12.5px] hover:bg-amber-100 md:h-9"
                onClick={decisione.onConferma}
                title="Non cambia niente: stato, note, appuntamenti e storia restano quelli che sono. Esce solo da questa coda e torna dov'era"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Conferma: lascialo com'è
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 border-amber-300 bg-white text-[12.5px] hover:bg-amber-100 md:h-9"
                onClick={decisione.onRimetti}
                title="Torna «Da contattare» in mezzo agli altri, con i tentativi a vuoto azzerati. Note, appuntamenti e storia NON si toccano"
              >
                <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Rimettilo fra i da contattare
              </Button>
              {/*  ── ⚠️ LA TERZA VIA: «NON LO SO ADESSO» ───────────────────
                  Richiesta del committente. Senza, la risposta onesta non
                  aveva un pulsante e si dava premendo «Conferma» — cioè si
                  lasciava tornare in circolo un duplicato che nessuno aveva
                  guardato, solo per togliersi il riquadro dagli occhi.
                  Sta per ultima e in tono più leggero delle altre due: è un
                  rinvio, non una decisione. */}
              <Button
                size="sm"
                variant="ghost"
                className="h-11 text-[12.5px] text-amber-900 hover:bg-amber-100 md:h-9"
                onClick={decisione.onVediDopo}
                title="Non decide niente: toglie questo riquadro dalla cima della coda e lo ritrovi nella linguetta «Vedi dopo», con le stesse scelte. Lo stato non si tocca e resta chiamabile come tutti gli altri"
              >
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Vedi dopo
              </Button>
              {/*  ── ⚠️ E LA SCHEDA INTERA, DA QUI ─────────────────────────
                  Richiesta del committente: «sui lead di ritorno posso
                  cliccare e aprire la scheda lead». Decidere se una persona
                  torna in circolo guardando quattro righe è la ragione per cui
                  si preme «conferma» a caso: qui dentro c'è chi è, ma non
                  c'è la sua storia. Il pulsante in cima alla scheda esiste, ma
                  è lontano dalla domanda e non si collega a lei. */}
              <Button
                size="sm"
                variant="ghost"
                className="h-11 text-[12.5px] text-amber-900 hover:bg-amber-100 md:h-9"
                onClick={onApri}
                title="Apre la scheda intera: storia, note, appuntamenti e trattativa, per decidere sapendo"
              >
                <User className="mr-1.5 h-3.5 w-3.5" /> Apri la scheda
              </Button>
            </div>
            {/*  ── ⚠️ RIPRENDERE LA CONSULENZA CHE NON SI È FATTA ─────────
                Richiesta del committente: un pulsante che scrive su WhatsApp
                ricordando l'appuntamento che c'era, con la sua data, e chiede
                quando vuole rifissare.
                Compare solo per chi un appuntamento ce l'aveva davvero —
                fissato, rifissato, da riprogrammare, o cliente assente: a
                chiunque altro racconterebbe una cosa mai successa. Il testo lo
                compone `messaggioRifissa` (crm/importa/ricarico), che guarda
                anche lo stato di ALLORA: chi è stato rimesso fra i «da
                contattare» ha lo stato azzerato, ma l'appuntamento mancato è
                successo lo stesso. */}
            {linkRifissa && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-11 w-full border-emerald-300 bg-white text-[12.5px] text-emerald-800 hover:bg-emerald-50 md:h-9"
              >
                {/*  ⚠️ PREMERE QUI NON SEGNA NIENTE: il clic dice soltanto
                    «apri WhatsApp». Al ritorno la pagina chiede se il
                    messaggio è partito davvero, e scrive solo il «sì» — vedi
                    la striscia in fondo. */}
                <a
                  href={linkRifissa}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => decisione.onWhatsApp()}
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  {daRifissare(d) && d.dataMeeting
                    ? `WhatsApp: «rifissiamo la consulenza del ${dataBreve(d.dataMeeting)}?»`
                    : "WhatsApp: «riprendiamo da dove eravamo rimasti»"}
                </a>
              </Button>
            )}
          </div>
        )}

        {/*  Due righe di cosa ha detto nel modulo; il resto si apre. */}
        <SintesiModulo modulo={modulo} />

        {/* ── CHIAMA, WHATSAPP, COM'È ANDATA ───────────────────────────────
            Sul telefono è la barra fissa in basso (BarraEsiti); sul computer sta
            qui, subito sotto la sintesi: il tasto Chiama si vede senza scorrere. */}
        <BarraEsiti
          telefono={telefono}
          linkWhatsApp={linkWhatsApp}
          onWhatsAppInviato={onWhatsAppInviato}
          esiti={esiti}
          onEsito={onEsito}
          inCima={sopraLaBarra}
        />

        <div className="grid grid-cols-3 gap-1 md:flex md:flex-wrap md:items-center md:gap-1.5">
          {/*  ⚠️ DI RADIX: con il menu aperto le scorciatoie 1…4 tacciono, così
               un tasto premuto qui dentro non dà un esito al lead. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-11 w-full gap-1 px-1 text-[13px] md:h-10 md:w-auto md:px-3">
                <MoreHorizontal className="h-3.5 w-3.5" /> Altri esiti
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {esitiAltri.map((s) => {
                const Icona = ICONA_STATO[s];
                return (
                  <DropdownMenuItem key={s} onSelect={() => onEsito(s)} className="min-h-11 md:min-h-0">
                    {Icona && <Icona className="mr-2 h-3.5 w-3.5" />}
                    {LEAD_STATUS_LABEL[s]}
                  </DropdownMenuItem>
                );
              })}
              {esitiAltri.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={onAltri} className="min-h-11 md:min-h-0">
                Tutti gli stati…
              </DropdownMenuItem>
              {onElimina && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={onElimina}
                    className="min-h-11 text-red-700 focus:bg-red-50 focus:text-red-800 md:min-h-0"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Elimina lead…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/*  ⚠️ «Salta» NON È UN ESITO, ma non è più nemmeno gratis: scrive
              due campi sulla scheda (crm/importa/saltati.ts), quindi il gesto
              dura oltre la giornata e lo vede anche il collega. Serve a chi
              trova occupato e non vuole sporcare la scheda con un tentativo
              che non è stato un tentativo — lo stato non si tocca e i KPI non
              se ne accorgono. Il `title` lo dice prima di premere: qui il
              commento diceva ancora «non scrive niente», ed era la frase che
              faceva premere «Salta» credendo di rimandare di due minuti. */}
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-full gap-1 px-1 text-[13px] md:h-10 md:w-auto md:px-3"
            onClick={onSalta}
            title="Mettilo da parte: esce dalla coda e finisce fra i «Lead saltati», anche domani e anche per gli altri. Non è un esito: lo stato resta com'è"
          >
            <SkipForward className="h-3.5 w-3.5" /> Salta
            <span className="hidden rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground md:inline">
              S
            </span>
          </Button>
          <Button size="sm" variant="ghost" className="h-11 w-full gap-1 px-1 text-[13px] md:h-10 md:w-auto md:px-3" onClick={onApri}>
            <User className="h-3.5 w-3.5" /> Apri scheda
          </Button>
        </div>

        <NoteChiuse dati={d} />
      </div>
    </Scheda>
  );
}
