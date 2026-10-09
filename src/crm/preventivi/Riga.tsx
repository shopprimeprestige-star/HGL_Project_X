/** ── PREVENTIVI · LA RIGA ──────────────────────────────────────────────────
 *
 *  A COSA RISPONDE, SENZA UN CLIC
 *  A CHI è intestato · QUANTO vale · QUANDO scade · A CHE PUNTO è, sia il
 *  documento sia la persona. Poi, e solo poi, i comandi.
 *
 *  ── QUATTRO COMANDI VISIBILI, NON SETTE ───────────────────────────────────
 *  WhatsApp · Copia il link · lo stato del preventivo · «…».
 *  L'ordine è quello della FREQUENZA: scrivere e mandare il link si fanno dieci
 *  volte al giorno, cancellare una volta al mese. shop/QuotesPanel.tsx è la
 *  controprova di cosa succede altrimenti: sette icone in fila, tutte dello
 *  stesso peso, con il cestino attaccato ad «Apri» — due bersagli vicini sono
 *  un errore che aspetta, e infatti lì c'è un commento che lo dice.
 *
 *  ── QUELLO CHE SI APRE SOLO SE SERVE ──────────────────────────────────────
 *  L'OFFERTA (voci, upsell, sconto, note del cliente) e il PERCORSO (data di
 *  inizio e cinque passaggi) stanno a fisarmonica, chiusi. Prima erano ~40
 *  righe di pagina per OGNI preventivo, sempre aperte: «cosa gli ho offerto» è
 *  una domanda che ci si fa DOPO aver deciso chi chiamare, e il percorso è il
 *  lavoro di chi produce, non di chi vende.
 *
 *  ⚠️ TRE TRAPPOLE VERE, TUTTE E TRE GIÀ COSTATE
 *   1. gli hook stanno TUTTI sopra qualunque uscita anticipata: questa riga ha
 *      pannelli e fisarmoniche, e un hook saltato è la schermata bianca in
 *      produzione (React 310, già successo qui);
 *   2. lo stato scritto a mano in passato NON deve sparire dal menu: senza la
 *      sua `<option>`, aprire la tendina cambierebbe stato al preventivo senza
 *      che nessuno l'abbia deciso;
 *   3. la data di inizio del percorso si salva con un TASTO. Prima stava su un
 *      `onBlur` di un campo con `defaultValue`: chi la scriveva e chiudeva la
 *      fisarmonica senza uscire dal campo non salvava niente, e non lo sapeva.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  CopyPlus,
  ExternalLink,
  Film,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Package,
  Phone,
  Save,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink, segnapostiResidui } from "@/crm/whatsapp";
import { linkPreventivo } from "@/shop/quote-link";
import { CLASSE_BADGE_STATO, Chip, Scheda, dataBreve, eur } from "@/crm/ui";
import { Finestra, NotaFinestra, Pannello, SezioneFinestra, VoceScelta } from "@/crm/ui/Finestra";
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { modoConsegna } from "@/crm/spedizione";
import { posaFatta, type Lead, type LeadStatus } from "@/crm/types";
import {
  MESSAGGI,
  componiPerPreventivo,
  messaggioDi,
  numeroPerWhatsApp,
  type ChiaveMessaggio,
} from "./messaggi";
import { PASSAGGI, STATI, perStato, quandoScade, type RigaPreventivo, type Voce } from "./dati";

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL PANNELLO DI WHATSAPP — si LEGGE prima di mandare
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ NON APRE WHATSAPP DIRETTAMENTE ────────────────────────────────
 *  Altrove nel CRM (la postazione delle chiamate) il tasto WhatsApp è un
 *  collegamento diretto, e va bene: lì il messaggio dipende solo dallo stato ed
 *  è stato scritto per quello stato. Qui dentro ci va un LINK GENERATO IN
 *  QUELL'ISTANTE — se la sessione non nasce, o il numero del preventivo è
 *  sbagliato, il cliente riceve un link morto e ce ne accorgiamo quando non
 *  risponde più. Un secondo di lettura prima dell'invio è il prezzo giusto, e
 *  `segnapostiResidui` esiste esattamente per questo momento.
 *
 *  ⚠️ IL LINK SI COSTRUISCE SOLO QUANDO SERVE. `linkPreventivo` non è una
 *   funzione pura: apre (o riusa) la sessione di consulenza e la registra sul
 *   server insieme al numero del preventivo. Chiamarla a ogni render, o su un
 *   preventivo che si sta solo guardando, vorrebbe dire aprire sessioni che
 *   nessuno ha chiesto. Qui si chiama una volta, quando il pannello si apre su
 *   un messaggio che il link ce l'ha davvero. */
function PannelloWhatsApp({
  voce,
  consulente,
  onCopiaLink,
}: {
  voce: Voce;
  /** il nome che finisce in {consulente}: chi sta scrivendo adesso */
  consulente: string;
  onCopiaLink: () => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [scelta, setScelta] = useState<ChiaveMessaggio>("invio");
  const [link, setLink] = useState("");

  const conLink = messaggioDi(scelta).conLink;

  //  La sessione si apre qui, e solo qui: pannello aperto + messaggio che
  //  contiene {link}. Il link resta valido finché il pannello è aperto, quindi
  //  cambiare messaggio e tornare indietro non ne apre un secondo.
  useEffect(() => {
    if (!aperto || !conLink || link) return;
    try {
      setLink(linkPreventivo(voce.q.quote_ref));
    } catch (e) {
      //  Non si tace: senza link il messaggio parte monco e il cliente non
      //  riceve niente da aprire.
      toast.error("Link del preventivo non generato", {
        description: e instanceof Error ? e.message : "Riprova, o copia il link dal preventivo.",
      });
    }
  }, [aperto, conLink, link, voce.q.quote_ref]);

  const numero = numeroPerWhatsApp(voce.q.telefono);
  const testo = useMemo(
    () =>
      componiPerPreventivo(scelta, {
        nome: voce.q.nome || "",
        cognome: voce.cognome,
        consulente,
        link,
      }),
    [scelta, voce.q.nome, voce.cognome, consulente, link],
  );
  const residui = useMemo(() => segnapostiResidui(testo), [testo]);
  //  Il link manca ma il messaggio lo prevede: la riga sparirebbe da sola
  //  (regola di `componiMessaggio`), quindi non si vede nessun buco — ed è
  //  proprio per questo che va detto, altrimenti si manda un invito ad aprire
  //  un preventivo senza il preventivo.
  const linkMancante = conLink && !link;
  const pronto = !!numero && !linkMancante && residui.length === 0;

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-emerald-300 bg-emerald-50 text-[12.5px] text-emerald-800 hover:bg-emerald-100"
          title={`Scrivi a ${voce.q.nome || "questo cliente"} su WhatsApp`}
        >
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
        </Button>
      </PopoverTrigger>
      <Pannello
        align="start"
        className="w-[22rem]"
        titolo="Scrivi al cliente"
        contesto={`${voce.intestatario} · ${voce.q.telefono}`}
      >
        <div className="space-y-2.5">
          {/*  I momenti, non i modelli: chi scrive sceglie «sta valutando», non
              «modello sta_valutando». */}
          <div className="flex flex-wrap gap-1">
            {MESSAGGI.map((m) => (
              <button
                key={m.chiave}
                type="button"
                onClick={() => setScelta(m.chiave)}
                title={m.nota}
                aria-pressed={scelta === m.chiave}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[11.5px] font-medium transition",
                  scelta === m.chiave
                    ? "border-slate-400 bg-slate-200/70 text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {m.etichetta}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-slate-500">{messaggioDi(scelta).nota}</p>

          {/*  Il messaggio si LEGGE, non si indovina. In sola lettura: qui non
              si scrivono testi nuovi — i modelli si correggono da /CRM/whatsapp,
              una volta per tutte le pagine, non riga per riga. */}
          <div className="max-h-44 overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-slate-800">
            {testo}
          </div>

          {residui.length > 0 && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              Nel messaggio è rimasto {residui.join(", ")}: arriverebbe scritto così al cliente.
              Correggi il modello in <b>CRM → WhatsApp</b> prima di mandarlo.
            </NotaFinestra>
          )}
          {linkMancante && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              Il link del preventivo non è stato generato: il messaggio partirebbe senza la riga che
              lo contiene. Chiudi e riapri, oppure copia il link a mano.
            </NotaFinestra>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onCopiaLink();
                setAperto(false);
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copia il link
            </Button>
            <Button
              asChild={pronto}
              size="sm"
              className="flex-1"
              disabled={!pronto}
              title={
                !numero
                  ? "Questo preventivo non ha un numero"
                  : linkMancante
                    ? "Manca il link"
                    : residui.length > 0
                      ? "Nel messaggio c'è un segnaposto non sostituito"
                      : "Apre WhatsApp con il messaggio già scritto"
              }
            >
              {pronto ? (
                <a
                  href={buildWhatsAppLink(numero, testo)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setAperto(false)}
                >
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Scrivi
                </a>
              ) : (
                <span>
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Scrivi
                </span>
              )}
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            Fuori da qui esce solo il link del preventivo: nessuna cifra, nessun dato che il cliente
            non abbia già.
          </p>
        </div>
      </Pannello>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL «…» — quello che si fa una volta ogni tanto
   ═════════════════════════════════════════════════════════════════════════ */

/** Una finestra e non un menu a tendina: i menu a tendina vivono in un portale
 *  fuori dal tema chiaro del CRM (vedi ui/Finestra.tsx) e sul telefono si aprono
 *  fuori dallo schermo. Stessa scelta già fatta per le azioni della posa. */
function FinestraAzioni({
  voce,
  aperta,
  onCambio,
  conRegistrazione,
  onScheda,
  onRegistrazione,
  onDuplica,
  onElimina,
}: {
  voce: Voce;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  conRegistrazione: boolean;
  onScheda: (l: Lead) => void;
  onRegistrazione: (ref: string) => void;
  /** Fa nascere lo stesso preventivo con un numero e una scadenza nuovi.
   *  La scrittura è della pagina: qui non si sa nemmeno che esista un database. */
  onDuplica: () => void;
  onElimina: () => void;
}) {
  const { q } = voce;
  const lead = voce.aggancio?.lead ?? null;
  //  Il numero come lo vuole `tel:`: spazi e parentesi sono caratteri che certi
  //  telefoni non compongono. Resta il `+`, l'unico segno che cambia davvero la
  //  chiamata.
  const componibile = q.telefono
    ? `${q.telefono.trim().startsWith("+") ? "+" : ""}${q.telefono.replace(/\D/g, "")}`
    : "";

  const fai = (azione: () => void) => {
    onCambio(false);
    azione();
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="sm"
      icona={MoreHorizontal}
      titolo="Azioni"
      contesto={`${q.quote_ref} · ${voce.intestatario}`}
      classeCorpo="space-y-3"
    >
      <SezioneFinestra titolo="Apri" classeCorpo="p-3 space-y-1.5">
        <VoceScelta
          icona={ExternalLink}
          titolo="Il preventivo"
          nota="La pagina come la vede il cliente"
          onClick={() =>
            fai(() =>
              window.open(
                `/preventivo?id=${encodeURIComponent(q.quote_ref)}`,
                "_blank",
                "noopener",
              ),
            )
          }
        />
        <VoceScelta
          icona={Package}
          titolo="Il percorso"
          nota="Selfie, video, colore, produzione, installazione"
          onClick={() =>
            fai(() =>
              window.open(`/percorso?id=${encodeURIComponent(q.quote_ref)}`, "_blank", "noopener"),
            )
          }
        />
        {lead && (
          <VoceScelta
            icona={UserRound}
            titolo="La scheda del cliente"
            nota="Stato, agenda, installazione, chiusura"
            onClick={() => fai(() => onScheda(lead))}
          />
        )}
        {conRegistrazione && (
          <VoceScelta
            icona={Film}
            titolo="La registrazione della consulenza"
            nota="La videochiamata in cui è nato questo preventivo"
            onClick={() => fai(() => onRegistrazione(q.quote_ref))}
          />
        )}
      </SezioneFinestra>

      {!!q.telefono && (
        <SezioneFinestra titolo="Il numero" classeCorpo="p-3 space-y-1.5">
          {/*  ⚠️ Sul computer un collegamento `tel:` può non fare NULLA se non
              c'è un programma per telefonare: il tasto sembra rotto e si preme
              tre volte. Per questo accanto c'è sempre «copia», che funziona
              ovunque — stessa scelta già fatta nella postazione delle chiamate. */}
          <VoceScelta
            icona={Phone}
            titolo={q.telefono}
            nota="Apre il programma per telefonare, se su questo computer c'è"
            onClick={() => fai(() => window.open(`tel:${componibile}`, "_self"))}
          />
          <VoceScelta
            icona={Copy}
            titolo="Copia il numero"
            onClick={() =>
              fai(() => {
                void navigator.clipboard
                  ?.writeText(q.telefono)
                  .then(() => toast.success("Numero copiato"))
                  .catch(() =>
                    toast.message("Copia il numero a mano", { description: q.telefono }),
                  );
              })
            }
          />
        </SezioneFinestra>
      )}

      {/* ── ⚠️ RIFARE LO STESSO PREVENTIVO ────────────────────────────────
          Richiesta del committente: «fai che un preventivo posso duplicarlo
          dalla lista preventivi con un pulsante».
          Un preventivo scade. Quando il cliente si rifà vivo due settimane
          dopo, l'unica strada era rifare la configurazione da capo — e
          bastava dimenticare una voce per mandargli un prezzo diverso da
          quello che aveva letto.
          Sta in una sezione sua, fra «apri» ed «elimina»: non è un modo di
          guardare il preventivo e non è un gesto distruttivo, ma scrive in
          archivio, quindi non va confuso con i primi. */}
      <SezioneFinestra titolo="Fanne un altro" classeCorpo="p-3">
        <VoceScelta
          icona={CopyPlus}
          titolo="Duplica il preventivo"
          nota="Stessa offerta e stesso cliente, con un numero e una scadenza nuovi. Stato «nuovo», percorso da rifare."
          onClick={() => fai(onDuplica)}
        />
      </SezioneFinestra>

      <SezioneFinestra titolo="Toglilo dall'archivio" classeCorpo="p-3">
        <VoceScelta
          icona={Trash2}
          titolo="Elimina il preventivo"
          nota="Non si annulla. La conferma dice cosa sparisce."
          onClick={() => fai(onElimina)}
        />
      </SezioneFinestra>
    </Finestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LE DUE FISARMONICHE
   ═════════════════════════════════════════════════════════════════════════ */

function Offerta({ voce }: { voce: Voce }) {
  const { q, edit } = voce;
  const qta = edit?.qty ?? q.qty ?? 1;
  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
      <p className="font-medium">
        {q.base_choice || "Soluzione non indicata"}
        {qta > 1 ? ` · ${qta} impianti` : ""}
        {/*  La quantità cambiata dopo la creazione va detta: è la ragione
            numero uno per cui il totale non è più quello del documento. */}
        {edit?.qty && edit.qty !== (q.qty ?? 1) ? (
          <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
            (erano {q.qty ?? 1})
          </span>
        ) : null}
      </p>
      {q.upsells && q.upsells.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
          {q.upsells.map((u, i) => (
            <li key={`${u.id}-${i}`} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">+ {u.name}</span>
              <span className="shrink-0 tabular-nums">{eur(u.price)}</span>
            </li>
          ))}
        </ul>
      )}
      {Number(q.discount_eur) > 0 && (
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-emerald-700">
          <Tag className="h-3 w-3" />
          {q.discount_code}: −{eur(Number(q.discount_eur))}
        </p>
      )}
      {Number(edit?.extraEur) > 0 && (
        <p className="mt-1 text-[12px] text-emerald-700">
          Sconto del consulente: −{eur(Number(edit?.extraEur))}
        </p>
      )}
      {(edit?.codes ?? []).map((c) => (
        <p key={c.code} className="mt-1 text-[12px] text-emerald-700">
          Codice {c.code} applicato dopo: −{eur(Number(c.eur) || 0)}
        </p>
      ))}
      {(q.eta || q.grey_pct != null || q.color_code) && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {[
            q.eta ? `${q.eta} anni` : "",
            q.grey_pct != null ? `${q.grey_pct}% bianchi` : "",
            q.color_code ? `colore ${q.color_code}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {q.problemi && (
        <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
          <span className="font-medium">Dichiarato dal cliente:</span> {q.problemi}
        </p>
      )}
      {/*  ── LE NOTE DI CONSULENZA ────────────────────────────────────────
          Vivono in `quote_edit.notes` e questa pagina prima non le vedeva
          affatto: erano leggibili solo dal pannello del presentatore. Sono la
          cosa che serve a chi riprende in mano il preventivo fra una settimana
          — cioè il lettore tipico di questo elenco. */}
      {(edit?.notes ?? []).length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Note di consulenza
          </p>
          <ul className="mt-1 space-y-1">
            {(edit?.notes ?? []).map((n, i) => (
              <li key={`${n.at}-${i}`} className="text-[12px] leading-snug">
                <span className="whitespace-pre-wrap">{n.text}</span>
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  {dataBreve(n.at)}
                  {n.by ? ` · ${n.by}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Si scrivono dal pannello «Preventivi attivi» del presentatore. Qui si leggono.
          </p>
        </div>
      )}
    </div>
  );
}

function Percorso({
  q,
  onInizio,
  onPassaggio,
}: {
  q: RigaPreventivo;
  onInizio: (id: string, data: string) => Promise<boolean>;
  onPassaggio: (q: RigaPreventivo, chiave: string) => void | Promise<void>;
}) {
  const iniziale = (q.timeline_start ?? q.created_at).slice(0, 10);
  const [data, setData] = useState(iniziale);
  const [salvando, setSalvando] = useState(false);
  //  Cambiando preventivo il campo riparte dal suo valore: la riga si rimonta
  //  di rado, e una data rimasta addosso da un'altra scheda si salverebbe.
  useEffect(() => setData(iniziale), [iniziale]);
  const daSalvare = data !== iniziale;

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          Data di inizio
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-[11.5px]"
          />
        </label>
        {/*  ⚠️ Il tasto compare solo quando c'è qualcosa da salvare, e finché c'è
            si vede: prima il salvataggio stava su `onBlur`, cioè su un gesto che
            nessuno sa di dover fare. */}
        {daSalvare && (
          <Button
            size="sm"
            className="h-7 text-[11.5px]"
            disabled={salvando}
            onClick={() => {
              setSalvando(true);
              void onInizio(q.id, data).finally(() => setSalvando(false));
            }}
          >
            <Save className="mr-1 h-3 w-3" /> {salvando ? "Salvo…" : "Salva la data"}
          </Button>
        )}
        <a
          href={`/percorso?id=${encodeURIComponent(q.quote_ref)}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] hover:underline"
        >
          Come lo vede il cliente <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PASSAGGI.map(([chiave, etichetta]) => {
          const fatto = !!q.timeline_steps?.[chiave];
          return (
            <button
              key={chiave}
              type="button"
              onClick={() => void onPassaggio(q, chiave)}
              aria-pressed={fatto}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] transition",
                fatto
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {fatto && <Check className="h-3 w-3" />}
              {etichetta}
            </button>
          );
        })}
      </div>
      {/*  ⚠️ Questa spunta NON sa niente dell'agenda pose: si può segnare
          «Installazione» con l'installazione ancora da programmare. È il
          percorso che il cliente vede, non il lavoro del tecnico — quello sta
          in CRM → Installazioni, e la riga sopra ci porta con un clic. */}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Sono le tappe che il cliente vede sulla sua pagina. La posa vera — giorno, ora, installatore
        — si programma dalle Installazioni: spuntare qui non fissa niente.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA RIGA
   ═════════════════════════════════════════════════════════════════════════ */

export function RigaPreventivoScheda({
  voce,
  consulente,
  conRegistrazione,
  onStatoPreventivo,
  onStatoLead,
  onScheda,
  onRegistrazione,
  onCopiaLink,
  onInizio,
  onPassaggio,
  onDuplica,
  onElimina,
}: {
  voce: Voce;
  consulente: string;
  conRegistrazione: boolean;
  onStatoPreventivo: (id: string, stato: string) => void | Promise<void>;
  onStatoLead: (lead: Lead, stato: LeadStatus) => void;
  onScheda: (l: Lead) => void;
  onRegistrazione: (ref: string) => void;
  onCopiaLink: (ref: string) => void;
  onInizio: (id: string, data: string) => Promise<boolean>;
  onPassaggio: (q: RigaPreventivo, chiave: string) => void | Promise<void>;
  /** Fa nascere lo stesso preventivo con un numero e una scadenza nuovi. */
  onDuplica: () => void;
  onElimina: () => void;
}) {
  //  ⚠️ Tutti gli hook stanno qui, sopra qualunque ramo: sotto non c'è nessun
  //  `return` anticipato, e non deve nascerne uno.
  const [offerta, setOfferta] = useState(false);
  const [percorso, setPercorso] = useState(false);
  const [azioni, setAzioni] = useState(false);

  const { q } = voce;
  const stato = perStato(q.status);
  const lead = voce.aggancio?.lead ?? null;

  //  Il colore della scadenza è lo stesso del resto del CRM: rosa = passata,
  //  ambra = sta per passare, grigio = c'è tempo. Su un preventivo accettato la
  //  scadenza non è più un problema di nessuno e resta muta.
  const tonoScadenza = voce.chiuso
    ? "text-muted-foreground"
    : voce.giorni < 0
      ? "text-rose-600"
      : voce.giorni <= 2
        ? "text-amber-600"
        : "text-muted-foreground";

  const posa = lead?.data?.installazione?.dataInstallazione;
  const modo = lead ? modoConsegna(lead) : null;

  return (
    <Scheda classeCorpo="p-3 sm:p-4">
      {/* ── 1. CHI È, QUANTO VALE, A CHE PUNTO È IL DOCUMENTO ─────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border bg-muted px-1.5 font-mono text-[12px] font-semibold leading-5">
          {q.quote_ref}
        </span>
        <span className="min-w-0 truncate text-[14px] font-semibold">{voce.intestatario}</span>
        {stato && (
          <Chip tono={stato.tono} punto>
            {stato.etichetta}
          </Chip>
        )}
        <span className="ml-auto text-right">
          <span className="block text-[17px] font-semibold leading-tight tabular-nums">
            {eur(voce.totale)}
            {/*  ⚠️ Il totale è ricostruito: quello a database non cambia mai, le
                modifiche del consulente vivono a parte. Quando la cifra esatta
                non è ricavabile da qui — codice sconto aggiunto dopo, oppure
                quantità cambiata (l'analisi in sede si paga una volta sola e da
                qui non si sa separarla) — si dichiara approssimata invece di
                dirla al telefono come certa. Il perché per esteso sta in
                `totaleApprossimato`, dati.ts. */}
            {voce.approssimato && (
              <span
                title="La cifra esatta è quella sulla pagina del preventivo: qui è ricostruita, e su questo preventivo è stato aggiunto un codice sconto o è cambiata la quantità. Aprilo prima di dirla al cliente."
                className="ml-1 align-middle text-[11px] font-medium text-amber-600"
              >
                ≈
              </span>
            )}
          </span>
          {voce.totaleOriginale != null && (
            <span
              className="block text-[11px] font-medium text-muted-foreground line-through tabular-nums"
              title="Il totale con cui il preventivo era nato"
            >
              {eur(voce.totaleOriginale)}
            </span>
          )}
        </span>
      </div>

      {/* ── 2. COME LO RAGGIUNGO, CHI L'HA FATTO, QUANDO SCADE ────────────── */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        {/*  La scadenza per PRIMA: è la sola informazione che dice cosa fare
            adesso, e in un elenco si legge quella in testa alla riga. */}
        <span className={cn("font-medium tabular-nums", tonoScadenza)}>
          {voce.accettato
            ? "accettato · la scadenza non conta più"
            : `${quandoScade(voce.giorni)} · ${dataBreve(voce.scadenzaIso)}`}
        </span>
        {/*  Condizioni riaperte: si vedono ENTRAMBE le date, la vecchia barrata.
            Senza, questa pagina direbbe «scaduto» a un cliente che sul suo
            telefono legge una data valida. */}
        {voce.scadenzaOriginaleIso && (
          <span
            className="tabular-nums line-through decoration-rose-400"
            title="Le condizioni sono state riaperte dal consulente: questa era la scadenza di partenza"
          >
            {dataBreve(voce.scadenzaOriginaleIso)}
          </span>
        )}
        <span className="inline-flex items-center gap-1" title="Chi ha fatto il preventivo">
          <UserRound className="h-3 w-3" />
          {voce.autore || "consulente non registrato"}
        </span>
        <span className="inline-flex items-center gap-1" title="Quando è stato fatto">
          <CalendarClock className="h-3 w-3" />
          {dataBreve(q.created_at)}
        </span>
        {q.telefono && <span className="tabular-nums">{q.telefono}</span>}
        {q.email && (
          <a
            href={`mailto:${q.email}`}
            className="inline-flex min-w-0 items-center gap-1 hover:text-foreground"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{q.email}</span>
          </a>
        )}
      </div>

      {/* ── 3. IL FILO CON IL RESTO DEL CRM ────────────────────────────────
          Un preventivo non vive da solo: dietro c'è una persona con uno stato,
          un appuntamento e magari una posa già programmata. Prima questa riga
          non c'era, e per sapere «a che punto è questo cliente» bisognava
          cercarlo a mano in un'altra pagina — cioè non lo si faceva.
          ⚠️ I DUE STATI RESTANO DUE. La pastiglia qui è quella del LEAD, con i
           suoi venti valori e le sue tre chiusure vinte; la tendina in fondo è
           quella del DOCUMENTO, con i suoi cinque. Non si convertono l'uno
           nell'altro: quando non vanno d'accordo si dice, e basta. */}
      {lead ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Il cliente
          </span>
          <PastigliaStato
            dati={lead.data}
            contesto={`${lead.data?.nome ?? ""} ${lead.data?.cognome ?? ""} · preventivo ${q.quote_ref}`.trim()}
            onScegli={(s) => onStatoLead(lead, s)}
          />
          <button
            type="button"
            onClick={() => onScheda(lead)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 text-[11px] font-medium leading-5 text-muted-foreground hover:text-foreground"
            title={
              voce.aggancio?.via === "riferimento"
                ? "La scheda collegata a questo preventivo"
                : "Agganciata dal numero di telefono: controlla che sia la persona giusta"
            }
          >
            <UserRound className="h-3 w-3" /> Scheda cliente
            {voce.aggancio?.via === "telefono" && (
              <span className="text-amber-600" title="Trovata dal telefono, non dal preventivo">
                ·
              </span>
            )}
          </button>
          {/*  La consulenza: è da lì che nasce il preventivo, ed è la data che
              dice quanto è «caldo» questo cliente. */}
          {lead.data?.dataMeeting && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              consulenza {dataBreve(lead.data.dataMeeting)}
              {lead.data.oraMeeting ? ` · ${lead.data.oraMeeting}` : ""}
            </span>
          )}
          {/*  L'installazione. ⚠️ NON esiste nessun legame diretto fra un
              preventivo e una posa: si passa dalla scheda, ed è l'unica strada
              che ci sia. Una spedizione non ha una data di posa e non deve
              chiederne una. */}
          {posa ? (
            <span
              className={cn(
                CLASSE_BADGE_STATO,
                posaFatta(lead.data)
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                  : "border-border bg-muted text-muted-foreground",
              )}
              title="La data della posa, dalla scheda del cliente"
            >
              <Package className="h-3 w-3 shrink-0" />
              {posaFatta(lead.data) ? "posato" : "posa"} {dataBreve(posa)}
            </span>
          ) : modo === "spedizione" ? (
            <span
              className={cn(CLASSE_BADGE_STATO, "border-border bg-muted text-muted-foreground")}
            >
              <Package className="h-3 w-3 shrink-0" /> da spedire
            </span>
          ) : null}
          {voce.aggancio?.incerto && (
            <span className="text-[11px] text-amber-600" title="Più schede hanno questo numero">
              più schede con questo numero
            </span>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Nessuna scheda cliente collegata: questo preventivo non è nato da una consulenza, oppure
          il numero in archivio è scritto diverso.
        </p>
      )}

      {voce.incoerenza && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {voce.incoerenza}
        </p>
      )}

      {/* ── 4. I COMANDI ──────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/*  ⚠️ Il tasto WhatsApp c'è SOLO se c'è un numero: un tasto che apre una
            chat vuota fa perdere tempo e, peggio, fa credere di aver scritto. */}
        {numeroPerWhatsApp(q.telefono) && (
          <PannelloWhatsApp
            voce={voce}
            consulente={consulente}
            onCopiaLink={() => onCopiaLink(q.quote_ref)}
          />
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[12.5px]"
          onClick={() => onCopiaLink(q.quote_ref)}
          title="Copia il link da mandare al cliente: apre la consulenza su questo preventivo"
        >
          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Copia il link
        </Button>

        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          Preventivo
          <select
            value={q.status}
            onChange={(e) => void onStatoPreventivo(q.id, e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12.5px] text-foreground"
          >
            {STATI.map((s) => (
              <option key={s.valore} value={s.valore}>
                {s.etichetta}
              </option>
            ))}
            {/*  ⚠️ Uno stato che non sta fra le voci scegliibili non deve sparire
                dal menu: altrimenti aprendo la tendina il preventivo cambierebbe
                stato senza che nessuno l'abbia deciso — e con `value` che non
                corrisponde a nessuna opzione la tendina si mostra pure vuota.
                Vale per gli stati scritti a mano in passato e per «sostituito»,
                che si assegna da sé quando il preventivo viene rifatto. */}
            {!STATI.some((s) => s.valore === q.status) && (
              <option value={q.status}>{stato?.etichetta ?? q.status}</option>
            )}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-[12px]"
            aria-expanded={offerta}
            onClick={() => setOfferta((v) => !v)}
          >
            Offerta
            <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", offerta && "rotate-180")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-[12px]"
            aria-expanded={percorso}
            onClick={() => setPercorso((v) => !v)}
          >
            Percorso
            <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", percorso && "rotate-180")} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setAzioni(true)}
            aria-haspopup="dialog"
            title="Altre azioni"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            <span className="sr-only">Altre azioni</span>
          </Button>
        </div>
      </div>

      {offerta && <Offerta voce={voce} />}
      {percorso && <Percorso q={q} onInizio={onInizio} onPassaggio={onPassaggio} />}

      <FinestraAzioni
        voce={voce}
        aperta={azioni}
        onCambio={setAzioni}
        conRegistrazione={conRegistrazione}
        onScheda={onScheda}
        onRegistrazione={onRegistrazione}
        onDuplica={onDuplica}
        onElimina={onElimina}
      />
    </Scheda>
  );
}
