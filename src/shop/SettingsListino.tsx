/** ─────────────────────────────────────────────────────────────────────────
 *  IMPOSTAZIONI DI MEETLY · scheda LISTINO
 *
 *  DA DOVE ARRIVA
 *  Era la pagina /CRM/prezzi del gestionale. Il listino decide le cifre che il
 *  cliente vede DURANTE la consulenza: è un'impostazione del software di
 *  vendita, non del gestionale, e ora sta dove si vende — dentro Meetly,
 *  raggiungibile senza uscire dalla presentazione.
 *
 *  COSA NON SI È PERSO NEL TRASLOCO (e non va tolto per "snellire")
 *   · IL VALORE ATTUALE SI LEGGE — ogni voce mostra il prezzo come CIFRA, non
 *     come casella. Si preme, e solo allora diventa un campo. Il campo è di
 *     testo, mai `type=number`: sopra un input numerico basta la rotellina del
 *     mouse per cambiare un prezzo senza accorgersene, e la virgola dei
 *     decimali verrebbe rifiutata.
 *   · SI VEDE COSA È CAMBIATO — la voce toccata si colora d'ambra e porta
 *     scritto "era 389,00 €". Finché non si salva, la barra dice quante
 *     modifiche sono in sospeso e il browser avvisa se si prova a chiudere.
 *   · SI CONFERMA PRIMA DI SCRIVERE — il salvataggio passa da una finestra che
 *     elenca voce per voce il prima → dopo, con l'anteprima di come apparirà, e
 *     segnala i salti sospetti (prezzo a zero, cifra moltiplicata o divisa per
 *     dieci: cioè uno zero digitato in più o in meno).
 *   · SI VERIFICA DOPO AVER SCRITTO — "salvato" non è "il server non ha dato
 *     errore": il server RILEGGE la riga e la rimanda indietro, e qui si
 *     confronta con ciò che si voleva scrivere. Solo allora compare l'orario.
 *     Se qualcosa non combacia le modifiche restano lì, non si perdono.
 *   · L'ANTEPRIMA È IL CONTROLLO PIÙ ECONOMICO — accanto a ogni voce c'è la
 *     pastiglia esatta che vedrà il cliente, e in fondo il preventivo tipo col
 *     totale che leggerebbe oggi, sconti automatici compresi.
 *
 *  PERCHÉ PASSA DAL SERVER
 *  Il presentatore non ha una sessione Supabase: la scrittura va a
 *  /api/presenter/pricing, che usa il service role dopo aver controllato chi
 *  sta chiedendo, e restituisce la riga riletta.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Euro,
  Eye,
  EyeOff,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Tag,
  Check,
  Landmark,
  Ticket,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/shop/catalog";
//  Le parole del limite di un'offerta: le stesse che leggerà il cliente sul
//  preventivo, non una seconda scrittura che col tempo dice un'altra cosa.
import { limiteInParole, tipoOfferta } from "@/shop/promo-garanzia";
import type { GaranziaCodice } from "@/shop/garanzia-codici";
//  La causale del bonifico: modello e regole in un posto solo (la stessa
//  frase la legge la pagina del cliente e la fattura).
import { MODELLO_DI_CASA as MODELLO_CAUSALE_DI_CASA, causaleDi } from "@/shop/causale-bonifico";
import {
  BASE_SOLUTIONS,
  DEFAULT_SELECTED,
  PARTI_PREVENTIVO,
  UPSELL_SECTIONS,
  ACCONTO_DI_CASA,
  MAINTENANCE as MANUTENZIONE_DI_CASA,
  chiaveParte,
  chiaveSezione,
  manutenzioneDi,
  preselezione,
  sectionsFor,
  type PricingOverrides,
  type PricingRow,
} from "@/shop/quote-menu";
import {
  IDS_BASE,
  RIGHE,
  basiDisponibili,
  calcolaPreventivoTipo,
  euroCorto,
  listinoDaVoci,
  numeroDaTesto,
  parlaDiManutenzione,
  testoDaNumero,
  vociDaListino,
  vociModificate,
  type Listino,
  type ScontiVigenti,
  type Voce,
  type VoceModificata,
} from "@/shop/listino-condiviso";
import { SchedaPreventivoTipo } from "@/shop/SettingsPreventivoTipo";
import {
  AnteprimaPrezzo,
  Avviso,
  BottoneChiaro,
  BottonePieno,
  FinestraScura,
  NotaFinestra,
  Numero,
  Pastiglia,
  Riquadro,
  Segmento,
  StatoSalvataggio,
  useAvvisoModificheNonSalvate,
} from "@/shop/settings-ui";

/** Ricerca "gentile": accenti e maiuscole non devono impedire di trovare una
 *  voce che si sta guardando a schermo. */
const normalizza = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Gli sconti che il cliente si trova applicati senza chiedere niente. Si
 *  leggono dall'endpoint dei coupon — lo stesso che alimenta la scheda Sconti —
 *  con lo stesso filtro del server: un codice a posti esauriti non si applica
 *  più, e qui non deve entrare nel conto del preventivo tipo. */
async function caricaScontiVigenti(): Promise<ScontiVigenti> {
  interface RigaCodice {
    code: string;
    label: string | null;
    discount_eur: number;
    stock_left: number | null;
    active: boolean;
    auto_apply: boolean;
  }
  const j = (await fetch("/api/presenter/coupons").then((r) => r.json())) as {
    codes?: RigaCodice[];
    qty?: Record<string, number>;
  };
  const auto = (j.codes ?? [])
    .filter((r) => r.active && r.auto_apply && (r.stock_left === null || r.stock_left > 0))
    .map((r) => ({ code: r.code, etichetta: r.label, eur: Number(r.discount_eur) || 0 }))
    .filter((r) => r.eur > 0);
  return { auto, quantita: j.qty ?? {} };
}

export function SettingsListino({
  chiaveRicarica = 0,
  vaiAiCodici,
}: {
  chiaveRicarica?: number;
  /** Porta al pannello degli sconti, dove i codici si creano davvero. Da qui
   *  si vedono soltanto: due editor per la stessa cosa si scostano sempre. */
  vaiAiCodici?: () => void;
}) {
  /*  ── I CODICI CHE CAMBIANO IL PREZZO DELLA GARANZIA ───────────────────
      Richiesta del committente: «fai sezione dove aggiungere codice
      promozionale per passare dal 35% garanzia a importo fisso che imposto nel
      codice promozionale».
      Qui si LEGGONO e basta: si creano dove si creano tutti gli altri codici,
      e un secondo posto in cui scriverli vorrebbe dire due elenchi che col
      tempo dicono cose diverse. Quello che questa sezione aggiunge è la cosa
      che mancava davvero: vedere, da dove imposti il 35%, QUALI codici lo
      sostituiscono e con che cifra. */
  const [garanzieCodici, setGaranzieCodici] = useState<Record<string, GaranziaCodice>>({});
  /*  ── ⚠️ E SI CREA DA QUI ──────────────────────────────────────────────
      Segnalazione del committente: «clicco ma non mi fa creare codice per
      questo». Giusto: il pulsante portava al pannello degli sconti, dove un
      codice si crea — ma è un codice normale, e l'offerta sulla garanzia va
      poi impostata a mano in un secondo riquadro. Due passaggi in due schede
      diverse per una cosa sola: chi non li conosce entrambi non arriva in
      fondo.
      Qui si crea nel modo in cui la si pensa: un nome e la cifra che pagherà
      dopo. Il resto — posti, data, testi — resta nel pannello Sconti, che
      continua a essere il posto dove i codici si modificano. */
  const [nuovoCodice, setNuovoCodice] = useState({
    codice: "",
    //  «fisso» = paga questa cifra; «percento» = paga questa percentuale in
    //  meno del prezzo di oggi. Due modi di dire la stessa promessa, e
    //  l'archivio li tiene separati apposta (vedi `tipoOfferta`).
    tipo: "fisso" as "fisso" | "percento",
    importo: "",
    posti: "",
    disponibili: "",
    giorni: "",
  });
  const [creando, setCreando] = useState(false);

  /** Crea il codice e gli attacca subito l'offerta sulla garanzia.
   *  ⚠️ Lo sconto sul totale è ZERO: questo codice non abbassa il preventivo di
   *   oggi, cambia soltanto quanto pagherà dopo. Metterci dentro anche uno
   *   sconto vorrebbe dire due promesse in un codice solo, e nessuno che se le
   *   ricorda entrambe al momento di spiegarle. */
  const creaCodiceGaranzia = async () => {
    const codice = nuovoCodice.codice.trim().toUpperCase();
    const importo = numeroDaTesto(nuovoCodice.importo);
    if (!codice || importo == null || importo <= 0) {
      toast.error(
        nuovoCodice.tipo === "percento"
          ? "Serve un codice e la percentuale di sconto"
          : "Serve un codice e il prezzo dal secondo impianto",
      );
      return;
    }
    if (nuovoCodice.tipo === "percento" && importo > 100) {
      toast.error("Una percentuale sopra il 100% non esiste");
      return;
    }
    setCreando(true);
    try {
      const creato = (await fetch("/api/presenter/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", code: codice, discount_eur: 0, label: "Garanzia a prezzo fisso" }),
      }).then((r) => r.json())) as { ok?: boolean; reason?: string };
      //  «Esiste già» non è un errore da fermarsi: si va avanti e gli si
      //  attacca l'offerta, che è quello che si stava cercando di fare.
      if (!creato?.ok && creato?.reason !== "duplicate") {
        toast.error("Codice NON creato", { description: creato?.reason });
        return;
      }
      const intero = (t: string): number | null => {
        const n = Math.round(Number(t.trim().replace(",", ".")));
        return t.trim() && Number.isFinite(n) && n > 0 ? n : null;
      };
      const totali = intero(nuovoCodice.posti);
      //  Quanti ne restano: se non lo scrive, restano tutti quelli che ha
      //  dichiarato. È la lettura che non sorprende nessuno.
      const disponibili = intero(nuovoCodice.disponibili) ?? totali;
      const giorni = intero(nuovoCodice.giorni);
      const g = (await fetch("/api/presenter/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "garanzia",
          code: codice,
          mostra: true,
          //  ⚠️ SI MANDANO TUTTI E DUE, e uno dei due è zero: passare da
          //   «−30%» a «550 €» deve CANCELLARE il 30, che altrimenti
          //   continuerebbe a comandare (la percentuale vince sul fisso).
          importo: nuovoCodice.tipo === "fisso" ? importo : 0,
          sconto: nuovoCodice.tipo === "percento" ? importo : 0,
          posti: disponibili ?? null,
          postiTotali: totali ?? null,
          giorni: giorni ?? null,
          scadenza: "",
          titolo: "",
        }),
      }).then((r) => r.json())) as { ok?: boolean; garanzie?: Record<string, GaranziaCodice>; reason?: string };
      if (!g?.ok) {
        toast.error("Offerta NON salvata", { description: g?.reason });
        return;
      }
      setGaranzieCodici(g.garanzie ?? {});
      setNuovoCodice((n) => ({ ...n, codice: "", importo: "", posti: "", disponibili: "", giorni: "" }));
      toast.success(`${codice} pronto`, {
        description:
          nuovoCodice.tipo === "percento"
            ? `Chi lo inserisce nel preventivo, dal secondo impianto paga il ${testoDaNumero(importo)}% in meno.`
            : `Chi lo inserisce nel preventivo, dal secondo impianto paga ${testoDaNumero(importo)} €.`,
      });
    } catch {
      toast.error("Non sono riuscito a parlare col server");
    } finally {
      setCreando(false);
    }
  };
  useEffect(() => {
    let vivo = true;
    void fetch("/api/presenter/coupons")
      .then((r) => r.json())
      .then((j: { garanzie?: Record<string, GaranziaCodice> }) => {
        if (vivo && j?.garanzie) setGaranzieCodici(j.garanzie);
      })
      .catch(() => { /* il pannello funziona lo stesso: questa è una vetrina */ });
    return () => { vivo = false; };
  }, [chiaveRicarica]);
  const [salvato, setSalvato] = useState<Listino>({});
  const [bozza, setBozza] = useState<Listino>({});
  /** ── I PREZZI BARRATI SI POSSONO SPEGNERE ──────────────────────────────
   *  Non è un prezzo, è il MODO in cui i prezzi si presentano: acceso, accanto
   *  a ogni personalizzazione compare il listino pieno sbarrato e il preventivo
   *  conta quel risparmio fra le condizioni; spento, il prezzo scontato è
   *  semplicemente il prezzo. Quello che il cliente paga non cambia mai.
   *  Sta in due stati come tutto il resto di questo pannello — salvato e bozza —
   *  perché anche questo interruttore deve passare da «Rivedi e salva». */
  const [scontiSalvato, setScontiSalvato] = useState(true);
  const [scontiBozza, setScontiBozza] = useState(true);
  /*  ── ⚠️ COSA DEL PREVENTIVO IL CLIENTE VEDE ────────────────────────────
      Richiesta del committente: «fai che posso disattivare le opzioni del
      preventivo dalle impostazioni presentazione».
      Le singole voci si nascondevano già una per una, qui sotto. Mancava il
      resto: una SEZIONE intera — per spegnerla bisognava nascondere le sue
      voci una alla volta, e per riaccenderla ricordarsi quali — e le parti
      fisse della pagina, che c'erano e basta.
      Stanno in due stati come tutto il resto del pannello, salvato e bozza:
      anche questi interruttori passano da «Rivedi e salva», perché spengono
      cose che un cliente pagante ha davanti. */
  const [spenteSalvate, setSpenteSalvate] = useState<Record<string, boolean>>({});
  const [spenteBozza, setSpenteBozza] = useState<Record<string, boolean>>({});
  /*  ── ⚠️ COSA È GIÀ SPUNTATO QUANDO IL PREVENTIVO SI APRE ───────────────
      Richiesta del committente: «fai che dalle impostazioni listino posso
      selezionare anche quali opzioni sono già preselezionate».
      Prima la combinazione di partenza era scritta nel codice: cambiarla
      voleva dire una pubblicazione. Qui si scrive solo ciò che si decide a
      mano — `true` spunta, `false` toglie una spunta di serie — e un id
      assente vale quanto dice `DEFAULT_SELECTED`, così i listini salvati
      prima di oggi aprono il preventivo come hanno sempre fatto.
      ⚠️ Non è la stessa cosa di «Cosa compare nel preventivo»: là si decide
       se il cliente VEDE una voce, qui se la trova già SPUNTATA. Una voce
       spuntata entra nel prezzo della scheda di partenza. */
  /*  ── ⚠️ QUANTO PAGA DOPO, E DI CHI È QUESTO LISTINO ────────────────────
      Due richieste del committente arrivate insieme: «fai che posso
      modificare anche quanto paga dopo 12 mesi da listino» e «le modifiche del
      listino che faccio io come consulente si salvano al consulente».
      La manutenzione era l'unica cifra del preventivo scritta nel codice: per
      cambiarla serviva una pubblicazione. `suoListino` dice invece SU QUALE
      riga si sta lavorando — la tua o quella di casa — perché ritoccare i
      prezzi senza sapere a chi cambiano è il modo di cambiarli a tutti
      credendo di cambiarli a sé. */
  const [manutSalvata, setManutSalvata] = useState({ prezzo: "", mesi: "" });
  const [manutBozza, setManutBozza] = useState({ prezzo: "", mesi: "" });
  /*  ── L'ACCONTO CHE APRE LA PRATICA ──────────────────────────────────────
      Richiesta del committente: «fai che posso cambiare anche l'importo
      dell'acconto che uscirà sul preventivo». Testo e non numero, come tutti
      gli importi di questo pannello: in italiano si scrive 150,50 e un campo
      "number" la virgola non la accetta nemmeno. Vuoto = quello di casa. */
  const [accontoSalvato, setAccontoSalvato] = useState("");
  const [accontoBozza, setAccontoBozza] = useState("");
  /*  ── L'ACCONTO DI UNA SINGOLA SOLUZIONE ───────────────────────────────
      Richiesta del committente: «per l'opzione patch cutanea l'acconto sia
      diverso rispetto a Invisible Derm Protocol».
      La patch costa un quarto del top di gamma: lo stesso acconto su due
      prezzi lontani vuol dire due cose diverse — su quello piccolo è quasi il
      totale, e un acconto che pareggia il prezzo smette di essere un acconto.
      ⚠️ Vuoto = vale quello generale qui sopra. Zero invece è una decisione
       («questo prodotto non chiede acconto») e deve restare dicibile: per
       questo si distingue il campo vuoto dallo zero, come per tutti gli altri
       numeri di questo pannello. */
  const [accontoBaseSalvato, setAccontoBaseSalvato] = useState<Record<string, string>>({});
  const [accontoBaseBozza, setAccontoBaseBozza] = useState<Record<string, string>>({});
  /*  Il modello della causale del bonifico: la riga che il cliente copia.
      Vuoto = quella di casa, «Conferma ordine - {numero}». */
  const [causaleSalvata, setCausaleSalvata] = useState("");
  const [causaleBozza, setCausaleBozza] = useState("");
  const [suoListino, setSuoListino] = useState<boolean | null>(null);
  const [preselSalvate, setPreselSalvate] = useState<Record<string, boolean>>({});
  const [preselBozza, setPreselBozza] = useState<Record<string, boolean>>({});
  /*  ── ⚠️ E OGNI SOLUZIONE HA LE SUE ────────────────────────────────────
      Richiesta del committente: «posso preselezionare gli upsell sui prodotti:
      seleziono il prodotto — Invisible Derm, Patch — e decido cosa è
      preselezionato e cosa no».
      Una mappa per soluzione base. Quella qui sopra resta come regola valida
      per tutte: si legge quando per quella soluzione non è stato deciso
      niente. */
  const [perBaseSalvate, setPerBaseSalvate] = useState<Record<string, Record<string, boolean>>>({});
  const [perBaseBozza, setPerBaseBozza] = useState<Record<string, Record<string, boolean>>>({});
  /** Di quale soluzione si stanno guardando le spunte. Parte dal top di gamma:
   *  è quella che ha tutte le sezioni, e quella su cui si lavora di più. */
  const [baseSpunte, setBaseSpunte] = useState<string>(
    BASE_SOLUTIONS.find((b) => b.id === "invisible-derm")?.id ?? BASE_SOLUTIONS[0].id,
  );
  const [sconti, setSconti] = useState<ScontiVigenti>({ auto: [], quantita: {} });
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvatoAlle, setSalvatoAlle] = useState<Date | null>(null);

  const [cerca, setCerca] = useState("");
  const [filtro, setFiltro] = useState<"tutte" | "modificate" | "promo" | "nascoste">("tutte");

  const [baseId, setBaseId] = useState<string>(BASE_SOLUTIONS[0].id);
  const [quantita, setQuantita] = useState(1);

  /* ── LETTURA ──────────────────────────────────────────────────────────── */
  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      const [listino, vigenti] = await Promise.all([
        fetch("/api/presenter/pricing")
          .then((r) => r.json())
          .then((j) => (j.pricing ?? {}) as PricingOverrides),
        caricaScontiVigenti(),
      ]);
      const voci = vociDaListino(listino);
      setSalvato(voci);
      setBozza(voci);
      const accesi = listino.upsellSconti !== false;
      setScontiSalvato(accesi);
      setScontiBozza(accesi);
      const spente = { ...(listino.spente ?? {}) };
      setSpenteSalvate(spente);
      setSpenteBozza(spente);
      const presel = { ...(listino.preselezionate ?? {}) };
      setPreselSalvate(presel);
      setPreselBozza(presel);
      const perBase = { ...(listino.preselezionatePerBase ?? {}) };
      setPerBaseSalvate(perBase);
      setPerBaseBozza(perBase);
      //  Assente = i valori di casa, e il campo resta col segnaposto: si vede
      //  subito che quella cifra non l'ha decisa nessuno qui dentro.
      const man = {
        prezzo: typeof listino.manutenzione?.prezzo === "number" ? testoDaNumero(listino.manutenzione.prezzo) : "",
        mesi: typeof listino.manutenzione?.mesi === "number" ? String(listino.manutenzione.mesi) : "",

      };
      setManutSalvata(man);
      setManutBozza(man);
      const acc = typeof listino.acconto === "number" ? testoDaNumero(listino.acconto) : "";
      setAccontoSalvato(acc);
      setAccontoBozza(acc);
      const accPerBase: Record<string, string> = {};
      for (const [id, v] of Object.entries(listino.accontoPerBase ?? {}))
        if (typeof v === "number") accPerBase[id] = testoDaNumero(v);
      setAccontoBaseSalvato(accPerBase);
      setAccontoBaseBozza(accPerBase);
      const caus = typeof listino.causale === "string" ? listino.causale : "";
      setCausaleSalvata(caus);
      setCausaleBozza(caus);
      setSuoListino((listino as { suo?: boolean }).suo === true);
      setSconti(vigenti);
      setErrore(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Listino non leggibile");
    }
    setCaricamento(false);
  }, []);
  useEffect(() => {
    carica();
  }, [carica, chiaveRicarica]);

  /* ── COSA È CAMBIATO ──────────────────────────────────────────────────── */
  const modificate = useMemo<VoceModificata[]>(
    () => vociModificate(salvato, bozza, formatPrice),
    [salvato, bozza],
  );
  const cambiVoci = modificate.reduce((s, v) => s + v.cambi.length, 0);
  //  L'interruttore dei prezzi barrati non è una voce del listino, ma è una
  //  modifica in sospeso come le altre: se non entrasse in questo conto, il
  //  pulsante «Rivedi e salva» resterebbe spento e si potrebbe chiudere la
  //  pagina credendo di averlo cambiato.
  const scontiCambiato = scontiBozza !== scontiSalvato;
  //  Gli interruttori di sezioni e parti contano come modifiche in sospeso
  //  esattamente come i prezzi: spegnere una sezione e chiudere la pagina
  //  senza salvare non deve sembrare fatto.
  const chiaviSpente = (m: Record<string, boolean>) => Object.keys(m).filter((k) => m[k]).sort().join("|");
  const spenteCambiate = chiaviSpente(spenteBozza) !== chiaviSpente(spenteSalvate);
  //  Le preselezioni si confrontano con i `false` compresi: togliere una
  //  spunta di serie è una modifica come metterne una nuova, e con la sola
  //  lista delle "accese" sarebbe passata inosservata fino a chiudere la pagina.
  const firmaPresel = (m: Record<string, boolean>) =>
    Object.keys(m)
      .filter((k) => typeof m[k] === "boolean")
      .sort()
      .map((k) => `${k}=${m[k] ? 1 : 0}`)
      .join("|");
  const firmaPerBase = (m: Record<string, Record<string, boolean>>) =>
    Object.keys(m)
      .sort()
      .map((b) => `${b}{${firmaPresel(m[b] ?? {})}}`)
      .join("|");
  const preselCambiate =
    firmaPresel(preselBozza) !== firmaPresel(preselSalvate) ||
    firmaPerBase(perBaseBozza) !== firmaPerBase(perBaseSalvate);
  const manutCambiata =
    manutBozza.prezzo.trim() !== manutSalvata.prezzo.trim() ||
    manutBozza.mesi.trim() !== manutSalvata.mesi.trim() ||
    false;
  const accontoCambiato =
    accontoBozza.trim() !== accontoSalvato.trim() ||
    JSON.stringify(accontoBaseBozza) !== JSON.stringify(accontoBaseSalvato);
  const causaleCambiata = causaleBozza.trim() !== causaleSalvata.trim();
  /*  ── L'INTERRUTTORE DELL'ASSISTENZA STA DOVE STA LA SUA CIFRA ───────────
      Richiesta del committente: «da dove modifico l'importo dell'assistenza
      dopo la consegna ci sia il check per attivarlo e disattivarlo».
      Era fra le pastiglie delle «parti fisse», in fondo alla pagina: chi
      stava correggendo l'importo non aveva modo di sapere che esistesse, e
      per spegnere il riquadro doveva cercarlo in un elenco che parla di
      tutt'altro (la quantità, il codice sconto, il percorso).
      ⚠️ LO STESSO INTERRUTTORE, NON UNO NUOVO: è sempre `parte:garanzia` in
       `spente`, quello che legge il preventivo. Per questo la pastiglia
       nell'elenco delle parti fisse adesso non c'è più: due comandi per la
       stessa cosa, sulla stessa pagina, sono il modo più rapido di non
       sapere più quale conta. */
  const CHIAVE_GARANZIA = chiaveParte("garanzia");
  const garanziaAccesa = !spenteBozza[CHIAVE_GARANZIA];
  const garanziaCambiata = !!spenteBozza[CHIAVE_GARANZIA] !== !!spenteSalvate[CHIAVE_GARANZIA];
  const quantiCambi =
    cambiVoci +
    (scontiCambiato ? 1 : 0) +
    (spenteCambiate ? 1 : 0) +
    (preselCambiate ? 1 : 0) +
    (manutCambiata ? 1 : 0) +
    (accontoCambiato ? 1 : 0) +
    (causaleCambiata ? 1 : 0);
  useAvvisoModificheNonSalvate(quantiCambi);

  /** Voci con un valore che non è un numero: finché ce n'è una, non si scrive
   *  niente. Un campo vuoto salvato diventerebbe "GRATIS" nel preventivo.
   *  A listino non ancora caricato la bozza è vuota: lì "non valido" non vuol
   *  dire niente, e l'avviso rosso sarebbe solo un falso allarme. */
  const nonValide = useMemo(
    () =>
      Object.keys(bozza).length === 0
        ? []
        : RIGHE.filter((r) => numeroDaTesto(bozza[r.id]?.prezzo ?? "") == null),
    [bozza],
  );

  /* ── I NUMERI IN CIMA ─────────────────────────────────────────────────── */
  const conteggi = useMemo(() => {
    let promo = 0;
    let nascoste = 0;
    RIGHE.forEach((r) => {
      const v = bozza[r.id];
      if (!v) return;
      if (v.nascosta) nascoste++;
      const p = numeroDaTesto(v.prezzo) ?? 0;
      const pieno = numeroDaTesto(v.pieno);
      if (p === 0 || (pieno != null && pieno > p)) promo++;
    });
    return { promo, nascoste };
  }, [bozza]);

  //  Il preventivo tipo si calcola sulla BOZZA, non su ciò che è salvato: la
  //  domanda a cui deve rispondere è "se salvo, cosa vedrà il cliente".
  //  ⚠️ Non solo i prezzi: il preventivo tipo deve rispondere a «se salvo,
  //   cosa vedrà il cliente», e quello che vede dipende anche dagli sconti
  //   spenti, dalle sezioni spente e da cosa trova già spuntato.
  const listinoBozza = useMemo<PricingOverrides>(
    () => ({
      ...listinoDaVoci(bozza),
      upsellSconti: scontiBozza,
      spente: spenteBozza,
      preselezionate: preselBozza,
      preselezionatePerBase: perBaseBozza,
    }),
    [bozza, scontiBozza, spenteBozza, preselBozza, perBaseBozza],
  );
  const calcolo = useMemo(
    () => calcolaPreventivoTipo(listinoBozza, sconti, baseId, quantita),
    [listinoBozza, sconti, baseId, quantita],
  );
  const basi = useMemo(() => basiDisponibili(listinoBozza), [listinoBozza]);

  /* ── L'ELENCO ─────────────────────────────────────────────────────────── */
  const idsModificati = useMemo(() => new Set(modificate.map((m) => m.riga.id)), [modificate]);
  const gruppi = useMemo(() => {
    const q = normalizza(cerca);
    const visibili = RIGHE.filter((r) => {
      const v = bozza[r.id];
      if (!v) return false;
      if (q && !normalizza(`${r.label} ${r.group}`).includes(q)) return false;
      if (filtro === "modificate") return idsModificati.has(r.id);
      if (filtro === "nascoste") return v.nascosta;
      if (filtro === "promo") {
        const p = numeroDaTesto(v.prezzo) ?? 0;
        const pieno = numeroDaTesto(v.pieno);
        return p === 0 || (pieno != null && pieno > p);
      }
      return true;
    });
    const out: { nome: string; righe: PricingRow[] }[] = [];
    visibili.forEach((r) => {
      let g = out.find((x) => x.nome === r.group);
      if (!g) {
        g = { nome: r.group, righe: [] };
        out.push(g);
      }
      g.righe.push(r);
    });
    return out;
  }, [bozza, cerca, filtro, idsModificati]);

  /* ── SCRIVERE, E POI CONTROLLARE DI AVER SCRITTO ──────────────────────── */
  const salva = async () => {
    setSalvataggio(true);
    setErrore(null);
    try {
      const j = (await fetch("/api/presenter/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricing: {
            ...listinoDaVoci(bozza),
            upsellSconti: scontiBozza,
            spente: spenteBozza,
            preselezionate: preselBozza,
            preselezionatePerBase: perBaseBozza,
            //  Campi vuoti = «vale quello di casa»: non si mandano, così la
            //  riga non si porta dietro uno zero che nel preventivo si
            //  leggerebbe «l'assistenza è gratis».
            manutenzione: {
              ...(manutBozza.prezzo.trim() ? { prezzo: manutBozza.prezzo.trim() } : {}),
              ...(manutBozza.mesi.trim() ? { mesi: Number(manutBozza.mesi.trim()) } : {}),
              //  ⚠️ Lo zero SI MANDA: è «sconto spento», ed è una decisione —
              //   mentre il campo vuoto vuol dire «non l'ho deciso io, vale
              //   quello di casa». Due cose diverse che si scrivono uguali solo
              //   se non si sta attenti qui.
            },
            //  Campo vuoto = «quello di casa»: non si manda. Uno «0» scritto
            //  apposta invece si manda, e vuol dire «non si chiede acconto».
            ...(accontoBozza.trim() ? { acconto: accontoBozza.trim() } : {}),
            //  Solo le soluzioni con un acconto scritto: una chiave vuota
            //  vorrebbe dire «zero», che è un'altra cosa.
            accontoPerBase: Object.fromEntries(
              Object.entries(accontoBaseBozza)
                .filter(([, v]) => String(v).trim() !== "")
                .map(([id, v]) => [id, numeroDaTesto(v) ?? 0]),
            ),
            causale: causaleBozza.trim(),
          },
        }),
      }).then((r) => r.json())) as { ok?: boolean; reason?: string; pricing?: unknown };

      if (!j.ok) {
        setErrore(
          `Listino NON salvato: ${j.reason ?? "errore del server"}. Le modifiche sono ancora qui.`,
        );
        toast.error("Listino NON salvato: le modifiche sono ancora qui.");
        return;
      }

      //  Non ci si ferma al "nessun errore": il server rimanda la riga riletta
      //  e la si confronta con quello che si voleva scrivere. È l'unico modo di
      //  poter dire "salvato" senza raccontarlo.
      const riletto = vociDaListino((j.pricing ?? {}) as PricingOverrides);
      const diverse = RIGHE.filter((r) => {
        const a = riletto[r.id];
        const b = bozza[r.id];
        if (!a || !b) return true;
        const cambi = vociModificate({ [r.id]: a }, { [r.id]: b }, formatPrice);
        return cambi.length > 0;
      });
      setSalvato(riletto);
      //  L'interruttore si rilegge dalla stessa risposta, con lo stesso metro:
      //  «nessun errore» non è «è finito nel database».
      const scontiRiletti = ((j.pricing ?? {}) as PricingOverrides).upsellSconti !== false;
      setScontiSalvato(scontiRiletti);
      //  Si rilegge anche questo: un interruttore che credi spento e non lo è
      //  vuol dire un cliente che vede una sezione che non doveva vedere.
      const spenteRilette = { ...(((j.pricing ?? {}) as PricingOverrides).spente ?? {}) };
      setSpenteSalvate(spenteRilette);
      //  E anche le spunte di partenza: crederle salvate e non averle salvate
      //  vuol dire un preventivo che si apre con dentro un prezzo che non
      //  volevi, davanti al cliente.
      const preselRilette = { ...(((j.pricing ?? {}) as PricingOverrides).preselezionate ?? {}) };
      setPreselSalvate(preselRilette);
      //  E la manutenzione: è una cifra che il cliente si porta a casa scritta
      //  nel preventivo, e «salvato» senza averla salvata è peggio che niente.
      const manRiletta = ((j.pricing ?? {}) as PricingOverrides).manutenzione ?? {};
      const manutRiletta = {
        prezzo: typeof manRiletta.prezzo === "number" ? testoDaNumero(manRiletta.prezzo) : "",
        mesi: typeof manRiletta.mesi === "number" ? String(manRiletta.mesi) : "",

      };
      setManutSalvata(manutRiletta);
      //  E l'acconto: è la cifra che il cliente bonifica oggi, e «salvato»
      //  senza averlo salvato gli fa pagare un importo diverso da quello detto.
      const accRiletto = ((j.pricing ?? {}) as PricingOverrides).acconto;
      const accontoRiletto = typeof accRiletto === "number" ? testoDaNumero(accRiletto) : "";
      setAccontoSalvato(accontoRiletto);
      const causaleRiletta = String(((j.pricing ?? {}) as PricingOverrides).causale ?? "").trim();
      setCausaleSalvata(causaleRiletta);
      //  Da quale riga si è letto: la prima volta che un consulente salva,
      //  la sua nasce adesso e la scritta in cima deve cambiare subito.
      setSuoListino(((j.pricing ?? {}) as { suo?: boolean }).suo === true);
      const perBaseRilette = {
        ...(((j.pricing ?? {}) as PricingOverrides).preselezionatePerBase ?? {}),
      };
      setPerBaseSalvate(perBaseRilette);
      if (diverse.length) {
        setErrore(
          `${diverse.length} voci non risultano salvate (${diverse
            .slice(0, 3)
            .map((r) => r.label)
            .join(", ")}${diverse.length > 3 ? "…" : ""}). Riprova: le modifiche sono ancora qui.`,
        );
        toast.error("Salvataggio incompleto: controlla le voci segnalate.");
        return;
      }
      if (chiaviSpente(spenteRilette) !== chiaviSpente(spenteBozza)) {
        setErrore(
          "Le sezioni e le parti spente non risultano salvate come le hai impostate. Riprova: la modifica è ancora qui.",
        );
        toast.error("Salvataggio incompleto: controlla cosa hai spento.");
        return;
      }
      if (
        firmaPresel(preselRilette) !== firmaPresel(preselBozza) ||
        firmaPerBase(perBaseRilette) !== firmaPerBase(perBaseBozza)
      ) {
        setErrore(
          "Le opzioni già spuntate non risultano salvate come le hai impostate. Riprova: la modifica è ancora qui.",
        );
        toast.error("Salvataggio incompleto: controlla le opzioni già spuntate.");
        return;
      }
      const uguale = (a: string, b: string) =>
        (numeroDaTesto(a) ?? null) === (numeroDaTesto(b) ?? null) || a.trim() === b.trim();
      if (!uguale(manutRiletta.prezzo, manutBozza.prezzo) || manutRiletta.mesi.trim() !== manutBozza.mesi.trim()) {
        setErrore(
          "L'assistenza non risulta salvata come l'hai impostata. Riprova: la modifica è ancora qui.",
        );
        toast.error("Salvataggio incompleto: controlla l'importo dell'assistenza.");
        return;
      }
      if (!uguale(accontoRiletto, accontoBozza)) {
        setErrore(
          "L'acconto non risulta salvato come l'hai impostato. Riprova: la modifica è ancora qui.",
        );
        toast.error("Salvataggio incompleto: controlla l'importo dell'acconto.");
        return;
      }
      if (causaleRiletta !== causaleBozza.trim()) {
        setErrore(
          "La causale del bonifico non risulta salvata come l'hai impostata. Riprova: la modifica è ancora qui.",
        );
        toast.error("Salvataggio incompleto: controlla la causale del bonifico.");
        return;
      }
      if (scontiRiletti !== scontiBozza) {
        setErrore(
          "I prezzi barrati non risultano salvati come li hai impostati. Riprova: la modifica è ancora qui.",
        );
        toast.error("Salvataggio incompleto: controlla i prezzi barrati.");
        return;
      }
      setBozza(riletto);
      setScontiBozza(scontiRiletti);
      setManutBozza(manutRiletta);
      setPreselBozza(preselRilette);
      setPerBaseBozza(perBaseRilette);
      setSalvatoAlle(new Date());
      setConfermaAperta(false);
      toast.success(
        `Listino aggiornato · ${quantiCambi} ${quantiCambi === 1 ? "modifica" : "modifiche"}`,
      );
    } catch (e) {
      setErrore(
        `Non ho potuto confermare il salvataggio: ${
          e instanceof Error ? e.message : "errore di rete"
        }. Riapri le impostazioni e controlla i prezzi.`,
      );
      toast.error("Verifica non riuscita: controlla i prezzi.");
    } finally {
      setSalvataggio(false);
    }
  };

  /** È spuntata? `true`/`false` scritti a mano vincono; altrimenti vale la
   *  combinazione di serie. È la stessa regola di `preselezione()` lato
   *  preventivo: scriverla due volte diverse vorrebbe dire un pannello che
   *  mostra una cosa e un cliente che ne vede un'altra. */
  const preselAccesa = (id: string) => {
    const sue = perBaseBozza[baseSpunte] ?? {};
    if (typeof sue[id] === "boolean") return sue[id];
    if (typeof preselBozza[id] === "boolean") return preselBozza[id];
    return DEFAULT_SELECTED.includes(id);
  };
  /** Spunta o toglie. Nei gruppi a scelta unica le altre si spengono per
   *  esteso (`false`): lasciarle "assenti" le riporterebbe su per via della
   *  combinazione di serie, e il preventivo si aprirebbe con due spunte nello
   *  stesso gruppo. */
  const cambiaPresel = (id: string, gruppo?: string[]) => {
    //  ⚠️ Si scrive nella mappa DELLA SOLUZIONE che si sta guardando: toccare
    //   quella generale cambierebbe anche le altre due strade, che è
    //   esattamente ciò che questo pannello deve smettere di fare.
    const era = preselAccesa(id);
    setPerBaseBozza((m) => {
      const sue = { ...(m[baseSpunte] ?? {}) };
      if (gruppo) gruppo.forEach((g) => (sue[g] = false));
      sue[id] = !era;
      return { ...m, [baseSpunte]: sue };
    });
  };
  /** Quante spunte sopravvivono davvero, e quanto pesano: lo dice la stessa
   *  funzione che legge il preventivo, non un conto fatto qui. */
  const spuntate = preselezione(listinoBozza, baseSpunte);
  /** Le sezioni che esistono per questa soluzione: il trapianto ha solo le
   *  sue, gli impianti non vedono le sue. */
  const sezioniSpunte = sectionsFor(UPSELL_SECTIONS, baseSpunte);

  /** La frase che uscirà nel preventivo con i numeri scritti adesso. La
   *  costruisce la stessa funzione che la costruisce per il cliente: scriverla
   *  qui a mano vorrebbe dire un'anteprima che promette una cosa e un
   *  preventivo che ne promette un'altra. */
  /*  ── ⚠️ LA RICERCA DEVE TROVARE ANCHE QUESTA ──────────────────────────
      Segnalazione del committente: «non riesco a modificare il prezzo dopo 15
      mesi, non c'è opzione su listino».
      L'opzione c'era ed è sempre stata al suo posto — ma la casella di
      ricerca in cima cerca SOLO fra le voci del listino: chi scriveva
      «manutenzione» leggeva «nessuna voce con questi filtri» e ne concludeva,
      ragionevolmente, che l'opzione non esistesse. Un campo che esiste e che
      la ricerca dichiara assente è peggio di un campo che manca.
      Adesso la ricerca risponde anche per lui: si accende il riquadro e
      l'elenco vuoto dice dov'è. ⚠️ Le parole sono quelle che uno DIGITA —
      «manutenzione», «450», «15 mesi» — non quelle che abbiamo scritto noi
      nel titolo. */
  const cercaLaManutenzione = useMemo(
    () =>
      parlaDiManutenzione(cerca, {
        prezzo: manutBozza.prezzo || MANUTENZIONE_DI_CASA.price,
        mesi: manutBozza.mesi || MANUTENZIONE_DI_CASA.everyMonths,
      }),
    [cerca, manutBozza],
  );

  const anteprimaManutenzione = manutenzioneDi({
    manutenzione: {
      ...(numeroDaTesto(manutBozza.prezzo) != null ? { prezzo: numeroDaTesto(manutBozza.prezzo) as number } : {}),
      ...(Number(manutBozza.mesi) > 0 ? { mesi: Number(manutBozza.mesi) } : {}),
    },
  });


  const cambiaVoce = (id: string, patch: Partial<Voce>) =>
    setBozza((b) => ({ ...b, [id]: { ...b[id], ...patch } }));

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/55">
        I prezzi che il configuratore mostra al cliente durante la consulenza. Valgono per i
        preventivi creati da adesso in poi.
      </p>

      {/* ── ⚠️ DI CHI È IL LISTINO CHE STAI TOCCANDO ──────────────────────
          Richiesta del committente: «le modifiche del listino che faccio io
          come consulente si salvano al consulente, e gli altri consulenti
          hanno le loro».
          Da qui si esce con due strade diverse, e la differenza non si vede
          guardando i prezzi: o stai cambiando i TUOI, o stai cambiando quelli
          di chi non ne ha di suoi. Detta a parole prima di toccare qualcosa,
          perché scoprirla dopo vuol dire averla già sbagliata. */}
      {suoListino !== null && (
        <p
          className={`rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-snug ${
            suoListino
              ? "border-brand/35 bg-brand/10 text-white/80"
              : "border-amber-300/30 bg-amber-400/10 text-amber-50/85"
          }`}
        >
          {suoListino ? (
            <>
              <b className="font-semibold text-white">Stai modificando il tuo listino.</b> Vale per
              le tue consulenze; gli altri consulenti hanno il loro e non cambia niente per loro.
            </>
          ) : (
            <>
              <b className="font-semibold text-white">Stai modificando il listino di casa</b> —
              quello che vale per tutti i consulenti che non ne hanno ancora uno loro. Se entri col
              tuo PIN, il primo salvataggio crea il tuo: da lì in poi è tuo e non segue più i
              ritocchi fatti qui.
            </>
          )}
        </p>
      )}

      {errore && <Avviso tono="grave">{errore}</Avviso>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          etichetta="Voci a listino"
          valore={RIGHE.length}
          nota="Tutto ciò che il cliente può scegliere"
          attivo={filtro === "tutte"}
          onClick={() => setFiltro("tutte")}
        />
        <Numero
          etichetta="In promozione o gratis"
          valore={conteggi.promo}
          nota="Barrate o incluse nel prezzo"
          tono={conteggi.promo > 0 ? "buono" : "neutro"}
          attivo={filtro === "promo"}
          onClick={() => setFiltro(filtro === "promo" ? "tutte" : "promo")}
        />
        <Numero
          etichetta="Nascoste dal preventivo"
          valore={conteggi.nascoste}
          nota="Il cliente non le vede"
          tono={conteggi.nascoste > 0 ? "sospeso" : "neutro"}
          attivo={filtro === "nascoste"}
          onClick={() => setFiltro(filtro === "nascoste" ? "tutte" : "nascoste")}
        />
        <Numero
          etichetta="Preventivo tipo"
          valore={euroCorto(calcolo.totale)}
          nota={`${calcolo.quantita} ${calcolo.quantita === 1 ? "impianto" : "impianti"} · sconti compresi`}
        />
      </div>

      {/* ── LA BARRA DELLE MODIFICHE ──────────────────────────────────────
          Quando c'è qualcosa in sospeso questa barra diventa ambra e non se ne
          va: è l'unica cosa che impedisce di chiudere credendo di aver salvato. */}
      <div
        className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 ${
          quantiCambi > 0
            ? "border-amber-400/45 bg-amber-400/10"
            : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <div className="relative min-w-[160px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca una voce del listino"
            className="w-full rounded-lg border border-white/15 bg-white/5 py-1.5 pl-7 pr-2 text-[12px] text-white placeholder:text-white/30 focus:border-brand focus:outline-none"
          />
        </div>
        <Segmento
          attivo={filtro === "modificate"}
          onClick={() => setFiltro(filtro === "modificate" ? "tutte" : "modificate")}
          conteggio={modificate.length}
          titolo="Solo le voci che hai toccato e non hai ancora salvato"
        >
          Modificate
        </Segmento>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatoSalvataggio
            quanti={quantiCambi}
            salvatoAlle={salvatoAlle}
            caricamento={caricamento}
          />
          {quantiCambi > 0 && (
            <button
              type="button"
              onClick={() => {
                setBozza(salvato);
                setScontiBozza(scontiSalvato);
                //  ⚠️ Anche gli interruttori, non solo i prezzi: «Annulla
                //   tutto» ne lasciava indietro due — si premeva, e la barra
                //   continuava a dire che c'era una modifica da salvare senza
                //   che si vedesse più quale.
                setSpenteBozza(spenteSalvate);
                setPreselBozza(preselSalvate);
                setManutBozza(manutSalvata);
                setAccontoBozza(accontoSalvato);
                setCausaleBozza(causaleSalvata);
                setPerBaseBozza(perBaseSalvate);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Annulla tutto
            </button>
          )}
          <button
            type="button"
            disabled={quantiCambi === 0 || nonValide.length > 0}
            onClick={() => setConfermaAperta(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Rivedi e salva
          </button>
        </div>
      </div>

      {/* ── ⚠️ QUANTO PAGA DOPO ────────────────────────────────────────────
          Richiesta del committente: «fai che posso modificare anche quanto
          paga dopo 12 mesi da listino».
          Era l'unica cifra del preventivo scritta nel codice: per cambiarla
          serviva una pubblicazione, e intanto il consulente la diceva a voce
          diversa da come stava scritta sotto gli occhi del cliente.
          ⚠️ I MESI NON SONO UN DETTAGLIO: l'importo comprende UN intervento
           dentro quella finestra, e la riga che lo spiega si scrive da questi
           due numeri. Per questo stanno vicini e si salvano insieme. */}
      <div
        id="pannello-manutenzione"
        className={`flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5 transition ${
          cercaLaManutenzione
            ? "border-brand/60 bg-brand/10 ring-2 ring-brand/40"
            : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <RotateCcw className="h-4 w-4 flex-shrink-0 text-brand" />
            L'assistenza dopo la consegna
            {/*  La parola che la gente digita davvero quando cerca questa
                cifra. Sta scritta, non solo cercabile: chi scorre la pagina
                senza cercare deve riconoscerla lo stesso. */}
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-white/55">
              manutenzione
            </span>
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            Quanto paga il cliente per una rigenerazione — o la sostituzione, se l'impianto è
            compromesso — e per quanti mesi quell'importo è valido. È la cifra grande nel riquadro
            verde del preventivo. Lasciali vuoti per tenere quelli di casa.
          </p>
          {/* ── L'INTERRUTTORE, QUI ────────────────────────────────────
              Richiesta del committente: «da dove modifico l'importo ci sia il
              check per attivarlo e disattivarlo». Spento, il riquadro verde
              non compare affatto sul preventivo — e non compare niente al suo
              posto: è una parte della pagina che non c'è, non una voce
              «esclusa» da spiegare al cliente.
              ⚠️ I due campi qui accanto restano scritti anche a riquadro
               spento: riaccendendolo si ritrova l'importo di prima, invece di
               doverlo ribattere. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={garanziaAccesa}
            onClick={() => setSpenteBozza((m) => ({ ...m, [CHIAVE_GARANZIA]: garanziaAccesa }))}
            className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-white/12 bg-black/20 px-2.5 py-1.5 text-left transition hover:bg-white/[0.06]"
          >
            <span
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                garanziaAccesa ? "border-brand bg-brand text-white" : "border-white/25 bg-transparent text-transparent"
              }`}
            >
              <Check className="h-3 w-3" />
            </span>
            <span className="text-[12.5px] font-medium text-white">
              {garanziaAccesa ? "Il cliente vede questo riquadro" : "Riquadro spento: il cliente non lo vede"}
            </span>
          </button>
        </div>
        <label className={`w-[140px] transition ${garanziaAccesa ? "" : "opacity-40"}`}>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Importo
          </span>
          <input
            value={manutBozza.prezzo}
            onChange={(e) => setManutBozza((m) => ({ ...m, prezzo: e.target.value }))}
            disabled={!garanziaAccesa}
            inputMode="decimal"
            placeholder={testoDaNumero(MANUTENZIONE_DI_CASA.price)}
            className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-brand disabled:cursor-not-allowed"
          />
        </label>
        <label className={`w-[110px] transition ${garanziaAccesa ? "" : "opacity-40"}`}>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Mesi
          </span>
          <input
            value={manutBozza.mesi}
            onChange={(e) => setManutBozza((m) => ({ ...m, mesi: e.target.value }))}
            disabled={!garanziaAccesa}
            inputMode="numeric"
            placeholder={String(MANUTENZIONE_DI_CASA.everyMonths)}
            className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-brand disabled:cursor-not-allowed"
          />
        </label>
        {/*  ⚠️ QUI C'ERA LO SCONTO AUTOMATICO DEL 35%, con la sua spunta.
             Tolto su richiesta del committente: «fai che in automatico non c'è
             nessuna garanzia dei 15 mesi, rimuovila». Adesso l'unica strada è
             un CODICE GARANZIA — qui sotto — e senza codice il preventivo è il
             preventivo. Un automatismo che regala un terzo del prezzo a
             chiunque apra la pagina è una decisione che va presa una persona
             alla volta, non una volta per tutte. */}
        {/* ── ⚠️ I CODICI DEL SECONDO IMPIANTO ───────────────────────────
            Richiesta del committente: «fai che posso creare codici
            promozionali per la garanzia, e che non si vada ad unificare con
            codice sconto delle testimonianze: sono due promo diverse, devono
            essere applicabili e differenziate anche come voce» — «dove posso
            scegliere o % di sconto su importo oppure prezzo fisso».
            Questa sezione fa SOLO questo. I codici della video testimonianza
            restano dove sono sempre stati (pannello Sconti): quelli tolgono
            euro dal totale di OGGI, questi fissano il prezzo di un acquisto
            FUTURO, e su un preventivo si vedono come due voci distinte. */}
        <div className="basis-full rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-emerald-100">
              Codici promozionali · prezzo dal secondo impianto
            </p>
            {vaiAiCodici && (
              <button
                type="button"
                onClick={vaiAiCodici}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
              >
                Aggiungi o modifica →
              </button>
            )}
          </div>
          {/*  ⚠️ `tipoOfferta` E NON `importo > 0`: un codice in PERCENTUALE ha
               l'importo a zero, quindi con il filtro di prima spariva
               dall'elenco appena creato — e da fuori sembrava che non si
               potesse più crearne. È lo stesso controllo che usa il preventivo
               per decidere se quel codice porta un'offerta: uno solo, e vale
               per tutti e due i modi. */}
          {Object.entries(garanzieCodici).filter(([, g]) => tipoOfferta(g)).length === 0 ? (
            <p className="mt-1.5 text-[12px] leading-snug text-white/50">
              Nessuno, per adesso: senza uno di questi codici il preventivo non promette niente sul
              secondo impianto.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {Object.entries(garanzieCodici)
                .filter(([, g]) => tipoOfferta(g))
                .map(([codice, g]) => (
                  <li
                    key={codice}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-black/25 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[12px] font-bold text-white">{codice}</span>
                    <span className="text-[12px] text-white/70">
                      dal 2º impianto{" "}
                      <b className="font-semibold text-emerald-200">
                        {Number(g.sconto) > 0 ? `−${g.sconto}%` : `${testoDaNumero(g.importo)} €`}
                      </b>
                    </span>
                    {limiteInParole(g) && (
                      <span className="text-[11.5px] text-amber-200/80">{limiteInParole(g)}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {/* ── ⚠️ CREARLO DA QUI, NON IN DUE SCHEDE ────────────────────
              Segnalazione del committente: «clicco ma non mi fa creare codice
              per questo». Il pulsante portava dove i codici si creano, ma lì si
              crea un codice NORMALE e l'offerta sulla garanzia va impostata in
              un secondo riquadro: due passaggi in due schede per una cosa sola.
              Qui bastano il nome e la cifra che pagherà dopo.
              ⚠️ Lo sconto sul totale è zero: questo codice non abbassa il
               preventivo di oggi, cambia solo quanto pagherà dopo. Due promesse
               in un codice solo non se le ricorda nessuno al momento di
               spiegarle. */}
          <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-emerald-400/20 pt-2.5">
            <label className="w-[130px]">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Codice
              </span>
              <input
                value={nuovoCodice.codice}
                onChange={(e) => setNuovoCodice((n) => ({ ...n, codice: e.target.value.toUpperCase() }))}
                placeholder="ES. GAR250"
                className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 font-mono text-[12.5px] uppercase text-white outline-none focus:border-emerald-400"
              />
            </label>
            {/*  ⚠️ I DUE MODI, SCELTI QUI E NON DEDOTTI DA UN CAMPO VUOTO.
                 «Dove posso scegliere o % di sconto su importo oppure prezzo
                 fisso»: un selettore esplicito, perché «550» e «30» in uno
                 stesso campo sono la stessa cosa scritta uguale e due promesse
                 diversissime — e a sbagliarsi ci si accorge dal cliente. */}
            <div className="flex items-end gap-1">
              <div>
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  Dal 2º impianto
                </span>
                <div className="flex overflow-hidden rounded-lg border border-white/15">
                  {(["fisso", "percento"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNuovoCodice((n) => ({ ...n, tipo: t }))}
                      className={`px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                        nuovoCodice.tipo === t
                          ? "bg-emerald-500 text-white"
                          : "bg-black/25 text-white/55 hover:text-white"
                      }`}
                    >
                      {t === "fisso" ? "paga" : "sconto"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="w-[110px]">
                <span className="sr-only">
                  {nuovoCodice.tipo === "fisso" ? "Prezzo dal secondo impianto" : "Percentuale di sconto"}
                </span>
                <div className="relative">
                  <input
                    value={nuovoCodice.importo}
                    onChange={(e) => setNuovoCodice((n) => ({ ...n, importo: e.target.value }))}
                    inputMode="decimal"
                    placeholder={nuovoCodice.tipo === "fisso" ? "550" : "30"}
                    className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 pr-7 text-[12.5px] text-white outline-none focus:border-emerald-400"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-white/40">
                    {nuovoCodice.tipo === "fisso" ? "€" : "%"}
                  </span>
                </div>
              </label>
            </div>
            <label className="w-[95px]">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Posti
              </span>
              <input
                value={nuovoCodice.posti}
                onChange={(e) => setNuovoCodice((n) => ({ ...n, posti: e.target.value }))}
                inputMode="numeric"
                placeholder="senza"
                className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-emerald-400"
              />
            </label>
            <label className="w-[110px]">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Disponibili
              </span>
              <input
                value={nuovoCodice.disponibili}
                onChange={(e) => setNuovoCodice((n) => ({ ...n, disponibili: e.target.value }))}
                inputMode="numeric"
                placeholder="tutti"
                className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-emerald-400"
              />
            </label>
            {/*  ⚠️ GIORNI, NON UNA DATA. Richiesta del committente: «posso
                 mettere entro quanti giorni scade e poi dà la data, in dinamico
                 ogni giorno mette data dinamica; ma quando il preventivo è
                 creato rimane su quel preventivo la data del giorno in cui è
                 stato generato».
                 Con una data fissa la promozione muore in un giorno preciso e
                 bisogna ricordarsi di spostarla; con i giorni ogni preventivo
                 nasce con la SUA scadenza e se la porta dietro per sempre. */}
            <label className="w-[130px]">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Scade fra
              </span>
              <div className="relative">
                <input
                  value={nuovoCodice.giorni}
                  onChange={(e) => setNuovoCodice((n) => ({ ...n, giorni: e.target.value }))}
                  inputMode="numeric"
                  placeholder="senza"
                  className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 pr-12 text-[12.5px] text-white outline-none focus:border-emerald-400"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/40">
                  giorni
                </span>
              </div>
            </label>
            <button
              type="button"
              onClick={() => void creaCodiceGaranzia()}
              disabled={creando}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {creando ? "Creo…" : "Crea codice"}
            </button>
            <p className="basis-full text-[11px] leading-snug text-white/40">
              Non abbassa il preventivo di oggi: fissa il prezzo dal secondo impianto in poi, ed è
              una promozione diversa da quella della video testimonianza — sul preventivo si vedono
              come due voci separate. Posti e giorni sono facoltativi: senza, non si scrive che
              l'offerta è limitata. I giorni danno una data che si rinnova ogni giorno e che resta
              ferma su ogni preventivo già creato.
            </p>
          </div>
        </div>

        <p className="basis-full text-[12px] leading-snug text-white/45">
          {garanziaAccesa
            ? `Il cliente leggerà: «${anteprimaManutenzione.foot}»`
            : "Sul preventivo non comparirà nessun riquadro dell'assistenza: né l'importo né la promessa dei mesi."}
        </p>
        {(manutCambiata || garanziaCambiata) && (
          <span className="basis-full text-[12px] font-medium text-amber-200/90">
            Da salvare: vale per i preventivi da qui in avanti, quelli già emessi non cambiano.
          </span>
        )}
      </div>

      {/* ── L'ACCONTO ──────────────────────────────────────────────────────
          Richiesta del committente: «fai che posso cambiare anche l'importo
          dell'acconto che uscirà sul preventivo».
          Erano 100 € scritti nel codice, in quattro punti della pagina del
          preventivo. Sta accanto all'assistenza perché sono le due cifre del
          preventivo che NON dipendono da cosa il cliente ha scelto: una si
          paga oggi, l'altra un anno dopo. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Wallet className="h-4 w-4 flex-shrink-0 text-brand" />
            L'acconto per aprire la pratica
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            La cifra che il cliente bonifica subito e che viene scalata dal totale. Lascialo vuoto
            per tenere quello di casa ({testoDaNumero(ACCONTO_DI_CASA)} €); scrivi 0 se su questi
            preventivi non vuoi chiedere nessun acconto.
          </p>
        </div>
        <label className="w-[140px]">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Importo
          </span>
          <input
            value={accontoBozza}
            onChange={(e) => setAccontoBozza(e.target.value)}
            inputMode="decimal"
            placeholder={testoDaNumero(ACCONTO_DI_CASA)}
            className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-brand"
          />
        </label>
        {/*  ── ⚠️ E UNO PER SOLUZIONE, DOVE SERVE ───────────────────────
             Richiesta del committente: «per l'opzione patch cutanea l'acconto
             sia diverso rispetto a Invisible Derm Protocol».
             Un campo per ogni soluzione, vuoto di suo: vuoto = vale la cifra
             qui sopra. Così non c'è niente da ricordarsi — chi non ne ha
             bisogno non vede nessun numero scritto, e chi ne ha bisogno lo
             scrive dove si aspetta di trovarlo. */}
        <div className="basis-full rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11.5px] font-semibold text-white/70">
            Acconto diverso per una soluzione
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {BASE_SOLUTIONS.map((b) => (
              <label key={b.id} className="flex items-center gap-2">
                <span className="text-[12px] text-white/60">{b.name}</span>
                <div className="relative">
                  <input
                    value={accontoBaseBozza[b.id] ?? ""}
                    onChange={(e) =>
                      setAccontoBaseBozza((m) => ({ ...m, [b.id]: e.target.value }))
                    }
                    inputMode="decimal"
                    placeholder={accontoBozza.trim() || testoDaNumero(ACCONTO_DI_CASA)}
                    className="w-[110px] rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 pr-7 text-[13px] text-white outline-none focus:border-brand"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-white/40">
                    €
                  </span>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-white/40">
            Vuoto = vale l'acconto qui sopra. Scrivi 0 se su quella soluzione non vuoi chiedere
            nessun acconto.
          </p>
        </div>

        {/*  ⚠️ Un acconto più alto del preventivo non esiste: la pagina ne
            mostra al massimo il totale. Detto qui, perché scrivendo una cifra
            grande non si vedrebbe nessun effetto e sembrerebbe rotto. */}
        <p className="basis-full text-[12px] leading-snug text-white/45">
          Sui preventivi che costano meno dell'acconto, al cliente si chiede il totale.
        </p>
        {accontoCambiato && (
          <span className="basis-full text-[12px] font-medium text-amber-200/90">
            Da salvare: vale per i preventivi da qui in avanti, quelli già emessi non cambiano.
          </span>
        )}
      </div>

      {/* ── LA CAUSALE DEL BONIFICO ────────────────────────────────────────
          Richiesta del committente: «fai che posso cambiare la causale del
          preventivo».
          ⚠️ Non è un'etichetta: è la riga che il cliente COPIA nel bonifico, ed
           è il filo con cui quel versamento si lega al documento. Per questo si
           imposta un MODELLO con dentro il numero e non una frase fissa — e per
           questo, se il numero non c'è, lo si aggiunge da soli in coda. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Landmark className="h-4 w-4 flex-shrink-0 text-brand" />
            La causale del bonifico
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            Quello che il cliente scrive nel bonifico dell'acconto. Puoi usare{" "}
            <b className="font-mono text-white/75">{"{numero}"}</b>,{" "}
            <b className="font-mono text-white/75">{"{nome}"}</b> e{" "}
            <b className="font-mono text-white/75">{"{totale}"}</b>. Lascialo vuoto per quella di
            casa. Il numero del preventivo ci finisce comunque: senza, un bonifico arriva in banca
            e non si sa di chi è.
          </p>
        </div>
        <label className="w-full min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Modello
          </span>
          <input
            value={causaleBozza}
            onChange={(e) => setCausaleBozza(e.target.value)}
            placeholder={MODELLO_CAUSALE_DI_CASA}
            className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 font-mono text-[13px] text-white outline-none focus:border-brand"
          />
        </label>
        <p className="basis-full text-[12px] leading-snug text-white/45">
          Il cliente copierà: «{causaleDi({ modello: causaleBozza, numero: "IDP1234", nome: "Mario Rossi", totale: "1.200,00 €" })}»
        </p>
        {causaleCambiata && (
          <span className="basis-full text-[12px] font-medium text-amber-200/90">
            Da salvare: vale per i preventivi da qui in avanti. Su uno già emesso si cambia dal
            pannello «Preventivi».
          </span>
        )}
      </div>

      {/* ── COSA IL CLIENTE VEDE DEL PREVENTIVO ────────────────────────────
          Richiesta del committente: «fai che posso disattivare le opzioni del
          preventivo dalle impostazioni presentazione».
          Non sono prezzi: sono PEZZI DI PAGINA. Una sezione spenta non compare
          e le sue voci non entrano in nessun conto; una parte fissa spenta
          toglie un comando al cliente. Stanno qui in cima, sopra le ottanta
          righe dei prezzi, perché la domanda «perché il cliente vede questa
          cosa?» si risponde guardando un elenco corto, non cercando una voce
          alla volta. */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <EyeOff className="h-4 w-4 flex-shrink-0 text-brand" />
            Cosa compare nel preventivo
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            Spegnendo una sezione sparisce insieme alle sue voci, e non entra in nessun conto.
            Le parti fisse sono comandi che il cliente ha davanti: spente, non ci sono.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Sezioni
          </p>
          <div className="flex flex-wrap gap-1.5">
            {UPSELL_SECTIONS.map((sez) => {
              const k = chiaveSezione(sez.num);
              const spenta = !!spenteBozza[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSpenteBozza((m) => ({ ...m, [k]: !spenta }))}
                  title={spenta ? "Spenta: il cliente non la vede" : "Accesa: il cliente la vede"}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                    spenta
                      ? "border-white/12 bg-white/[0.03] text-white/35 line-through decoration-white/25"
                      : "border-brand/40 bg-brand/15 text-white"
                  }`}
                >
                  {spenta ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {sez.title}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Parti fisse
          </p>
          <div className="flex flex-wrap gap-1.5">
            {/*  ⚠️ L'assistenza non è qui: il suo interruttore sta accanto al
                 suo importo, dove chi la sta cambiando lo trova senza
                 cercarlo (vedi il pannello «L'assistenza dopo la consegna»). */}
            {PARTI_PREVENTIVO.filter((parte) => parte.id !== "garanzia").map((parte) => {
              const k = chiaveParte(parte.id);
              const spenta = !!spenteBozza[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSpenteBozza((m) => ({ ...m, [k]: !spenta }))}
                  title={parte.nota}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                    spenta
                      ? "border-white/12 bg-white/[0.03] text-white/35 line-through decoration-white/25"
                      : "border-brand/40 bg-brand/15 text-white"
                  }`}
                >
                  {spenta ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {parte.nome}
                </button>
              );
            })}
          </div>
        </div>

        {spenteCambiate && (
          <p className="text-[12px] font-medium text-amber-200/90">
            Da salvare: vale per i preventivi da qui in avanti, quelli già emessi non cambiano.
          </p>
        )}
      </div>

      {/* ── COSA È GIÀ SPUNTATO QUANDO IL PREVENTIVO SI APRE ───────────────
          Richiesta del committente: «fai che dalle impostazioni listino posso
          selezionare anche quali opzioni sono già preselezionate».
          Sta subito sotto «Cosa compare nel preventivo» perché le due domande
          si fanno di seguito — la vede? e la trova già spuntata? — e perché è
          la coppia che decide il prezzo scritto sulla scheda della soluzione:
          quello che è spuntato qui è dentro quella cifra. */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <CheckCheck className="h-4 w-4 flex-shrink-0 text-brand" />
            Opzioni già spuntate all'apertura
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            Il preventivo si apre su queste scelte, e il loro prezzo è già compreso nella cifra
            che il cliente legge sulla scheda della soluzione. Nei gruppi a scelta unica ne resta
            spuntata una sola: scegliendone un'altra la precedente si toglie.
          </p>
        </div>

        {/* ── SI DECIDE UNA SOLUZIONE ALLA VOLTA ───────────────────────────
            Richiesta del committente: «posso preselezionare gli upsell sui
            prodotti: seleziono il prodotto e decido cosa è preselezionato».
            Le tre strade si vendono in modo diverso — una spunta che ha senso
            sul top di gamma non ce l'ha sul più economico — e prima erano
            costrette a condividere le stesse. Qui si sceglie di quale strada
            si stanno guardando le spunte, e si tocca solo quella. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Per quale soluzione
          </span>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-black/20 p-1">
            {BASE_SOLUTIONS.map((b) => {
              const quante = preselezione(listinoBozza, b.id).length;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBaseSpunte(b.id)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                    baseSpunte === b.id
                      ? "bg-brand text-white"
                      : "text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {/*  Il nome per esteso è lungo quanto una riga: qui basta il
                      pezzo che lo distingue. */}
                  {b.name.split("—")[0].trim()}
                  <span
                    className={`ml-1.5 text-[11px] font-medium ${baseSpunte === b.id ? "text-white/70" : "text-white/35"}`}
                  >
                    {quante}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="-mt-1 text-[12px] text-white/45">
          Su questa soluzione sono spuntate{" "}
          <b className="font-semibold text-white/75">{spuntate.length}</b>{" "}
          {spuntate.length === 1 ? "opzione" : "opzioni"}. Quello che cambi qui non tocca le altre
          due.
        </p>

        {sezioniSpunte.map((sez) => {
          const sezSpenta = !!spenteBozza[chiaveSezione(sez.num)];
          return (
            <div key={sez.num}>
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                {sez.title}
                {sez.single && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-white/50">
                    una sola
                  </span>
                )}
                {sezSpenta && (
                  <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-200/80">
                    sezione spenta
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sez.items.map((voce) => {
                  const nascosta = !!bozza[voce.id]?.nascosta;
                  const accesa = preselAccesa(voce.id);
                  //  Una voce nascosta o dentro una sezione spenta non può
                  //  essere spuntata: sarebbe un prezzo nel totale senza una
                  //  riga che lo spieghi. Si mostra comunque, con scritto
                  //  perché non si può — sparire e basta non spiega niente.
                  const bloccata = nascosta || sezSpenta;
                  const prezzo = bozza[voce.id]?.prezzo ?? "";
                  return (
                    <button
                      key={voce.id}
                      type="button"
                      disabled={bloccata}
                      onClick={() =>
                        cambiaPresel(voce.id, sez.single ? sez.items.map((i) => i.id) : undefined)
                      }
                      title={
                        bloccata
                          ? nascosta
                            ? "Voce nascosta dal preventivo: non può essere spuntata"
                            : "Sezione spenta: il cliente non la vede"
                          : accesa
                            ? "Spuntata: il cliente la trova già scelta"
                            : "Non spuntata: il cliente la sceglie lui"
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                        bloccata
                          ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/25"
                          : accesa
                            ? "border-brand/40 bg-brand/15 text-white"
                            : "border-white/12 bg-white/[0.03] text-white/45 hover:border-white/25 hover:text-white/70"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${
                          accesa && !bloccata ? "border-brand bg-brand" : "border-white/25"
                        }`}
                      >
                        {accesa && !bloccata && <CheckCheck className="h-2.5 w-2.5 text-white" />}
                      </span>
                      {voce.name}
                      {prezzo && (
                        <span className="text-[11px] text-white/40">
                          {numeroDaTesto(prezzo) === 0 ? "incluso" : `${prezzo} €`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {preselCambiate && (
          <p className="text-[12px] font-medium text-amber-200/90">
            Da salvare: vale per i preventivi aperti da qui in avanti, quelli già emessi non
            cambiano.
          </p>
        )}
      </div>

      {/* ── GLI SCONTI DEL LISTINO: ACCESI O SPENTI ────────────────────────
          Non è una voce del listino ed è giusto che stia fuori dall'elenco:
          vale per tutte le voci insieme. Sta qui in alto perché chi apre
          questa pagina per capire «perché il cliente vede tutto barrato» deve
          trovarlo senza scorrere ottanta righe.

          ⚠️ E NON È PIÙ SOLO GRAFICA. Segnalazione del committente:
           «nascondendo gli sconti deve mettere i prezzi del prezzo intero e
           ignorare quelli scontati». Prima «Nascondili» toglieva il barrato e
           lasciava lo sconto dentro al prezzo: si credeva di averlo tolto e lo
           si continuava a regalare, senza più nemmeno la riga che lo
           ricordava. Adesso spegnere significa vendere al listino, e la
           scritta qui sotto lo dice chiaro — perché è una decisione sul
           PREZZO, non sulla presentazione. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Tag className="h-4 w-4 flex-shrink-0 text-brand" />
            Sconti sulle personalizzazioni
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            {scontiBozza ? (
              <>
                Accanto a ogni voce il cliente vede il prezzo pieno{" "}
                <s className="text-white/40">sbarrato</s>, e il risparmio finisce fra le condizioni
                del preventivo.
              </>
            ) : (
              <>
                Si vende a <b className="text-white/75">prezzo pieno</b>: dove c'è un listino più
                alto diventa lui il prezzo, niente barrato e niente riga «Sconti sulle
                personalizzazioni».
              </>
            )}{" "}
            {scontiBozza
              ? "Il cliente paga il prezzo scontato."
              : "⚠️ Il cliente paga di più: è lo sconto che viene tolto, non solo il barrato."}
          </p>
        </div>
        {/*  Due pulsanti che dichiarano lo stato, non un interruttore da
             indovinare: qui si decide cosa vedrà un cliente pagante, e
             «acceso/spento» va letto, non dedotto dalla posizione di una
             levetta. */}
        <div className="flex flex-shrink-0 items-center rounded-xl border border-white/15 bg-black/20 p-1">
          {[
            { v: true, t: "Mostrali" },
            { v: false, t: "Nascondili" },   // = vendi a prezzo pieno
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setScontiBozza(o.v)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                scontiBozza === o.v
                  ? "bg-brand text-white"
                  : "text-white/55 hover:bg-white/10 hover:text-white"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
        {scontiCambiato && (
          <span className="basis-full text-[12px] font-medium text-amber-200/90">
            Da salvare: vale per i preventivi da qui in avanti, quelli già emessi non cambiano.
          </span>
        )}
      </div>

      {nonValide.length > 0 && (
        <Avviso tono="grave">
          {nonValide.length === 1 ? "Una voce non ha" : `${nonValide.length} voci non hanno`} un
          prezzo valido (
          {nonValide
            .slice(0, 3)
            .map((r) => r.label)
            .join(", ")}
          {nonValide.length > 3 ? "…" : ""}). Un campo vuoto diventerebbe GRATIS nel preventivo e un
          importo negativo non esiste: finché è così non si può salvare.
        </Avviso>
      )}

      {caricamento ? (
        <p className="py-10 text-center text-sm text-white/50">Caricamento del listino…</p>
      ) : gruppi.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center">
          {/*  ⚠️ «Nessuna voce» da solo faceva concludere che l'opzione non
              esistesse: è così che è nata la segnalazione. Se quello che si
              cerca è la manutenzione, qui si dice dov'è e ci si va. */}
          {cercaLaManutenzione ? (
            <>
              <p className="text-sm text-white/70">
                Non è una voce del listino: l'importo dell'assistenza dopo la consegna si cambia nel
                riquadro «L'assistenza dopo la consegna», qui sopra.
              </p>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("pannello-manutenzione")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
              >
                Portami all'assistenza ({anteprimaManutenzione.price} € ogni{" "}
                {anteprimaManutenzione.everyMonths} mesi)
              </button>
            </>
          ) : (
            <p className="text-sm text-white/60">Nessuna voce con questi filtri.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setCerca("");
              setFiltro("tutte");
            }}
            className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/10"
          >
            Mostra tutto il listino
          </button>
        </div>
      ) : (
        gruppi.map((g) => (
          <Riquadro key={g.nome} titolo={g.nome} senzaPadding>
            <div className="divide-y divide-white/10">
              {g.righe.map((r) => (
                <RigaListino
                  key={r.id}
                  riga={r}
                  voce={bozza[r.id]}
                  precedente={salvato[r.id]}
                  modificata={idsModificati.has(r.id)}
                  onCambio={(patch) => cambiaVoce(r.id, patch)}
                  onRipristina={() => setBozza((b) => ({ ...b, [r.id]: { ...salvato[r.id] } }))}
                />
              ))}
            </div>
          </Riquadro>
        ))
      )}

      <SchedaPreventivoTipo
        calcolo={calcolo}
        basi={basi}
        onBase={setBaseId}
        onQuantita={setQuantita}
        nota={
          //  Il nome della scheda va detto com'è scritto sulla linguetta: le
          //  vecchie "Coupon" e "Sconti quantità" adesso sono una sola.
          <p className="text-[11.5px] text-white/45">
            Il totale tiene già conto degli sconti che partono da soli (scheda{" "}
            <strong className="text-white/70">Sconti e coupon</strong>). I preventivi già creati non
            cambiano: mantengono i prezzi del giorno in cui sono stati fatti.
          </p>
        }
      />

      <FinestraConferma
        aperta={confermaAperta}
        onChiudi={() => setConfermaAperta(false)}
        modificate={modificate}
        quantiCambi={quantiCambi}
        salvataggio={salvataggio}
        onConferma={salva}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I PEZZI
   ═════════════════════════════════════════════════════════════════════════ */

/** Una voce del listino: nome, come apparirà al cliente, e i due importi. */
function RigaListino({
  riga,
  voce,
  precedente,
  modificata,
  onCambio,
  onRipristina,
}: {
  riga: PricingRow;
  voce?: Voce;
  precedente?: Voce;
  modificata: boolean;
  onCambio: (patch: Partial<Voce>) => void;
  onRipristina: () => void;
}) {
  //  Il listino arriva dal server: se una voce manca (catalogo cambiato, riga
  //  mai salvata) non si disegna una riga a metà, si salta.
  if (!voce || !precedente) return null;

  const prezzo = numeroDaTesto(voce.prezzo);
  const pieno = numeroDaTesto(voce.pieno);
  //  Un barrato che non è più alto del prezzo semplicemente non compare: è
  //  un'impostazione che sembra fatta e non fa niente, e va detto qui.
  const barratoInutile = pieno != null && prezzo != null && pieno <= prezzo;

  return (
    <div
      className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${
        modificata ? "bg-amber-400/[0.08]" : ""
      } ${voce.nascosta ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-white">{riga.label}</span>
          {modificata && <Pastiglia tono="sospeso">da salvare</Pastiglia>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-white/40">Nel preventivo:</span>
          {voce.nascosta ? (
            <span className="text-[11.5px] font-medium text-white/50">
              non compare — il cliente non può sceglierla
            </span>
          ) : prezzo == null ? (
            <span className="text-[11.5px] font-medium text-rose-300">
              prezzo non valido: scrivi una cifra da 0 in su
            </span>
          ) : (
            <AnteprimaPrezzo prezzo={prezzo} pieno={pieno} senzaPiu={IDS_BASE.has(riga.id)} />
          )}
          {!voce.nascosta && barratoInutile && (
            <span className="text-[11px] text-amber-300">
              il barrato non comparirà: è più basso del prezzo
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {riga.hasWas && (
          <CampoImporto
            etichetta="Prezzo pieno"
            valore={voce.pieno}
            salvato={precedente.pieno}
            disabilitato={voce.nascosta}
            vuotoAmmesso
            onCambio={(v) => onCambio({ pieno: v })}
          />
        )}
        <CampoImporto
          etichetta="Prezzo"
          valore={voce.prezzo}
          salvato={precedente.prezzo}
          disabilitato={voce.nascosta}
          forte
          onCambio={(v) => onCambio({ prezzo: v })}
        />
        <button
          type="button"
          onClick={() => onCambio({ nascosta: !voce.nascosta })}
          title={
            voce.nascosta
              ? "Nascosta dal preventivo — premi per rimetterla"
              : "Visibile nel preventivo — premi per nasconderla"
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/70 transition-colors hover:bg-white/10"
        >
          {voce.nascosta ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="sr-only">{voce.nascosta ? "Rimetti nel preventivo" : "Nascondi"}</span>
        </button>
        {modificata && (
          <button
            type="button"
            onClick={onRipristina}
            title="Riporta questa voce ai valori salvati"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/15 text-amber-200 transition-colors hover:bg-amber-400/25"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="sr-only">Annulla la modifica</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** ── L'IMPORTO SI LEGGE, POI SI MODIFICA ───────────────────────────────────
 *  A riposo è una CIFRA, non una casella: il valore attuale si legge da lontano
 *  e non si cambia per sbaglio. Alla pressione diventa un campo di testo (mai
 *  `type=number`: sopra un campo numerico la rotellina del mouse cambia il
 *  prezzo mentre si scorre, in silenzio, e la virgola non viene accettata).
 *  Esc riporta il valore da cui si era partiti, Invio chiude. */
function CampoImporto({
  etichetta,
  valore,
  salvato,
  disabilitato,
  forte,
  vuotoAmmesso,
  onCambio,
}: {
  etichetta: string;
  valore: string;
  salvato: string;
  disabilitato?: boolean;
  /** true = è il prezzo vero, quello che va letto per primo */
  forte?: boolean;
  /** true = si può lasciare vuoto (il prezzo pieno è facoltativo) */
  vuotoAmmesso?: boolean;
  onCambio: (v: string) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const daRipristinare = useRef(valore);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aperto) campo.current?.select();
  }, [aperto]);

  const numero = numeroDaTesto(valore);
  const numeroSalvato = numeroDaTesto(salvato);
  const cambiato = (numero ?? -1) !== (numeroSalvato ?? -1);
  const invalido = numero == null && !(vuotoAmmesso && valore.trim() === "");

  if (aperto)
    return (
      <label className="min-w-0">
        <span className="block text-[11px] text-white/45">{etichetta}</span>
        <input
          ref={campo}
          value={valore}
          inputMode="decimal"
          autoFocus
          aria-label={etichetta}
          onChange={(e) => onCambio(e.target.value)}
          onBlur={() => setAperto(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setAperto(false);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCambio(daRipristinare.current);
              setAperto(false);
            }
          }}
          className={`h-8 w-[108px] rounded-lg border bg-white/10 px-2 text-right text-[13px] font-semibold tabular-nums text-white outline-none ${
            invalido
              ? "border-rose-400 ring-2 ring-rose-400/30"
              : "border-brand ring-2 ring-brand/30"
          }`}
        />
      </label>
    );

  return (
    <button
      type="button"
      disabled={disabilitato}
      onClick={() => {
        daRipristinare.current = valore;
        setAperto(true);
      }}
      title={`Modifica ${etichetta.toLowerCase()}`}
      className={`group w-[108px] shrink-0 rounded-lg border px-2 py-1 text-right transition-colors ${
        cambiato
          ? "border-amber-400/50 bg-amber-400/15"
          : "border-white/15 bg-white/5 hover:bg-white/10"
      } ${disabilitato ? "cursor-not-allowed opacity-50" : ""} ${
        invalido ? "border-rose-400/60 bg-rose-500/10" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-1 text-[11px] text-white/45">
        {etichetta}
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </span>
      <span
        className={`block truncate tabular-nums ${
          forte ? "text-[14px] font-semibold" : "text-[13px] font-medium"
        } ${invalido ? "text-rose-300" : "text-white"}`}
      >
        {numero == null ? (vuotoAmmesso ? "nessuno" : "—") : formatPrice(numero)}
      </span>
      {cambiato && (
        <span className="block truncate text-[11px] text-amber-300">
          era {numeroSalvato == null ? "nessuno" : formatPrice(numeroSalvato)}
        </span>
      )}
    </button>
  );
}

/** La finestra di conferma: l'ultimo posto in cui un errore costa ancora zero.
 *  Elenca voce per voce il prima → dopo e, accanto, la pastiglia che vedrà il
 *  cliente. I salti sospetti sono in ambra, con scritto perché lo sono. */
function FinestraConferma({
  aperta,
  onChiudi,
  modificate,
  quantiCambi,
  salvataggio,
  onConferma,
}: {
  aperta: boolean;
  onChiudi: () => void;
  modificate: VoceModificata[];
  quantiCambi: number;
  salvataggio: boolean;
  onConferma: () => void;
}) {
  const sospetti = modificate.reduce((s, v) => s + v.cambi.filter((c) => c.avviso).length, 0);
  return (
    <FinestraScura
      aperta={aperta}
      onChiudi={onChiudi}
      bloccante
      icona={Euro}
      titolo="Conferma le modifiche al listino"
      contesto={`${modificate.length} ${modificate.length === 1 ? "voce" : "voci"} · ${quantiCambi} ${
        quantiCambi === 1 ? "valore" : "valori"
      } che il cliente vedrà nel preventivo`}
      azioni={
        <>
          <BottoneChiaro onClick={onChiudi} disabled={salvataggio}>
            Torna a controllare
          </BottoneChiaro>
          <BottonePieno onClick={onConferma} disabled={salvataggio}>
            {salvataggio ? "Salvataggio…" : "Salva il listino"}
          </BottonePieno>
        </>
      }
    >
      <div className="space-y-2.5">
        {sospetti > 0 && (
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            {sospetti === 1 ? "Una modifica merita" : `${sospetti} modifiche meritano`} un secondo
            sguardo: sono i salti che di solito nascono da uno zero di troppo o mancante.
          </NotaFinestra>
        )}

        {modificate.map((m) => (
          <div key={m.riga.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-white">{m.riga.label}</div>
                <div className="truncate text-[11px] text-white/45">{m.riga.group}</div>
              </div>
              {m.nascosta ? (
                <span className="text-[11.5px] font-medium text-white/50">
                  non comparirà nel preventivo
                </span>
              ) : (
                <AnteprimaPrezzo
                  prezzo={m.prezzo}
                  pieno={m.pieno}
                  senzaPiu={IDS_BASE.has(m.riga.id)}
                />
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {m.cambi.map((c) => (
                <li key={c.campo} className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
                  <span className="text-white/45">{c.campo}:</span>
                  <span className="text-white/45 line-through">{c.prima}</span>
                  <span className="text-white/30">→</span>
                  <span className="font-semibold text-white">{c.dopo}</span>
                  {c.avviso && (
                    <span className="rounded-md border border-amber-300/40 bg-amber-400/15 px-1.5 text-[11px] font-medium text-amber-200">
                      {c.avviso}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <NotaFinestra icona={Ticket}>
          Vale per i preventivi creati da adesso in poi. Quelli già fatti tengono i prezzi del
          giorno in cui sono stati creati.
        </NotaFinestra>
      </div>
    </FinestraScura>
  );
}
