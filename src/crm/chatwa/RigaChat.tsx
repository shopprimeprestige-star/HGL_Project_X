import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Hourglass,
  Lock,
  LockOpen,
  Phone,
  Star,
  Undo2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { FinestraStati, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { numeroDaComporre } from "@/crm/importa/chiamare";
import { statiMenuRiga, pastigliaFinestra } from "./daChiamare";
import { useCRM } from "@/crm/CRMContext";
import { corpoLeggibile } from "@/crm/testo-modello";
import { TemperaturaRiga } from "@/crm/Temperatura";
import { mostraTemperatura } from "@/crm/temperatura-lead";
import { anteprimaRiga, type Spunte } from "./anteprima-riga";
import { IconaMedia } from "./IconaMedia";
import { attesaInChiaro, ultimoDellaChat } from "./stato";
import { ritornoInChat } from "./ritorno";
import { PrimaDelRitorno } from "@/crm/importa/PrimaDelRitorno";
import { linkApriWhatsapp } from "./apriWhatsapp";
import { scadenzaFinestra, segnoConferma } from "./segniRiga";
import { testoPerWhatsapp } from "./testoWhatsapp";
import { IconaWhatsApp } from "./IconaWhatsApp";
import { etichettaRichiamo, stileRichiamo } from "./richiamo";
import { oggiIso } from "@/crm/ui";
import { formatTimeIT, initials, numeroLeggibile } from "./formati";
import type { ChatItem } from "./tipi";

/** Come si disegna una riga: normale, in attesa di risposta, o attenuata (oltre 7 giorni, R10). */
export type ModoRiga = "normale" | "attesa" | "vecchia";

/** Le spunte del mio ultimo messaggio, come nella bolla: lette in azzurro, il resto in grigio. */
function SpunteRiga({ stato }: { stato: Spunte }) {
  const classe = "h-3.5 w-3.5 shrink-0";
  return (
    <>
      {stato === "lette" && (
        <CheckCheck aria-hidden="true" className={cn(classe, "text-sky-600")} />
      )}
      {stato === "consegnato" && <CheckCheck aria-hidden="true" className={classe} />}
      {stato === "inviato" && <Check aria-hidden="true" className={classe} />}
      {stato === "errore" && (
        <AlertCircle aria-hidden="true" className={cn(classe, "text-red-600")} />
      )}
      <span className="sr-only">
        {
          { lette: "Letto", consegnato: "Consegnato", inviato: "Inviato", errore: "Non inviato" }[
            stato
          ]
        }
        {". "}
      </span>
    </>
  );
}

/** Nome da mostrare: scheda, poi nome salvato, poi il numero. */
export function nomeChat(c: ChatItem): string {
  const scheda = c.lead ? `${c.lead.data.nome} ${c.lead.data.cognome}`.trim() : "";
  return scheda || c.contact?.display_name || numeroLeggibile(c.phone);
}

interface RigaChatProps {
  chat: ChatItem;
  modo: ModoRiga;
  attiva: boolean;
  adesso: number;
  onApri: () => void;
  onCreaScheda: () => void;
  onAbbina: () => void;
  /** Le stelle di priorità (0-3) e il tocco che le cambia (vedi useStelle). */
  stelle?: number;
  onStelle?: () => void;
  /** Cambia lo stato del lead dalla riga (salvataggio condiviso: useChatWa.cambiaStatoLead). */
  onCambiaStato?: (lead: Lead, stato: LeadStatus) => void;
  /** Solo in «Da chiamare»: pastiglia verde se si può scrivere (finestra di 24 ore
   *  aperta), rossa se è chiusa e serve un modello approvato. */
  mostraFinestra?: boolean;
  /** È la chat del prossimo meet di oggi (vedi prossimo-meet.ts): la barra in cima la ripete, qui
   *  resta lo sfondo e il bordo viola, così la si riconosce anche scorrendo. */
  prossimoMeet?: boolean;
}

/** Una chat nell'elenco. La riga è un solo bottone; «Crea scheda» e «Abbina» stanno
 *  sotto, fuori dal bottone (un bottone dentro un bottone non è valido e sul telefono
 *  prende il tocco sbagliato). Il nome ha sempre la riga tutta per sé: pastiglia di
 *  stato e numero vanno sotto, così non lo schiacciano. */
export function RigaChat({
  chat: c,
  modo,
  attiva,
  adesso,
  onApri,
  onCreaScheda,
  onAbbina,
  stelle = 0,
  onStelle,
  onCambiaStato,
  mostraFinestra = false,
  prossimoMeet = false,
}: RigaChatProps) {
  //  Con la finestra CHIUSA il bollino con l'icona di WhatsApp c'è in ogni
  //  elenco (richiesta del 29/10/2026: «ogni volta che la finestra è chiusa»);
  //  quello verde «aperta» solo dove serve (`mostraFinestra`).
  const finestra =
    mostraFinestra || c.finestra?.aperta === false ? pastigliaFinestra(c.finestra) : null;
  const [cambiaStato, setCambiaStato] = useState(false);
  const nome = nomeChat(c);
  //  Il numero sotto il nome, anche per gli sconosciuti; se il nome È già il numero non si ripete.
  const numero = numeroLeggibile(c.phone);
  const numeroSotto = nome.replace(/\D/g, "") !== numero.replace(/\D/g, "");
  const telefono = numeroDaComporre(c.phone);
  //  Gli stati di chiamata che la regola del CRM (`statiPer`) ammette per QUESTO lead.
  const ammessi = new Set(c.lead ? statiSelezionabili(c.lead.data) : []);
  const opzioniStato = statiMenuRiga(c.lead?.data.stato, ammessi);
  //  p1-chat-veloce: l'ultimo messaggio anche delle chat vecchie (fuori dai letti),
  //  salvato sul contatto — entrata o uscita. Il più recente dei due.
  const last = ultimoDellaChat(c.lastMessage, c.contact);
  const inAttesa = modo === "attesa" || modo === "vecchia";
  const ambigua = c.schedaAmbigua === true;
  const senzaScheda = !c.lead && (c.senzaScheda ?? true);

  // `dal` c'è sempre se la chat è in attesa; se mancasse, meglio l'ora dell'ultimo messaggio che un «da meno di 1 min» falso.
  const dal = inAttesa ? (c.daRispondere?.dal ?? null) : null;
  const tempo = dal
    ? attesaInChiaro(dal, adesso)
    : formatTimeIT(last?.created_at ?? c.contact?.last_message_at ?? null);
  const { consultants } = useCRM();
  const nomeConsulente =
    consultants.find((x) => x.id === c.lead?.data?.consulenteId)?.data.nome ?? null;
  //  Con la finestra chiusa il link porta già il promemoria giusto nella casella (30/10/2026),
  //  se la scheda ha tutto per scriverlo; altrimenti solo il numero (vedi testoWhatsapp.ts).
  const apriWa =
    finestra && !finestra.aperta
      ? linkApriWhatsapp(
          c.phone,
          typeof navigator === "undefined" ? "" : navigator.userAgent,
          testoPerWhatsapp(c, nomeConsulente, new Date(adesso)),
        )
      : "";
  //  Conferma e finestra in scadenza (30/10/2026): vedi segniRiga.ts.
  const conferma = segnoConferma(c.lead?.data, new Date(adesso));
  const scadenza = scadenzaFinestra(c, adesso);
  //  L'anteprima è SEMPRE l'ultimo messaggio della chat, di chiunque sia (30/10/2026):
  //  anche in «Da rispondere», dove prima si vedeva l'ultimo del cliente. Un nostro
  //  modello («[template:nome]») si legge col suo testo, come nella bolla. Un media si
  //  legge con la sua icona outline, anche se l'anteprima salvata ha l'emoji di prima del 28/10.
  const a = anteprimaRiga({
    ultimo: last,
    contatto: c.contact,
    attesa: c.daRispondere,
    inAttesa,
    vecchia: modo === "vecchia",
    nonLetti: c.unread,
    adesso,
    testoUscita: (corpo) => corpoLeggibile(corpo, c.lead?.data, nomeConsulente, c.lead?.id).testo,
  });
  const ritorno = c.lead ? ritornoInChat(c.lead.data) : null;
  const richiamo = c.lead ? etichettaRichiamo(c.lead.data, oggiIso(new Date(adesso))) : null;

  //  Nessun messaggio in archivio: si dice. Se invece la chat ha messaggi ma
  //  l'ultimo non è fra quelli letti (si leggono gli ultimi 500), la riga
  //  dell'anteprima non si disegna: niente buco vuoto in mezzo alla riga.
  //  `temperatura` dice solo se c'è la riga del numero; il pallino lo decide TemperaturaRiga.
  const temperatura = !!c.lead && mostraTemperatura(c.lead.data.stato);
  const nessunMessaggio = a.nessunMessaggio;
  const rigaAnteprima = a.testo !== "" || nessunMessaggio || c.unread > 0;

  return (
    <li
      className={cn(
        "relative border-b border-border",
        attiva
          ? "bg-emerald-50/60"
          : prossimoMeet && "bg-violet-50/70 ring-1 ring-inset ring-violet-300",
      )}
    >
      {/*  ── LA RIGA, STILE WHATSAPP (29/10/2026) ──────────────────────────────
          Richiesta del titolare: compatta, senza vuoti. Nome e ora sulla prima
          riga, sotto il numero, sotto ancora la finestra di 24 ore (piccola), poi
          l'anteprima. Le pastiglie stanno sotto, vanno a capo e non escono mai. */}
      <button
        type="button"
        onClick={onApri}
        aria-current={attiva ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 pb-1.5 pl-3 pt-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          //  Con la cornetta a destra (44 px + 4 di margine) il testo si ferma prima.
          c.lead && telefono ? "pr-12 md:pr-10" : "pr-3",
        )}
      >
        <Avatar className="h-11 w-11 shrink-0 md:h-10 md:w-10">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
            {c.lead ? initials(c.lead.data.nome, c.lead.data.cognome) : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 md:text-[13px] md:leading-[18px]",
                modo === "vecchia" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {nome}
            </span>
            {/*  A destra della prima riga ci sta SEMPRE di chi è la palla (30/10/2026):
                «da 18 h» in ambra = tocca a noi; «Senza risposta da 2 g» in ardesia con la
                clessidra = tocca a lui. Ardesia e non azzurro: l'azzurro è già nello stato.
                Niente riga in più nell'elenco. Sul tablet (colonna stretta) restano
                clessidra e durata, la frase c'è per chi legge con lo schermo. */}
            {a.senzaRisposta ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 text-[11px] font-medium leading-5 tabular-nums text-slate-700 md:leading-[18px]"
                title={`Hai scritto tu per ultimo e il cliente non ha ancora risposto (${a.senzaRisposta.da})`}
              >
                <Hourglass aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span>
                  <span className="md:max-lg:sr-only">Senza risposta</span>
                  {a.senzaRisposta.daOre && ` ${a.senzaRisposta.breve}`}
                </span>
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap text-[12px] tabular-nums md:text-[11px]",
                  modo === "attesa" ? "font-semibold text-amber-700" : "text-muted-foreground",
                )}
              >
                {tempo}
              </span>
            )}
          </span>
          {/*  Il numero, e a destra sotto l'ora com'è messo il cliente (28/10/2026):
              pallino e parola, niente risposte brevi (le risposte sono nel tasto
              info della chat). Sulla riga del numero c'è posto, e la riga delle
              pastiglie resta a stato, richiamo e stelle. */}
          {(numeroSotto || temperatura) && (
            <span className="flex items-baseline justify-end gap-2 text-[12px] leading-4 md:text-[11px]">
              {numeroSotto && (
                <span className="min-w-0 flex-1 truncate tabular-nums text-muted-foreground">
                  {numero}
                </span>
              )}
              {c.lead && mostraTemperatura(c.lead.data.stato) && (
                <TemperaturaRiga dati={c.lead.data} max={0} className="shrink-0 text-[11px]" />
              )}
            </span>
          )}
          {/*  Finestra di 24 ore (29/10/2026, solo in «Da chiamare»), sotto il
              numero come chiesto dal titolare: verde = si può scrivere, rossa =
              finestra chiusa, serve un modello. Testo piccolo, non pastiglia. */}
          {/*  Con il link (finestra chiusa) qui resta solo il posto, invisibile: il
              link vero sta fuori dal bottone della riga (un link dentro un bottone
              non è valido) e si appoggia esattamente su questo posto. */}
          {finestra && (
            <span
              aria-hidden={apriWa ? true : undefined}
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium leading-4",
                finestra.aperta ? "text-emerald-700" : "text-red-700",
                apriWa && "invisible",
              )}
              title={apriWa ? undefined : finestra.titolo}
            >
              {finestra.aperta ? (
                <LockOpen aria-hidden="true" className="h-3 w-3 shrink-0" />
              ) : (
                <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
              )}
              {finestra.testo}
              {apriWa && <span className="h-3.5 w-3.5 shrink-0" />}
            </span>
          )}
          {rigaAnteprima && (
            <span className="mt-0.5 flex items-center gap-2">
              {/*  Chi ha scritto l'ultimo (30/10/2026): se sono io, davanti ci sono le
                  spunte e «Tu:» e NON si tagliano (shrink-0); si taglia solo il testo, con
                  i puntini, su una riga. Se è del cliente, niente prefisso; da leggere =
                  grassetto scuro. */}
              <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] leading-[18px] text-muted-foreground md:text-[12px] md:leading-4">
                {a.mio && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {a.spunte && <SpunteRiga stato={a.spunte} />}
                    <span className="font-medium">Tu:</span>
                  </span>
                )}
                {a.media && <IconaMedia tipo={a.media} className="shrink-0" />}
                <span
                  className={cn("min-w-0 truncate", a.nonLetto && "font-semibold text-foreground")}
                >
                  {nessunMessaggio ? "Nessun messaggio" : a.testo}
                </span>
              </span>
              {c.unread > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold leading-none text-white">
                  {c.unread > 99 ? "99+" : c.unread}
                  <span className="sr-only"> non letti</span>
                </span>
              )}
            </span>
          )}
        </span>
      </button>

      {/*  ── CORNETTA (28/10/2026) ───────────────────────────────────────────
          Su ogni riga con la scheda: apre il compositore con il numero (sul Mac lo
          passa all'iPhone). Fuori dal bottone della riga e con stopPropagation, così
          non apre la chat; 44 px di tocco sul telefono. */}
      {c.lead && telefono && (
        <Button
          asChild
          variant="ghost"
          className="absolute right-1 top-0 h-11 w-11 p-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 md:top-0.5 md:h-9 md:w-9"
        >
          <a
            href={`tel:${telefono}`}
            aria-label={`Chiama ${nome}`}
            title={`Chiama ${nome}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4" />
          </a>
        </Button>
      )}

      {/*  ── FINESTRA CHIUSA: APRI WHATSAPP (29/10/2026) ──────────────────────
          L'icona di WhatsApp e il tocco apre l'app sul numero (Business prima, su
          Android): lì si scrive a mano. Sotto il numero, sul posto lasciato nel
          bottone della riga: in alto 10 px + nome + numero (20+16 sul telefono,
          18+16 dal computer). Tocco da 44 px sul telefono con `after:`. */}
      {finestra && !finestra.aperta && apriWa && (
        <a
          href={apriWa}
          //  wa.me in una scheda nuova (il CRM resta aperto); il link Android si apre e basta.
          target={apriWa.startsWith("https:") ? "_blank" : undefined}
          rel="noopener noreferrer"
          title={`${finestra.titolo}. Tocca per aprire la chat nell'app WhatsApp`}
          aria-label="Finestra chiusa: apri la chat nell'app WhatsApp"
          className={cn(
            "absolute left-[68px] inline-flex h-4 items-center gap-1 rounded-sm text-[11px] font-medium leading-4 text-red-700 after:absolute after:-inset-x-1 after:-inset-y-3.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:left-16 md:after:-inset-y-1",
            numeroSotto || temperatura ? "top-[46px] md:top-[44px]" : "top-[30px] md:top-[28px]",
          )}
        >
          <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
          {finestra.testo}
          <IconaWhatsApp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        </a>
      )}

      {/*  ── STATO, RICHIAMO, RITORNO E STELLE ─────────────────────────────────
          Sotto il bottone della riga e non dentro: lo stato si cambia da qui (un
          bottone dentro un bottone non è valido e sul telefono prende il tocco
          sbagliato). Il tasto dello stato apre la STESSA finestra del resto del CRM
          (FinestraStati) con gli stati di chiamata; il salvataggio è `onCambiaStato`.
          Le pastiglie vanno a capo (`flex-wrap`) e quelle lunghe si accorciano
          (`max-w-full` + `truncate`): nessuna esce dallo schermo a 375 px.
          ⚠️ I TOCCHI RESTANO DA 44 PX SENZA ALZARE LA RIGA: stato e stelle sono
           alti ~22 px a vista, e sul telefono un `after:` trasparente allarga
           l'area del tocco sopra e sotto (dal computer non serve). */}
      {(c.lead || onStelle) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 pb-2.5 pl-[68px] pr-3 md:pl-16">
          {c.lead && (
            <button
              type="button"
              onClick={() => setCambiaStato(true)}
              aria-haspopup="dialog"
              aria-label={`Stato: ${LEAD_STATUS_LABEL[c.lead.data.stato]}. Cambialo`}
              title={`${LEAD_STATUS_LABEL[c.lead.data.stato]} · cambia stato`}
              className="relative inline-flex min-w-0 max-w-full items-center rounded-full after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:hidden"
            >
              <span
                className={cn(
                  "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
                  LEAD_STATUS_COLOR[c.lead.data.stato],
                )}
              >
                <span className="truncate">{LEAD_STATUS_LABEL[c.lead.data.stato]}</span>
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
              </span>
            </button>
          )}
          {/*  ── CONFERMA E FINESTRA IN SCADENZA (30/10/2026) ───────────────────
              Solo per gli appuntamenti fissati. «Confermato» verde con la spunta,
              «Da confermare» arancione col pallino: testo semplice, senza bordo, per
              non sembrare un altro stato. «chiude tra…» ambra con l'orologio: scrivi
              ora, gratis, prima che serva un modello. Stanno nella riga delle
              pastiglie (che va a capo): nessun allargamento a 375 px. */}
          {conferma && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4",
                conferma.tipo === "confermato" ? "text-emerald-700" : "text-orange-700",
              )}
              title={conferma.titolo}
            >
              {conferma.tipo === "confermato" ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              ) : (
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              )}
              {conferma.testo}
            </span>
          )}
          {scadenza && (
            <span
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 tabular-nums text-amber-800"
              title={scadenza.titolo}
            >
              <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
              {scadenza.testo}
            </span>
          )}
          {/*  Quando richiamarlo (29/10/2026): la data messa nella finestra dello
              stato, rossa se è passata. A vista senza «Richiamo» (lo dice
              l'icona del calendario, e lo stato accanto spesso è già «Richiamo
              concordato»): così stato e data stanno sulla stessa riga. */}
          {richiamo && (
            <span
              className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 tabular-nums",
                stileRichiamo(richiamo),
              )}
              title={richiamo.titolo}
            >
              <CalendarClock aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">
                <span className="sr-only">Richiamo </span>
                {richiamo.testo.replace(/^Richiamo /, "")}
              </span>
            </span>
          )}
          {/*  Di ritorno (28/10/2026): nella riga solo «Ritorno» con l'icona, lo stato di
              prima nell'intestazione della chat e nel tooltip. */}
          {ritorno && (
            <span
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-700"
              title={ritorno.titolo}
            >
              {/*  Icona outline al posto della freccia (28/10/2026). */}
              <Undo2 aria-hidden="true" className="h-3 w-3 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">{ritorno.corta}</span>
            </span>
          )}
          {/*  «prima: …» (30/10/2026): sotto la fila delle pastiglie, a filo dello
              stato. `order-last basis-full` la manda a capo da sola senza toccare
              stelle e pastiglie; l'icona ↩ c'è già nella pastiglia del ritorno. */}
          {c.lead && (
            <PrimaDelRitorno
              dati={c.lead.data}
              icona={false}
              className="order-last -mt-1 basis-full pl-2"
            />
          )}
          {/*  ── LE STELLE, DALLA LISTA (28/10/2026) ───────────────────────────
              Un tocco ne aggiunge una (0 → 1 → 2 → 3 → 0). Sempre in fondo a
              destra, sotto la cornetta; se non c'è posto vanno a capo, a destra. */}
          {onStelle && (
            <button
              type="button"
              onClick={onStelle}
              className="relative ml-auto inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md px-1 after:absolute after:inset-x-0 after:-inset-y-2.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:hidden"
              aria-label={`Priorità di ${nome}: ${stelle} su 3. Tocca per cambiare`}
              title={
                stelle
                  ? `In osservazione: ${stelle} su 3 · tocca per cambiare`
                  : "Metti in osservazione"
              }
            >
              {[1, 2, 3].map((i) => (
                <Star
                  key={i}
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4",
                    i <= stelle ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40",
                  )}
                />
              ))}
            </button>
          )}
        </div>
      )}
      {c.lead && (
        <FinestraStati
          aperta={cambiaStato}
          onChiudi={() => setCambiaStato(false)}
          stato={c.lead.data.stato}
          opzioni={opzioniStato}
          contesto={`${nome} · adesso: ${LEAD_STATUS_LABEL[c.lead.data.stato]}`}
          onScegli={(s) => {
            setCambiaStato(false);
            if (c.lead) onCambiaStato?.(c.lead, s);
          }}
        />
      )}

      {(senzaScheda || ambigua) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-3 pl-[68px] pr-3">
          <span className="text-[12px] text-muted-foreground">
            {ambigua ? "Più schede con questo numero" : "Numero senza scheda"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {!ambigua && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCreaScheda}
                className="h-11 px-3 text-[13px] md:h-8 md:text-xs"
              >
                Crea scheda
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAbbina}
              className="h-11 px-3 text-[13px] md:h-8 md:text-xs"
            >
              Abbina a una scheda
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
