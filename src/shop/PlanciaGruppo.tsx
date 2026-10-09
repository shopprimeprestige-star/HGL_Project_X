/** ── IL PANNELLO «COSA VEDE IL CLIENTE» ────────────────────────────────────
 *
 *  Segnalazione del committente, davanti al pannello: «questa funzione non va
 *  bene… analizza bene tutte le sue funzioni così le ottimizziamo». Aveva
 *  ragione, e riletto tutto il difetto era nel modo di dire le cose, non nelle
 *  regole:
 *
 *   · DUE INTERRUTTORI CHE SEMBRAVANO SIMMETRICI E NON LO ERANO. «Lo vede lui»
 *     faceva una cosa sola; «Lo vedo io» ne faceva tre (apriva la sua stanza,
 *     entrava in preparazione privata, e in un caso portava tutti sul
 *     preventivo) e spegnendolo non rimetteva niente a posto.
 *   · TRE RIGHE PER DIRE UNA COSA SOLA: i due interruttori spenti, più una
 *     frase sotto che ripeteva «vede quello che gli stai mostrando».
 *   · LA DOMANDA VERA NON AVEVA RISPOSTA: quanto fa il suo preventivo, e se
 *     l'ha toccato. Per saperlo bisognava aprirlo, cioè smettere di fare
 *     quello che si stava facendo.
 *   · «Mostralo a tutti» con una persona sola: «tutti» è lui, e l'etichetta
 *     non diceva la cosa vera (quel preventivo diventa quello della
 *     consulenza, e da lì è solo da guardare).
 *
 *  ── COM'È FATTO ADESSO ───────────────────────────────────────────────────
 *  Una riga per persona, e su ogni riga:
 *   1. UN SELETTORE A TRE STATI, che risponde alla sola domanda che conta —
 *      che cosa ha davanti LUI: «Segue me», «Il suo», «Solo io»
 *      (vedi `statoDiQuestaPersona`, dove ci sono anche i tre passaggi);
 *   2. il RIASSUNTO del suo preventivo: quanto fa, quante voci, da quanto non
 *      si muove (`riassuntoInParole`);
 *   3. quello che riguarda il MIO schermo — aprire la sua stanza da me — che è
 *      un'altra domanda e sta su un'altra riga, piccola;
 *   4. l'avviso quando c'è qualcosa che non torna (non è entrato, oppure il
 *      suo schermo non conferma), con il rimedio accanto.
 *
 *  ⚠️ IL SELETTORE PARLA DEL SUO SCHERMO, NON DEL MIO. È la regola che tiene
 *   in piedi tutto il pannello: se si rimescolano le due cose si ricade negli
 *   interruttori di prima, e uno stato impossibile (acceso per lui MENTRE lo
 *   preparo di nascosto) torna a essere raggiungibile.
 *  ⚠️ IL PREVENTIVO COMUNE RESTA, ma solo dove vuol dire qualcosa: in due o
 *   più. Con una persona sola quell'interruttore non comanderebbe niente — chi
 *   è solo vede sempre quello che gli mostri (vedi `cosaVede`) — e un comando
 *   che non fa niente è peggio di un comando che manca.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw, Users } from "lucide-react";
import {
  conAperto,
  conStatoPersona,
  haIlSuo,
  riassuntoInParole,
  statoDelloSchermo,
  statoDiQuestaPersona,
  type PersonaDelPannello,
  type RegiaGruppo,
  type StatoPersona,
} from "@/shop/preventivi-di-gruppo";
import { cambiaRegia } from "@/shop/regia-gruppo";

export interface AttesoDelGruppo { gettone: string; nome: string; leadId: string }

/** Chi è atteso in questa consulenza, con il nome intero: sta dietro alla
 *  sessione del consulente (api.presenter.sala-attesa). */
export function useAttesiDelConsulente(code: string | null | undefined, giro = 0): AttesoDelGruppo[] {
  const [attesi, setAttesi] = useState<AttesoDelGruppo[]>([]);
  useEffect(() => {
    const sess = String(code || "").trim();
    if (!sess) { setAttesi([]); return; }
    let vivo = true;
    const giro = () =>
      fetch(`/api/presenter/sala-attesa?sess=${encodeURIComponent(sess)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (vivo && j?.ok && Array.isArray(j.attesi)) setAttesi(j.attesi as AttesoDelGruppo[]); })
        .catch(() => { /* rete: si riprova al giro dopo */ });
    void giro();
    //  L'elenco cambia quando il consulente aggiunge una persona all'appuntamento
    //  dal gestionale, quindi si rilegge — ma con calma: è una cosa che si fa
    //  prima della consulenza, non durante.
    const iv = setInterval(giro, 30_000);
    return () => { vivo = false; clearInterval(iv); };
    //  `giro` lo alza chi ha appena registrato una persona: senza, si
    //  aspetterebbero trenta secondi per vedere comparire il cliente che è
    //  già in linea davanti a te.
  }, [code, giro]);
  return attesi;
}

/** Il riassunto dei preventivi della stanza, per gettone (api.presenter.preventivi-stanza).
 *  ⚠️ SI CHIEDE SOLO A PANNELLO APERTO, e ogni dieci secondi: chiuso non lo
 *   legge nessuno, e ogni giro è una richiesta che si paga (vedi
 *   shop/stato-stanza, il giorno in cui il sito si è fermato per i limiti del
 *   piano). */
type RiassuntoPreventivo = { totale: number | null; voci: number; toccato: boolean; quando: number };
function useRiassunti(code: string | null | undefined, attivo: boolean): Record<string, RiassuntoPreventivo> {
  const [r, setR] = useState<Record<string, RiassuntoPreventivo>>({});
  useEffect(() => {
    const sess = String(code || "").trim();
    if (!sess || !attivo) return;
    let vivo = true;
    const giro = () =>
      fetch(`/api/presenter/preventivi-stanza?sess=${encodeURIComponent(sess)}`, { cache: "no-store" })
        .then((x) => (x.ok ? x.json() : null))
        .then((j) => { if (vivo && j?.ok && j.preventivi) setR(j.preventivi as Record<string, RiassuntoPreventivo>); })
        .catch(() => { /* rete: si riprova al giro dopo */ });
    void giro();
    const iv = setInterval(giro, 10_000);
    return () => { vivo = false; clearInterval(iv); };
  }, [code, attivo]);
  return r;
}

/** I tre stati, disegnati come un selettore unico: uno solo può essere acceso,
 *  e si legge in che stato si è senza impararlo. */
function Selettore({ stato, scegli }: { stato: StatoPersona; scegli: (s: StatoPersona) => void }) {
  /*  ⚠️ DUE VOCI, non tre: «solo io» è stato tolto su indicazione del
      committente («solo io non serve»), e il perché per esteso sta nel
      cartello di `statoDiQuestaPersona`. Guardare il suo preventivo mentre lo
      compila si fa ancora, ma è un'altra riga — riguarda il MIO schermo. */
  const voci: { k: StatoPersona; t: string; sotto: string }[] = [
    { k: "segue", t: "Segue me", sotto: "vede quello che mostri" },
    { k: "suo", t: "Il suo", sotto: "lo compila lui" },
  ];
  return (
    <div className="mt-1 grid grid-cols-2 gap-1">
      {voci.map((v) => {
        const on = stato === v.k;
        return (
          <button
            key={v.k}
            type="button"
            onClick={() => scegli(v.k)}
            aria-pressed={on}
            className={`rounded-lg border px-1.5 py-1.5 text-left text-[11px] transition ${
              on
                ? v.k === "suo"
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                  : "border-brand/60 bg-brand/20 text-white"
                : "border-white/12 bg-white/[0.04] text-white/70 hover:border-white/25"
            }`}
          >
            <b className="block truncate font-semibold">{v.t}</b>
            <span className="block text-[9.5px] leading-snug opacity-70">{v.sotto}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PlanciaGruppo({
  code,
  regia,
  attesi,
  inLinea,
  conferma,
  aggiornaSchermo,
  compatta,
  apriIlPreventivo,
  tornaIndietro,
}: {
  code: string | null | undefined;
  regia: RegiaGruppo | null;
  attesi: PersonaDelPannello[];
  /** Gli id delle SCHEDE di chi è collegato ora. `undefined` = non si sa (una
   *  finestra del preventivo aperta fuori dalla consulenza non può saperlo, e
   *  meglio niente che «non è entrato» detto a chi ti sta guardando in faccia). */
  inLinea?: string[];
  /** Chi DICHIARA dal proprio dispositivo di stare sul suo preventivo: è
   *  l'unica prova che quella scheda conosce la regola (`statoDelloSchermo`). */
  conferma?: string[];
  /** Ricarica lo schermo di una persona (per le schede rimaste a ieri). */
  aggiornaSchermo?: (leadId: string) => void;
  /** Dentro Meetly parte rannicchiata: lì lo schermo è delle facce. */
  compatta?: boolean;
  /** Porta me sulla pagina del preventivo (e la chiamata ai contenuti). */
  apriIlPreventivo?: () => void;
  /** Riporta me (e chi mi segue) alla schermata di prima. */
  tornaIndietro?: () => void;
}) {
  const [aperta, setAperta] = useState(!compatta);
  /*  ── ⚠️ IL PULSANTE DEVE RISPONDERE NELL'ISTANTE IN CUI LO PREMI ───────
      Segnalazione del committente: «clicco apri il suo e si bugga». Non si
      rompeva niente: la mossa andava sul server e questo pannello aspettava il
      giro di lettura — secondi in cui il pulsante restava identico a prima.
      Chi preme un pulsante che non cambia lo preme di nuovo, e il secondo
      colpo disfaceva il primo. La mossa si applica qui con le stesse funzioni
      del server (shop/preventivi-di-gruppo), e la risposta la conferma. */
  const [subito, setSubito] = useState<RegiaGruppo | null>(null);
  //  ⚠️ Tutti i ganci PRIMA di qualunque uscita: vedi `proveDegliHook`.
  const riassunti = useRiassunti(code, aperta && attesi.length >= 1);

  /*  ⚠️ BASTA UNA PERSONA, e la soglia a due era l'errore che ha reso questo
      lavoro invisibile: in archivio, su 201 stanze di appuntamento, quelle con
      due persone erano ZERO — si prenota un cliente per volta. */
  if (!code || attesi.length < 1) return null;
  const inGruppo = attesi.length >= 2;

  //  Quello che si mostra: la mossa appena fatta se è più recente della
  //  risposta del server, altrimenti il server.
  const vista = subito && (!regia || subito.at >= (regia.at || 0)) ? subito : regia;
  const aperto = vista?.aperto || "";

  const schermoDi = (p: PersonaDelPannello) =>
    statoDelloSchermo({
      acceso: haIlSuo(vista, p.gettone),
      collegato: inLinea ? inLinea.includes(p.leadId) : null,
      lodice: conferma?.includes(p.leadId),
    });
  /** Quanti hanno il preventivo acceso ma lo schermo che non lo conferma. */
  const daAggiornare = attesi.filter((p) => schermoDi(p) === "non-conferma").length;

  /** Manda una mossa: subito qui, poi al server, che conferma. */
  const manda = (r: RegiaGruppo, patch: Parameters<typeof cambiaRegia>[1], adesso: number) => {
    setSubito(r);
    void cambiaRegia(code, patch).then((risposta) => {
      if (risposta) setSubito({ ...risposta, at: Math.max(risposta.at, adesso) });
    });
  };

  /** ── IL SELETTORE: CHE COSA HA DAVANTI LUI ───────────────────────────
   *  Tutte e tre le transizioni in un posto solo (`conStatoPersona` per la
   *  riga, qui per quello che si muove sugli schermi). */
  /*  ── ⚠️ CHI NON HA UNA SCHEDA NON HA ANCORA UNA STANZA SUA ───────────
      È entrato dal link scrivendo il suo nome: per un attimo — il tempo che
      il consulente lo registri come persona della stanza (vedi
      `/api/presenter/atteso-ospite`) — non ha un gettone, quindi non ha un
      preventivo suo da accendere. In quel momento segue e basta, e il
      pannello lo DICE invece di mostrargli un selettore che non comanda
      niente: un interruttore finto è peggio di un pannello che manca. */
  const statoDi = (p: PersonaDelPannello): StatoPersona =>
    p.senzaScheda ? "segue" : statoDiQuestaPersona(vista, p.gettone);

  const scegli = (p: PersonaDelPannello, s: StatoPersona) => {
    if (p.senzaScheda) return;   // niente stanza sua: non c'è niente da muovere
    const prima = statoDiQuestaPersona(vista, p.gettone);
    if (s === prima) return;
    const adesso = Date.now();
    const r = conStatoPersona(vista, p.gettone, s, adesso);
    const patch: { individuale: { chi: string; acceso: boolean }; aperto?: string } = {
      individuale: { chi: p.gettone, acceso: s === "suo" },
    };
    if (s === "segue" && aperto === p.gettone) patch.aperto = "";
    manda(r, patch, adesso);
    //  E adesso gli schermi: è l'unica parte che non si può dedurre dalla riga
    //  — la riga dice chi vede cosa, non chi si sposta.
    if (s === "suo") apriIlPreventivo?.();      // ci andiamo insieme: lui sul suo, io sulla pagina
    else if (prima === "suo") tornaIndietro?.();// torniamo alla schermata di prima
  };

  /** Il suo preventivo sul MIO schermo, senza cambiare quello che vede lui. */
  const guardaDaMe = (p: PersonaDelPannello, apri: boolean) => {
    //  Senza stanza sua non c'è niente da «aprire di nascosto»: il preventivo
    //  comune o lo vede anche lui, o non lo vede nessuno.
    if (p.senzaScheda) { if (apri) apriIlPreventivo?.(); return; }
    const adesso = Date.now();
    manda(conAperto(vista ?? { comune: false, penne: {}, individuali: [], aperto: "", at: 0 }, apri ? p.gettone : "", adesso),
      { aperto: apri ? p.gettone : "" }, adesso);
    //  ⚠️ Chiudendo NON si torna indietro: stavo solo guardando, e quello che
    //   vede lui non è cambiato. Resto dove sono.
    if (apri) apriIlPreventivo?.();
  };

/*  ── ⚠️ QUI C'ERA «RENDILO IL PREVENTIVO DELLA CONSULENZA» ───────────────
    Copiava il preventivo di una persona dentro quello comune e lo accendeva
    per tutti. Non serve più, ed è una decisione del committente: il preventivo
    comune adesso NASCE comune — «Nuovo preventivo» apre quello della
    consulenza, non di qualcuno — e chi è su «Segue me» lo vede comporsi in
    diretta mentre lo spieghi. Non c'è più niente da promuovere da una stanza
    all'altra, e con il pulsante se ne va anche il rischio che portava con sé:
    copiare in una stanza che leggono tutti una riga nata nella stanza di una
    persona sola. */

  return (
    <div
      data-hg-noptr
      data-hg-sempre
      /*  ── ⚠️ ATTACCATO SOTTO LA TESTATA, NON A UN'ALTEZZA INVENTATA ────
          Era `top-20`, cioè 80 px scritti a mano. La barra dei comandi in
          alto però cresce: con la riga «sullo schermo di…», i modi e le
          camerine arriva a due o tre righe, e il pannello ci finiva sopra.
          Adesso segue la misura vera della barra, che lei stessa pubblica
          mentre si ridispone (`--hg-barra-alta`, vedi call.tsx). */
      style={{ top: "calc(var(--hg-barra-alta, 72px) + 8px)" }}
      className={`fixed right-3 z-[140] print:hidden ${aperta ? "w-[min(92vw,320px)]" : "w-auto"}`}
    >
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0b1a38]/96 shadow-2xl shadow-black/50 backdrop-blur">
        <button
          type="button"
          onClick={() => setAperta((v) => !v)}
          title={aperta ? "Chiudi il pannello" : "Apri il pannello dei preventivi"}
          className={`flex items-center gap-2 text-left font-semibold text-white/85 ${
            aperta ? "w-full px-3 py-2 text-[12px]" : "px-2.5 py-1.5 text-[11px]"
          }`}
        >
          <Users className="h-4 w-4 flex-shrink-0 text-brand" />
          <span className={aperta ? "flex-1" : ""}>
            {inGruppo ? `Cosa vede ciascuno · ${attesi.length}` : "Cosa vede il cliente"}
          </span>
          {/*  Chiusa, il pannello deve far vedere che c'è qualcosa da fare:
               dentro Meetly sta rannicchiata proprio mentre si passa alle
               facce, che è il momento in cui l'avviso conta. */}
          {daAggiornare > 0 && (
            <span
              title="Un cliente ha il suo preventivo acceso ma il suo schermo non lo conferma: apri il pannello"
              className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/90 px-1 text-[9.5px] font-bold text-[#231000]"
            >
              {daAggiornare}
            </span>
          )}
          <span className="text-white/40">{aperta ? "–" : "+"}</span>
        </button>

        {aperta && (
          <div className="space-y-1.5 px-2.5 pb-2.5">
            {/*  ⚠️ QUI C'ERA L'INTERRUTTORE «PREVENTIVO COMUNE» (acceso/spento).
                 Tolto con lo stesso ragionamento del pulsante qui sopra: il
                 comune non si accende più, è semplicemente quello che stai
                 mostrando, e chi ti segue lo vede (vedi `cosaVede`). */}
            {attesi.map((p) => {
              const stato = statoDi(p);
              const daMe = !p.senzaScheda && aperto === p.gettone;
              //  Gli avvisi («acceso ma non conferma») parlano della stanza di
              //  una persona: per chi non ce l'ha non vogliono dire niente.
              const q = p.senzaScheda ? "spento" : schermoDi(p);
              const r = riassunti[p.gettone];
              //  È collegato per costruzione: questa riga nasce dal roster.
              const collegato = p.senzaScheda ? true : inLinea ? inLinea.includes(p.leadId) : null;
              return (
                <div key={p.gettone || "ospite"} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-2 px-1 py-0.5">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand/20 text-[11px] font-bold text-brand">
                      {p.nome.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">{p.nome}</span>
                    {/*  ⚠️ NON PIÙ ATTACCATO AL NOME: «· non an…» tagliato a
                         metà era il modo più veloce di far sembrare rotto un
                         pannello che funzionava. Qui ha il suo posto e non si
                         accorcia mai. */}
                    {collegato !== null && (
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${collegato ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-white/40"}`}>
                        {collegato ? "in linea" : "non entrato"}
                      </span>
                    )}
                  </div>

                  {p.senzaScheda ? (
                    <p className="px-1 py-1 text-[10.5px] leading-snug text-white/50">
                      Vede quello che mostri. Sto preparando la sua scheda: fra un istante
                      potrai dargli un preventivo suo da compilare.
                    </p>
                  ) : (
                    <Selettore stato={stato} scegli={(s) => scegli(p, s)} />
                  )}

                  {/*  ── IL SUO PREVENTIVO, IN UNA RIGA ───────────────────
                       Quanto fa, quante voci, da quanto non si muove: la cosa
                       che il pannello non ha mai detto e che serve sempre. */}
                  <div className="mt-1.5 flex items-center gap-2 px-1">
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-white/55">{riassuntoInParole(r)}</span>
                    {/*  ── ⚠️ UN'ICONA, NON UNA FRASE ──────────────────────
                         Era un pulsante scritto, «guarda da me / chiudi da
                         me», e il committente l'ha fatto togliere: «non ha
                         senso quello». Aveva ragione — diceva dove finisce il
                         preventivo («da me») invece di dire a cosa serve, e
                         per capirlo bisognava leggere una spiegazione lunga
                         due righe appesa al passaggio del mouse.
                         Quello che fa è una cosa sola: aprire sul MIO schermo
                         il suo preventivo mentre lo compila, in tempo reale,
                         senza che lui se ne accorga. Un occhio lo dice meglio
                         di qualunque etichetta, e sta in un angolo invece di
                         occupare una riga.
                         ⚠️ Compare solo quando ha senso: se il preventivo è
                          suo. Quando segue me ce l'ho già davanti io. */}
                    {stato === "suo" && (
                      <button
                        type="button"
                        onClick={() => guardaDaMe(p, !daMe)}
                        aria-label={daMe ? "Smetti di guardare il suo preventivo" : "Guarda cosa sta facendo, in tempo reale"}
                        title={daMe ? "Smetti di guardare" : "Guarda cosa sta facendo, in tempo reale"}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                          daMe
                            ? "border-brand/60 bg-brand/20 text-white"
                            : "border-white/12 bg-white/[0.04] text-white/55 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        {daMe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {/*  ── QUELLO CHE NON TORNA, CON IL RIMEDIO ACCANTO ────── */}
                  {q === "non-collegato" && (
                    <p className="mt-1 px-1 text-[10px] leading-snug text-amber-300/80">
                      Acceso, ma non è entrato: fagli riaprire il link.
                    </p>
                  )}
                  {q === "non-conferma" && (
                    <div className="mt-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5">
                      <p className="text-[10px] leading-snug text-amber-100/90">
                        Acceso, ma il suo schermo non lo conferma: se ha la pagina aperta da prima,
                        sta girando con una versione vecchia e la videochiamata gliela cambia ancora.
                      </p>
                      {aggiornaSchermo && (
                        <button
                          type="button"
                          onClick={() => aggiornaSchermo(p.leadId)}
                          className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-400/25 px-2 py-1 text-[10.5px] font-bold text-amber-50 hover:bg-amber-400/40"
                        >
                          <RefreshCw className="h-3 w-3" /> Aggiorna il suo schermo
                        </button>
                      )}
                    </div>
                  )}
                  {q === "suo" && (
                    <p className="mt-1 px-1 text-[10px] leading-snug text-emerald-300/75">
                      Lo sta compilando: qualunque cosa mostri, lui resta qui.
                    </p>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
