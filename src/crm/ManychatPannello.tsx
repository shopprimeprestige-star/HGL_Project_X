/** ── IL RIQUADRO «WHATSAPP CON MANYCHAT» (Impostazioni → WhatsApp) ───────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5. Va sotto
 *  «Conferma consulenze». Ci sono, in quest'ordine: la riga di stato in chiaro,
 *  l'allarme «nessun giro da più di 5 minuti», gli interruttori (spenti di
 *  serie), il collegamento («Collegamento ok» + «Prova di collegamento»), i
 *  problemi recenti, e in fondo le cose che si toccano di rado: il canale, i
 *  tetti, i flussi, la «Prova a secco» e la «Prova creazione contatto».
 *
 *  Commessa 2026-10-25: in più «Lead nuovo» e «Giorno del meet», la data della
 *  frase del consenso nel modulo Meta, un interruttore per ogni stato con un
 *  messaggio (e l'indirizzo della sede), la riga «Foglio Google», il tetto dei
 *  lead nuovi e i flussi delle sequenze. Tutto spento di serie; accendere si
 *  conferma; «Lead nuovo» non si accende senza la data della frase.
 *
 *  Le frasi e le regole (stato, allarme, tetti, collegamento) sono in
 *  `manychat/vista-pannello.ts` e sono provate; le chiamate al server in
 *  `manychat/client-crm.ts`, che è anche il contratto con le rotte. Qui si
 *  disegna.
 *
 *  ⚠️ PARTE SPENTO E NIENTE DA QUI MANDA UN MESSAGGIO. Le tre prove non
 *   scrivono a nessun cliente; la «Prova creazione contatto» crea il contatto
 *   DEL TITOLARE dentro ManyChat (lo dice la frase accanto al tasto, prima del
 *   clic). Il numero scritto non si salva nel CRM e il campo si svuota subito.
 *  ⚠️ ACCENDERE SI CONFERMA, spegnere no: un clic sbagliato per spegnere non fa
 *   danni, uno per accendere sì. Cambiare canale si conferma sempre.
 *  ⚠️ I TETTI SI POSSONO SOLO ABBASSARE. Il campo non accetta più delle
 *   costanti e il server le riporta comunque giù.
 *  ⚠️ IL BROWSER NON DECIDE NIENTE DA SOLO: legge e comanda attraverso
 *   `/api/crm/manychat`, che risponde 403 a chi non ha «impostazioni»; qui i
 *   comandi si vedono solo a chi può (nasconde, non difende). Mai la chiave di
 *   ManyChat qui.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata (React #310).
 *  ───────────────────────────────────────────────────────────────────────── */
import { CheckCircle2, CircleMinus, HelpCircle, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { usePuo } from "@/crm/AuthContext";
import { Finestra, NotaFinestra, Pillola } from "@/crm/ui/Finestra";
import {
  leggiManychat,
  provaASecco,
  provaCollegamento,
  provaCreazioneContatto,
  salvaFraseModulo,
  salvaManychat,
  type CanaleManychat,
  type ComandoManychat,
  type ProvaASecco,
  type ProvaCreazione,
  type RispostaCrm,
  type StatoManychat,
} from "@/crm/manychat/client-crm";
import { TETTO_RICONTATTI, TETTO_TOTALE, TETTO_PRIMA_SETTIMANA } from "@/crm/manychat/quando";
import {
  MODELLI_FLUSSO,
  MODELLI_FLUSSO_SEQUENZE,
  PAROLA_ESITO,
  TETTO_LEAD_NUOVI,
  allarmeGiro,
  giornoBreve,
  leggiGiornoFrase,
  leggiIndirizzo,
  leggiNs,
  leggiTetto,
  oraBreve,
  quandoBreve,
  righeProblemi,
  rigaStatoRiquadro,
  tettiEffettivi,
  righeCollegamento,
  titoloCollegamento,
  vistaFoglio,
  vistaFraseModulo,
  vistaSequenze,
  type TonoRiquadro,
  type VistaStato,
} from "@/crm/manychat/vista-pannello";
import { aRoma } from "@/crm/promemoria/formati";
import { cn } from "@/lib/utils";

const TONI: Record<TonoRiquadro, string> = {
  verde: "border-emerald-200 bg-emerald-50 text-emerald-900",
  ambra: "border-amber-200 bg-amber-50 text-amber-900",
  rosso: "border-rose-200 bg-rose-50 text-rose-900",
  neutro: "border-border bg-muted text-foreground",
};

const TESTO_ESITO = {
  ok: "text-emerald-700",
  errore: "text-rose-700",
  da_verificare: "text-amber-800",
  non_serve: "text-slate-500",
} as const;

const ICONA_ESITO = {
  ok: CheckCircle2,
  errore: XCircle,
  da_verificare: HelpCircle,
  non_serve: CircleMinus,
} as const;

const POLLING_MS = 60_000;
const CONFERMA_MODELLO = "consulenza_conferma_presenza";

type ChiaveInterruttore = "acceso" | "promemoria" | "ricontatti" | "leadNuovo" | "giornoMeet";

interface Conferma {
  titolo: string;
  testo: ReactNode;
  etichetta: string;
  azione: () => void;
}

const FRASE_PROVA_CREAZIONE =
  "Questa prova crea il tuo contatto dentro ManyChat (nome e numero restano lì). Nel CRM il numero non si salva. Non parte nessun messaggio.";

function Sezione({
  titolo,
  nota,
  children,
}: {
  titolo: string;
  nota?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-slate-200 pt-4">
      <div>
        <h3 className="text-[13px] font-semibold text-slate-900">{titolo}</h3>
        {nota && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function Interruttore({
  etichetta,
  nota,
  acceso,
  disabilitato,
  onCambia,
  forte,
}: {
  etichetta: string;
  nota: ReactNode;
  acceso: boolean;
  disabilitato: boolean;
  onCambia: (v: boolean) => void;
  forte?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className={cn("block text-sm", forte ? "font-semibold" : "font-medium")}>
          {etichetta}
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">
            {acceso ? "acceso" : "spento"}
          </span>
        </span>
        <span className="block text-[12px] leading-snug text-muted-foreground">{nota}</span>
      </span>
      <Switch
        checked={acceso}
        disabled={disabilitato}
        onCheckedChange={onCambia}
        aria-label={etichetta}
        className="mt-0.5"
      />
    </label>
  );
}

export function ManychatPannello() {
  const puoCambiare = usePuo()("impostazioni");
  const [stato, setStato] = useState<StatoManychat | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [occupato, setOccupato] = useState<string | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);
  const [bozzaTetti, setBozzaTetti] = useState({ ricontatti: "", leadNuovi: "", totale: "" });
  const [bozzaFrase, setBozzaFrase] = useState("");
  const [bozzaSede, setBozzaSede] = useState("");
  const [bozzaFlussi, setBozzaFlussi] = useState<Record<string, string>>({});
  const [secco, setSecco] = useState<ProvaASecco | null>(null);
  const [creazione, setCreazione] = useState<ProvaCreazione | null>(null);
  const [telefonoProva, setTelefonoProva] = useState("");

  //  Contatore delle scritture: una lettura partita PRIMA di un comando e
  //  arrivata dopo porterebbe la configurazione vecchia (l'interruttore
  //  tornerebbe com'era per un minuto). Si scarta.
  const versione = useRef(0);

  const ricarica = useCallback(async () => {
    const mia = versione.current;
    const r = await leggiManychat();
    if (mia !== versione.current) return;
    if (r.ok) {
      setStato(r.dati);
      setErrore(null);
    } else {
      setErrore(r.errore);
    }
    setCaricato(true);
  }, []);

  useEffect(() => {
    if (!puoCambiare) return;
    void ricarica();
    //  Il minuto che passa deve poter far scattare «nessun giro da 5 minuti».
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void ricarica();
    }, POLLING_MS);
    //  Tornando sulla scheda si rilegge subito: l'allarme del giro non deve
    //  restare quello vecchio fino al prossimo minuto.
    const alRitorno = () => {
      if (document.visibilityState === "visible") void ricarica();
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alRitorno);
    };
  }, [ricarica, puoCambiare]);

  //  Le bozze ripartono dai valori del server quando cambiano (o arrivano).
  const config = stato?.config;
  const chiaveConfig = JSON.stringify([config?.tetti, config?.flussi, config?.indirizzoSede]);
  useEffect(() => {
    if (!config) return;
    setBozzaTetti({
      ricontatti: String(config.tetti.ricontatti ?? TETTO_RICONTATTI),
      leadNuovi: String(config.tetti.leadNuovi ?? TETTO_LEAD_NUOVI),
      totale: String(config.tetti.totale ?? TETTO_TOTALE),
    });
    setBozzaFlussi({ ...config.flussi });
    setBozzaSede(config.indirizzoSede ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si riparte solo quando cambiano tetti, flussi e sede
  }, [chiaveConfig]);

  //  Il campo della frase parte dal giorno segnato, o da oggi (a Roma) se non c'è.
  const fraseSalvata = stato?.fraseModulo ?? null;
  useEffect(() => {
    if (!stato) return;
    setBozzaFrase(
      fraseSalvata ? aRoma(new Date(fraseSalvata.il)).giorno : aRoma(new Date(stato.adesso)).giorno,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si riparte solo quando cambia la frase salvata
  }, [fraseSalvata?.il, !!stato]);

  const adesso = useMemo(() => {
    const t = stato ? new Date(stato.adesso) : new Date();
    return Number.isFinite(t.getTime()) ? t : new Date();
    //  Il giro del tempo lo fa il polling: `stato` è nuovo a ogni lettura.
  }, [stato]);

  /** Una chiamata: occupa il riquadro, mostra l'errore in chiaro, o applica. */
  const esegui = async <T,>(
    chiave: string,
    chiamata: () => Promise<RispostaCrm<T>>,
    applica: (d: T) => void,
    fatto?: string,
  ) => {
    setOccupato(chiave);
    versione.current += 1;
    const r = await chiamata();
    versione.current += 1;
    setOccupato(null);
    if (!r.ok) {
      toast.error(r.errore);
      return;
    }
    applica(r.dati);
    if (fatto) toast.success(fatto);
  };

  const comanda = (c: ComandoManychat, fatto: string) =>
    esegui(
      "salva",
      () => salvaManychat(c),
      (d) => setStato((s) => (s ? { ...s, config: d.config } : s)),
      fatto,
    );

  const ctxCollegamento = {
    segretoRitornoPresente: stato?.segretoRitornoPresente ?? true,
    ultimaRispostaIl: stato?.giro.ultimaRispostaIl ?? null,
  };
  const collegamentoTitolo = titoloCollegamento(stato?.collegamento, ctxCollegamento);
  const righeColl = righeCollegamento(stato?.collegamento, ctxCollegamento);

  const imposta = (chiave: ChiaveInterruttore, valore: boolean) => {
    const parole: Record<ChiaveInterruttore, { titolo: string; testo: ReactNode; fatto: string }> =
      {
        acceso: {
          titolo: "Accendere WhatsApp con ManyChat?",
          testo:
            "Il giro comincia a lavorare ogni minuto. Manda solo quello che accendi qui sotto («Promemoria» e «Ricontatti»), e solo a chi ha «Ok a WhatsApp» sulla scheda.",
          fatto: "WhatsApp con ManyChat acceso",
        },
        promemoria: {
          titolo: "Accendere i promemoria 25 minuti prima?",
          testo:
            "Chi ha un meet oggi, con «Ok a WhatsApp» sulla scheda, riceve un promemoria 25 minuti prima. Uno solo per appuntamento. Parte solo se anche l'interruttore generale è acceso.",
          fatto: "Promemoria acceso",
        },
        ricontatti: {
          titolo: "Accendere i ricontatti dei consulenti?",
          testo:
            "Nel giorno fissato, ai lead dei consulenti con «Ok a WhatsApp» parte un ricontatto: uno ogni 27-33 minuti, dalle 9 alle 20, da lunedì a sabato. Le date già passate non partono mai. Parte solo se anche l'interruttore generale è acceso.",
          fatto: "Ricontatti acceso",
        },
        leadNuovo: {
          titolo: "Accendere «Lead nuovo»?",
          testo: (
            <>
              Chi lascia il numero nel modulo Meta riceve subito un primo messaggio e, se non
              risponde, un richiamo dopo 24 ore. Poi basta. Parte solo per i moduli compilati dal{" "}
              {stato?.fraseModulo ? giornoBreve(stato.fraseModulo.il) : "giorno della frase"} in poi
              e arrivati dopo questa accensione, dalle 9 alle 20, da lunedì a sabato. Il richiamo è
              un secondo messaggio a chi non ha risposto: per questo caso la regola «mai due
              messaggi senza risposta» non vale. Chi ricompila il modulo con un numero già in
              archivio non riceve il primo messaggio. Parte solo se anche l'interruttore generale è
              acceso.
            </>
          ),
          fatto: "Lead nuovo acceso",
        },
        giornoMeet: {
          titolo: "Accendere «Giorno del meet»?",
          testo: (
            <>
              Chi ha un meet oggi riceve un messaggio la mattina (alle 9; se il meet è prima delle
              10, appena possibile) e uno all'ora esatta, con il link per entrare. Il promemoria 25
              minuti prima resta il suo interruttore. Questi messaggi non sono frenati da «mai due
              messaggi senza risposta», perché riguardano un appuntamento già preso; contano nei
              tetti e si fermano con STOP. Parte solo se anche l'interruttore generale è acceso.
            </>
          ),
          fatto: "Giorno del meet acceso",
        },
      };
    const p = parole[chiave];
    if (!valore) {
      void comanda({ interruttori: { [chiave]: false } }, p.fatto.replace("acceso", "spento"));
      return;
    }
    setConferma({
      titolo: p.titolo,
      etichetta: "Accendi",
      azione: () => void comanda({ interruttori: { [chiave]: true } }, p.fatto),
      testo: (
        <div className="space-y-2.5">
          <p>{p.testo}</p>
          {collegamentoTitolo.tono !== "verde" && (
            <NotaFinestra tono="attenzione">
              {collegamentoTitolo.tono === "neutro"
                ? "Il collegamento non è ancora stato controllato: prima fai «Prova di collegamento»."
                : `${collegamentoTitolo.titolo}. Meglio sistemare prima.`}
            </NotaFinestra>
          )}
          <p className="text-[12px] text-slate-500">
            Prima di accendere conviene fare «Prova di collegamento» e «Prova a secco».
          </p>
        </div>
      ),
    });
  };

  const cambiaCanale = (canale: CanaleManychat) => {
    if (canale === config?.canale) return;
    const aManychat = canale === "manychat";
    setConferma({
      titolo: aManychat ? "Passare a ManyChat?" : "Tornare alla Cloud API diretta?",
      etichetta: aManychat ? "Passa a ManyChat" : "Torna alla Cloud API",
      azione: () => void comanda({ canale }, aManychat ? "Canale: ManyChat" : "Canale: Cloud API"),
      testo: aManychat ? (
        <div className="space-y-2.5">
          <p>
            Da adesso TUTTI i messaggi WhatsApp del CRM passano da ManyChat: conferma della
            consulenza, chat, webinar. Il numero deve essere collegato a ManyChat e il flusso della
            conferma deve essere indicato qui sotto.
          </p>
          <NotaFinestra tono="attenzione">
            Prima del cambio: l'accordo sul trattamento dati (DPA) con ManyChat, il registro dei
            fornitori e l'informativa privacy devono essere a posto.
          </NotaFinestra>
          <p className="text-[12px] text-slate-500">
            Per tornare indietro: canale su Cloud API e numero ricollegato alla Cloud API.
          </p>
        </div>
      ) : (
        <p>
          I messaggi tornano a passare dalla Cloud API di Meta. Il numero deve essere ricollegato
          alla Cloud API, altrimenti non parte niente.
        </p>
      ),
    });
  };

  // ── tetti ──────────────────────────────────────────────────────────────
  const letturaRicontatti = leggiTetto(bozzaTetti.ricontatti, TETTO_RICONTATTI);
  const letturaLeadNuovi = leggiTetto(bozzaTetti.leadNuovi, TETTO_LEAD_NUOVI);
  const letturaTotale = leggiTetto(bozzaTetti.totale, TETTO_TOTALE);
  const tettiCambiati =
    !!config &&
    ((letturaRicontatti.ok &&
      letturaRicontatti.valore !== (config.tetti.ricontatti ?? TETTO_RICONTATTI)) ||
      (letturaLeadNuovi.ok &&
        config.sequenze &&
        letturaLeadNuovi.valore !== (config.tetti.leadNuovi ?? TETTO_LEAD_NUOVI)) ||
      (letturaTotale.ok && letturaTotale.valore !== (config.tetti.totale ?? TETTO_TOTALE)));
  const salvaTetti = () => {
    if (!letturaRicontatti.ok || !letturaLeadNuovi.ok || !letturaTotale.ok) return;
    void comanda(
      {
        tetti: {
          ricontatti: letturaRicontatti.valore,
          totale: letturaTotale.valore,
          //  Il tetto dei lead nuovi sta nelle colonne di S2: senza, non si manda.
          ...(config?.sequenze ? { leadNuovi: letturaLeadNuovi.valore } : {}),
        },
      },
      "Tetti salvati",
    );
  };

  // ── la frase del consenso, i messaggi per stato, la sede ────────────────
  const letturaFrase = leggiGiornoFrase(bozzaFrase, adesso);
  const frasePronta =
    letturaFrase.ok &&
    letturaFrase.giorno !== (fraseSalvata ? aRoma(new Date(fraseSalvata.il)).giorno : "");
  const confermaFrase = () => {
    if (!letturaFrase.ok) return;
    const giorno = letturaFrase.giorno;
    const [a, m, g] = giorno.split("-");
    const prima = fraseSalvata ? aRoma(new Date(fraseSalvata.il)).giorno : null;
    setConferma({
      titolo: "Segnare la data della frase?",
      etichetta: "Segna la data",
      azione: () =>
        void esegui(
          "frase",
          () => salvaFraseModulo(giorno),
          (d) => setStato((st) => (st ? { ...st, fraseModulo: d.fraseModulo } : st)),
          "Data della frase segnata",
        ),
      testo: (
        <div className="space-y-2.5">
          <p>
            Da adesso i moduli Meta compilati dal {g}/{m}/{a} in poi valgono come consenso a
            ricevere i messaggi di servizio su WhatsApp. I moduli di prima no. Conferma solo se la
            frase del consenso era già nel modulo da quel giorno.
          </p>
          {prima && giorno < prima && (
            <NotaFinestra tono="attenzione">
              Stai anticipando la data: valgono anche i moduli compilati dal {g}/{m} fino al{" "}
              {prima.slice(8)}/{prima.slice(5, 7)}.
            </NotaFinestra>
          )}
        </div>
      ),
    });
  };

  const letturaSede = leggiIndirizzo(bozzaSede);
  const sedeCambiata = letturaSede.ok && letturaSede.valore !== (config?.indirizzoSede ?? "");
  const salvaSede = () => {
    if (!letturaSede.ok) return;
    void comanda({ indirizzoSede: letturaSede.valore }, "Indirizzo della sede salvato");
  };

  const accendiStato = (r: VistaStato, valore: boolean) => {
    const fatto = `${r.etichetta}: messaggio ${valore ? "acceso" : "spento"}`;
    if (!valore) {
      void comanda({ stati: { [r.stato]: false } }, fatto);
      return;
    }
    const flussoMancante = !config?.flussi[r.modello];
    setConferma({
      titolo: `Accendere il messaggio per «${r.etichetta}»?`,
      etichetta: "Accendi",
      azione: () => void comanda({ stati: { [r.stato]: true } }, fatto),
      testo: (
        <div className="space-y-2.5">
          <p>
            {r.quando}. Riceve il messaggio: {r.chi.toLowerCase()}, e solo con il consenso WhatsApp.
            Le schede che sono già in questo stato non ricevono niente: contano solo da adesso. Il
            messaggio ha il suo posto nei tetti e nel ritmo dei ricontatti, e si ferma con STOP.
            Parte solo se anche l'interruttore generale è acceso.
          </p>
          {flussoMancante && (
            <NotaFinestra tono="attenzione">
              Il flusso di questo messaggio non è ancora collegato (in «Canale e flussi»): finché
              manca, non parte niente.
            </NotaFinestra>
          )}
          {r.avviso && <NotaFinestra tono="attenzione">{r.avviso}</NotaFinestra>}
        </div>
      ),
    });
  };

  // ── flussi ─────────────────────────────────────────────────────────────
  const modelli = useMemo(() => {
    const sequenze = config?.sequenze ? MODELLI_FLUSSO_SEQUENZE : [];
    const noti = new Set([...MODELLI_FLUSSO, ...sequenze].map((m) => m.modello));
    const extra = Object.keys(config?.flussi ?? {})
      .filter((m) => !noti.has(m))
      .map((modello) => ({ modello, etichetta: modello }));
    return [...MODELLI_FLUSSO, ...sequenze, ...extra];
  }, [config?.flussi, config?.sequenze]);
  const flussiLetti = modelli.map((m) => ({
    modello: m.modello,
    lettura: leggiNs(bozzaFlussi[m.modello] ?? ""),
    prima: config?.flussi[m.modello] ?? "",
  }));
  const flussiCambiati = flussiLetti.filter((f) => f.lettura.ok && f.lettura.valore !== f.prima);
  const flussiSbagliati = flussiLetti.some((f) => !f.lettura.ok);
  const salvaFlussi = () => {
    const corpo: Record<string, string> = {};
    for (const f of flussiCambiati) if (f.lettura.ok) corpo[f.modello] = f.lettura.valore;
    const conferma0 = corpo[CONFERMA_MODELLO] === "" && !!config?.flussi[CONFERMA_MODELLO];
    if (conferma0 && config?.canale === "manychat") {
      setConferma({
        titolo: "Togliere il flusso della conferma?",
        etichetta: "Togli il flusso",
        azione: () => void comanda({ flussi: corpo }, "Flussi salvati"),
        testo: (
          <NotaFinestra tono="attenzione">
            Senza il flusso della conferma, col canale ManyChat la conferma «risponda SÌ» alle
            consulenze si ferma: non parte nessun messaggio finché non lo ricolleghi.
          </NotaFinestra>
        ),
      });
      return;
    }
    void comanda({ flussi: corpo }, "Flussi salvati");
  };

  // ── prove ──────────────────────────────────────────────────────────────
  const faiProvaASecco = () => esegui("secco", provaASecco, (d) => setSecco(d));
  const faiProvaCollegamento = () =>
    esegui("collegamento", provaCollegamento, (d) =>
      setStato((s) => (s ? { ...s, collegamento: d } : s)),
    );
  const cifreProva = telefonoProva.replace(/\D/g, "");
  const faiProvaCreazione = () => {
    const numero = telefonoProva;
    setTelefonoProva("");
    void esegui(
      "creazione",
      () => provaCreazioneContatto(numero),
      (d) => setCreazione(d),
    );
  };

  // ── il disegno ─────────────────────────────────────────────────────────
  if (!puoCambiare)
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">WhatsApp con ManyChat</CardTitle>
          <p className="text-[13px] text-muted-foreground">
            Solo chi può cambiare le impostazioni vede e gestisce questo riquadro.
          </p>
        </CardHeader>
      </Card>
    );

  const riga = stato ? rigaStatoRiquadro(stato, adesso) : null;
  const allarme = stato ? allarmeGiro(stato.giro, stato.config.acceso, adesso) : null;
  const eff = config ? tettiEffettivi(config.tetti, config.primaAccensione, adesso) : null;
  const sequenze = stato ? vistaSequenze(stato) : null;
  const fraseVista = vistaFraseModulo(fraseSalvata);
  const foglioVista = stato ? vistaFoglio(stato.foglio) : null;
  const problemi = stato ? righeProblemi(stato.giro) : [];
  const bloccato = !caricato || !stato || occupato !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">WhatsApp con ManyChat</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Promemoria del meet, ricontatti dei consulenti, sequenze per i lead nuovi e per il giorno
          del meet, messaggi per stato: li manda ManyChat. Parte spento: non scrive a nessuno finché
          non lo accendi, e solo a chi ha dato il consenso: «Ok a WhatsApp» sulla scheda, o il
          numero lasciato nel modulo Meta dopo la frase del consenso.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!caricato && <p className="text-[13px] text-muted-foreground">Carico lo stato…</p>}
        {caricato && !stato && (
          <div role="alert" className={cn("rounded-md border px-3 py-2 text-[13px]", TONI.rosso)}>
            <p>{errore ?? "Non riesco a leggere lo stato."}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void ricarica()}>
              Riprova
            </Button>
          </div>
        )}

        {stato && config && riga && eff && (
          <>
            <p
              role="status"
              className={cn(
                "rounded-md border px-3 py-2 text-[13px] leading-snug",
                TONI[riga.tono],
              )}
            >
              {!riga.frase.toLowerCase().startsWith(riga.parola.toLowerCase()) && (
                <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide">
                  {riga.parola}
                </span>
              )}
              {riga.frase}
            </p>
            {allarme && (
              <p
                role="alert"
                className={cn(
                  "rounded-md border px-3 py-2 text-[13px] leading-snug",
                  allarme.tono === "rosso" ? TONI.rosso : TONI.ambra,
                )}
              >
                <span className="mr-2 font-semibold uppercase tracking-wide text-[11px]">
                  {allarme.tono === "rosso" ? "Giro fermo" : "Giro"}
                </span>
                {allarme.frase}
              </p>
            )}
            {errore && (
              <p className="text-[12px] text-rose-800">
                Non riesco ad aggiornare lo stato: {errore} (vedi l'ultima lettura).
              </p>
            )}

            <div className="space-y-3">
              <Interruttore
                forte
                etichetta="WhatsApp con ManyChat"
                nota="Interruttore generale. Spento: il giro non chiama ManyChat e la coda resta ferma."
                acceso={config.acceso}
                disabilitato={bloccato}
                onCambia={(v) => imposta("acceso", v)}
              />
              <div className="space-y-3 pl-4 sm:pl-6">
                <Interruttore
                  etichetta="Promemoria 25 minuti prima"
                  nota="Il cliente con un meet oggi riceve un messaggio 25 minuti prima."
                  acceso={config.promemoria}
                  disabilitato={bloccato}
                  onCambia={(v) => imposta("promemoria", v)}
                />
                <Interruttore
                  etichetta="Ricontatti dei consulenti"
                  nota="Nel giorno fissato, ai lead dei consulenti. Uno ogni 27-33 minuti, 9-20, non la domenica. È anche il messaggio per «Ricontatto fissato»."
                  acceso={config.ricontatti}
                  disabilitato={bloccato}
                  onCambia={(v) => imposta("ricontatti", v)}
                />
                {sequenze && (
                  <>
                    <Interruttore
                      etichetta="Lead nuovo"
                      nota={
                        <>
                          Primo messaggio appena arriva dal modulo Meta e richiamo dopo 24 ore se
                          non risponde. Poi basta.
                          {config.leadNuovo && config.leadNuovoDal
                            ? ` Acceso dal ${quandoBreve(config.leadNuovoDal)}: i lead arrivati prima non ricevono niente.`
                            : ""}
                          {sequenze.leadNuovo.nota && (
                            <span className="mt-0.5 block text-amber-800">
                              {sequenze.leadNuovo.nota}
                            </span>
                          )}
                        </>
                      }
                      acceso={config.leadNuovo}
                      disabilitato={bloccato || sequenze.leadNuovo.disabilitato}
                      onCambia={(v) => imposta("leadNuovo", v)}
                    />
                    <Interruttore
                      etichetta="Giorno del meet"
                      nota={
                        <>
                          Il giorno del meet: un messaggio la mattina e uno all'ora esatta, con il
                          link per entrare.
                          {sequenze.giornoMeet.nota && (
                            <span className="mt-0.5 block text-amber-800">
                              {sequenze.giornoMeet.nota}
                            </span>
                          )}
                        </>
                      }
                      acceso={config.giornoMeet}
                      disabilitato={bloccato || sequenze.giornoMeet.disabilitato}
                      onCambia={(v) => imposta("giornoMeet", v)}
                    />
                  </>
                )}
              </div>
            </div>

            <Sezione
              titolo="Frase del consenso nel modulo Meta"
              nota="Il giorno in cui hai aggiunto al modulo Meta la frase sul contatto WhatsApp. I moduli compilati da quel giorno in poi valgono come consenso; quelli di prima no. Senza questa data «Lead nuovo» non si accende."
            >
              <p
                role="status"
                className={cn(
                  "rounded-md border px-3 py-2 text-[13px] leading-snug",
                  TONI[fraseVista.tono],
                )}
              >
                {fraseVista.frase}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[12px] font-medium" htmlFor="frase-giorno">
                    Giorno in cui l'hai aggiunta
                  </label>
                  <Input
                    id="frase-giorno"
                    type="date"
                    max={aRoma(adesso).giorno}
                    value={bozzaFrase}
                    onChange={(e) => setBozzaFrase(e.target.value)}
                    disabled={bloccato}
                    aria-invalid={!letturaFrase.ok}
                    aria-describedby="frase-giorno-nota"
                    className="mt-1 h-9 w-44 tabular-nums"
                  />
                </div>
                <Button size="sm" onClick={confermaFrase} disabled={bloccato || !frasePronta}>
                  {occupato === "frase" ? "Salvo…" : "Segna la data"}
                </Button>
              </div>
              <p
                id="frase-giorno-nota"
                className={cn(
                  "text-[12px] leading-snug",
                  letturaFrase.ok ? "text-muted-foreground" : "text-rose-700",
                )}
              >
                {letturaFrase.ok
                  ? "Se vuoi dare il consenso anche ai moduli di prima, scegli un giorno più vecchio: te lo chiedo di nuovo prima di salvare."
                  : letturaFrase.errore}
              </p>
            </Sezione>

            {sequenze && (
              <Sezione
                titolo="Messaggi per stato"
                nota="Quando una scheda passa a uno di questi stati parte il messaggio, uno per stato, spenti di serie. Ogni messaggio vale per le schede che entrano nello stato dopo l'accensione, e solo con il consenso WhatsApp."
              >
                <div className="space-y-3">
                  {sequenze.stati.map((r) =>
                    r.legatoA ? (
                      <p key={r.stato} className="text-[12px] leading-snug text-muted-foreground">
                        <span className="font-medium text-slate-900">{r.etichetta}</span> parte con
                        «Ricontatti dei consulenti», qui sopra.
                      </p>
                    ) : (
                      <Interruttore
                        key={r.stato}
                        etichetta={r.etichetta}
                        nota={
                          <>
                            {r.quando}. {r.chi}.
                            {r.dal ? ` ${r.dal[0].toUpperCase()}${r.dal.slice(1)}.` : ""}
                            {r.avviso && !r.acceso && (
                              <span className="mt-0.5 block text-amber-800">{r.avviso}</span>
                            )}
                          </>
                        }
                        acceso={r.acceso}
                        disabilitato={bloccato || r.disabilitato}
                        onCambia={(v) => accendiStato(r, v)}
                      />
                    ),
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-medium" htmlFor="sede-indirizzo">
                    Indirizzo della sede
                  </label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Input
                      id="sede-indirizzo"
                      value={bozzaSede}
                      onChange={(e) => setBozzaSede(e.target.value)}
                      disabled={bloccato}
                      placeholder="Via, numero civico, città"
                      aria-invalid={!letturaSede.ok}
                      aria-describedby="sede-indirizzo-nota"
                      autoComplete="off"
                      className="h-9 min-w-0 flex-1"
                    />
                    <Button size="sm" onClick={salvaSede} disabled={bloccato || !sedeCambiata}>
                      Salva l'indirizzo
                    </Button>
                  </div>
                  <p
                    id="sede-indirizzo-nota"
                    className={cn(
                      "mt-1 text-[12px] leading-snug",
                      letturaSede.ok ? "text-muted-foreground" : "text-rose-700",
                    )}
                  >
                    {letturaSede.ok
                      ? "Lo legge il promemoria «Appuntamento in sede»: senza indirizzo quel messaggio non parte. Una riga sola."
                      : letturaSede.errore}
                  </p>
                </div>
              </Sezione>
            )}

            <Sezione
              titolo={collegamentoTitolo.titolo}
              nota={
                stato.collegamento
                  ? `Controllato il ${quandoBreve(stato.collegamento.controllatoIl)}. La prova chiede a ManyChat «chi sei?» e legge flussi e campi: non manda niente.`
                  : "La prova chiede a ManyChat «chi sei?» e legge flussi e campi: non manda niente."
              }
            >
              {righeColl.length > 0 && (
                <ul className="space-y-1">
                  {righeColl.map((r) => {
                    const Icona = ICONA_ESITO[r.esito];
                    return (
                      <li key={r.id} className="flex items-start gap-2 text-[13px] leading-snug">
                        <Icona
                          className={cn("mt-0.5 h-4 w-4 shrink-0", TESTO_ESITO[r.esito])}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">{r.testo}</span>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                            TESTO_ESITO[r.esito],
                          )}
                        >
                          {PAROLA_ESITO[r.esito]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void faiProvaCollegamento()}
                disabled={bloccato}
              >
                {occupato === "collegamento" ? "Controllo…" : "Prova di collegamento"}
              </Button>
            </Sezione>

            {foglioVista && (
              <Sezione
                titolo="Foglio Google"
                nota="I lead che arrivano dal foglio Google (Meta Lead Ads). Qui compaiono solo l'ora e l'esito: nessun nome e nessun numero."
              >
                <p
                  role="status"
                  className={cn(
                    "rounded-md border px-3 py-2 text-[13px] leading-snug",
                    TONI[foglioVista.tono],
                  )}
                >
                  {foglioVista.frase}
                </p>
              </Sezione>
            )}

            <Sezione
              titolo="Prova a secco"
              nota="Dice chi verrebbe scritto adesso e perché, senza chiamare ManyChat e senza scrivere niente."
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => void faiProvaASecco()}
                disabled={bloccato}
              >
                {occupato === "secco" ? "Controllo…" : "Prova a secco"}
              </Button>
              {secco && (
                <div className="space-y-1" aria-live="polite">
                  {secco.righe.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">
                      Alle {oraBreve(secco.adesso)} non toccherebbe a nessuno.
                    </p>
                  ) : (
                    <>
                      <p className="text-[13px] font-medium">
                        Alle {oraBreve(secco.adesso)}: scriverebbe a{" "}
                        {secco.righe.filter((r) => r.esito === "scriverebbe").length} su{" "}
                        {secco.righe.length}.
                      </p>
                      <ul className="space-y-1">
                        {secco.righe.map((r, i) => (
                          <li key={`${r.nome}-${i}`} className="text-[13px] leading-snug">
                            <span className="font-medium">{r.nome}</span> · {r.tipo} ·{" "}
                            <span
                              className={cn(
                                "font-semibold",
                                r.esito === "scriverebbe"
                                  ? "text-emerald-700"
                                  : r.esito === "aspetta"
                                    ? "text-amber-800"
                                    : "text-slate-600",
                              )}
                            >
                              {r.esito === "scriverebbe"
                                ? "scriverebbe"
                                : r.esito === "aspetta"
                                  ? "aspetta"
                                  : "salta"}
                            </span>{" "}
                            · <span className="text-muted-foreground">{r.motivo}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </Sezione>

            {problemi.length > 0 && (
              <Sezione
                titolo={`Ultimi problemi · ${problemi.length}`}
                nota="Nome abbreviato e motivo. Il numero di telefono non compare mai."
              >
                <ul className="space-y-1">
                  {problemi.map((p, i) => (
                    <li key={`${p.quando}-${i}`} className="text-[13px] leading-snug">
                      <span className="mr-2 tabular-nums text-muted-foreground">{p.quando}</span>
                      {p.testo}
                    </li>
                  ))}
                </ul>
              </Sezione>
            )}

            <Sezione
              titolo="Tetti di ogni giorno"
              nota={`Massimo ${TETTO_RICONTATTI} ricontatti, ${TETTO_LEAD_NUOVI} lead nuovi e ${TETTO_TOTALE} messaggi in tutto al giorno, e ${TETTO_PRIMA_SETTIMANA} ricontatti nei primi 7 giorni dopo la prima accensione. Puoi solo abbassarli.`}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    [
                      "ricontatti",
                      "Ricontatti al giorno",
                      TETTO_RICONTATTI,
                      letturaRicontatti,
                      stato.giro.oggi.ricontatti,
                      eff.ricontatti,
                    ],
                    ...(config.sequenze
                      ? ([
                          [
                            "leadNuovi",
                            "Lead nuovi al giorno",
                            TETTO_LEAD_NUOVI,
                            letturaLeadNuovi,
                            stato.giro.oggi.leadNuovi,
                            eff.leadNuovi,
                          ],
                        ] as const)
                      : []),
                    [
                      "totale",
                      "Messaggi in tutto al giorno",
                      TETTO_TOTALE,
                      letturaTotale,
                      stato.giro.oggi.totale,
                      eff.totale,
                    ],
                  ] as const
                ).map(([campo, etichetta, massimo, lettura, oggi, valgono]) => (
                  <div key={campo}>
                    <label className="block text-[12px] font-medium" htmlFor={`tetto-${campo}`}>
                      {etichetta}{" "}
                      <span className="font-normal text-muted-foreground">(massimo {massimo})</span>
                    </label>
                    <Input
                      id={`tetto-${campo}`}
                      inputMode="numeric"
                      value={bozzaTetti[campo]}
                      onChange={(e) => setBozzaTetti((b) => ({ ...b, [campo]: e.target.value }))}
                      disabled={bloccato}
                      aria-invalid={!lettura.ok}
                      aria-describedby={`tetto-${campo}-nota`}
                      className="mt-1 h-9 w-28 tabular-nums"
                    />
                    <p
                      id={`tetto-${campo}-nota`}
                      className={cn(
                        "mt-1 text-[12px] leading-snug",
                        lettura.ok ? "text-muted-foreground" : "text-rose-700",
                      )}
                    >
                      {lettura.ok
                        ? `Oggi: ${oggi} su ${valgono}${campo === "ricontatti" && eff.primaSettimana ? " (prima settimana)" : ""}`
                        : lettura.errore}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={salvaTetti}
                disabled={
                  bloccato ||
                  !tettiCambiati ||
                  !letturaRicontatti.ok ||
                  !letturaTotale.ok ||
                  (config.sequenze && !letturaLeadNuovi.ok)
                }
              >
                Salva i tetti
              </Button>
            </Sezione>

            <Sezione
              titolo="Canale e flussi"
              nota="Il canale dice da dove escono i messaggi. I flussi sono quelli costruiti in ManyChat, uno per modello: l'identificativo (ns) lo copi da ManyChat; non è un segreto."
            >
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Canale">
                <Pillola
                  attiva={config.canale === "manychat"}
                  onClick={() => cambiaCanale("manychat")}
                  disabilitata={bloccato}
                >
                  ManyChat
                </Pillola>
                <Pillola
                  attiva={config.canale === "cloud"}
                  onClick={() => cambiaCanale("cloud")}
                  disabilitata={bloccato}
                >
                  Cloud API diretta
                </Pillola>
              </div>
              {config.canale === "cloud" && (
                <NotaFinestra tono="attenzione">
                  Il canale è la Cloud API diretta: il giro di questo riquadro non manda niente. Per
                  usare ManyChat scegli «ManyChat» (e prima controlla privacy e flussi).
                </NotaFinestra>
              )}
              <div className="space-y-2">
                {modelli.map((m, i) => {
                  const lettura = flussiLetti[i].lettura;
                  return (
                    <div key={m.modello}>
                      {config.sequenze && i === MODELLI_FLUSSO.length && (
                        <p className="mb-2 mt-3 text-[12px] font-semibold text-slate-900">
                          Sequenze e messaggi per stato
                        </p>
                      )}
                      <label
                        className="block text-[12px] font-medium"
                        htmlFor={`flusso-${m.modello}`}
                      >
                        {m.etichetta}
                      </label>
                      <Input
                        id={`flusso-${m.modello}`}
                        value={bozzaFlussi[m.modello] ?? ""}
                        onChange={(e) =>
                          setBozzaFlussi((b) => ({ ...b, [m.modello]: e.target.value }))
                        }
                        disabled={bloccato}
                        placeholder="Non collegato: incolla l'ns del flusso"
                        aria-invalid={!lettura.ok}
                        aria-describedby={`flusso-${m.modello}-nota`}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 h-9 font-mono text-[12.5px]"
                      />
                      <p
                        id={`flusso-${m.modello}-nota`}
                        className={cn(
                          "mt-0.5 text-[12px]",
                          lettura.ok ? "text-muted-foreground" : "text-rose-700",
                        )}
                      >
                        {lettura.ok ? `Modello: ${m.modello}` : lettura.errore}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Button
                size="sm"
                onClick={salvaFlussi}
                disabled={bloccato || flussiCambiati.length === 0 || flussiSbagliati}
              >
                Salva i flussi
              </Button>
            </Sezione>

            <Sezione titolo="Prova creazione contatto" nota={FRASE_PROVA_CREAZIONE}>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[12px] font-medium" htmlFor="prova-telefono">
                    Il tuo numero WhatsApp
                  </label>
                  <Input
                    id="prova-telefono"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="+39 …"
                    value={telefonoProva}
                    onChange={(e) => setTelefonoProva(e.target.value)}
                    disabled={bloccato}
                    className="mt-1 h-9 w-52"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={faiProvaCreazione}
                  disabled={bloccato || cifreProva.length < 8}
                >
                  {occupato === "creazione" ? "Creo…" : "Prova creazione contatto"}
                </Button>
              </div>
              {creazione && (
                <p
                  role="status"
                  className={cn(
                    "rounded-md border px-3 py-2 text-[13px] leading-snug",
                    creazione.esito === "ok" ? TONI.verde : TONI.rosso,
                  )}
                >
                  <span className="mr-2 font-semibold uppercase tracking-wide text-[11px]">
                    {creazione.esito === "ok"
                      ? "Ok"
                      : creazione.esito === "negata"
                        ? "Negata"
                        : "Errore"}
                  </span>
                  {creazione.messaggio}
                </p>
              )}
            </Sezione>

            {config.ultimaAccensione && (
              <p className="text-[12px] text-muted-foreground">
                Ultima accensione: {quandoBreve(config.ultimaAccensione)}
                {config.primaAccensione
                  ? ` · prima accensione: ${giornoBreve(config.primaAccensione)}`
                  : ""}
              </p>
            )}
          </>
        )}
      </CardContent>

      <Finestra
        aperta={!!conferma}
        onCambio={(v) => !v && setConferma(null)}
        titolo={conferma?.titolo ?? ""}
        larghezza="sm"
        bloccante
        azioni={
          <>
            <Button variant="outline" onClick={() => setConferma(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                const azione = conferma?.azione;
                setConferma(null);
                azione?.();
              }}
            >
              {conferma?.etichetta ?? "Conferma"}
            </Button>
          </>
        }
      >
        <div className="text-[13px] leading-snug text-slate-700">{conferma?.testo}</div>
      </Finestra>
    </Card>
  );
}
