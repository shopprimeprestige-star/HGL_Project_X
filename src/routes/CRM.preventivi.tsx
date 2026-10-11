/** ── PREVENTIVI ────────────────────────────────────────────────────────────
 *
 *  CHI APRE QUESTA PAGINA HA IL TELEFONO IN MANO.
 *  Non sta consultando un archivio: sta decidendo A CHI TELEFONARE PRIMA CHE IL
 *  SUO PREZZO SCADA. Ogni riga risponde, senza aprire nulla, a cinque domande —
 *  a chi è intestato, quanto vale, quando scade, chi l'ha fatto, a che punto è
 *  quel cliente — e offre i due gesti che si fanno dieci volte al giorno:
 *  mandargli il link e scrivergli su WhatsApp.
 *
 *  ── L'ORDINE È QUELLO DELLE SCADENZE ──────────────────────────────────────
 *  L'ordine di arrivo risponde a «cosa è successo per ultimo», che non è una
 *  domanda di lavoro. Qui viene prima chi sta per perdere il prezzo, poi chi
 *  l'ha già perso (recuperabile: si rifà l'offerta), infine chi ha accettato o
 *  è andato perso — quelli non chiedono più niente a nessuno.
 *
 *  ── COS'ERA, E PERCHÉ È STATA RIFATTA ─────────────────────────────────────
 *  Era un elenco che sapeva solo di sé stesso. Mostrava il totale grezzo di
 *  `quote_requests` ignorando le modifiche fatte dopo dal consulente, quindi
 *  diceva «scaduto» a chi aveva le condizioni riaperte e una cifra a chi ne
 *  legge un'altra sul telefono. Non sapeva che dietro ogni preventivo c'è una
 *  SCHEDA CLIENTE con il suo stato, la sua consulenza e la sua installazione.
 *  E non aveva né il link da mandare né WhatsApp: per farlo bisognava aprire il
 *  pannello del presentatore, cioè un'altra applicazione.
 *
 *  ── INVENTARIO: COSA C'ERA, COSA NE È STATO ───────────────────────────────
 *   TENUTO, perché serve a chi vende
 *    · la scadenza calcolata con `promoDeadline` — la stessa funzione che
 *      stampa la data sul preventivo del cliente — e detta a parole
 *      («scade domani», non «14 ago»);
 *    · le tre fasce d'ordinamento e i conteggi calcolati DENTRO i filtri
 *      attivi: un numero che ignora il filtro manda a cercare righe che non si
 *      vedono;
 *    · il recupero del cognome dai preventivi vecchi, dove stava in coda alle
 *      note. Toglierlo fa tornare mezzo archivio «Senza nome»;
 *    · il filtro per consulente, che comprende anche chi non è più in elenco ma
 *      ha firmato dei preventivi;
 *    · lo stato del preventivo con la sua tendina a cinque voci, compresa la
 *      riga che tiene in vita gli stati scritti a mano in passato;
 *    · la password di modifica e i cinque passaggi del percorso.
 *   RIDOTTO, perché serviva ma non a quel prezzo
 *    · l'OFFERTA e il PERCORSO: erano ~40 righe di pagina per ogni preventivo,
 *      sempre aperte. Ora sono due fisarmoniche chiuse dentro la riga;
 *    · la PASSWORD di modifica: da blocco in fondo alla pagina a pannello che
 *      si apre dal titolo. È configurazione, non lavoro;
 *    · i QUATTRO RIQUADRI: erano in cima E facevano da filtro, cioè dicevano
 *      per numero quello che i segmenti dicono per parola, a dieci centimetri
 *      di distanza. Ora i filtri sono UNA banda sola, in cima, e i numeri
 *      stanno in fondo — dove si guardano a fine giornata.
 *   USCITO
 *    · l'eliminazione fatta con `supabase.delete()`. Cancellava la riga e
 *      basta, mentre la conferma prometteva che «il cliente che apre il link
 *      non troverà più nulla»: l'immagine di anteprima con nome, cognome e
 *      totale restava online, in un deposito pubblico. Adesso si passa dalla
 *      rotta che pulisce tutte e nove le tracce e che, prima di dire «fatto»,
 *      va a controllare che quel file non ci sia più.
 *   NUOVO, perché era quello che mancava
 *    · CONDIVIDI IL LINK e SCRIVI SU WHATSAPP dalla riga, senza aprire niente;
 *    · le MODIFICHE fatte dopo (quantità, sconto del consulente, condizioni
 *      riaperte, note di consulenza) lette da /api/presenter/quote-edit e usate
 *      per il totale e per la scadenza;
 *    · il FILO con il resto del CRM: scheda cliente, stato del lead che si
 *      cambia dalla pastiglia condivisa, consulenza, installazione — e
 *      l'avviso quando le due verità non coincidono;
 *    · la CHIUSURA proposta quando si segna «Acconto ricevuto»: il preventivo è
 *      esattamente il posto in cui si scopre di aver venduto.
 *
 *  ⚠️ QUATTRO TRAPPOLE, TUTTE GIÀ COSTATE
 *   1. `/api/presenter/quote-owner` risponde 401 a chi apre il CRM senza una
 *      sessione da presentatore, e risponde `{owners:{}}`: il `.json()` non
 *      lancia e il `catch` non scatta. Prima il risultato era «consulente non
 *      registrato» su TUTTE le righe e il filtro «Senza consulente» al 100%,
 *      senza un avviso. Adesso lo si guarda e LO SI DICE (vedi `senzaAutori`);
 *   2. `setPromoDays` scrive in un modulo, non in uno stato: senza il contatore
 *      `duratePronte` React non ha motivo di rifare i conti, e le scadenze
 *      restano ferme sul valore di riserva — cioè la pagina mente a tutti;
 *   3. gli hook stanno TUTTI sopra qualunque uscita anticipata (React 310 =
 *      schermata bianca, già successo in questo repository);
 *   4. `supabase` non lancia: restituisce `{ error }`. Ogni scrittura di questa
 *      pagina lo legge e lo dice con un toast.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  FileText,
  Lock,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intestazioniCRM, useAuth, useConsulenteCollegato, fetchCRM } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
import { FinestraStati, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { copyLink } from "@/shop/copied";
import { linkPreventivo } from "@/shop/quote-link";
import { setPromoDays } from "@/shop/quote-menu";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import {
  AiutoScorciatoie,
  BarraAzioni,
  Kpi,
  KpiRiga,
  Pagina,
  SCORCIATOIE_COMUNI,
  Scheda,
  Segmento,
  SepBarra,
  Titolo,
  Vuoto,
  etichettaStato,
  eur,
  normalizza,
  soloCifre,
  useScorciatoie,
  type Scorciatoia,
} from "@/crm/ui";
import { Finestra, NotaFinestra } from "@/crm/ui/Finestra";
import { RigaPreventivoScheda } from "@/crm/preventivi/Riga";
import {
  ACCETTATI,
  GIORNI_IN_SCADENZA,
  VISTE,
  costruisciVoce,
  dbPreventivi,
  eLeadVinto,
  inVista,
  indicizzaLead,
  type ModificaPreventivo,
  type RigaPreventivo,
  type Vista,
  type Voce,
} from "@/crm/preventivi/dati";
//  ⚠️ Che cosa si copia e che cosa no quando si duplica un preventivo — il
//   numero, la scadenza, lo stato, il percorso — è una decisione sul documento
//   e sta in un posto solo, provabile.
import {
  rigaDuplicata,
  spiegazioneDuplicato,
  type PreventivoDaCopiare,
} from "@/crm/preventivi/duplica";

export const Route = createFileRoute("/CRM/preventivi")({
  head: () => ({ meta: [{ title: "Preventivi — CRM" }] }),
  component: PaginaPreventivi,
});

/** ── QUANTE RIGHE SI LEGGONO ───────────────────────────────────────────────
 *  Prima la lettura non aveva limite: con qualche migliaio di preventivi la
 *  pagina avrebbe smesso di aprirsi, e nessuno avrebbe saputo perché. Il limite
 *  c'è, ed è DICHIARATO a schermo quando viene raggiunto: un elenco tagliato in
 *  silenzio è peggio di un elenco lento, perché fa credere che un preventivo
 *  non esista. */
const LIMITE_RIGHE = 1000;

/** Quante modifiche si chiedono in una volta. ⚠️ La rotta quote-edit taglia a
 *  60 riferimenti per richiesta (`.slice(0, 60)`): chiedergliene di più
 *  significa perdere in silenzio le modifiche di tutti gli altri, cioè mostrare
 *  totali e scadenze vecchi proprio dove qualcuno li ha corretti. */
const RIFERIMENTI_PER_CHIAMATA = 60;
/** Oltre questo numero di preventivi le modifiche non si leggono più tutte: si
 *  leggono le più recenti (l'elenco arriva ordinato per data) e lo si dice. */
const MASSIMO_MODIFICHE = 600;

const SCORCIATOIE: Scorciatoia[] = [["1…4", "Cambia vista"], ...SCORCIATOIE_COMUNI];

/* ═══════════════════════════════════════════════════════════════════════════
   LE MODIFICHE FATTE DOPO — una lettura sola per tutto l'elenco
   ═════════════════════════════════════════════════════════════════════════ */

interface EsitoModifiche {
  modifiche: Record<string, ModificaPreventivo>;
  /** false = la rotta ha risposto 401. Non è un guasto: è che chi apre il CRM
   *  può non avere una sessione da presentatore. Va detto, non ingoiato. */
  leggibili: boolean;
  /** true = i preventivi erano più di quanti se ne possano chiedere */
  parziali: boolean;
}

/** ⚠️ `intestazioni` NON è un optional di comodo: la rotta `?refs=` chiede una
 *   sessione, e dal CRM la sessione del PRESENTATORE non esiste. Senza queste
 *   credenziali ogni blocco tornava 401 e il totale mostrato restava quello
 *   grezzo — cioè l'esatto difetto per cui questa lettura era stata aggiunta.
 *   È lo stesso anello mancante già trovato su `/api/presenter/quote-owner`.
 *
 *  ⚠️ E L'ANELLO È FATTO DI DUE PEZZI: questo è il lato che manda, e l'altro è
 *   la rotta. ADESSO CI SONO TUTTI E DUE: `leggeTutto` in
 *   api.presenter.quote-edit.ts prova prima la sessione del presentatore e poi
 *   `guardiaCRM` col permesso «preventivi» — lo stesso schema di `porta()` in
 *   api.presenter.quote-owner.ts, e lo stesso permesso che apre questa pagina.
 *   Qui c'era scritto che la rotta apriva una porta sola: non è più vero, e
 *   lasciarlo scritto avrebbe mandato a cercare un guasto già chiuso — o, peggio,
 *   a leggere l'avviso ambra sopra l'elenco come una condizione normale.
 *   Quell'avviso adesso vuol dire quello che dice: le modifiche NON sono state
 *   lette, e i totali a schermo sono quelli originali. */
async function leggiModifiche(
  refs: string[],
  intestazioni: Record<string, string>,
): Promise<EsitoModifiche> {
  const utili = refs.slice(0, MASSIMO_MODIFICHE);
  const parziali = refs.length > utili.length;
  if (utili.length === 0) return { modifiche: {}, leggibili: true, parziali: false };

  const blocchi: string[][] = [];
  for (let i = 0; i < utili.length; i += RIFERIMENTI_PER_CHIAMATA) {
    blocchi.push(utili.slice(i, i + RIFERIMENTI_PER_CHIAMATA));
  }

  const modifiche: Record<string, ModificaPreventivo> = {};
  let leggibili = true;
  const risposte = await Promise.all(
    blocchi.map((b) =>
      fetch(`/api/presenter/quote-edit?refs=${encodeURIComponent(b.join(","))}`, {
        headers: intestazioni,
      })
        .then(
          (r) =>
            r.json() as Promise<{ edits?: Record<string, ModificaPreventivo>; error?: string }>,
        )
        .catch((): { edits?: Record<string, ModificaPreventivo>; error?: string } => ({
          error: "rete",
        })),
    ),
  );
  for (const j of risposte) {
    //  ⚠️ La risposta 401 arriva come un JSON valido con `error:"auth"`: il
    //   `.json()` non lancia e il `catch` non scatta. Se non si guarda questo
    //   campo, «nessuna modifica» e «non sono autorizzato a leggerle» diventano
    //   la stessa cosa — e la seconda fa mostrare cifre vecchie come se fossero
    //   quelle buone.
    if (j?.error) {
      leggibili = false;
      continue;
    }
    Object.assign(modifiche, j?.edits ?? {});
  }
  return { modifiche, leggibili, parziali };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

function PaginaPreventivi() {
  const { user } = useAuth();
  const consulenteCollegato = useConsulenteCollegato();
  const { leads, updateLead } = useCRM();

  const [righe, setRighe] = useState<RigaPreventivo[]>([]);
  const [proprietari, setProprietari] = useState<Record<string, { id: string; nome: string }>>({});
  const [consulenti, setConsulenti] = useState<{ id: string; name: string }[]>([]);
  const [modifiche, setModifiche] = useState<Record<string, ModificaPreventivo>>({});
  const [registrazioni, setRegistrazioni] = useState<Set<string>>(new Set());
  const [caricamento, setCaricamento] = useState(true);
  /** ── QUELLO CHE DA QUI NON SI VEDE, E VA DETTO ─────────────────────────
   *  Tre rotte di /api/presenter rispondono 401 a chi apre il CRM senza una
   *  sessione da presentatore. Non è un errore da toast — un avviso rosso a
   *  ogni apertura si impara a ignorare in due giorni — è un fatto da scrivere
   *  sopra l'elenco, con il tono di `notaFonte` in ChiusuraDialog: si dice cosa
   *  manca e perché, e si continua a lavorare. */
  const [senzaAutori, setSenzaAutori] = useState(false);
  const [senzaModifiche, setSenzaModifiche] = useState(false);
  const [modificheParziali, setModificheParziali] = useState(false);
  const [troncato, setTroncato] = useState(false);
  //  La durata della promozione arriva dal server: finché non è arrivata le
  //  scadenze userebbero il valore di riserva. Il contatore forza il ricalcolo
  //  quando la durata vera è nota (setPromoDays scrive in un modulo, non in uno
  //  stato: senza questo, React non avrebbe motivo di rifare i conti).
  const [duratePronte, setDuratePronte] = useState(0);

  const [vista, setVista] = useState<Vista>("tutti");
  /** Il foglio dei filtri: esiste solo sotto i 1024 punti. Sul monitor la
   *  banda è tutta in vista e non si apre mai. */
  const [foglioFiltri, setFoglioFiltri] = useState(false);
  const [consulente, setConsulente] = useState<string>("tutti");
  const [cerca, setCerca] = useState("");
  const campoCerca = useRef<HTMLInputElement>(null);

  const [aiutoAperto, setAiutoAperto] = useState(false);
  const [passwordAperta, setPasswordAperta] = useState(false);
  const [password, setPassword] = useState("");
  const [salvandoPassword, setSalvandoPassword] = useState(false);

  const [daEliminare, setDaEliminare] = useState<Voce | null>(null);
  const [pin, setPin] = useState("");
  const [eliminando, setEliminando] = useState(false);
  //  ⚠️ Il chiavistello contro il doppio invio sta in un riferimento e non in
  //   uno stato: fra il primo clic e il render che spegne il pulsante c'è un
  //   istante, e su un tasto che dice «Elimina» il doppio tocco lo fa chiunque
  //   non veda succedere niente.
  const eliminazioneInCorso = useRef(false);

  /** Le finestre condivise: nessuna è scritta qui dentro. */
  const [scheda, setScheda] = useState<Lead | null>(null);
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStato, setQuickStato] = useState<LeadStatus | null>(null);
  /** Il lead a cui proporre la chiusura dopo aver accettato il preventivo. */
  const [daChiudere, setDaChiudere] = useState<Lead | null>(null);
  const chiusura = useChiusura();

  /* ── IL CARICAMENTO ──────────────────────────────────────────────────── */

  const carica = useCallback(async () => {
    setCaricamento(true);

    //  ⚠️ Il limite è dichiarato: sotto si controlla se è stato raggiunto e lo
    //   si scrive in pagina. Un elenco tagliato in silenzio fa credere che un
    //   preventivo non esista.
    const { data, error } = await dbPreventivi
      .from("quote_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMITE_RIGHE);
    if (error) {
      //  Senza le righe non c'è pagina: si dice, e non si lascia un elenco
      //  vuoto che si legge come «non ci sono preventivi».
      toast.error("Preventivi non caricati", { description: error.message });
      setCaricamento(false);
      return;
    }
    const elenco = data ?? [];
    setRighe(elenco);
    setTroncato(elenco.length >= LIMITE_RIGHE);

    const { data: cfg } = await dbPreventivi
      .from("app_config")
      .select("value")
      .eq("key", "quote_edit_password")
      .maybeSingle();
    setPassword(cfg?.value ?? "");

    //  ⚠️ LE CREDENZIALI DEL CRM, UNA VOLTA SOLA, PER TUTTE E TRE LE ROTTE
    //   PROTETTE. Il token del CRM è un'intestazione, non un cookie: non parte
    //   da solo. Senza, `quote-owner` mostrava «consulente non registrato» su
    //   OGNI riga, `quote-edit` faceva mostrare i totali grezzi al posto di
    //   quelli corretti dal consulente, e `recordings` faceva sparire la voce
    //   della registrazione dal menu «…» — tre volte lo stesso anello mancante,
    //   e nessuna delle tre lasciava un errore da nessuna parte.
    const credenziali = await intestazioniCRM();

    //  Autori, consulenti, durata della promozione e modifiche si leggono a
    //  parte e NON devono poter far fallire l'elenco: se una di queste non
    //  arriva, i preventivi restano leggibili e la pagina dice cosa manca.
    try {
      const [pro, cons, promo] = await Promise.all([
        fetch("/api/presenter/quote-owner", { headers: credenziali }).then((r) => r.json()),
        fetch("/api/presenter/presenters").then((r) => r.json()),
        fetch("/api/public/validate-discount").then((r) => r.json()),
      ]);
      setProprietari((pro?.owners ?? {}) as Record<string, { id: string; nome: string }>);
      //  ⚠️ Il 401 arriva come JSON valido: si guarda `error`, altrimenti
      //   «nessun autore registrato» e «non posso leggerli» sono la stessa cosa.
      setSenzaAutori(!!pro?.error);
      setConsulenti((cons?.presenters ?? []) as { id: string; name: string }[]);
      if (promo?.promoDays) {
        setPromoDays(Number(promo.promoDays));
        setDuratePronte((n) => n + 1);
      }
    } catch {
      setSenzaAutori(true);
    }

    const esito = await leggiModifiche(
      elenco.map((r) => (r.quote_ref || "").toUpperCase()).filter(Boolean),
      credenziali,
    );
    setModifiche(esito.modifiche);
    setSenzaModifiche(!esito.leggibili);
    setModificheParziali(esito.parziali);

    //  Le registrazioni servono a una voce sola del menu «…»: si chiede una
    //  volta e, se non è leggibile, quella voce semplicemente non compare —
    //  meglio di un tasto che apre un errore.
    try {
      const rec = await fetch("/api/presenter/recordings", { headers: credenziali }).then((r) =>
        r.json(),
      );
      setRegistrazioni(new Set(((rec?.refs as string[]) ?? []).map((x) => x.toUpperCase())));
    } catch {
      setRegistrazioni(new Set());
    }

    setCaricamento(false);
  }, []);

  useEffect(() => {
    if (user) void carica();
  }, [user, carica]);

  /* ── LE VOCI, GIÀ DECISE ─────────────────────────────────────────────── */

  /** L'indice per agganciare ogni preventivo alla sua scheda cliente. Si
   *  costruisce una volta su tutto l'archivio invece di cercare riga per riga:
   *  con ottocento lead e mille preventivi la differenza è fra una pagina che
   *  si apre e una che si pianta. */
  const indice = useMemo(() => indicizzaLead(leads), [leads]);

  const voci = useMemo<Voce[]>(
    () => righe.map((q) => costruisciVoce(q, proprietari, modifiche, indice)),
    // duratePronte non si usa nel corpo: serve solo a rifare i conti quando la
    // durata vera della promozione è arrivata dal server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [righe, proprietari, modifiche, indice, duratePronte],
  );

  /** Chi compare nel filtro: i consulenti configurati più chiunque abbia
   *  firmato un preventivo (uno cancellato dall'elenco ha comunque lasciato il
   *  suo lavoro qui, e senza questa riga i suoi preventivi sparirebbero dal
   *  filtro pur restando nell'elenco). */
  const filtriConsulente = useMemo(() => {
    const m = new Map<string, string>();
    consulenti.forEach((c) => m.set(c.id, c.name));
    voci.forEach((v) => {
      if (v.autoreId && !m.has(v.autoreId)) m.set(v.autoreId, v.autore || "Consulente");
    });
    return [...m.entries()]
      .map(([id, nome]) => ({ id, nome, n: voci.filter((v) => v.autoreId === id).length }))
      .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
  }, [consulenti, voci]);

  const senzaAutore = useMemo(() => voci.filter((v) => !v.autoreId).length, [voci]);

  /** Base = quello che il consulente scelto e la ricerca lasciano passare. I
   *  numeri in fondo contano DENTRO questa base: un conteggio che ignora i
   *  filtri attivi manda a cercare righe che non si vedono. */
  const base = useMemo(() => {
    const testo = normalizza(cerca.trim());
    const cifre = soloCifre(cerca);
    return voci.filter((v) => {
      if (consulente === "nessuno" && v.autoreId) return false;
      if (consulente !== "tutti" && consulente !== "nessuno" && v.autoreId !== consulente)
        return false;
      if (!testo && !cifre) return true;
      if (cifre.length >= 3 && v.cifre.includes(cifre)) return true;
      return testo.length > 0 && v.cerca.includes(testo);
    });
  }, [voci, consulente, cerca]);

  const conteggi = useMemo(() => {
    let inScadenza = 0;
    let scaduti = 0;
    let accettati = 0;
    let aperti = 0;
    let valoreAperto = 0;
    for (const v of base) {
      if (v.accettato) accettati += 1;
      if (v.chiuso) continue;
      aperti += 1;
      valoreAperto += v.totale;
      if (v.giorni < 0) scaduti += 1;
      else if (v.giorni <= GIORNI_IN_SCADENZA) inScadenza += 1;
    }
    return { inScadenza, scaduti, accettati, aperti, valoreAperto };
  }, [base]);

  const perVista = useMemo(() => {
    const conta = (x: Vista) => base.filter((v) => inVista(v, x)).length;
    return {
      tutti: base.length,
      scadenza: conta("scadenza"),
      scaduti: conta("scaduti"),
      accettati: conta("accettati"),
    } as Record<Vista, number>;
  }, [base]);

  const elenco = useMemo(() => {
    const filtrate = base.filter((v) => inVista(v, vista));
    //  Dentro la fascia «in scadenza» vince chi scade prima; fra gli scaduti
    //  vince il più recente (è quello che si può ancora recuperare); fra i
    //  chiusi si torna all'ordine di arrivo.
    return [...filtrate].sort((a, b) => {
      if (a.fascia !== b.fascia) return a.fascia - b.fascia;
      if (a.fascia === 0) return a.scadenzaIso.localeCompare(b.scadenzaIso);
      return b.q.created_at.localeCompare(a.q.created_at);
    });
  }, [base, vista]);

  /* ── LE AZIONI SUL PREVENTIVO ────────────────────────────────────────── */

  const salvaPassword = async () => {
    setSalvandoPassword(true);
    const { error } = await dbPreventivi
      .from("app_config")
      .upsert(
        { key: "quote_edit_password", value: password, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSalvandoPassword(false);
    if (error) {
      toast.error("Password non salvata", { description: error.message });
      return;
    }
    toast.success("Password salvata");
  };

  /** ── SEGNARE LO STATO DEL PREVENTIVO ───────────────────────────────────
   *  Si aggiorna prima a schermo: è il gesto più frequente della pagina e
   *  aspettare il giro completo la fa sembrare rotta. L'errore, se arriva,
   *  rimette le cose com'erano E lo dice. */
  const cambiaStatoPreventivo = async (id: string, status: string) => {
    const prima = righe.find((r) => r.id === id)?.status ?? "";
    setRighe((prec) => prec.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await dbPreventivi.from("quote_requests").update({ status }).eq("id", id);
    if (error) {
      toast.error("Stato non salvato", { description: error.message });
      void carica();
      return;
    }

    //  ── IL PREVENTIVO È IL POSTO DOVE SI SCOPRE DI AVER VENDUTO ─────────
    //   Segnare «Acconto ricevuto» qui non tocca la scheda del cliente, e
    //   viceversa: sono due vocabolari e restano due. Ma il momento in cui
    //   qualcuno segna l'incasso è ESATTAMENTE il momento in cui la vendita va
    //   registrata, e chiederlo dopo vuol dire non chiederlo mai.
    //   ⚠️ Non si sceglie la chiusura al posto suo: le chiusure vinte sono TRE
    //    (nel nostro centro, a domicilio, da spedire) e dicono anche come
    //    arriva l'impianto. Si apre la griglia degli stati — quella condivisa —
    //    e da lì la scelta finisce in ChiusuraDialog, che scrive stato, acconto
    //    e modo di consegna in un salvataggio solo.
    if (ACCETTATI.has(status) && !ACCETTATI.has(prima)) {
      const lead = voci.find((v) => v.q.id === id)?.aggancio?.lead ?? null;
      if (lead && !eLeadVinto(lead)) setDaChiudere(lead);
    }
  };

  const cambiaInizio = async (id: string, data: string): Promise<boolean> => {
    const { error } = await dbPreventivi
      .from("quote_requests")
      .update({ timeline_start: data || null })
      .eq("id", id);
    if (error) {
      toast.error("Data non salvata", { description: error.message });
      return false;
    }
    setRighe((prec) => prec.map((r) => (r.id === id ? { ...r, timeline_start: data || null } : r)));
    toast.success("Data di inizio salvata");
    return true;
  };

  const cambiaPassaggio = async (q: RigaPreventivo, chiave: string) => {
    const passaggi = { ...(q.timeline_steps ?? {}) };
    passaggi[chiave] = !passaggi[chiave];
    setRighe((prec) => prec.map((r) => (r.id === q.id ? { ...r, timeline_steps: passaggi } : r)));
    const { error } = await dbPreventivi
      .from("quote_requests")
      .update({ timeline_steps: passaggi })
      .eq("id", q.id);
    if (error) {
      toast.error("Passaggio non salvato", { description: error.message });
      void carica();
    }
  };

  /** ── COPIARE IL LINK ───────────────────────────────────────────────────
   *  `linkPreventivo` è SINCRONA di proposito: il link si costruisce e si copia
   *  dentro lo stesso clic, perché gli appunti del browser non aspettano una
   *  risposta di rete. Copiare non è copiare un indirizzo: da quel momento
   *  esiste una consulenza a cui quel link appartiene.
   *  ⚠️ Fuori esce SOLO il link: nessun nome, nessuna cifra. Chi lo riceve vede
   *   quello che è suo, e nient'altro. */
  const copiaLink = (ref: string) => {
    try {
      const url = linkPreventivo(ref);
      //  ── PERCHÉ LA CONFERMA NON È UN TOAST DI SONNER ────────────────────
      //   In questa pagina tutto parla con sonner, e la tentazione era di fare
      //   lo stesso qui. Ma `copyLink` conferma NELL'ISTANTE DEL CLIC senza
      //   aspettare `writeText`, che in certi browser non si risolve finché la
      //   finestra non torna in primo piano — cioè proprio quando si sta per
      //   incollare da un'altra parte. Con un toast legato all'esito la
      //   conferma non comparirebbe affatto: è il difetto che copied.tsx esiste
      //   per togliere. E la copia parte da due strade in parallelo, così se
      //   una non è disponibile (HTTP semplice, permessi negati) c'è l'altra.
      //   Sonner resta per l'unico fallimento che si può davvero riconoscere:
      //   il link che non si costruisce (qui sotto).
      copyLink(url, `Link di ${ref} copiato · mandalo al cliente`);
    } catch (e) {
      toast.error("Link non generato", {
        description: e instanceof Error ? e.message : "Riprova, oppure aprilo dal preventivo.",
      });
    }
  };

  const apriRegistrazione = async (ref: string) => {
    try {
      //  Stessa rotta protetta di sopra: senza le credenziali del CRM il tasto
      //  si apriva su «archivio non raggiungibile» anche quando la registrazione
      //  c'era.
      const j = await fetchCRM(
        `/api/presenter/recordings?quoteRef=${encodeURIComponent(ref)}`,
      ).then((r) => r.json());
      const rec = ((j?.recordings as { url: string }[]) ?? [])[0];
      if (!rec?.url) {
        toast.error("Nessuna registrazione per questo preventivo");
        return;
      }
      window.open(rec.url, "_blank", "noopener");
    } catch {
      toast.error("Archivio delle registrazioni non raggiungibile");
    }
  };

  /* ── L'ELIMINAZIONE, DALLA ROTTA CHE PULISCE DAVVERO ─────────────────── */

  /** ⚠️ NON si passa più da `supabase.delete()`. Quella cancellava la riga e
   *   basta, mentre la conferma prometteva che il cliente non avrebbe più
   *   trovato nulla: l'immagine di anteprima — con nome, cognome e totale
   *   disegnati sopra — resta in un deposito PUBBLICO e continua a rispondere a
   *   chiunque abbia il link. Cancellare a metà un dato personale è peggio che
   *   non cancellarlo, perché nessuno va più a controllare.
   *   La rotta toglie nove tracce e, prima di rispondere «fatto», va a
   *   verificare che quel file non ci sia più; se c'è ancora, non cancella
   *   nemmeno il preventivo e lo dice. */
  /** ── ⚠️ DUPLICARE: STESSA OFFERTA, DOCUMENTO NUOVO ─────────────────────
   *  Richiesta del committente: «fai che un preventivo posso duplicarlo dalla
   *  lista preventivi con un pulsante».
   *  Cosa si copia e cosa no lo decide `rigaDuplicata` (crm/preventivi/duplica),
   *  non questa funzione: sono decisioni sul documento — il numero, la
   *  scadenza, lo stato, il percorso — e vanno lette in un posto solo.
   *  ⚠️ Si scrive passando dal server (api.public.quote-create), che è l'unico
   *   che sa assegnare un numero libero: due preventivi con lo stesso numero
   *   sarebbero lo stesso documento per il link del cliente, per la causale del
   *   bonifico e per la fattura.
   *  ⚠️ E si dice com'è andata. Una scrittura che fallisce in silenzio, qui,
   *   vuol dire un consulente convinto di avere un preventivo nuovo da mandare
   *   e un archivio in cui non c'è niente. */
  const duplicaInCorso = useRef(false);
  const duplica = async (v: Voce) => {
    if (duplicaInCorso.current) return;
    duplicaInCorso.current = true;
    try {
      const j = (await fetch("/api/public/quote-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: rigaDuplicata(v.q as PreventivoDaCopiare) }),
      }).then((r) => r.json())) as { ok?: boolean; ref?: string; reason?: string };
      if (!j?.ok || !j.ref) {
        toast.error("Preventivo NON duplicato", {
          description: `${j?.reason ?? "il server non ha risposto"}. In archivio non è stato scritto niente.`,
        });
        return;
      }
      toast.success(`Duplicato in ${j.ref}`, {
        description: spiegazioneDuplicato(v.q as PreventivoDaCopiare),
        action: {
          label: "Aprilo",
          onClick: () =>
            window.open(`/preventivo?id=${encodeURIComponent(j.ref!)}`, "_blank", "noopener"),
        },
      });
      //  L'elenco si rilegge: il duplicato deve comparire dov'è, non solo nel
      //  messaggio che sparisce fra cinque secondi.
      await carica();
    } catch (e) {
      toast.error("Preventivo NON duplicato", {
        description: `${e instanceof Error ? e.message : "connessione assente"}. In archivio non è stato scritto niente.`,
      });
    } finally {
      duplicaInCorso.current = false;
    }
  };

  const elimina = async () => {
    if (!daEliminare || eliminazioneInCorso.current) return;
    const ref = daEliminare.q.quote_ref;
    eliminazioneInCorso.current = true;
    setEliminando(true);
    try {
      const j = await (
        await fetch("/api/presenter/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", refs: [ref], code: pin.trim() }),
        })
      ).json();

      if (!j?.ok) {
        //  Il server sa perché ha detto di no, e quel motivo va a schermo così
        //  com'è: senza, si riprova all'infinito una cosa che non si può fare.
        const pinRifiutato = j?.error === "auth" || j?.reason === "codice non valido";
        if (pinRifiutato) setPin("");
        toast.error(
          pinRifiutato
            ? "PIN non riconosciuto"
            : typeof j?.reason === "string" && j.reason
              ? j.reason
              : "Eliminazione non riuscita",
          { duration: 12000 },
        );
        //  ⚠️ E poi si ricarica lo stesso: «non riuscito» vuol dire anche
        //   «riuscito a metà» — il preventivo può essere sparito davvero e a
        //   restare indietro una pulizia laterale. Senza questa riga si
        //   continuerebbe a premere su un fantasma.
        void carica();
        return;
      }

      const fatti = typeof j?.deleted === "number" ? j.deleted : 1;
      setDaEliminare(null);
      if (fatti === 0) {
        toast.warning("Non c'era più niente da eliminare", {
          description: "Quel preventivo non era più in archivio. L'elenco è stato aggiornato.",
        });
      } else {
        const avvisi = Array.isArray(j.avvisi) ? (j.avvisi as string[]).join("; ") : "";
        toast.success(
          `Preventivo ${ref} eliminato`,
          avvisi ? { description: avvisi, duration: 12000 } : undefined,
        );
      }
      void carica();
    } catch {
      //  Da qui non si può sapere se la richiesta sia arrivata: la connessione
      //  può essere caduta DOPO che il lavoro era fatto. Si ammette il dubbio e
      //  si ricarica, che è l'unico modo di scoprirlo.
      toast.error("Errore di rete durante l'eliminazione", {
        description:
          "Non si sa se la richiesta sia arrivata: l'elenco è stato ricaricato, controlla se il preventivo c'è ancora.",
        duration: 12000,
      });
      void carica();
    } finally {
      eliminazioneInCorso.current = false;
      setEliminando(false);
    }
  };

  /* ── LO STATO DELLA SCHEDA CLIENTE ───────────────────────────────────── */

  /** ⚠️ Le tre chiusure vinte NON si scrivono qui: le scrive ChiusuraDialog
   *   insieme all'acconto, al totale e al modo di consegna, in un salvataggio
   *   solo. Uno stato scritto qui e i soldi scritti dopo sono due momenti, e in
   *   mezzo c'è un lead verde con la cassa vuota.
   *   Il ramo della chiusura va PRIMA di quello di `requiresAnyDialog`, o si
   *   aprirebbero due finestre per un gesto solo. */
  const cambiaStatoLead = (lead: Lead, nuovo: LeadStatus) => {
    setDaChiudere(null);
    if (nuovo === lead.data?.stato) return;
    if (chiusura.intercetta(lead, nuovo)) return;
    if (requiresAnyDialog(nuovo)) {
      setQuickLead(lead);
      setQuickStato(nuovo);
      return;
    }
    void (async () => {
      //  `updateLead` risponde true/false: un salvataggio non partito non deve
      //  potersi confondere con uno riuscito.
      const scritto = await updateLead(lead.id, { stato: nuovo });
      if (!scritto) {
        toast.error("Stato della scheda NON salvato", {
          description: "La scheda in archivio è rimasta com'era. Riprova.",
        });
        return;
      }
      toast.success(
        `${`${lead.data?.nome ?? ""} ${lead.data?.cognome ?? ""}`.trim() || "Il cliente"} → ${LEAD_STATUS_LABEL[nuovo]}`,
      );
    })();
  };

  /* ── LE SCORCIATOIE ──────────────────────────────────────────────────── */

  //  ⚠️ Ultimo hook, e sotto non c'è nessuna uscita anticipata che lo salti.
  useScorciatoie(
    {
      "/": () => campoCerca.current?.focus(),
      "?": () => setAiutoAperto((v) => !v),
      ...Object.fromEntries(VISTE.map((v, i) => [String(i + 1), () => setVista(v.chiave)])),
    },
    //  Con una finestra aperta i tasti appartengono a quella.
    { bloccato: !!daEliminare || !!scheda || !!quickLead || !!daChiudere },
  );

  const nomeConsulente = consulenteCollegato?.nome ?? "";

  /* ── LA PAGINA ───────────────────────────────────────────────────────── */

  /** ── ⚠️ SCRITTI UNA VOLTA, MOSTRATI IN DUE POSTI ────────────────────────
   *  Sul monitor la banda ci sta tutta. Sotto i 1024 punti — telefono E
   *  TABLET — no: ricerca, quattro viste, «Tutti» e un nome per ogni
   *  consulente diventano tre o quattro righe sopra l'elenco. Là restano
   *  fuori la ricerca e le viste (che portano i conteggi), e i nomi entrano
   *  in un foglio.
   *  ⚠️ Il tablet sta con il telefono e non col monitor: a 820 punti la banda
   *   andava a capo lo stesso, e una riga in meno di elenco su uno schermo
   *   tenuto in mano costa quanto sul telefono.
   *  ⚠️ È UNA sola espressione, resa in due contenitori: una copia ridotta
   *   vorrebbe dire che il giorno che si aggiunge un filtro lo si aggiunge in
   *   un posto solo, e le due schermate filtrano insiemi diversi. */
  const laRicerca = (
    <>
      <Input
        ref={campoCerca}
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
        placeholder="Nome, telefono, numero preventivo…  ( / )"
        aria-label="Cerca un preventivo"
        className="h-8 w-full max-w-[260px] text-[12.5px]"
      />
    </>
  );
  const gliAltriFiltri = (
    <>
      <SepBarra />
      {VISTE.map((v, i) => (
        <Segmento
          key={v.chiave}
          attivo={vista === v.chiave}
          onClick={() => setVista(v.chiave)}
          conteggio={perVista[v.chiave]}
          titolo={`${v.titolo} (tasto ${i + 1})`}
        >
          {v.etichetta}
        </Segmento>
      ))}
      {filtriConsulente.length > 0 && <SepBarra />}
      {filtriConsulente.length > 0 && (
        <Segmento
          attivo={consulente === "tutti"}
          onClick={() => setConsulente("tutti")}
          conteggio={voci.length}
          titolo="I preventivi di chiunque"
        >
          Tutti
        </Segmento>
      )}
      {filtriConsulente.map((c) => (
        <Segmento
          key={c.id}
          attivo={consulente === c.id}
          onClick={() => setConsulente(c.id)}
          conteggio={c.n}
          titolo={`Solo i preventivi fatti da ${c.nome}`}
        >
          {c.nome}
        </Segmento>
      ))}
      {senzaAutore > 0 && !senzaAutori && (
        <Segmento
          attivo={consulente === "nessuno"}
          onClick={() => setConsulente("nessuno")}
          conteggio={senzaAutore}
          titolo="Preventivi nati prima che si registrasse l'autore, o compilati dal cliente da solo"
        >
          Senza consulente
        </Segmento>
      )}
    </>
  );
  return (
    <Pagina>
      <Titolo
        testo="Preventivi"
        nota={
          conteggi.aperti > 0
            ? `${conteggi.aperti} ancora aperti, ${eur(conteggi.valoreAperto)} sul tavolo. Prima chi sta per perdere il prezzo.`
            : "Chi ha ricevuto un'offerta e quanto tempo resta prima che il prezzo scada"
        }
        icona={FileText}
        azioni={
          <>
            <AiutoScorciatoie voci={SCORCIATOIE} aperto={aiutoAperto} onCambia={setAiutoAperto} />
            {/*  La password è CONFIGURAZIONE, non lavoro: si tocca una volta
                all'anno. Prima stava in fondo alla pagina «dove non ruba
                attenzione» — ma era anche l'ultima cosa che si leggeva
                scorrendo l'elenco. Dentro un pannello chiuso non ruba niente e
                non conclude niente. */}
            <Button
              size="sm"
              variant={passwordAperta ? "secondary" : "outline"}
              className="h-8 text-[12px]"
              onClick={() => setPasswordAperta((v) => !v)}
            >
              <Lock className="mr-1 h-3.5 w-3.5" /> Password di modifica
            </Button>
          </>
        }
      />

      {/* ── LA BANDA: UNA SOLA ────────────────────────────────────────────
          Ricerca, consulente, vista. Prima erano DUE bande — i segmenti dei
          consulenti e quattro riquadri numerici cliccabili — e i secondi
          ripetevano per numero ciò che i primi dicevano per parola. È lo stesso
          errore che le Installazioni hanno già corretto: il conteggio sta
          DENTRO la pastiglia del filtro. */}
      {/* ── SUL MONITOR: LA BANDA COM'ERA ─────────────────────────────── */}
      <BarraAzioni className="hidden lg:flex">
        {laRicerca}
        {gliAltriFiltri}
      </BarraAzioni>

      {/* ── SOTTO I 1024: LA RICERCA, LE VISTE, E UN PULSANTE ──────────── */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        <div className="flex items-center gap-1.5">
          {laRicerca}
          <button
            type="button"
            onClick={() => setFoglioFiltri(true)}
            aria-label="Tutti i filtri"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition",
              consulente !== "tutti"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {/*  Il NOME e non un puntino: un elenco ristretto a una persona
                senza dire quale si legge come «ci sono meno preventivi». */}
            {consulente === "tutti"
              ? "Filtri"
              : consulente === "nessuno"
                ? "Senza consulente"
                : (filtriConsulente.find((c) => c.id === consulente)?.nome ?? "Filtri")}
          </button>
        </div>
        {/*  Le viste scorrono di lato invece di andare a capo: portano i
            conteggi, e sono la partizione principale della pagina. */}
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VISTE.map((v, i) => (
            <Segmento
              key={v.chiave}
              attivo={vista === v.chiave}
              onClick={() => setVista(v.chiave)}
              conteggio={perVista[v.chiave]}
              titolo={v.titolo}
              className="shrink-0"
            >
              {v.etichetta}
            </Segmento>
          ))}
        </div>
      </div>

      {foglioFiltri && (
        <Finestra
          aperta={foglioFiltri}
          onCambio={setFoglioFiltri}
          icona={SlidersHorizontal}
          titolo="Filtri"
          larghezza="md"
        >
          <div className="flex flex-wrap items-center gap-2">{gliAltriFiltri}</div>
        </Finestra>
      )}

      {/* ── QUELLO CHE DA QUI NON SI VEDE ─────────────────────────────────
          Detto una volta, in una riga, con il tono di chi spiega e non di chi
          allarma. Un avviso rosso all'apertura di ogni pagina si impara a
          ignorare in due giorni; questo si legge, si capisce e si sa cosa
          farne. */}
      {(senzaAutori || senzaModifiche || modificheParziali || troncato) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            Da qui non si vede tutto
          </p>
          <ul className="mt-1 space-y-0.5 pl-5">
            {senzaAutori && (
              <li>
                Chi ha fatto i preventivi non è leggibile senza l&apos;accesso da presentatore:
                l&apos;autore resta vuoto su tutte le righe e il filtro per consulente non compare.
              </li>
            )}
            {senzaModifiche && (
              <li>
                Le modifiche fatte dopo — quantità, sconto del consulente, condizioni riaperte, note
                di consulenza — non sono leggibili senza l&apos;accesso da presentatore.{" "}
                <b>I totali e le scadenze qui sotto sono quelli originali</b>: se qualcuno ha
                riaperto le condizioni, il cliente vede una data diversa.
              </li>
            )}
            {modificheParziali && (
              <li>
                Le modifiche sono state lette solo sui {MASSIMO_MODIFICHE} preventivi più recenti:
                sui più vecchi il totale è quello con cui erano nati.
              </li>
            )}
            {troncato && (
              <li>
                L&apos;elenco si ferma ai {LIMITE_RIGHE} preventivi più recenti. Per i più vecchi
                usa la ricerca del pannello «Preventivi attivi».
              </li>
            )}
          </ul>
        </div>
      )}

      {passwordAperta && (
        <Scheda
          titolo="Password di modifica del preventivo"
          nota="Serve al cliente per sbloccare «Modifica preventivo» nella pagina di conferma"
          icona={Lock}
          azioni={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[12px]"
              onClick={() => setPasswordAperta(false)}
            >
              Chiudi
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="es. HG2026"
              className="h-9 w-full max-w-xs text-[13px]"
            />
            <Button
              size="sm"
              className="h-9"
              onClick={() => void salvaPassword()}
              disabled={salvandoPassword}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {salvandoPassword ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Senza questa password il cliente non può modificare da solo il preventivo che ha
            ricevuto.
          </p>
        </Scheda>
      )}

      {/* ── L'ELENCO ──────────────────────────────────────────────────────── */}
      {caricamento ? (
        <p className="py-8 text-center text-[12.5px] text-muted-foreground">Caricamento…</p>
      ) : elenco.length === 0 ? (
        <Vuoto
          titolo={voci.length === 0 ? "Nessun preventivo" : "Nessun preventivo in questa vista"}
          testo={
            voci.length === 0
              ? "I preventivi compilati dal configuratore /preventivo compaiono qui appena vengono salvati."
              : "Cambia filtro in cima per vedere le altre righe."
          }
          icona={FileText}
          azione={
            voci.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setVista("tutti");
                  setConsulente("tutti");
                  setCerca("");
                }}
              >
                Togli i filtri
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {elenco.map((v) => (
            <RigaPreventivoScheda
              key={v.q.id}
              voce={v}
              consulente={nomeConsulente}
              conRegistrazione={registrazioni.has((v.q.quote_ref || "").toUpperCase())}
              onStatoPreventivo={cambiaStatoPreventivo}
              onStatoLead={cambiaStatoLead}
              onScheda={setScheda}
              onRegistrazione={(ref) => void apriRegistrazione(ref)}
              onCopiaLink={copiaLink}
              onInizio={cambiaInizio}
              onPassaggio={cambiaPassaggio}
              onDuplica={() => void duplica(v)}
              onElimina={() => {
                setPin("");
                setDaEliminare(v);
              }}
            />
          ))}
        </div>
      )}

      {/* ── I NUMERI, IN FONDO ────────────────────────────────────────────
          Non sono filtri, ed è il punto: un riquadro che è anche un filtro
          insegna che i numeri si premono, e allora tutti i numeri della pagina
          diventano ambigui. I filtri stanno in cima, nella loro banda; questi
          si leggono a fine giornata e dicono se si sta avanzando.
          Contano DENTRO i filtri attivi, come l'elenco sopra. */}
      {!caricamento && voci.length > 0 && (
        <KpiRiga colonne={4}>
          <Kpi
            etichetta="Aperti"
            valore={conteggi.aperti}
            nota={
              conteggi.valoreAperto > 0 ? `${eur(conteggi.valoreAperto)} da chiudere` : undefined
            }
            icona={FileText}
          />
          <Kpi
            etichetta="In scadenza"
            valore={conteggi.inScadenza}
            nota={`Il prezzo scade entro ${GIORNI_IN_SCADENZA} giorni`}
            tono={conteggi.inScadenza > 0 ? "in_sospeso" : "neutro"}
            icona={CalendarClock}
          />
          <Kpi
            etichetta="Scaduti"
            valore={conteggi.scaduti}
            nota="Il prezzo non è più valido: va rifatto"
            tono={conteggi.scaduti > 0 ? "persa" : "neutro"}
          />
          <Kpi
            etichetta="Accettati"
            valore={conteggi.accettati}
            nota="Acconto ricevuto o confermato"
            tono={conteggi.accettati > 0 ? "vinta" : "neutro"}
            icona={Check}
          />
        </KpiRiga>
      )}

      {/* ── ELIMINAZIONE ──────────────────────────────────────────────────
          Non chiede «sei sicuro?»: quella è una domanda che si preme senza
          leggerla. Chiede se eliminare il preventivo DI QUALCUNO, con il suo
          nome, il suo numero e la sua cifra — le tre cose che permettono di
          accorgersi di aver preso la riga sbagliata mentre c'è ancora tempo. */}
      <Finestra
        aperta={!!daEliminare}
        onCambio={(v) => !v && !eliminando && setDaEliminare(null)}
        titolo={
          daEliminare
            ? `Eliminare il preventivo di ${daEliminare.intestatario}?`
            : "Elimina il preventivo"
        }
        contesto={
          daEliminare
            ? `${daEliminare.q.quote_ref} · ${eur(daEliminare.totale)} · creato il ${new Date(daEliminare.q.created_at).toLocaleDateString("it-IT")}`
            : undefined
        }
        icona={Trash2}
        larghezza="sm"
        bloccante
        classeCorpo="space-y-3"
        azioni={
          <>
            <Button variant="outline" disabled={eliminando} onClick={() => setDaEliminare(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={eliminando || !pin.trim()}
              onClick={() => void elimina()}
            >
              {eliminando ? "Eliminazione…" : "Elimina definitivamente"}
            </Button>
          </>
        }
      >
        {/*  ⚠️ QUESTA FRASE È UN IMPEGNO, e chi lo mantiene è il server:
            /api/presenter/quotes (action:"delete") toglie anche l'immagine di
            anteprima con nome, cognome e totale disegnati sopra — che sta in un
            deposito PUBBLICO — e prima di rispondere «fatto» va a controllare
            che non ci sia più. Finché passava da `supabase.delete()`, questa
            promessa era falsa. */}
        <NotaFinestra tono="attenzione" icona={Trash2}>
          Spariscono per sempre il preventivo, le sue voci, il percorso, le condizioni riaperte e le
          note di consulenza, e il rimando dalla scheda del cliente. Il link smette di funzionare:
          se l&apos;hai già mandato su WhatsApp, al posto dell&apos;anteprima con il nome e il
          totale il cliente troverà la scheda generica dello studio. L&apos;operazione non si
          annulla.
        </NotaFinestra>
        {/*  Il PIN non è un fastidio in più: la rotta lo verifica davvero — chi
            manda un codice sbagliato non cancella niente — ed è la firma di chi
            si assume questa cancellazione, che finisce nel registro del server. */}
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            PIN consulente
          </span>
          <Input
            type="password"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="h-10 max-w-[10rem] text-center text-[16px] tracking-[0.35em]"
          />
          <span className="mt-1.5 block text-[11px] text-slate-500">
            Il PIN con cui entri nel CRM, oppure il codice consulente.
          </span>
        </label>
      </Finestra>

      {/* ── LE FINESTRE CONDIVISE ─────────────────────────────────────────
          Nessuna è scritta qui: la griglia degli stati è quella di
          SelettoreStatoDialog, giorno/ora e importi li chiede QuickStatusDialog,
          la vendita ChiusuraDialog, la scheda intera LeadDialog. */}
      <FinestraStati
        aperta={!!daChiudere}
        onChiudi={() => setDaChiudere(null)}
        stato={daChiudere?.data?.stato}
        opzioni={daChiudere ? statiSelezionabili(daChiudere.data ?? {}) : []}
        contesto={
          daChiudere
            ? `Preventivo accettato · ${`${daChiudere.data?.nome ?? ""} ${daChiudere.data?.cognome ?? ""}`.trim()} · la scheda è ancora «${etichettaStato(daChiudere.data?.stato)}»`
            : undefined
        }
        onScegli={(s) => {
          const l = daChiudere;
          //  Prima si chiude, poi si sceglie: la scelta apre quasi sempre una
          //  SECONDA finestra, e due dialoghi aperti insieme si rubano il fuoco
          //  e lasciano due veli sovrapposti.
          setDaChiudere(null);
          if (l) cambiaStatoLead(l, s);
        }}
      />

      <QuickStatusDialog
        open={!!quickLead && !!quickStato}
        onOpenChange={(v) => {
          if (v) return;
          setQuickLead(null);
          setQuickStato(null);
        }}
        lead={quickLead}
        newStatus={quickStato}
      />

      {chiusura.finestra}

      <LeadDialog open={!!scheda} onOpenChange={(v) => !v && setScheda(null)} lead={scheda} />
    </Pagina>
  );
}
