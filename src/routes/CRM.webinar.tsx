/** ── WEBINAR — LA POSTAZIONE DI CHI PRESENTA ────────────────────────────────
 *
 *  Da qui si crea una sala, si copia il link da mandare agli iscritti e si va
 *  in onda. È un pulsante SEPARATO da quello della videoconsulenza, e la
 *  separazione è il punto: le consulenze continuano a passare da Meetly
 *  esattamente come prima, senza che una riga di quel codice sia stata toccata.
 *
 *  ── L'INTERRUTTORE ────────────────────────────────────────────────────────
 *  Se nelle impostazioni il trasporto è «Meetly», questa pagina non apre
 *  nessuna sala nuova: crea una normale stanza di consulenza e ci manda dentro.
 *  Regge poche persone — è la mesh, ognuno con ognuno — ma è la tecnologia già
 *  collaudata, e ci si torna con un clic senza dover pubblicare niente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart3, BellRing, Circle, Copy, Download, Link2, Loader2, Plus, Radio, Sliders, Square, Trash2, TriangleAlert, Users, Video } from "lucide-react";
import { Pagina, Scheda, Titolo } from "@/crm/ui";
import { Button } from "@/components/ui/button";
import { intestazioniCRM } from "@/crm/AuthContext";
import { aggiungiTracce, vaiInOnda, type Onda } from "@/webinar/sfu";
import { ComAndata } from "@/webinar/ComAndata";
import { archivia, avviaRegistrazione, type Registrazione } from "@/webinar/registrazione";
import { percorsoWebinar, type StanzaWebinar, type TrasportoWebinar } from "@/webinar/tipi";
import { Regia } from "@/webinar/Regia";
import { depositaAnteprimaWebinar } from "@/webinar/anteprima-link";
import { VERSIONE_SCHEDA } from "@/prova/versione-scheda";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";

export const Route = createFileRoute("/CRM/webinar")({
  head: () => ({ meta: [{ title: "Webinar — Hair Genius Labs" }] }),
  component: PaginaWebinar,
});

type StanzaConLink = StanzaWebinar & { link: string; iscritti?: number };

async function chiedi(corpo: unknown) {
  const r = await fetch("/api/crm/webinar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(j?.error || `errore ${r.status}`));
  return j;
}

function PaginaWebinar() {
  const auth = useAuth();
  const { consultants } = useCRM();
  //  Il nome con cui i messaggi del presentatore compaiono in chat. È quello
  //  della persona che sta lavorando, non un'etichetta fissa: in sala c'è
  //  scritto chi ti sta parlando.
  //  Chi è entrato col PIN ha un nome; chi è entrato con email e password no,
  //  e allora firma col nome dello studio — che è comunque meglio di una
  //  parola vuota o di «Presentatore».
  const nomePresentatore = auth.consulente?.nome?.trim() || "Hair Genius Labs";
  //  Quale sala si sta seguendo dalla regia. Mentre si è in onda è per forza
  //  quella in onda; a diretta ferma la si sceglie, perché la gente arriva in
  //  anticipo e scrive prima che tu abbia acceso la camera.
  const [inRegia, setInRegia] = useState<StanzaConLink | null>(null);
  /** Quale sala si sta guardando «com'è andata». Una alla volta: due pannelli
   *  aperti insieme fanno confrontare a occhio due curve che non si vedono
   *  nemmeno per intero. */
  const [misurata, setMisurata] = useState("");
  /** Quale sala sta mandando i promemoria adesso. Uno alla volta: due invii
   *  insieme allo stesso elenco vorrebbero dire due messaggi alla stessa
   *  persona. */
  const [avviso, setAvviso] = useState("");
  /** I template approvati su Meta, per scegliere con quale parte il
   *  promemoria. Si chiedono una volta sola: sono un elenco che cambia una
   *  volta al mese, non ogni volta che si apre la pagina.
   *  ⚠️ Se la chiamata fallisce l'elenco resta vuoto e NON si dice niente:
   *   qui si viene per fare una diretta, e un allarme rosso su una cosa che si
   *   configura una volta l'anno fa solo perdere il filo. Il momento in cui
   *   serve saperlo è quando un invio viene rifiutato — e lì lo si dice. */
  const [modelli, setModelli] = useState<Array<{ name: string; status: string }>>([]);
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/whatsapp-templates", { headers: await intestazioniCRM() });
        const j = await r.json();
        //  Solo gli APPROVATI: proporre un template in attesa vuol dire un
        //  invio che fallisce tutto insieme, la sera della diretta.
        setModelli((j?.templates ?? []).filter((m: { status?: string }) => m.status === "APPROVED"));
      } catch { /* si resta col messaggio scritto a mano */ }
    })();
  }, []);

  /** ⚠️ Si dice QUANTI sono partiti, non «fatto». Su duecento numeri qualcuno
   *  fallisce sempre — chi ha cambiato numero, chi ha bloccato — e sapere che
   *  ne sono partiti 187 su 190 è un'informazione; «fatto» non lo è. */
  /** ⚠️ Si aggiorna anche l'elenco in pagina, non solo il server: senza, la
   *  tendina tornerebbe a quella di prima al primo ricaricamento dei dati e
   *  sembrerebbe che la scelta non si salvi. */
  const salvaModello = async (s: { codice: string }, template: string) => {
    setStanze((v) => v.map((x) => (x.codice === s.codice ? { ...x, templatePromemoria: template } : x)));
    try {
      await chiedi({ azione: "template-promemoria", codice: s.codice, template });
    } catch (e) {
      toast.error(`Non sono riuscito a salvarlo: ${String((e as Error).message || e)}`);
    }
  };

  const avvisa = async (s: { codice: string; titolo: string }) => {
    setAvviso(s.codice);
    try {
      const r = await fetch("/api/crm/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({ azione: "promemoria", codice: s.codice, tipo: "manca-poco" }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "no");
      const fuori = Number(j.fuoriFinestra || 0);
      const guai = [
        j.falliti ? `${j.falliti} non sono partiti` : "",
        //  ⚠️ Questo si dice per esteso perché ha una cura sola e precisa. Chi
        //   legge «3 non sono partiti» riprova; chi legge questo va a mettere
        //   il template, che è l'unica cosa che lo risolve.
        fuori ? `${fuori} rifiutati da Meta: senza un template approvato si può scrivere solo a chi ti ha scritto nelle ultime 24 ore` : "",
      ].filter(Boolean).join(" — ");
      if (j.mandati) toast.success(`Promemoria partito a ${j.mandati} iscritti${guai ? ` — ${guai}` : ""}`);
      else if (guai) toast.error(`Non è partito niente: ${guai}`);
      else toast.info("Nessuno da avvisare: o non ci sono iscritti, o li hai già avvisati da poco");
    } catch (e) {
      toast.error(`Non sono riuscito a mandarli: ${String((e as Error).message || e)}`);
    } finally {
      setAvviso("");
    }
  };
  const [trasporto, setTrasporto] = useState<TrasportoWebinar>("meetly");
  const [pronto, setPronto] = useState(false);
  const [simulcast, setSimulcast] = useState(true);
  const [stanze, setStanze] = useState<StanzaConLink[]>([]);
  const [titolo, setTitolo] = useState("");
  /** Quando comincia. Vuoto = si parte quando si parte, e la sala d'attesa
   *  resta quella semplice. */
  const [quando, setQuando] = useState("");
  //  Chi potrà condurla. Vuoto = tutti, ed è il caso normale: si sceglie
  //  quando la diretta è di qualcuno in particolare.
  const [chiConduce, setChiConduce] = useState<string[]>([]);
  const [caricando, setCaricando] = useState(true);

  const [onda, setOnda] = useState<Onda | null>(null);
  const [inCorso, setInCorso] = useState<StanzaConLink | null>(null);
  const [collegando, setCollegando] = useState(false);
  const anteprima = useRef<HTMLVideoElement | null>(null);
  //  Le tracce restano nostre, non della funzione di trasporto: chiudere la
  //  diretta non deve spegnere la webcam di chi sta per ricominciare.
  const media = useRef<MediaStream | null>(null);

  // ── LA REGISTRAZIONE ────────────────────────────────────────────────
  const [registro, setRegistro] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [durata, setDurata] = useState(0);
  const registrazione = useRef<Registrazione | null>(null);
  const [archivio, setArchivio] = useState<{ id: string; titolo: string; secondi: number; peso: number; quando: string; url: string | null }[]>([]);

  // ── IL PALCO, DAL LATO DI CHI CONDUCE ───────────────────────────────
  //  ⚠️ Senza questo il presentatore è l'unico in tutta la sala a NON sentire
  //   la persona a cui ha appena dato la parola. Era il difetto della prima
  //   versione: la sua connessione era di sola andata.
  const flussiPalco = useRef<Map<string, MediaStream>>(new Map());
  const nomiPalco = useRef<Map<string, string>>(new Map());
  const agganciate = useRef<Set<string>>(new Set());
  const suonoPalco = useRef<HTMLAudioElement | null>(null);

  const ricarica = useCallback(async () => {
    try {
      const h = await intestazioniCRM();
      const [c, e] = await Promise.all([
        fetch("/api/crm/webinar?azione=config", { headers: h }).then((r) => r.json()),
        fetch("/api/crm/webinar?azione=elenco", { headers: h }).then((r) => r.json()),
      ]);
      setTrasporto(c?.trasporto === "sfu" ? "sfu" : "meetly");
      setPronto(!!c?.pronto);
      setSimulcast(c?.simulcast !== false);
      setStanze(Array.isArray(e?.stanze) ? e.stanze : []);
    } catch {
      toast.error("Non riesco a leggere le impostazioni del webinar");
    } finally {
      setCaricando(false);
    }
  }, []);

  useEffect(() => { void ricarica(); }, [ricarica]);

  /** ── ⚠️ LE SCHEDE DEI LINK SI DEPOSITANO DA SOLE ────────────────────────
   *  Prima l'immagine nasceva solo copiando il link. Ma il link parte anche da
   *  altre strade — i promemoria automatici agli iscritti, un indirizzo
   *  incollato a mano, una sala creata mesi fa — e in tutti quei casi nella
   *  chat compariva la scheda GENERICA dello studio: quella della
   *  videoconsulenza, che con un webinar non c'entra niente. È esattamente
   *  quello che si vedeva sul debugger di Facebook.
   *  Qui, aperto l'elenco, si guarda quali sale non hanno ancora la loro
   *  immagine e si disegnano. ⚠️ Solo quelle che mancano: ridisegnarle tutte a
   *  ogni apertura vorrebbe dire caricare un file da cento kilobyte per sala.
   *  ⚠️ E in fila, non tutte insieme: sono disegni su tela, e dieci in
   *   parallelo bloccherebbero la pagina di chi sta lavorando.
   */
  useEffect(() => {
    if (!stanze.length) return;
    let fermo = false;
    void (async () => {
      //  Se il disegno è cambiato, si rifanno tutte una volta sola: l'immagine
      //  depositata è un file, e senza questo resterebbe per sempre quella
      //  vecchia (vedi prova/versione-scheda).
      let vista = "";
      try { vista = localStorage.getItem("hg_scheda_webinar_v") || ""; } catch { /* pazienza */ }
      const daRifare = vista !== String(VERSIONE_SCHEDA);
      //  ⚠️ Un tetto: chi ha cento sale in archivio non deve aspettare cento
      //   disegni per vedere la pagina. Le più recenti stanno in cima.
      for (const s of stanze.slice(0, 12)) {
        if (fermo) return;
        if (!daRifare) {
          try {
            const r = await fetch(`/api/anteprima?tipo=webinar&codice=${encodeURIComponent(s.codice)}`);
            const j = await r.json().catch(() => null);
            if (j?.ok && j?.url) continue;
          } catch { /* nel dubbio si disegna */ }
        }
        await depositaAnteprimaWebinar({
          codice: s.codice, titolo: s.titolo, inizioPrevisto: s.inizioPrevisto,
        });
      }
      if (!fermo && daRifare) {
        try { localStorage.setItem("hg_scheda_webinar_v", String(VERSIONE_SCHEDA)); } catch { /* pazienza */ }
      }
    })();
    return () => { fermo = true; };
  }, [stanze]);

  //  Chiudendo la scheda mentre si è in onda, la stanza resterebbe «viva» per
  //  il tempo di tre battiti. Avvisare subito costa una riga e toglie a chi
  //  guarda tre quarti di minuto di schermo fermo.
  useEffect(() => {
    if (!onda) return;
    const addio = () => { void onda.chiudi(); };
    window.addEventListener("pagehide", addio);
    return () => window.removeEventListener("pagehide", addio);
  }, [onda]);

  //  Ogni volta che il palco cambia, si agganciano le tracce nuove SENZA
  //  rifare la connessione: rifarla vorrebbe dire due secondi di schermo nero
  //  per tutta la sala ogni volta che qualcuno prende la parola.
  const agganciaPalco = useCallback(async (palco: { spettatore: string; nome: string; sessionId?: string; tracciaAudio?: string; tracciaVideo?: string }[]) => {
    const o = onda;
    if (!o || !inCorso) return;
    const nuove: { sessionId: string; trackName: string }[] = [];
    for (const p of palco) {
      nomiPalco.current.set(p.spettatore, p.nome);
      if (!p.sessionId) continue;
      for (const t of [p.tracciaAudio, p.tracciaVideo]) {
        if (!t) continue;
        const k = `${p.sessionId}/${t}`;
        if (agganciate.current.has(k)) continue;
        agganciate.current.add(k);
        nuove.push({ sessionId: p.sessionId, trackName: t });
      }
    }
    if (!nuove.length) return;
    try {
      await aggiungiTracce(inCorso.codice, o.sessionId, o.pc, nuove, o.registra);
    } catch (e) {
      //  Si dimentica, così al giro dopo ci si riprova invece di restare per
      //  sempre senza sentire chi ha preso la parola.
      nuove.forEach((n) => agganciate.current.delete(`${n.sessionId}/${n.trackName}`));
      console.error("[WEBINAR] non aggancio chi è salito:", e);
    }
  }, [onda, inCorso]);

  // ── REGISTRARE ──────────────────────────────────────────────────────
  const avvia = () => {
    if (registrazione.current || !media.current) return;
    registrazione.current = avviaRegistrazione(
      //  La scena si rilegge a ogni fotogramma: chi è sul palco cambia durante
      //  la diretta, e una scena decisa all'avvio registrerebbe per un'ora una
      //  sala che nel frattempo si è riempita di gente.
      () => ({
        principale: media.current,
        riquadri: Array.from(flussiPalco.current.entries()).map(([id, stream]) => ({
          nome: nomiPalco.current.get(id) || "Ospite",
          stream,
        })),
      }),
      { microfono: media.current },
    );
    setRegistro(true);
    void chiedi({ azione: "registrando", codice: inCorso?.codice, acceso: true }).catch(() => { /* è solo un avviso */ });
  };

  const fermaRegistrazione = async () => {
    const r = registrazione.current;
    if (!r) return;
    registrazione.current = null;
    setRegistro(false);
    setSalvo(true);
    void chiedi({ azione: "registrando", codice: inCorso?.codice, acceso: false }).catch(() => { /* */ });
    try {
      const file = await r.ferma();
      if (!file) { toast.error("Non è stato registrato niente"); return; }
      const esito = await archivia(
        file,
        { codice: inCorso?.codice || "", titolo: inCorso?.titolo || "Webinar", secondi: r.secondi() },
        await intestazioniCRM(),
      );
      if (esito.ok) { toast.success("Registrazione salvata in archivio"); void caricaArchivio(); }
      else toast.error(esito.motivo || "Non sono riuscito a salvarla");
    } finally {
      setSalvo(false);
      setDurata(0);
    }
  };

  const caricaArchivio = useCallback(async () => {
    try {
      const r = await fetch("/api/crm/webinar-registrazioni", { headers: await intestazioniCRM() });
      const j = await r.json();
      setArchivio(Array.isArray(j?.registrazioni) ? j.registrazioni : []);
    } catch { /* si riproverà */ }
  }, []);

  useEffect(() => { void caricaArchivio(); }, [caricaArchivio]);

  //  Il cronometro della registrazione. Un secondo esatto: è un numero che si
  //  guarda di sfuggita mentre si parla, e deve essere leggibile, non preciso.
  useEffect(() => {
    if (!registro) return;
    const t = setInterval(() => setDurata(registrazione.current?.secondi() ?? 0), 1000);
    return () => clearInterval(t);
  }, [registro]);

  //  ⚠️ Chiudere la scheda mentre si registra butta via il file: sta tutto in
  //   memoria fino a quando non lo si ferma. Il browser non lascia scrivere un
  //   messaggio nostro, ma la domanda la fa.
  useEffect(() => {
    if (!registro) return;
    const chiedo = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", chiedo);
    return () => window.removeEventListener("beforeunload", chiedo);
  }, [registro]);

  const crea = async () => {
    try {
      const j = await chiedi({
        azione: "crea",
        titolo: titolo.trim(),
        presentatori: chiConduce,
        //  ⚠️ Si manda la data COMPLETA DI FUSO. Un `datetime-local` dà
        //   «2026-09-10T21:00» senza fuso: interpretata dal server, quella
        //   stringa diventa un'ora UTC — cioè due ore prima, e il conto alla
        //   rovescia della sala direbbe due ore in meno a tutti. Passando da
        //   `new Date()` la si àncora al fuso di chi la sta scrivendo.
        inizioPrevisto: quando ? new Date(quando).toISOString() : "",
      });
      setTitolo("");
      setQuando("");
      setChiConduce([]);
      toast.success(
        quando
          ? "Sala creata: il link mostra il conto alla rovescia"
          : "Sala creata: il link è pronto da mandare",
      );
      /** ── ⚠️ L'ANTEPRIMA SI DISEGNA SUBITO, NON SOLO ALLA COPIA ──────────
       *  Il link non parte sempre da qui: i promemoria automatici agli
       *  iscritti lo mandano da soli, e se l'immagine non fosse ancora stata
       *  depositata quei messaggi — che sono i più numerosi — mostrerebbero il
       *  riquadro generico. Disegnarla alla nascita costa un decimo di secondo
       *  e copre anche quel caso; copiando il link si ridisegna aggiornata. */
      const nata = (j as { stanza?: { codice?: string } } | null)?.stanza;
      if (nata?.codice) {
        void depositaAnteprimaWebinar({
          codice: nata.codice,
          titolo: titolo.trim(),
          inizioPrevisto: quando ? new Date(quando).toISOString() : "",
        });
      }
      void ricarica();
      return j;
    } catch (e) {
      toast.error(String((e as Error).message || e));
    }
  };

  /** ── ⚠️ IL LINK SI COPIA CON LA SUA FACCIA GIÀ PRONTA ──────────────────
   *  L'anteprima si disegna QUI, nel momento in cui il link sta per partire, e
   *  non quando la sala nasce: il titolo si corregge, l'orario si sposta, e
   *  un'immagine disegnata una volta sola resterebbe quella di prima. Copiare
   *  è il gesto che precede sempre l'invio — quindi è il momento giusto.
   *  ⚠️ Prima si copia, poi si disegna: il permesso di scrivere negli appunti
   *   scade se lo si fa aspettare, e un link non copiato è molto peggio di
   *   un'anteprima vecchia.
   *  ⚠️ E se il disegno non riesce non si dice niente di allarmante: il link
   *   funziona lo stesso, cambia solo il riquadro che si vede nella chat. */
  const copia = async (link: string, s?: { codice: string; titolo: string; inizioPrevisto?: string }) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiato");
    } catch {
      toast.error("Il browser non mi lascia copiare: seleziona il link a mano");
    }
    if (!s?.codice) return;
    void depositaAnteprimaWebinar({
      codice: s.codice, titolo: s.titolo, inizioPrevisto: s.inizioPrevisto,
    });
  };

  const parti = async (s: StanzaConLink) => {
    setCollegando(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      media.current = stream;
      if (anteprima.current) {
        anteprima.current.srcObject = stream;
        //  Muto per forza: è la PROPRIA voce che torna dagli altoparlanti, cioè
        //  il larsen. Non è una preferenza, è l'unico modo di ascoltarsi senza
        //  fischiare.
        anteprima.current.muted = true;
        void anteprima.current.play().catch(() => { /* partirà da sola */ });
      }
      const o = await vaiInOnda(s.codice, stream, {
        simulcast,
        intestazioni: await intestazioniCRM(),
        instrada: (nomeTraccia, traccia) => {
          const m = /^([av])-(.+)$/.exec(nomeTraccia);
          if (!m) return;
          const chi = m[2];
          let f = flussiPalco.current.get(chi);
          if (!f) { f = new MediaStream(); flussiPalco.current.set(chi, f); }
          f.addTrack(traccia);
          //  Le voci del palco vanno fatte SUONARE: senza un elemento che le
          //  riproduca arrivano e non le sente nessuno, presentatore compreso.
          //  Un elemento solo per tutte, con un flusso che le raccoglie.
          if (suonoPalco.current) {
            const insieme = (suonoPalco.current.srcObject as MediaStream | null) ?? new MediaStream();
            if (traccia.kind === "audio") insieme.addTrack(traccia);
            suonoPalco.current.srcObject = insieme;
            void suonoPalco.current.play().catch(() => { /* partirà da sé */ });
          }
        },
      });
      setOnda(o);
      setInCorso(s);
      toast.success("Sei in onda");
    } catch (e) {
      media.current?.getTracks().forEach((t) => t.stop());
      media.current = null;
      toast.error(String((e as Error).message || e));
    } finally {
      setCollegando(false);
    }
  };

  const ferma = async () => {
    //  Prima si chiude la registrazione, poi la diretta: al contrario, gli
    //  ultimi secondi verrebbero registrati su un video già staccato.
    if (registrazione.current) await fermaRegistrazione();
    await onda?.chiudi();
    flussiPalco.current.clear();
    agganciate.current.clear();
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    setOnda(null);
    setInCorso(null);
    void ricarica();
    toast.success("Diretta terminata");
  };

  const elimina = async (s: StanzaConLink) => {
    try {
      await chiedi({ azione: "elimina", codice: s.codice });
      void ricarica();
    } catch (e) {
      toast.error(String((e as Error).message || e));
    }
  };

  return (
    <Pagina>
      <Titolo
        testo="Webinar"
        icona={Radio}
        nota="Una sala per tante persone. La videoconsulenza a due resta dov'era, su Meetly."
      />

      {/* ── LO STATO DEL TRASPORTO ─────────────────────────────────────── */}
      {!caricando && trasporto === "sfu" && !pronto && (
        <Scheda titolo="Manca la configurazione Cloudflare" icona={TriangleAlert}>
          <p className="t-corpo text-muted-foreground">
            Il trasporto è impostato su <b>Cloudflare Realtime</b>, ma le credenziali non ci sono:
            senza, andare in onda non è possibile. Le imposti in{" "}
            <b>Impostazioni → Webinar</b>. In alternativa, sempre da lì, puoi rimettere il
            trasporto su <b>Meetly</b> e usare la tecnologia di sempre.
          </p>
        </Scheda>
      )}

      {!caricando && trasporto === "meetly" && (
        <Scheda titolo="Stai usando la tecnologia di Meetly" icona={Video}>
          <p className="t-corpo text-muted-foreground">
            Ogni partecipante si collega a tutti gli altri, come nelle consulenze. È la strada
            collaudata, ma regge <b>poche persone</b>: oltre le sei o sette, chi parla deve caricare
            un video per ciascuno e il computer non ce la fa. Per una sala vera passa a{" "}
            <b>Cloudflare Realtime</b> in <b>Impostazioni → Webinar</b>.
          </p>
        </Scheda>
      )}

      {/* ── IN ONDA ────────────────────────────────────────────────────── */}
      {onda && inCorso && (
        <Scheda
          titolo={`In onda · ${inCorso.titolo}`}
          icona={Radio}
          azioni={
            <div className="flex flex-wrap gap-2">
              {registro ? (
                <Button variant="outline" onClick={() => void fermaRegistrazione()} disabled={salvo}>
                  <Square className="h-4 w-4 text-rose-500" /> Ferma la registrazione ({Math.floor(durata / 60)}:{String(durata % 60).padStart(2, "0")})
                </Button>
              ) : (
                <Button variant="outline" onClick={avvia} disabled={salvo}>
                  {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4 fill-rose-500 text-rose-500" />}
                  {salvo ? "Sto salvando…" : "Registra"}
                </Button>
              )}
              <Button variant="destructive" onClick={() => void ferma()}>
                <Square className="h-4 w-4" /> Termina
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
            <video ref={anteprima} playsInline autoPlay muted className="aspect-video w-full rounded-lg bg-black" />
            {/*  ⚠️ Le voci di chi è salito devono uscire da QUALCOSA. Senza
                questo elemento arrivano al presentatore e non le sente
                nessuno: è il difetto che si scopre solo dando la parola a
                qualcuno in diretta, davanti a tutti. */}
            <audio ref={suonoPalco} autoPlay className="hidden" />
            <div className="space-y-2">
              <p className="t-corpo text-muted-foreground">
                Stai caricando <b>un solo</b> flusso: quante persone guardano non cambia niente per
                il tuo computer né per la tua linea.
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="t-nota min-w-0 flex-1 truncate">{inCorso.link}</span>
                <Button size="sm" variant="outline" onClick={() => void copia(inCorso.link, inCorso)}>
                  <Copy className="h-3.5 w-3.5" /> Copia
                </Button>
              </div>
              {registro && (
                <p className="t-nota flex items-center gap-1.5 text-rose-600">
                  <Circle className="h-3 w-3 animate-pulse fill-rose-600 text-rose-600" />
                  Stai registrando — in sala c&apos;è scritto, e non chiudere questa scheda finché
                  non hai fermato: il file sta qui dentro finché non lo salvi.
                </p>
              )}
              {simulcast && (
                <p className="t-etichetta text-muted-foreground">
                  Tre qualità in parallelo: chi ha la linea scarsa scende da solo invece di perdere
                  la diretta.
                </p>
              )}
            </div>
          </div>
        </Scheda>
      )}

      {/* ── NUOVA SALA ─────────────────────────────────────────────────── */}
      {!onda && (
        <Scheda titolo="Nuovo webinar" icona={Plus}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void crea()}
              placeholder="Come si chiama? (es. Invisible Derm Protocol — sessione di aprile)"
              className="t-corpo min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary"
            />
            {/* ── ⚠️ QUANDO COMINCIA ─────────────────────────────────────
                  Non è un promemoria per te: è quello che chi riceve il link
                  vede PRIMA che tu vada in onda. Senza, chi apre in anticipo
                  trova una schermata che dice «non è ancora cominciato» e non
                  sa se mancano dieci minuti o tre giorni — e chiude.
                 ⚠️ Si può lasciare vuoto: una sala aperta per partire subito
                  non ha un orario da mostrare, e inventarlo sarebbe peggio. */}
            <input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              title="Quando comincia: chi apre il link prima vede il conto alla rovescia"
              className="t-corpo shrink-0 rounded-lg border bg-background px-3 py-2 tabular-nums outline-none focus:border-primary"
            />
            <Button onClick={() => void crea()}>
              <Plus className="h-4 w-4" /> Crea la sala
            </Button>
          </div>

          {/* ── ⚠️ CHI LA CONDUCE ────────────────────────────────────────
              Nessuno selezionato vuol dire TUTTI, non «nessuno»: è il caso
              normale, e le sale create prima che questa scelta esistesse non
              devono sparire dalla postazione di chi le conduceva da sempre.
              Selezionandone qualcuno, invece, la sala compare SOLO nella loro
              postazione — e chi non è dentro non la vede nemmeno. È così che
              si fa una diretta a due voci: si scelgono le due voci, e il link
              per entrare se lo trovano loro. */}
          {consultants.length > 1 && (
            <div className="mt-3 border-t pt-3">
              <p className="t-nota mb-2 text-muted-foreground">
                <Users className="mr-1 inline h-3.5 w-3.5" />
                Chi la conduce — {chiConduce.length === 0
                  ? "nessuno scelto: la vedono tutti i consulenti"
                  : `in ${chiConduce.length}, e la vedono solo loro`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {consultants.map((c) => {
                  const dentro = chiConduce.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setChiConduce((v) => (dentro ? v.filter((x) => x !== c.id) : [...v, c.id]))
                      }
                      className={`rounded-full border px-3 py-1 text-[12px] transition ${
                        dentro ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {c.data.nome || "senza nome"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Scheda>
      )}

      {/* ── LE SALE ────────────────────────────────────────────────────── */}
      <Scheda titolo="Le tue sale" icona={Radio} classeCorpo="p-0">
        {caricando ? (
          <div className="flex items-center gap-2 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> <span className="t-corpo">Carico…</span>
          </div>
        ) : stanze.length === 0 ? (
          <p className="t-corpo p-4 text-muted-foreground">
            Nessuna sala. Creane una qui sopra: ottieni un link da mandare agli iscritti, e ci vai
            in onda quando vuoi.
          </p>
        ) : (
          <ul className="divide-y">
            {stanze.map((s) => (
              <li key={s.codice} className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="t-riga truncate font-medium">{s.titolo}</p>
                  <p className="t-nota truncate text-muted-foreground">{s.link}</p>
                  {/*  ⚠️ Il numero si mostra solo se c'è. Uno «0 iscritti»
                       stampato sotto ogni sala appena creata è una bocciatura
                       gratuita: la sala è nuova, non è andata male. */}
                  {!!s.iscritti && (
                    <p className="t-nota text-muted-foreground">
                      {s.iscritti} {s.iscritti === 1 ? "iscritto" : "iscritti"}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => void copia(s.link, s)}>
                  <Copy className="h-3.5 w-3.5" /> Link
                </Button>
                {trasporto === "sfu" ? (
                  /*  ⚠️ Si apre la REGIA, una schermata a sé: è lì che si
                      conduce. Da qui si amministrano le sale, non si va in
                      onda — e mescolare le due cose voleva dire una pagina del
                      gestionale che tiene aperta una videocamera. */
                  <Button size="sm" disabled={!pronto} asChild>
                    <a href={`/regia/${encodeURIComponent(s.codice)}`} target="_blank" rel="noreferrer">
                      <Radio className="h-3.5 w-3.5" /> Apri la regia
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" asChild>
                    <a href={percorsoWebinar(s.codice)} target="_blank" rel="noreferrer">
                      <Video className="h-3.5 w-3.5" /> Apri
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={inRegia?.codice === s.codice ? "default" : "outline"}
                  onClick={() => setInRegia((v) => (v?.codice === s.codice ? null : s))}
                >
                  <Sliders className="h-3.5 w-3.5" /> Regia
                </Button>
                {/* ── ⚠️ «COM'È ANDATA» STA QUI, ACCANTO ALLA SALA ─────────
                      Non in una pagina di statistiche a parte: una schermata di
                      numeri che vive per conto suo la si apre due volte e poi
                      mai più. Qui invece la si incontra ogni volta che si torna
                      per fare la diretta dopo — che è l'unico momento in cui
                      quei numeri possono cambiare qualcosa. */}
                {/* ── ⚠️ AVVISA GLI ISCRITTI, A MANO ────────────────────────
                      «Siamo in diretta» parte da solo quando vai in onda: è il
                      messaggio che porta più gente e non può dipendere da un
                      tasto premuto di corsa. Questo serve per l'altro momento —
                      un'ora prima — che senza un pianificatore non può partire
                      da sé.
                     ⚠️ Chi ha già ricevuto un messaggio da meno di venti minuti
                      viene saltato: due promemoria di fila sono il modo più
                      veloce di farsi bloccare il numero, e su WhatsApp un
                      blocco non si toglie. */}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={avviso === s.codice || !s.iscritti}
                  onClick={() => void avvisa(s)}
                >
                  {avviso === s.codice
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <BellRing className="h-3.5 w-3.5" />}
                  Avvisa gli iscritti
                </Button>
                <Button
                  size="sm"
                  variant={misurata === s.codice ? "default" : "outline"}
                  onClick={() => setMisurata((v) => (v === s.codice ? "" : s.codice))}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Com'è andata
                </Button>
                {/* ── ⚠️ CON QUALE TEMPLATE ────────────────────────────────
                      Compare solo se c'è qualcuno da avvisare e se lo studio ha
                      davvero dei template approvati: un menu a tendina vuoto,
                      su ogni sala, sarebbe una domanda senza risposte possibili
                      messa in mezzo alla strada.
                     ⚠️ Sta sulla SALA e non nelle impostazioni generali perché
                      un webinar di formazione e uno di vendita non si annunciano
                      con lo stesso messaggio, e Meta approva un testo per
                      volta. */}
                {!!s.iscritti && modelli.length > 0 && (
                  <label className="t-nota flex basis-full items-center gap-2 text-muted-foreground">
                    Promemoria con
                    <select
                      className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-foreground"
                      value={s.templatePromemoria || ""}
                      onChange={(e) => void salvaModello(s, e.target.value)}
                    >
                      <option value="">Messaggio scritto a mano (solo a chi ti ha scritto da meno di 24h)</option>
                      {modelli.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <Button size="sm" variant="ghost" onClick={() => void elimina(s)} aria-label="Elimina la sala">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
                {misurata === s.codice && (
                  <div className="w-full border-t pt-1">
                    <ComAndata codice={s.codice} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Scheda>

      {/* ── L'ARCHIVIO ─────────────────────────────────────────────────
          ⚠️ I collegamenti scadono dopo un'ora e si riconiano ogni volta che
           si apre questa pagina: le registrazioni stanno in un archivio
           PRIVATO, perché dentro ci sono decine di persone che hanno detto il
           proprio nome e raccontato in diretta un problema che riguarda il
           loro corpo. Un indirizzo permanente sarebbe tutta quella gente lì. */}
      {archivio.length > 0 && (
        <Scheda titolo="Registrazioni" icona={Circle} classeCorpo="p-0">
          <ul className="divide-y">
            {archivio.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="t-riga truncate font-medium">{r.titolo}</p>
                  <p className="t-nota text-muted-foreground">
                    {new Date(r.quando).toLocaleString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{Math.floor(r.secondi / 60)} min
                    {" · "}{Math.round(r.peso / (1024 * 1024))} MB
                  </p>
                </div>
                {r.url ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> Apri</a>
                  </Button>
                ) : (
                  <span className="t-nota text-muted-foreground">collegamento non disponibile</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await fetch("/api/crm/webinar-registrazioni", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
                      body: JSON.stringify({ azione: "elimina", id: r.id }),
                    });
                    void caricaArchivio();
                  }}
                  aria-label="Elimina la registrazione"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </Scheda>
      )}

      {/* ── LA REGIA ────────────────────────────────────────────────────
          Compare per la sala in onda, oppure per quella scelta dall'elenco.
          Non è dentro il riquadro «In onda» di proposito: serve anche PRIMA
          di andare in onda, perché i primi arrivati scrivono in sala d'attesa
          e lasciarli senza risposta è il momento in cui se ne vanno. */}
      {(inCorso || inRegia) && (
        <Scheda
          titolo={`Regia · ${(inCorso || inRegia)!.titolo}`}
          icona={Sliders}
          nota="Quante persone ci sono davvero, chi chiede la parola, cosa si scrivono."
        >
          <Regia
            codice={(inCorso || inRegia)!.codice}
            nomePresentatore={nomePresentatore}
            inOnda={!!onda}
            chiedi={chiedi}
            onPalco={agganciaPalco}
          />
        </Scheda>
      )}
    </Pagina>
  );
}
