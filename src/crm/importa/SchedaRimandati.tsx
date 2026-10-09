/** ─────────────────────────────────────────────────────────────────────────
 *  «VEDI DOPO» — le decisioni sui contatti di ritorno, rimandate
 *
 *  DA DOVE ARRIVA
 *  Richiesta del committente: «oltre a conferma e rimettilo fra i da
 *  contattare mettilo "vedi dopo", e poi ho una scheda con tutti i "vedi dopo"
 *  dove ho le due opzioni conferma o rimettilo tra i contattare».
 *
 *  PERCHÉ SERVIVA
 *  La domanda «questa persona l'abbiamo già: che ne facciamo?» arriva SEMPRE
 *  nel momento sbagliato — in cima alla coda, mentre si sta telefonando. Le
 *  vie erano due, e nessuna delle due era «non lo so adesso»: per togliersi il
 *  riquadro giallo dagli occhi si finiva col premere «Conferma», cioè con una
 *  decisione presa per fretta. Un duplicato tornava a circolare senza che
 *  nessuno l'avesse guardato, ed è esattamente ciò che quel riquadro esisteva
 *  per evitare.
 *
 *  COSA C'È QUI DENTRO, E COSA NO
 *  Ci sono le DUE decisioni vere, le stesse del riquadro, con le stesse parole:
 *  chi arriva qui deve riconoscerle, non impararle di nuovo. E c'è la scheda
 *  intera a un clic sul nome — l'altra richiesta del committente — perché
 *  decidere se una persona torna in circolo guardando quattro righe è
 *  precisamente il motivo per cui si preme «conferma» a caso.
 *  Non c'è il terzo pulsante: rimandare una cosa già rimandata è il modo di
 *  non deciderla mai, e questa schermata esiste per chiuderle.
 *
 *  ⚠️ RIMANDARE NON È SALTARE. Il salto (crm/importa/saltati.ts) toglie la
 *   persona dalla CODA delle telefonate. Qui è messa da parte la DOMANDA: chi
 *   è in questo elenco resta in coda al suo turno e si chiama come tutti gli
 *   altri. Confonderli vorrebbe dire smettere di telefonare ai rimandati.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, type ComponentType } from "react";
import { Check, Clock, MessageCircle, PhoneCall, RotateCcw, Undo2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Lead, LeadData } from "@/crm/types";
import {
  BarraSelezione,
  CLASSE_BADGE_STATO,
  Scheda,
  Vuoto,
  classiStato,
  dataBreve,
  etichettaStato,
} from "@/crm/ui";
import { buildWhatsAppLink } from "@/crm/whatsapp";
import {
  attesaWhatsApp,
  etichettaRicarico,
  eWhatsappConfermato,
  messaggioRifissa,
  righeRicarico,
  storiaDelRitorno,
  volteScritto,
} from "./ricarico";
//  Le spunte, il Maiusc+clic e il tetto sono gli stessi di «Tutta la lista» e
//  dei «Messi da parte»: una selezione che si comporta in due modi diversi
//  nella stessa pagina si impara due volte.
import { useSelezioneRighe, testoSelezionaTutti } from "./selezione";

/** I colori del distintivo «che cos'era prima»: gli stessi toni del resto del
 *  CRM, e significano la stessa cosa. */
const classiStoria = (tono: "neutro" | "buono" | "attesa" | "freddo"): string =>
  tono === "buono"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : tono === "attesa"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tono === "freddo"
        ? "border-slate-300 bg-slate-100 text-slate-600"
        : "border-border bg-muted text-muted-foreground";

export function SchedaRimandati({
  rimandati,
  titolo = "Vedi dopo",
  nota,
  vuotoTitolo = "Nessuna decisione rimandata",
  vuotoTesto = "Qui finiscono i contatti di ritorno su cui hai premuto «Vedi dopo». Quando ce n'è uno, lo trovi con le stesse due scelte: confermarlo com'è, o rimetterlo fra i da contattare.",
  icona = Clock,
  onConferma,
  onRimetti,
  onApri,
  onWhatsApp,
  onInviato,
  onNonInviato,
  nomeConsulente,
  inBlocco,
}: {
  /** Le schede di questo elenco. Arrivano dalla pagina già filtrate e ordinate
   *  (`eRimandato`, `eContattatoWhatsApp`): dove sta una scheda lo decide il
   *  modulo, e non si ridecide qui. */
  rimandati: Lead[];
  /*  ── ⚠️ LO STESSO ELENCO SERVE A DUE LINGUETTE ────────────────────────
      «Vedi dopo» e «Scritti su WhatsApp» sono la stessa domanda in due
      momenti, con le stesse due decisioni e le stesse righe: due componenti
      gemelli si sarebbero scostati al primo ritocco, e allora la stessa scheda
      avrebbe due aspetti a seconda della linguetta da cui la si guarda. Cambia
      solo come si chiama l'elenco e cosa dice quando è vuoto. */
  titolo?: string;
  nota?: string;
  vuotoTitolo?: string;
  vuotoTesto?: string;
  icona?: ComponentType<{ className?: string }>;
  onConferma: (l: Lead) => void;
  onRimetti: (l: Lead) => void;
  /** Apre la scheda intera del lead: è la richiesta del committente, ed è il
   *  gesto che rende questa schermata utile invece che un secondo elenco. */
  onApri: (l: Lead) => void;
  /** Premuto il tasto di WhatsApp: la pagina ne prende nota. Il messaggio si
   *  apre comunque — qui non si intercetta niente, si segna e basta. */
  onWhatsApp?: (l: Lead) => void;
  /** ── ⚠️ IL CHECK E LA X ───────────────────────────────────────────────
   *  Richiesta del committente: «quando clicco contatta su WhatsApp spostalo
   *  su contattati su WhatsApp, e lì posso cliccare un check se è stato
   *  contattato oppure una X se non ho inviato il messaggio».
   *  Ci sono solo dove ha senso — nella linguetta di chi è stato scritto — e
   *  per questo sono facoltativi: nella scheda «Vedi dopo» quella domanda non
   *  esiste, e un pulsante che non c'entra è un pulsante che si preme per
   *  sbaglio. */
  onInviato?: (l: Lead) => void;
  onNonInviato?: (l: Lead) => void;
  /** Come si chiama il consulente che segue una scheda: entra nel messaggio di
   *  WhatsApp come firma. La risposta la dà la pagina, che ha l'elenco dei
   *  collaboratori; qui non si sa nemmeno che esistano. */
  nomeConsulente?: (id?: string | null) => string;
  /** ── ⚠️ I GESTI DI GRUPPO ──────────────────────────────────────────────
   *  Misurato in archivio il 7/10: sedici persone scritte su WhatsApp, tutte
   *  lo stesso giorno in cinquanta minuti, nessuna chiusa nove giorni dopo, e
   *  quattordici su sedici mai confermate col ✓. Il reparto registrava un
   *  debito e non dava nessun modo di smaltirlo: cinque tocchi per persona,
   *  sedici volte, uno alla volta.
   *  Qui l'elenco diventa selezionabile e le stesse tre decisioni si danno a
   *  un gruppo. Senza questa proprietà l'elenco resta esattamente com'era —
   *  niente spunte, niente barra — perché dove le righe sono tre le spunte
   *  sono rumore.
   *  ⚠️ LE SCRITTURE SONO LE STESSE DELLE RIGHE SINGOLE: le passa la pagina
   *   (`confermaRitorno`, `rimettiFraIDaContattare`, `confermaWhatsApp`), e
   *   non ne esiste una seconda versione qui dentro. */
  inBlocco?: {
    /** «Decisione presa, resta com'è»: chiude la domanda. */
    onConferma: (righe: Lead[]) => void;
    /** «Rimettili fra i da contattare»: lo stato riparte da capo. */
    onRimetti: (righe: Lead[]) => void;
    /** «Sì, questi messaggi sono partiti»: solo dove la domanda esiste. */
    onInviati?: (righe: Lead[]) => void;
  };
}) {
  /*  ⚠️ I GANCI STANNO SOPRA L'USCITA ANTICIPATA, sempre: sotto, il giorno in
      cui l'elenco si svuota il componente perde i suoi stati e React si ferma.
      C'è una prova che lo impedisce (proveDeiGanci). */
  const sel = useSelezioneRighe(rimandati);
  /*  ── ⚠️ I MESSAGGI APERTI E MAI CONFERMATI ───────────────────────────
      Il ✓ dice «questo è partito davvero», e quattordici volte su sedici non
      lo preme nessuno — non perché non interessi, ma perché costa un secondo
      viaggio per persona: si apre WhatsApp, si scrive, si torna qui, si cerca
      la riga, si preme. Invece di chiederlo riga per riga lo si chiede UNA
      volta, su tutti quelli rimasti in sospeso. */
  const daConfermare = useMemo(
    () => rimandati.filter((l) => l.data?.ricarico?.whatsappIl && !eWhatsappConfermato(l)),
    [rimandati],
  );

  if (rimandati.length === 0)
    return <Vuoto titolo={vuotoTitolo} icona={icona} testo={vuotoTesto} />;

  const sceglibile = !!inBlocco;
  const scelte = sel.selezionati;

  return (
    <>
      <Scheda
        titolo={titolo}
        nota={
          nota ??
          `${rimandati.length === 1 ? "1 decisione rimandata" : `${rimandati.length} decisioni rimandate`} · i più vecchi in cima`
        }
        icona={icona}
        senzaPadding
        azioni={
          sceglibile ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={sel.tuttiSelezionati ? sel.azzera : sel.selezionaTutti}
            >
              {testoSelezionaTutti(sel.tuttiSelezionati, sel.tettoStretto, rimandati.length)}
            </Button>
          ) : undefined
        }
      >
        {/*  ── ⚠️ UNA DOMANDA SOLA, INVECE DI QUATTORDICI ───────────────────
             Misurato: quattordici messaggi su sedici aperti e mai confermati.
             Il ✓ riga per riga costa un secondo viaggio a persona — si apre
             WhatsApp, si scrive, si torna qui, si cerca la riga — e infatti
             non lo preme quasi nessuno. Qui la stessa domanda si fa una volta
             su tutti quelli in sospeso, con la via d'uscita accanto per chi
             non li ha mandati tutti.
             ⚠️ Da due in su: su una riga sola il tasto della riga è già lì. */}
        {inBlocco?.onInviati && daConfermare.length >= 2 && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-amber-900">
            <p className="text-[13px] font-semibold">
              {daConfermare.length} messaggi aperti e mai confermati
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-amber-800">
              Il tasto apre WhatsApp, non lo manda: finché nessuno conferma, qui non si sa se quei
              messaggi sono partiti — e si rischia di riscrivere a chi ha già ricevuto.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => inBlocco.onInviati?.(daConfermare)}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Li ho mandati tutti
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-amber-300 bg-white/60 text-amber-900 hover:bg-white"
                onClick={() => sel.tieniSolo(daConfermare.map((l) => l.id))}
                title="Li prende tutti in selezione: togli quelli che non hai mandato e poi conferma dalla barra in basso"
              >
                Scelgo io quali
              </Button>
            </div>
          </div>
        )}
        <ul className="divide-y divide-border">
          {rimandati.map((l) => (
            <Riga
              key={l.id}
              lead={l}
              scelta={sceglibile ? sel.selezione.has(l.id) : undefined}
              onScegli={sceglibile ? (blocco: boolean) => sel.scegli(l.id, blocco) : undefined}
              onConferma={() => onConferma(l)}
              onRimetti={() => onRimetti(l)}
              onApri={() => onApri(l)}
              onWhatsApp={onWhatsApp ? () => onWhatsApp(l) : undefined}
              onInviato={onInviato ? () => onInviato(l) : undefined}
              onNonInviato={onNonInviato ? () => onNonInviato(l) : undefined}
              firma={nomeConsulente?.(l.data?.consulenteId) ?? ""}
            />
          ))}
        </ul>
      </Scheda>

      {/*  La barra è la stessa del resto della pagina, e i tre gesti sono le
          tre decisioni possibili su un debito: «è partito», «chiudo», «lo
          rimetto in coda». */}
      {inBlocco && (
        <BarraSelezione conteggio={scelte.length} onAnnulla={sel.azzera}>
          {inBlocco.onInviati && (
            <Button
              type="button"
              size="sm"
              className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => inBlocco.onInviati?.(scelte)}
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Mandati davvero
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => inBlocco.onConferma(scelte)}
            title="Chiude la domanda: le schede restano esattamente come sono e tornano fra i lead normali"
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Chiudi, resta com'è
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => inBlocco.onRimetti(scelte)}
            title="Rimette le schede fra i «Da contattare» con lo stato azzerato: tornano in coda come tutti gli altri"
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Rimetti fra i da contattare
          </Button>
        </BarraSelezione>
      )}
    </>
  );
}

function Riga({
  lead,
  scelta,
  onScegli,
  onConferma,
  onRimetti,
  onApri,
  onWhatsApp,
  onInviato,
  onNonInviato,
  firma,
}: {
  lead: Lead;
  /** Spunta a sinistra: c'è solo dove i gesti di gruppo esistono. */
  scelta?: boolean;
  onScegli?: (blocco: boolean) => void;
  onConferma: () => void;
  onRimetti: () => void;
  onApri: () => void;
  onWhatsApp?: () => void;
  onInviato?: () => void;
  onNonInviato?: () => void;
  /** Il nome del consulente della scheda: chi il cliente ricorda di aver
   *  sentito. Vuoto = si firma con il solo nome della casa. */
  firma?: string;
}) {
  const d = lead.data ?? ({} as LeadData);
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  const telefono = String(d.telefono || "");
  //  Vuoto per chi un appuntamento non l'ha mai avuto: a quello il messaggio
  //  racconterebbe una cosa mai successa. La regola sta in `ricarico`.
  //  ⚠️ Va a TUTTI i contatti di ritorno, anche a chi un appuntamento non l'ha
  //   mai avuto: cambia la prima riga, e a quelli non si nomina nessuna data.
  //   La regola — e il testo — stanno in `ricarico`.
  const messaggio = messaggioRifissa(d, new Date(), firma);
  const confermato = eWhatsappConfermato(lead);
  //  `null` su chi non è stato scritto: nella linguetta «Vedi dopo» non c'è
  //  nessuna attesa da raccontare, e un'etichetta in più sarebbe rumore.
  const attesa = attesaWhatsApp(lead);
  const linkRifissa = telefono && messaggio ? buildWhatsAppLink(telefono, messaggio) : "";

  const volte = volteScritto(d);

  return (
    <li className={cn("px-4 py-3", onScegli && "flex items-start gap-3")}>
      {/*  ── LA SPUNTA STA FUORI DAL RESTO ────────────────────────────────
           Dentro la riga ci sono già quattro pulsanti: la spunta ha la sua
           colonna a sinistra, con il bersaglio allargato a trentadue pixel
           come nelle altre schede — su un telefono sedici pixel sbagliano un
           tocco su tre. */}
      {onScegli && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.06]">
          <Checkbox
            checked={!!scelta}
            onCheckedChange={() => onScegli(false)}
            onClick={(e) => onScegli(e.shiftKey)}
            aria-label={`Seleziona ${nome}`}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {/*  ── IL NOME È IL PULSANTE ────────────────────────────────────────
          Richiesta del committente: «posso cliccare e aprire la scheda lead
          e vedere la scheda lead proprio». Tutta la riga sarebbe un bersaglio
          più grande, ma qui dentro ci sono altri tre pulsanti: una riga
          cliccabile con dentro dei pulsanti è il modo di aprire una finestra
          mentre si voleva premere «Conferma». */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={onApri}
            className="min-w-0 flex-1 text-left"
            title="Apre la scheda intera: storia, note, appuntamenti e trattativa"
          >
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold underline-offset-2 hover:underline">
                {nome}
              </span>
              <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                {etichettaStato(d.stato)}
              </span>
              <span
                className={cn(CLASSE_BADGE_STATO, "border-amber-300 bg-amber-50 text-amber-700")}
              >
                <RotateCcw className="h-3 w-3 shrink-0" /> {etichettaRicarico(d) || "Di ritorno"}
              </span>
              {/*  Che cos'era prima: la stessa regola della coda, perché è la
                stessa domanda (vedi `storiaDelRitorno`). */}
              <span
                className={cn(CLASSE_BADGE_STATO, classiStoria(storiaDelRitorno(d).tono))}
                title={storiaDelRitorno(d).nota}
              >
                {storiaDelRitorno(d).etichetta}
              </span>
              {/*  ── ⚠️ DA QUANTO ASPETTA, E SE È PARTITO DAVVERO ───────────
                 Richiesta del committente. In questo reparto ogni riga è un
                 DEBITO: una persona a cui abbiamo scritto e che non ha
                 risposto. Finché sono tre righe si guardano a occhio; a venti,
                 quella di sei giorni fa è identica a quella di stamattina — e
                 ci resta per sempre.
                 ⚠️ Il colore non sposta e non scrive niente: dice soltanto
                  chi è stato dimenticato. Niente si muove da solo (scelta del
                  committente), e la regola dei giorni sta in `attesaWhatsApp`,
                  dove si può provare. */}
              {attesa && (
                <span
                  className={cn(
                    CLASSE_BADGE_STATO,
                    attesa.tono === "rosso"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : attesa.tono === "ambra"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-slate-50 text-slate-600",
                  )}
                  title={
                    attesa.confermato
                      ? "Il messaggio è stato confermato come mandato. Il colore dice da quanto aspetti una risposta."
                      : "Il tasto WhatsApp è stato premuto, ma nessuno ha ancora confermato col ✓ che il messaggio sia partito davvero."
                  }
                >
                  <Clock className="h-3 w-3 shrink-0" /> {attesa.testo}
                </span>
              )}
              {/*  ── QUANTE VOLTE GLI ABBIAMO SCRITTO ────────────────────
                   `attesa` dice da quanto, questo dice quante: senza, una
                   persona scritta tre volte senza mai una risposta si legge
                   come una scritta stamattina, e si continua a riscrivere a
                   chi non risponderà. Dalla seconda in su, perché «1 volta» è
                   il caso normale e non va detto. */}
              {volte > 1 && (
                <span
                  className={cn(CLASSE_BADGE_STATO, "border-red-300 bg-red-50 text-red-700")}
                  title="Gliene è stato mandato più di uno e non ha mai risposto: di solito è il momento di chiudere, non di riscrivere"
                >
                  <MessageCircle className="h-3 w-3 shrink-0" /> scritto {volte} volte
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
              {[
                telefono || "senza telefono",
                d.citta || null,
                d.dataMeeting ? `consulenza del ${dataBreve(d.dataMeeting)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0 text-[12px]" onClick={onApri}>
            <User className="mr-1 h-3.5 w-3.5" /> Apri scheda
          </Button>
        </div>

        {/*  Le righe non modificabili: si calcolano da `ricarico` ogni volta che
          si guardano, quindi non possono sfasarsi dal contatore. Qui servono
          più che altrove — è la schermata in cui si decide a freddo, giorni
          dopo, senza ricordarsi perché era stato rimandato. */}
        <ul className="mt-1.5 space-y-0.5">
          {righeRicarico(d).map((r, i) => (
            <li key={i} className="text-[12px] leading-snug text-muted-foreground">
              {r}
            </li>
          ))}
        </ul>

        {/*  ── ⚠️ È PARTITO DAVVERO? ─────────────────────────────────────────
           Premere «WhatsApp» apre soltanto la chat: in mezzo c'è una persona
           che può ripensarci, sbagliare conversazione o non trovare il numero.
           La scheda si sposta qui SUBITO — così il lavoro fatto si vede e non
           torna a interrompere le telefonate — e la conferma si dà da qui.
           Stanno per primi e staccati dagli altri due: sono la domanda di
           questa linguetta, le decisioni vere (conferma / rimetti) vengono
           dopo che si sa com'è andata. */}
        {(onInviato || onNonInviato) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {confermato ? (
              <span
                className={cn(
                  CLASSE_BADGE_STATO,
                  "border-emerald-300 bg-emerald-50 text-emerald-700",
                )}
              >
                <Check className="h-3 w-3 shrink-0" /> Messaggio mandato
              </span>
            ) : (
              <span className="text-[12px] text-muted-foreground">Il messaggio è partito?</span>
            )}
            {onInviato && !confermato && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-emerald-300 text-[12px] text-emerald-800 hover:bg-emerald-50"
                onClick={onInviato}
                title="Segna che il messaggio è stato mandato davvero. La scheda resta qui, in attesa della risposta"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Sì, l'ho mandato
              </Button>
            )}
            {onNonInviato && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-rose-300 text-[12px] text-rose-800 hover:bg-rose-50"
                onClick={onNonInviato}
                title="Non è stato mandato niente: la scheda torna in coda com'era, e nessuno resta ad aspettare una risposta che non può arrivare"
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> No, non l'ho mandato
              </Button>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            onClick={onConferma}
            title="Non cambia niente: stato, note, appuntamenti e storia restano quelli che sono. Esce da questo elenco e torna dov'era"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" /> Conferma: lascialo com'è
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            onClick={onRimetti}
            title="Torna «Da contattare» in mezzo agli altri, con i tentativi a vuoto azzerati. Note, appuntamenti e storia NON si toccano"
          >
            <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Rimettilo fra i da contattare
          </Button>
          {linkRifissa && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 border-emerald-300 text-[12px] text-emerald-800 hover:bg-emerald-50"
            >
              {/*  ⚠️ PREMERE QUI NON SEGNA NIENTE, e prima lo faceva.
                Segnalazione del committente: «se clicco WhatsApp cambia subito
                stato come fatto, ma se non mando il messaggio è errato».
                Il clic dice soltanto «apri WhatsApp»: in mezzo c'è una persona
                che può ripensarci o sbagliare chat. Qui si avvisa la pagina,
                che al ritorno CHIEDE se il messaggio è partito davvero; scrive
                solo il «sì». Il collegamento resta un collegamento. */}
              <a href={linkRifissa} target="_blank" rel="noreferrer" onClick={() => onWhatsApp?.()}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                {d.dataMeeting
                  ? `WhatsApp: rifissiamo quella del ${dataBreve(d.dataMeeting)}`
                  : "WhatsApp: riprendiamo da dove eravamo"}
              </a>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
