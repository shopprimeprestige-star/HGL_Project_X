import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ListChecks, Loader2, Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { combaciaRicerca, ordinaPerStelle } from "./cercaChat";
import { useStelle } from "./useStelle";
import { useCRM } from "@/crm/CRMContext";
import { useAuth, useConsulenteCollegato } from "@/crm/AuthContext";
import { faConsulenze } from "@/crm/permessi";
import { chiVale, consulenteDelloSchermo } from "@/crm/consulente-dentro";
import { RigaChat, type ModoRiga } from "./RigaChat";
import { useStabile } from "./apiElenco";
import { PASSO_RIGHE, RIGHE_INIZIALI, tagliaSezioni } from "./finestraLista";
import { AzioniSelezione, TestataSelezione } from "./BarraSelezione";
import {
  commuta as commutaScelta,
  fraseEsito,
  pianoAzione,
  selezionaTutte,
  senzaDoppioni,
  sonoTutte,
  soloVisibili,
  type AzioneBlocco,
} from "./selezione";
import { BarraProssimoMeet } from "./BarraProssimoMeet";
import { prossimoMeet } from "./prossimo-meet";
import { ordinaPerScadenza } from "./segniRiga";
import { ordinaComeWhatsapp } from "./ordineWhatsapp";
import { chatSenzaScheda } from "./senzaScheda";
import { LEAD_STATUS_LABEL } from "@/crm/types";
import { contaPerStato, vociConScelto } from "./perStato";
import {
  chatDaChiamare,
  contaSottofiltri,
  STATI_SOTTOFILTRI,
  type Sottofiltro,
} from "./daChiamare";
import {
  commuta,
  contaAccesi,
  contaVoce,
  eAcceso,
  etichetteAccese,
  FILTRI_VUOTI,
  filtriValidi,
  passaFiltri,
  togli,
  VOCI_RIGA,
  type CampoFiltro,
} from "./filtri";
import { BORDO_TASTO, Contatore, FUOCO, PannelloFiltri } from "./PannelloFiltri";
import type { ChatItem, ElencoChatProps } from "./tipi";
import { chiaveOrdine, passaRichiamo, vociFiltro, type FiltroRichiamo } from "./richiamo";
import { oggiIso } from "@/crm/ui";

/** I chip dello «Stato della chiamata» (con «Da chiamare» acceso): «Tutti» + uno per stato. */
const CHIP_SOTTOFILTRI: { v: Sottofiltro; l: string }[] = [
  { v: "tutti", l: "Tutti" },
  ...STATI_SOTTOFILTRI.map((v) => ({ v, l: LEAD_STATUS_LABEL[v] })),
];

/** La riga che scorre di lato (sul telefono col dito), uguale per le pillole principali e per i
 *  sottofiltri di «Da chiamare». La barra di scorrimento non si vede. */
const RIGA_SCORREVOLE =
  "flex overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Un sottofiltro (30/10/2026): la versione leggera della pillola, solo testo con la linea sotto
 *  per quello scelto. 44 px di tocco sul telefono come le pillole, 32 dal computer. */
const sottoTasto = (acceso: boolean, allarme = false) =>
  cn(
    "t-nota inline-flex h-11 shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2.5 font-medium transition-colors lg:pointer-fine:h-8",
    acceso
      ? allarme
        ? "border-red-700 text-red-700"
        : "border-primary text-primary"
      : allarme
        ? "border-transparent text-red-700/80 hover:text-red-700"
        : "border-transparent text-muted-foreground hover:text-foreground",
    FUOCO,
  );

/** Il tasto di un chip: 44 px di tocco col dito, 32 dal computer col mouse. Il chip a vista
 *  (`chip`) è più basso: il resto è area da toccare, trasparente. */
const TASTO_CHIP =
  "group inline-flex items-center focus-visible:outline-none min-h-11 lg:pointer-fine:min-h-8";
/** Il chip a vista; `acceso` = i colori del secondo livello (primario chiaro). */
const chip = (acceso: boolean) =>
  cn(
    "t-nota inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-3 font-medium transition-colors lg:pointer-fine:h-7",
    "group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
    acceso
      ? "border-primary/40 bg-primary/10 text-[color-mix(in_oklab,var(--primary),black_25%)]"
      : `${BORDO_TASTO} bg-background text-muted-foreground group-hover:bg-muted`,
  );

/** Ogni quanto si rinfrescano «da 25 min» e simili (un solo timer per tutto l'elenco). */
const RINFRESCO_MS = 30_000;

/** L'ora «adesso», aggiornata ogni 30 secondi. */
function useAdesso(): number {
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), RINFRESCO_MS);
    return () => clearInterval(t);
  }, []);
  return adesso;
}

/** L'elenco delle chat. Con «Tutte» (la vista di partenza) è l'elenco di WhatsApp: uno solo, per ultimo
 *  messaggio. Con una coda scelta: in cima «Da rispondere», poi le altre. Riempie il contenitore che gli
 *  dà `PaginaChat`: larghezza e visibilità non sono affar suo (R12). Sul telefono è a tutta larghezza: bersagli da 44 px, testi
 *  della scala `t-*`, 16 px nella ricerca (altrimenti iOS ingrandisce la pagina).
 *
 *  ── I FILTRI A GRUPPI (30/10/2026) ──────────────────────────────────────
 *  Una riga che scorre (Tutte · Da rispondere · Da chiamare · Con stelle · Sconosciuti) e il
 *  tasto «Filtri» col pannello dei sei gruppi. Gruppi diversi si sommano; in uno stesso gruppo
 *  si sceglie una voce sola. Le regole sono in filtri.ts: qui si compongono e si disegnano. */
function ElencoChatBase({ api, onCreaScheda: creaSchedaProp }: ElencoChatProps) {
  const { filtri: filtriSalvati, setFiltri, ricerca, setRicerca, caricamento, attiva } = api;
  //  Funzioni stabili: le righe non si ridisegnano se cambia solo la loro identità.
  const apri = useStabile(api.apri);
  const onCreaScheda = useStabile(creaSchedaProp);
  const cambiaStatoLead = useStabile(api.cambiaStatoLead);
  const creaSchedaConStato = useStabile(api.creaSchedaConStato);
  const adesso = useAdesso();
  const [pannelloAperto, setPannelloAperto] = useState(false);
  //  Le stelle (28/10/2026): ordinano sempre l'elenco, prima le tre; ora sono anche un filtro.
  const { di: stelleDi, cambia: cambiaStelle, metti: mettiStelle } = useStelle();
  //  Il sottofiltro di «Da chiamare» (28/10/2026): UN elenco, ordinato per stato.
  const [sotto, setSotto] = useState<Sottofiltro>("tutti");
  //  Quando richiamarlo (29/10/2026): Scaduti, Oggi, Domani, poi le date.
  const [quando, setQuando] = useState<FiltroRichiamo>("tutti");

  /*  ── IL CONSULENTE (28/10/2026) ────────────────────────────────────────
      Le chat dei lead assegnati a un consulente (`consulenteId` della scheda). Vale per TUTTE le
      sezioni, anche «Da rispondere»: è la vista di una persona, non un'etichetta — e quanti
      aspettano negli altri si dice. Fra le scelte i consulenti con almeno una chat, più quello
      scelto (anche se intanto le sue chat sono passate a un altro: il filtro non resta mai acceso
      senza vedersi). Dal 30/10 si ricorda sul dispositivo; se è stato cancellato dal CRM non vale. */
  const { consultants } = useCRM();
  const consulentiNoti = useMemo(() => new Set(consultants.map((x) => x.id)), [consultants]);
  const filtri = useMemo(
    () => filtriValidi(filtriSalvati, consulentiNoti),
    [filtriSalvati, consulentiNoti],
  );
  const consulente = filtri.consulente;
  const nomeConsulente = (id: string) =>
    String(consultants.find((x) => x.id === id)?.data?.nome ?? "").trim() || "Senza nome";
  const accesi = contaAccesi(filtri);
  const cercando = ricerca.trim() !== "";
  //  «Tutte» è acceso quando nessun filtro è attivo (il consulente scelto non conta: si ricorda).
  const soloRiga = contaAccesi({ ...filtri, consulente: "" }) === 0;

  // ── Quante chat con questi filtri, e quanti numeri per ogni voce (ricerca esclusa) ────────
  const passa = (c: ChatItem) => passaFiltri(c, filtri, stelleDi);
  const conta = (campo: CampoFiltro, valore: string | true) =>
    contaVoce(api.chats, filtri, stelleDi, campo, valore);

  // I riquadri obbediscono a ricerca e filtri. «Una chat una volta sola»: sotto.
  const trovate = api.chats.filter((c) => passa(c) && combaciaRicerca(c, ricerca));
  const perStelle = (righe: ChatItem[]) => ordinaPerStelle(righe, stelleDi);
  //  ── FINESTRA IN CHIUSURA IN CIMA (30/10/2026) ───────────────────────────
  //  Con «Si può scrivere» le chat che chiudono entro 4 ore hanno un riquadro tutto loro, sopra
  //  «Da rispondere», dalla scadenza più vicina: si scrive gratis finché si può.
  //  Escono dagli altri riquadri (una chat una volta sola). Vedi segniRiga.ts.
  //  ── «TUTTE» (30/10/2026) ────────────────────────────────────────────────
  //  Senza una coda scelta l'elenco è UNO solo, nell'ordine di WhatsApp (ordineWhatsapp.ts): niente
  //  riquadri, niente stelle in cima. Per questo anche il riquadro «Finestra in chiusura» (che è una
  //  sezione) esce: con «Si può scrivere» la riga ha comunque il suo bollino.
  const tutte = filtri.coda === null;
  //  ── «SENZA SCHEDA» IN CIMA (30/10/2026) ────────────────────────────────
  //  In «Tutte» le chat senza scheda (con messaggi, anche vecchi) hanno un riquadro tutto loro
  //  sopra l'elenco: sono clienti non ancora salvati nel CRM. Non si ripetono sotto. Nelle altre
  //  viste no: i numeri di «Da rispondere» e «Da chiamare» devono restare quelli dei pulsanti.
  //  La pillola «Sconosciuti» resta: è il filtro che mostra SOLO queste, senza il resto.
  const senzaSchedaCon = tutte ? chatSenzaScheda(trovate) : [];
  const inSenzaSchedaTel = new Set(senzaSchedaCon.map((c) => c.phone));
  const elencoTutte = tutte
    ? ordinaComeWhatsapp(trovate.filter((c) => !inSenzaSchedaTel.has(c.phone)))
    : [];
  const inScadenza =
    filtri.coda !== null && filtri.finestra === "aperta" ? ordinaPerScadenza(trovate, adesso) : [];
  const inScadenzaTel = new Set(inScadenza.map((c) => c.phone));
  const fuoriScadenza = trovate.filter((c) => !inScadenzaTel.has(c.phone));

  const inAttesa = perStelle(fuoriScadenza.filter((c) => c.daRispondere?.attesa));
  //  Chi aspetta e non è di questo consulente (ma passa il resto): si dice, non si nasconde nel silenzio.
  const nascostiInAttesa = consulente
    ? api.chats.filter(
        (c) =>
          c.daRispondere?.attesa &&
          !inScadenzaTel.has(c.phone) &&
          combaciaRicerca(c, ricerca) &&
          passaFiltri(c, { ...filtri, consulente: "" }, stelleDi),
      ).length - inAttesa.length
    : 0;
  // Una chat una volta sola: se sta fra quelle che aspettano, non si ripete fra le altre.
  const altre = perStelle(fuoriScadenza.filter((c) => !c.daRispondere?.attesa));

  //  ── «DA CHIAMARE» CON I SOTTOFILTRI (28/10/2026) ──────────────────────
  //  Con «Da chiamare» acceso NON ci sono riquadri: un elenco solo, ordinato per stato (non
  //  risponde, segreteria…) e dentro ogni stato dal cambio più vecchio. I chip scelgono uno stato
  //  solo; quelli a zero spariscono. Ora ubbidisce anche agli altri gruppi (30/10/2026).
  const daChiamareTutte = filtri.coda === "da-chiamare" ? trovate : [];
  const conti = contaSottofiltri(daChiamareTutte);
  //  Un chip scelto che nel frattempo si svuota (stato cambiato dalla riga) torna a «Tutti».
  const sottoAttivo: Sottofiltro = sotto === "tutti" || conti[sotto] > 0 ? sotto : "tutti";
  const perStato = chatDaChiamare(daChiamareTutte, sottoAttivo);
  /*  ── QUANDO RICHIAMARLO (29/10/2026) ───────────────────────────────────
      Le voci si contano sulle chat del chip scelto; una voce scelta che si svuota torna a
      «Tutti». Con una voce scelta l'elenco va per data e ora del richiamo (prima gli scaduti). */
  const oggi = oggiIso(new Date(adesso));
  const vociQuando = vociFiltro(
    perStato.map((c) => c.lead?.data),
    oggi,
  );
  const quandoAttivo: FiltroRichiamo = vociQuando.some((x) => x.v === quando) ? quando : "tutti";
  const elencoDaChiamare =
    quandoAttivo === "tutti"
      ? perStato
      : perStato
          .filter((c) => passaRichiamo(c.lead?.data, quandoAttivo, oggi))
          .sort((a, b) => chiaveOrdine(a.lead?.data).localeCompare(chiaveOrdine(b.lead?.data)));

  /*  ── SELEZIONE TENENDO PREMUTO (30/10/2026) ───────────────────────────────
      Le chat «visibili» sono quelle che l'elenco mostra ORA, riquadri compresi: «Seleziona tutto» e le azioni valgono per loro, mai per chat nascoste
      da un filtro cambiato dopo. Le regole stanno in selezione.ts. */
  const [inSel, setInSel] = useState(false);
  const [scelte, setScelte] = useState<Set<string>>(() => new Set());
  //  Le righe in memoria non rivedono `scelte`: il tocco legge sempre quella di adesso.
  const scelteRef = useRef(scelte);
  scelteRef.current = scelte;
  const [inCorso, setInCorso] = useState<AzioneBlocco | null>(null);
  const blocco = api.inBlocco;
  const mostrate = senzaDoppioni(
    filtri.coda === "da-chiamare"
      ? elencoDaChiamare
      : [...senzaSchedaCon, ...inScadenza, ...inAttesa, ...altre],
  );
  //  ── SI DISEGNANO LE PRIME RIGHE (p1-chat-veloce, 30/10/2026) ─────────────────
  //  Con 2.000+ chat le righe nella pagina erano 95.000 nodi: ora ne bastano 40, e altre 40 a ogni
  //  discesa verso il fondo. I numeri, «Seleziona tutto» e `mostrate` restano sugli elenchi interi.
  const [visti, setVisti] = useState(RIGHE_INIZIALI);
  const chiaveVista = JSON.stringify([filtri, ricerca, sottoAttivo, quandoAttivo]);
  const [chiavePrec, setChiavePrec] = useState(chiaveVista);
  if (chiavePrec !== chiaveVista) {
    setChiavePrec(chiaveVista);
    setVisti(RIGHE_INIZIALI);
  }
  const [senzaSchedaVis, tutteVis] = tagliaSezioni(visti, senzaSchedaCon, elencoTutte);
  const [inScadenzaVis, inAttesaVis, altreVis] = tagliaSezioni(visti, inScadenza, inAttesa, altre);
  const elencoDaChiamareVis = elencoDaChiamare.slice(0, visti);
  const fondoRef = useRef<HTMLDivElement>(null);
  const daDisegnare = mostrate.length;
  useEffect(() => {
    const fondo = fondoRef.current;
    if (!fondo || visti >= daDisegnare) return;
    //  shortcut: senza IntersectionObserver (browser molto vecchi) si disegna tutto come prima.
    if (typeof IntersectionObserver === "undefined") {
      setVisti(daDisegnare);
      return;
    }
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisti((v) => v + PASSO_RIGHE);
      },
      { root: fondo.parentElement, rootMargin: "800px" },
    );
    o.observe(fondo);
    return () => o.disconnect();
  }, [visti, daDisegnare]);

  const scelteVisibili = inSel ? soloVisibili(scelte, mostrate) : [];
  const esciDallaSelezione = () => {
    setInSel(false);
    setScelte(new Set());
  };
  //  Esc esce, come «Annulla».
  useEffect(() => {
    if (!inSel) return;
    const alTasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") esciDallaSelezione();
    };
    window.addEventListener("keydown", alTasto);
    return () => window.removeEventListener("keydown", alTasto);
  }, [inSel]);

  const esegui = async (azione: AzioneBlocco) => {
    if (!blocco || inCorso) return;
    const piano = pianoAzione(
      azione,
      scelteVisibili.map((c) => ({
        phone: c.phone,
        unread: c.contact?.unread_count ?? 0,
        haContatto: c.contact !== null,
        inAttesa: c.daRispondere?.attesa === true,
        stelle: stelleDi(c.phone),
      })),
      attiva?.phone ?? null,
    );
    //  «Fatto» non si disfa: su più chat si chiede prima (come «Elimina»).
    if (
      azione === "fatto" &&
      piano.fare.length > 1 &&
      !confirm(
        `Segnare «Fatto» su ${piano.fare.length} chat?\n\nEscono da «Da rispondere» senza mandare nulla ai clienti.`,
      )
    )
      return;
    setInCorso(azione);
    let fatte = 0;
    let rimaste: string[] = [];
    let manca = false;
    try {
      if (piano.fare.length > 0) {
        if (azione === "osservazione") {
          const ok = await mettiStelle(piano.fare, 1).catch(() => false);
          if (ok) fatte = piano.fare.length;
          else rimaste = piano.fare;
        } else {
          const r = await (azione === "letto"
            ? blocco.segnaLetto
            : azione === "da-leggere"
              ? blocco.segnaDaLeggere
              : blocco.segnaFatto)(piano.fare);
          fatte = r.riuscite.length;
          rimaste = r.fallite;
          manca = r.manca === true;
        }
      }
    } catch {
      //  Un guasto imprevisto non deve sembrare un successo: tutte le chat da fare restano da fare.
      fatte = 0;
      rimaste = piano.fare;
    } finally {
      setInCorso(null);
    }
    if (manca) toast.error("Manca l'aggiornamento del database: avvisa il titolare");
    else {
      const esito = fraseEsito(azione, {
        fatte,
        gia: piano.gia.length,
        saltate: piano.saltate.length,
        fallite: rimaste.length,
        motivoSaltate: piano.saltate[0]?.motivo,
      });
      if (esito.tipo === "ok") toast.success(esito.testo);
      else if (esito.tipo === "niente") toast.info(esito.testo);
      else if (esito.tipo === "parziale") toast.warning(esito.testo);
      else toast.error(esito.testo);
    }
    //  Se qualcuna non è riuscita restano scelte solo quelle: riprovare è un tocco.
    if (rimaste.length > 0) setScelte(new Set(rimaste));
    else esciDallaSelezione();
  };

  // ── Le voci del pannello che cambiano con i dati ──────────────────────────────────────────
  //  «Altri stati»: gli stati con almeno una chat (con gli altri filtri accesi), più quello scelto.
  const stati = contaPerStato(
    api.chats.filter((c) => passaFiltri(c, { ...filtri, fase: null }, stelleDi)),
  );
  const altriStati = vociConScelto(stati.voci, filtri.fase ?? "").map((v) => ({
    stato: v.stato,
    nome: v.etichetta,
    n: conta("fase", `stato:${v.stato}`),
  }));
  //  Consulenti: quelli con almeno una chat, più lo scelto.
  const conChat = new Set(api.chats.map((c) => c.lead?.data?.consulenteId).filter(Boolean));
  const consulenti = consultants
    .filter((x) => conChat.has(x.id) || x.id === consulente)
    .map((x) => ({ id: x.id, nome: nomeConsulente(x.id), n: conta("consulente", x.id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const etichette = etichetteAccese(filtri, nomeConsulente);
  const azzera = () => setFiltri(FILTRI_VUOTI);

  /*  ── IL PROSSIMO MEET IN CIMA (30/10/2026) ──────────────────────────────
      Fra le chat che passano filtri e ricerca (con il filtro consulente è il prossimo meet di quella
      persona). Sta in una barra incollata sopra tutte le sezioni e NON esce dalla sua sezione: i
      numeri di «Da rispondere» devono restare quelli del pulsante, e una chat che sparisce da lì
      sembrerebbe già risposta. In sezione la riga ha solo il segno viola. Si aggiorna col timer. */
  //  In «Da chiamare» si guarda l'elenco mostrato: mai un meet la cui riga non c'è.
  //  Chi è dentro (31/10/2026): il consulente vede solo il SUO prossimo meet, non quelli degli altri;
  //  il titolare (senza consulente collegato) quello di tutti, com'era. Regole: consulente-dentro.ts.
  const meSteso = useConsulenteCollegato();
  const { accesso } = useAuth();
  const soloDi = chiVale(
    consulenteDelloSchermo({
      collegatoId: meSteso?.id,
      admin: accesso.ruolo === "admin",
      faConsulenze: faConsulenze(accesso.puo),
    }),
    filtri.consulente || null,
  );
  const meet = prossimoMeet(
    filtri.coda === "da-chiamare" ? elencoDaChiamare : trovate,
    oggi,
    adesso,
    consultants,
    soloDi,
  );

  const riga = (c: ChatItem, modo: ModoRiga, mostraFinestra = filtri.finestra !== null) => (
    <RigaChat
      comeWhatsapp={tutte}
      prossimoMeet={meet?.chat.phone === c.phone}
      mostraFinestra={mostraFinestra}
      key={c.phone}
      chat={c}
      modo={modo}
      attiva={attiva?.phone === c.phone}
      adesso={adesso}
      onApri={() => apri(c.phone)}
      onCreaScheda={() => onCreaScheda(c)}
      stelle={stelleDi(c.phone)}
      onStelle={() => cambiaStelle(c.phone)}
      onCambiaStato={(lead, stato) => void cambiaStatoLead(lead, stato)}
      onCreaSchedaConStato={(stato) => void creaSchedaConStato(c, stato)}
      selezione={
        blocco
          ? {
              attiva: inSel,
              scelta: inSel && scelte.has(c.phone),
              onInizia: () => {
                setInSel(true);
                setScelte(new Set([c.phone]));
              },
              onTocca: () => {
                const nuove = commutaScelta(scelteRef.current, c.phone);
                if (nuove.size === 0) esciDallaSelezione();
                else setScelte(nuove);
              },
            }
          : undefined
      }
    />
  );

  /** Tutto l'elenco è vuoto: si dice perché e, con dei filtri accesi, c'è il tasto per toglierli. */
  const vuoto = (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="t-nota text-muted-foreground">
        {filtri.coda === "da-chiamare" && accesi === 1 && !cercando
          ? "Nessuno da chiamare: tutto in ordine"
          : accesi > 0
            ? "Nessuna chat con questi filtri"
            : cercando
              ? "Nessuna chat trovata"
              : "Nessuna chat"}
      </p>
      {accesi > 0 && (
        <button
          type="button"
          onClick={azzera}
          className={cn(
            "t-corpo inline-flex items-center rounded-md border bg-background px-3 font-medium hover:bg-muted",
            BORDO_TASTO,
            "h-11 lg:pointer-fine:h-8",
            FUOCO,
          )}
        >
          Azzera filtri
        </button>
      )}
    </div>
  );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      {inSel ? (
        <TestataSelezione
          quante={scelteVisibili.length}
          tutte={sonoTutte(scelte, mostrate)}
          occupata={inCorso !== null}
          onTutte={() =>
            setScelte(sonoTutte(scelte, mostrate) ? new Set() : selezionaTutte(mostrate))
          }
          onAnnulla={esciDallaSelezione}
        />
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3 md:px-2 md:py-2.5">
          {/*  Il titolo dice cosa si sta guardando: con nessun filtro, tutte. */}
          <p className="t-riga font-semibold text-foreground">
            {accesi > 0 ? "Chat filtrate" : "Tutte le chat"}
            {!caricamento && (
              <span className="tabular-nums text-muted-foreground">
                {" · "}
                {accesi > 0 ? trovate.length : api.chats.length}
              </span>
            )}
          </p>
          {/*  Per chi non usa la pressione lunga (tastiera, mouse): accende la selezione senza scegliere. */}
          {blocco && (
            <button
              type="button"
              onClick={() => setInSel(true)}
              className="t-corpo -my-2 inline-flex h-11 items-center gap-1.5 rounded-md px-3 font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:pointer-fine:my-0 lg:pointer-fine:h-8 lg:pointer-fine:px-2"
            >
              <ListChecks aria-hidden="true" className="h-4 w-4" />
              Seleziona
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 pb-2 md:px-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground lg:pointer-fine:left-2.5 lg:pointer-fine:h-3.5 lg:pointer-fine:w-3.5"
          />
          <Input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca nome o numero…"
            aria-label="Cerca nome o numero"
            className="h-11 bg-background pl-9 text-base focus-visible:ring-2 focus-visible:ring-primary md:text-base lg:pointer-fine:h-8 lg:pointer-fine:pl-8 lg:pointer-fine:text-[13px]"
          />
        </div>
        <PannelloFiltri
          filtri={filtri}
          onCambia={setFiltri}
          conta={conta}
          altriStati={altriStati}
          consulenti={consulenti}
          mostra={trovate.length}
          aperto={pannelloAperto}
          onApri={setPannelloAperto}
        />
      </div>

      {/*  ── LA RIGA DEI FILTRI RAPIDI (30/10/2026) ──────────────────────────
          Una riga sola che scorre di lato (sul telefono si scorre col dito), nell'ordine d'uso:
          Tutte · Da rispondere · Da chiamare · Con stelle · Sconosciuti. Tasti alti 44 px, nomi corti.
          Acceso = pieno primario E `aria-pressed` (il colore non basta da solo). Il numero è quello
          che vedrai se tocchi. «Tutte» spegne i filtri ma non il consulente, che si ricorda. */}
      <div
        role="group"
        aria-label="Filtri rapidi"
        className={cn(RIGA_SCORREVOLE, "gap-2 px-3 pb-2 md:px-2")}
      >
        <button
          type="button"
          aria-pressed={soloRiga}
          onClick={() => setFiltri({ ...FILTRI_VUOTI, consulente: filtri.consulente })}
          className={cn(
            "t-corpo flex h-11 shrink-0 items-center rounded-lg border px-3 font-medium transition-colors lg:pointer-fine:h-8",
            soloRiga
              ? "border-primary bg-primary text-primary-foreground"
              : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
            FUOCO,
          )}
        >
          Tutte
        </button>
        {VOCI_RIGA.map((v) => {
          const acceso = eAcceso(filtri, v.campo, v.valore);
          return (
            <button
              key={`${v.campo}:${String(v.valore)}`}
              type="button"
              aria-pressed={acceso}
              onClick={() => setFiltri(commuta(filtri, v.campo, v.valore))}
              className={cn(
                "t-corpo flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors lg:pointer-fine:h-8",
                acceso
                  ? "border-primary bg-primary text-primary-foreground"
                  : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
                FUOCO,
              )}
            >
              {v.campo === "stelle" && (
                <Star
                  aria-hidden="true"
                  className={cn("h-3.5 w-3.5 shrink-0", acceso ? "text-amber-300" : "text-amber-600")}
                />
              )}
              <span className="whitespace-nowrap">{v.nome}</span>
              <Contatore
                n={conta(v.campo, v.valore)}
                acceso={acceso}
                urgente={v.valore === "da-rispondere"}
              />
            </button>
          );
        })}
      </div>

      {/*  Il riepilogo: mai un filtro acceso che non si vede. Ogni etichetta si toglie con la sua ✕. */}
      {accesi > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 border-t border-border px-3 md:px-2">
          <p className="t-nota tabular-nums text-muted-foreground">
            {trovate.length} di {api.chats.length} chat
          </p>
          <button
            type="button"
            onClick={azzera}
            className={cn(
              "t-nota inline-flex items-center rounded-md px-1 font-medium text-primary underline-offset-2 hover:underline",
              "min-h-11 lg:pointer-fine:min-h-8",
              FUOCO,
            )}
          >
            Azzera
          </button>
          {etichette.map((e) => (
            <button
              key={e.campo}
              type="button"
              aria-label={`Togli il filtro ${e.etichetta}`}
              onClick={() => setFiltri(togli(filtri, e.campo))}
              className={TASTO_CHIP}
            >
              <span className={chip(true)}>
                {e.etichetta}
                <X aria-hidden="true" className="h-3 w-3 shrink-0" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/*  Sotto «Da chiamare» (30/10/2026): lo stato della chiamata e, se serve, quando richiamare.
          Righe che scorrono di lato come le pillole sopra, ma più leggere (solo testo, linea sotto
          quella scelta). I numeri sono quelli che vedrai toccando. */}
      {filtri.coda === "da-chiamare" && (
        <div className="border-y border-border bg-muted/30 px-3 md:px-2">
          <div role="group" aria-label="Stato della chiamata" className={cn(RIGA_SCORREVOLE, "gap-1")}>
            {CHIP_SOTTOFILTRI.filter((x) => x.v === "tutti" || conti[x.v] > 0).map((x) => (
              <button
                key={x.v}
                type="button"
                aria-pressed={sottoAttivo === x.v}
                onClick={() => setSotto(x.v)}
                className={sottoTasto(sottoAttivo === x.v)}
              >
                {x.l} <span className="tabular-nums">{conti[x.v]}</span>
              </button>
            ))}
          </div>
          {vociQuando.length > 1 && (
            <div
              role="group"
              aria-label="Quando richiamare"
              className={cn(RIGA_SCORREVOLE, "gap-1 border-t border-border/60")}
            >
              {/*  «Scaduti» in rosso. */}
              {vociQuando.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  aria-pressed={quandoAttivo === x.v}
                  onClick={() => setQuando(x.v)}
                  className={sottoTasto(quandoAttivo === x.v, x.v === "scaduti")}
                >
                  {x.l} <span className="tabular-nums">{x.n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/*  Per chi usa lo screen reader: a ogni cambio, quante chat si vedono. */}
      <div role="status" aria-live="polite" className="sr-only">
        {caricamento ? "" : `${trovate.length} chat`}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border">
        {!caricamento && meet && (
          <BarraProssimoMeet meet={meet} onApri={() => apri(meet.chat.phone)} />
        )}
        {caricamento ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento chat…
          </div>
        ) : trovate.length === 0 ? (
          vuoto
        ) : filtri.coda === "da-chiamare" ? (
          elencoDaChiamare.length === 0 ? (
            vuoto
          ) : (
            <ul aria-label="Chat da chiamare, per stato">
              {elencoDaChiamareVis.map((c) => riga(c, "normale", true))}
            </ul>
          )
        ) : tutte ? (
          <>
            {senzaSchedaCon.length > 0 && (
              <section aria-labelledby="titolo-senza-scheda">
                <h2
                  id="titolo-senza-scheda"
                  className="t-corpo border-b border-primary/20 bg-primary/5 px-3 py-2 font-semibold text-foreground"
                >
                  Senza scheda ({senzaSchedaCon.length})
                  <span className="t-nota ml-2 font-normal text-muted-foreground">
                    clienti da salvare nel CRM
                  </span>
                </h2>
                <ul>
                  {senzaSchedaVis.map((c) => riga(c, c.daRispondere?.attesa ? "attesa" : "normale"))}
                </ul>
              </section>
            )}
            <ul aria-label="Tutte le chat, dall'ultimo messaggio">
              {/*  Come WhatsApp: nessuna riga sbiadita, il grassetto solo per chi aspetta. */}
              {tutteVis.map((c) => riga(c, c.daRispondere?.attesa ? "attesa" : "normale"))}
            </ul>
          </>
        ) : (
          <>
            {inScadenza.length > 0 && (
              <section aria-labelledby="titolo-in-scadenza">
                <h2
                  id="titolo-in-scadenza"
                  className="t-corpo border-b border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900"
                >
                  Finestra in chiusura ({inScadenza.length}) · scrivi ora, è gratis
                </h2>
                <ul>
                  {inScadenzaVis.map((c) => riga(c, c.daRispondere?.attesa ? "attesa" : "normale"))}
                </ul>
              </section>
            )}
            <section aria-labelledby="titolo-da-rispondere">
              <h2
                id="titolo-da-rispondere"
                className={cn(
                  "t-corpo border-b px-3 py-2 font-semibold",
                  inAttesa.length > 0
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                Da rispondere ({inAttesa.length})
                {nascostiInAttesa > 0
                  ? ` · altre ${nascostiInAttesa} non di questo consulente`
                  : ""}
              </h2>
              {inAttesa.length === 0 ? (
                <p className="t-nota flex items-center gap-2 border-b border-border px-3 py-3 text-muted-foreground">
                  {accesi === 0 && !cercando && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  {cercando
                    ? "Nessuna in questa ricerca"
                    : accesi > 0
                      ? "Nessuna con questi filtri"
                      : "Nessuno aspetta una risposta"}
                </p>
              ) : (
                <ul>{inAttesaVis.map((c) => riga(c, "attesa"))}</ul>
              )}
            </section>

            {altre.length > 0 && (
              <section aria-labelledby="titolo-altre-chat">
                <h2
                  id="titolo-altre-chat"
                  className="t-corpo border-b border-border bg-muted/40 px-3 py-2 font-semibold text-muted-foreground"
                >
                  {filtri.stelle ? "Con stelle" : "Altre chat"}
                </h2>
                <ul>{altreVis.map((c) => riga(c, "normale"))}</ul>
              </section>
            )}
          </>
        )}
        {visti < daDisegnare && <div ref={fondoRef} aria-hidden="true" className="h-px" />}
      </div>
      {inSel && (
        <AzioniSelezione
          quante={scelteVisibili.length}
          inCorso={inCorso}
          onAzione={(a) => void esegui(a)}
        />
      )}
    </aside>
  );
}

/** In memoria: si ridisegna solo se cambia l'`api` che le dà `useApiElenco` (vedi apiElenco.ts). */
export const ElencoChat = memo(ElencoChatBase);
