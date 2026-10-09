/** ── LA REGIA ───────────────────────────────────────────────────────────────
 *  Quello che chi conduce ha sotto gli occhi mentre parla: quante persone ci
 *  sono DAVVERO, chi ha alzato la mano, la chat con i comandi sul singolo
 *  messaggio, e i messaggi che partono da soli.
 *
 *  ── PERCHÉ È UN COMPONENTE E NON UNA PAGINA ───────────────────────────────
 *  Serve sia mentre si è in onda sia prima: la gente arriva in anticipo e
 *  scrive, e una regia che compare solo a diretta avviata lascerebbe i primi
 *  arrivati senza risposta proprio nel momento in cui stanno decidendo se
 *  restare.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { inTesto, type Riga as RigaDiario } from "@/webinar/diario";
import { toast } from "sonner";
import { Clock, Eye, EyeOff, Plus, Send, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSala, ElencoPalco, type ComandiChat } from "./ChatSala";
import type { InPalco, MessaggioChat, MessaggioProgrammato } from "./tipi";

interface Sala {
  presenti: number;
  passate: number;
  sogliaVisibile: number;
  elenco: { spettatore: string; nome: string }[];
  messaggi: MessaggioChat[];
  fissato: MessaggioChat | null;
  palco: InPalco[];
  programmati: MessaggioProgrammato[];
  iniziataIl: string | null;
  tabelleMancanti?: boolean;
}

/** Il ritmo della regia è più fitto di quello della sala, e non passa dalla
 *  cache: chi conduce deve vedere una mano alzata SUBITO, non fra quattro
 *  secondi, perché nel frattempo ha già cambiato argomento. */
const RITMO_MS = 2000;

export function Regia({
  codice,
  nomePresentatore,
  inOnda,
  chiedi,
  onPalco,
}: {
  codice: string;
  nomePresentatore: string;
  inOnda: boolean;
  /** ⚠️ La regia è l'unica che interroga il palco a ritmo serrato, quindi è
   *  lei a dire alla pagina chi c'è sopra. Senza questo giro, il presentatore
   *  non aggancerebbe mai le voci di chi ha fatto salire — cioè darebbe la
   *  parola a qualcuno e resterebbe l'unico a non sentirlo. */
  onPalco?: (palco: InPalco[]) => void;
  /** la stessa funzione autenticata che usa la pagina: qui non si reinventa
   *  il modo di parlare col server */
  chiedi: (corpo: unknown) => Promise<any>;
}) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [bozza, setBozza] = useState("");
  const [fissa, setFissa] = useState(false);
  const [minuto, setMinuto] = useState("5");
  const [testoProg, setTestoProg] = useState("");
  const [fissaProg, setFissaProg] = useState(false);
  const [sogliaBozza, setSogliaBozza] = useState("");
  /** Quale dei due numeri veri mostra la sala. Vedi StanzaWebinar.contatore. */
  const [contatore, setContatore] = useState<"adesso" | "totale" | "iscritti" | "niente">("adesso");
  /** Quanti si sono iscritti. Lo sa solo chi conduce: vedi StanzaWebinar. */
  const [iscritti, setIscritti] = useState("");
  const inCorso = useRef(false);

  const giro = useCallback(async () => {
    //  Un giro alla volta: se il server è lento, due chiamate sovrapposte
    //  tornerebbero fuori ordine e la sala lampeggerebbe fra due stati.
    if (inCorso.current) return;
    inCorso.current = true;
    try {
      const j = await chiedi({ azione: "sala", codice });
      setSala(j as Sala);
      onPalco?.((j as Sala).palco ?? []);
      setSogliaBozza((v) => (v === "" ? String(j.sogliaVisibile ?? 0) : v));
    } catch { /* si riprova al giro dopo */ } finally { inCorso.current = false; }
  }, [chiedi, codice, onPalco]);

  useEffect(() => {
    void giro();
    const t = setInterval(() => void giro(), RITMO_MS);
    return () => clearInterval(t);
  }, [giro]);

  //  ── I MESSAGGI CHE PARTONO DA SOLI ──────────────────────────────────
  //   Il momento lo decide il SERVER, contando dall'inizio della diretta: se
  //   lo contasse questa scheda, due schede aperte manderebbero tutto due
  //   volte, e una scheda ricaricata ricomincerebbe da zero.
  useEffect(() => {
    if (!inOnda) return;
    const t = setInterval(() => {
      void chiedi({ azione: "spedisci-dovuti", codice, nome: nomePresentatore }).catch(() => { /* al giro dopo */ });
    }, 10_000);
    return () => clearInterval(t);
  }, [inOnda, chiedi, codice, nomePresentatore]);

  const comandi: ComandiChat = {
    faiSalire: (spettatore, nome, modo) => {
      //  ⚠️ IL NOME VA MANDATO. Qui c'era `_nome`, cioè buttato via: la riga
      //   del palco la crea questa chiamata (è un upsert), e senza nome nella
      //   sala compariva un riquadro anonimo — mentre facendo salire la stessa
      //   persona dalla console il nome c'era. Due strade per lo stesso gesto,
      //   due risultati diversi.
      void chiedi({ azione: "fai-salire", codice, spettatore, nome, modo })
        //  ⚠️ E LA SALA DEVE PASSARE AL SALOTTO, altrimenti quella persona
        //   parla e non la vede nessuno: chi la fa salire ha detto «fallo
        //   entrare», non «fallo entrare e poi ricordati di cambiare vista».
        .then(() => chiedi({ azione: "vista", codice, vista: "salotto" }).catch(() => { /* al giro dopo */ }))
        .then(giro);
      toast.success(modo === "video" ? "Sale con voce e video" : "Sale con la sola voce");
    },
    faiScendere: (spettatore) => { void chiedi({ azione: "fai-scendere", codice, spettatore }).then(giro); },
    microfono: (spettatore, acceso) => { void chiedi({ azione: "microfono", codice, spettatore, acceso }).then(giro); },
    fissa: (id, acceso) => { void chiedi({ azione: "fissa", codice, id, acceso }).then(giro); },
    cancella: (id) => { void chiedi({ azione: "cancella-messaggio", codice, id }).then(giro); },
  };

  const invia = async () => {
    const testo = bozza.trim();
    if (!testo) return;
    setBozza("");
    try {
      await chiedi({ azione: "scrivi", codice, nome: nomePresentatore, testo, fissa });
      setFissa(false);
      void giro();
    } catch (e) { setBozza(testo); toast.error(String((e as Error).message || e)); }
  };

  const programma = async () => {
    const testo = testoProg.trim();
    if (!testo) return;
    try {
      const j = await chiedi({ azione: "programma", codice, minuto: Number(minuto) || 0, testo, fissa: fissaProg });
      setTestoProg(""); setFissaProg(false);
      setSala((s) => (s ? { ...s, programmati: j.programmati } : s));
    } catch (e) { toast.error(String((e as Error).message || e)); }
  };

  const salvaSoglia = async () => {
    try {
      await chiedi({ azione: "soglia", codice, soglia: Number(sogliaBozza) || 0 });
      toast.success("Soglia salvata");
      void giro();
    } catch (e) { toast.error(String((e as Error).message || e)); }
  };

  if (!sala) return null;

  if (sala.tabelleMancanti) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <p className="t-riga font-medium">Manca un pezzo di database</p>
        <p className="t-corpo mt-1 text-muted-foreground">
          La diretta funziona già, ma chat, contatore e palco hanno bisogno di quattro tabelle che
          non sono ancora state create. Trovi il file da lanciare in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[12px]">
            supabase/migrations/20260901120000_webinar_sala.sql
          </code>
          : incollalo nell&apos;editor SQL di Supabase, e questa schermata si accende da sola.
        </p>
      </div>
    );
  }
  /** ── SCARICA COSA È SUCCESSO A CHI GUARDAVA ────────────────────────────
   *  ⚠️ È LA RISPOSTA A «SI VEDE NERO», che senza questo tasto si poteva solo
   *   ipotizzare. Ogni spettatore che incontra un guasto manda il suo diario:
   *   qui escono tutti insieme, in un file di testo leggibile — quale codice,
   *   su che apparecchio, e in che ordine sono andate le cose.
   *  ⚠️ Un file e non una schermata: va mandato a chi corregge, e una tabella
   *   a schermo si può solo ricopiare a mano. */
  const scaricaDiagnostica = async () => {
    try {
      const r = await fetch(`/api/crm/webinar?azione=diagnostica&codice=${encodeURIComponent(codice)}`);
      const j = (await r.json()) as { diari?: { quando: string; apparecchio: string; codice: string; righe: RigaDiario[] }[] };
      if (!r.ok) throw new Error("la diagnostica non si legge");
      const diari = j.diari ?? [];
      if (!diari.length) {
        //  ⚠️ SI DICE CHE NON C'È NIENTE, e non si scarica un file vuoto: un
        //   file di zero righe fa credere che la diagnostica sia rotta, mentre
        //   vuol dire la cosa opposta — nessuno ha avuto problemi.
        toast.success("Nessun problema segnalato: nessuno spettatore ha incontrato guasti.");
        return;
      }
      const testo = diari
        .map((d) => inTesto({ apparecchio: d.apparecchio || "sconosciuto", quando: d.quando, righe: d.righe || [] }))
        .join("\n\n");
      const url = URL.createObjectURL(new Blob([testo], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `webinar-${codice}-diagnostica.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${diari.length} ${diari.length === 1 ? "segnalazione" : "segnalazioni"} scaricate`);
    } catch (e) { toast.error(String((e as Error).message || e)); }
  };

  const mani = sala.palco.filter((p) => p.stato === "attesa").length;
  const soglia = Number(sogliaBozza) || 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ══ SINISTRA: I NUMERI E GLI AUTOMATISMI ══════════════════════ */}
      <div className="space-y-4">
        {/* ── ⚠️ IL NUMERO A CUI TI SCRIVONO QUANDO FINISCE ─────────────
              È l'ultima schermata che vede la sala, e senza questo numero resta
              un ringraziamento e basta: la gente esce e non succede niente.
              Si scrive UNA VOLTA e vale per tutte le tue dirette — sta sulla
              tua scheda, non su questa sala.
             ⚠️ NON è il telefono che hai in anagrafica: quello è il tuo numero
              interno, questo lo leggono duecento sconosciuti. Sono due cose
              diverse apposta. */}
        <NumeroWhatsapp />

        {/* ── QUANTE PERSONE CI SONO DAVVERO ─────────────────────────── */}
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="t-etichetta text-muted-foreground">In sala adesso</p>
              <p className="text-3xl font-semibold tabular-nums">{sala.presenti}</p>
            </div>
            <div>
              <p className="t-etichetta text-muted-foreground">Passate in tutto</p>
              <p className="text-3xl font-semibold tabular-nums text-muted-foreground">{sala.passate}</p>
            </div>
            <button
              type="button"
              onClick={() => void scaricaDiagnostica()}
              className="ml-auto rounded-lg border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
              title="Cosa è andato storto a chi stava guardando: codice del guasto, apparecchio, e in che ordine"
            >
              Scarica la diagnostica
            </button>
            {mani > 0 && (
              <div>
                <p className="t-etichetta text-muted-foreground">Mani alzate</p>
                <p className="text-3xl font-semibold tabular-nums text-amber-600">{mani}</p>
              </div>
            )}
          </div>

          {/* ── COSA VEDONO LORO ────────────────────────────────────────
              ⚠️ Vedono lo STESSO numero, oppure nessuno. Non ne esiste un
              terzo, ed è una scelta: una sala gonfiata si riconosce — il
              numero balla mentre la chat resta deserta — e chi se ne accorge
              non pensa «bel webinar», pensa «mi stanno raccontando balle»
              proprio mentre gli chiedi di fidarsi per una cosa che gli tocca
              il corpo. La soglia fa il lavoro utile senza il rischio. */}
          {/* ── ⚠️ CHE NUMERO VEDE LA SALA ─────────────────────────────────
                Due numeri, tutti e due VERI. «Adesso» dice quante persone ci
                sono in questo momento; «passate» quante ne sono passate
                dall'inizio — ed è quasi sempre parecchio più grande, perché in
                una diretta la gente entra ed esce e chi è arrivato al minuto
                dieci ha comunque seguito.
               ⚠️ Non c'è un campo dove scrivere il numero a mano, ed è una
                scelta: un contatore inventato — o vero ma fatto oscillare — è
                un dato falso mostrato a persone che stanno decidendo se
                spendere. Chi se ne accorge, e qualcuno se ne accorge sempre
                (il numero balla mentre la chat resta deserta), non pensa «bel
                webinar»: pensa «mi stanno raccontando balle» proprio mentre gli
                chiedi di fidarsi per una cosa che gli tocca il corpo. */}
          <div className="mt-4 border-t pt-3">
            <p className="t-etichetta text-muted-foreground">Che numero vede la sala</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {([
                ["adesso", "Quanti ci sono adesso", `${sala.presenti}`],
                ["totale", "Quanti sono passati", `${sala.passate}`],
                ["iscritti", "Quanti si sono iscritti", ""],
                ["niente", "Nessun numero", ""],
              ] as const).map(([v, testo, quanti]) => (
                <button
                  key={v}
                  onClick={() => {
                    setContatore(v);
                    void chiedi({ azione: "contatore", codice, contatore: v })
                      .then(giro)
                      .catch(() => { setContatore(contatore); toast.error("Non è cambiato: riprova"); });
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
                    contatore === v ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {testo}
                  {!!quanti && (
                    <span className={`ml-1.5 tabular-nums ${contatore === v ? "opacity-70" : "text-muted-foreground"}`}>
                      {quanti}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── ⚠️ IL NUMERO DEGLI ISCRITTI LO SCRIVI TU ────────────────
                  Perché sei l'unico che lo sa: le iscrizioni si raccolgono
                  fuori di qui — un modulo, una campagna, una lista — e la sala
                  non ha modo di contarle.
                 ⚠️ E la sala lo mostra scritto «iscritti», non «in sala
                  adesso». È la differenza fra dire un numero vero che il
                  programma non può sapere e far credere che ci siano
                  duecento persone collegate in questo momento: la prima è
                  un'informazione, la seconda è una cosa che chi se ne accorge
                  non ti perdona — e in una sala mezza vuota se ne accorgono. */}
            {contatore === "iscritti" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <span className="t-corpo">Iscritti a questa diretta</span>
                <input
                  value={iscritti}
                  onChange={(e) => setIscritti(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  onBlur={() => {
                    void chiedi({ azione: "contatore", codice, contatore: "iscritti", iscritti: Number(iscritti) || 0 })
                      .then(giro)
                      .catch(() => toast.error("Non è stato salvato: riprova"));
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-24 rounded border bg-background px-2 py-1 text-center tabular-nums outline-none focus:border-primary"
                />
                <span className="t-nota text-muted-foreground">
                  In sala compare come «{iscritti || "0"} iscritti».
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
            {sala.presenti >= soglia ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            <span className="t-corpo">
              {sala.presenti >= soglia
                ? <>Gli spettatori vedono <b>{sala.presenti}</b></>
                : <>Gli spettatori <b>non vedono nessun numero</b></>}
            </span>
            <span className="t-nota ml-auto flex items-center gap-2 text-muted-foreground">
              mostralo da
              <input
                value={sogliaBozza}
                onChange={(e) => setSogliaBozza(e.target.value.replace(/\D/g, ""))}
                onBlur={() => void salvaSoglia()}
                inputMode="numeric"
                className="w-16 rounded border bg-background px-2 py-1 text-center tabular-nums outline-none focus:border-primary"
              />
              in su
            </span>
          </div>
          <p className="t-etichetta mt-2 text-muted-foreground">
            Sotto la soglia non si mostra niente: una sala che dice «2 spettatori» lavora contro di
            te, e tacere non è mentire.
          </p>
        </div>

        {/* ── CHI HA LA PAROLA ───────────────────────────────────────── */}
        <div className="rounded-xl border p-3">
          <p className="t-etichetta mb-2 flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Palco e mani alzate
          </p>
          <div className="rounded-lg bg-slate-900 p-2">
            <ElencoPalco palco={sala.palco} comandi={comandi} />
          </div>
        </div>

        {/* ── I MESSAGGI CHE PARTONO DA SOLI ─────────────────────────── */}
        <div className="rounded-xl border p-4">
          <p className="t-riga mb-1 flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4" /> Messaggi automatici
          </p>
          {/*  ⚠️ Escono col TUO nome e col tuo distintivo, come tutto quello che
              scrivi. Non si possono firmare con nomi di spettatori inventati:
              una finta partecipante che al minuto 12 scrive «l'ho fatto e sono
              felicissima» è una testimonianza falsa, e dal 2023 (D.Lgs.
              26/2023) sta nella lista nera delle pratiche sempre scorrette —
              su un trattamento della persona, la fattispecie da manuale. */}
          <p className="t-nota mb-3 text-muted-foreground">
            Partono da soli al minuto che scegli, firmati <b>{nomePresentatore}</b> come tutto quello
            che scrivi tu. Servono per il link del preventivo, la scadenza dell'offerta, il modulo
            da compilare: le cose che ogni volta ti dimentichi di dire.
          </p>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="t-nota text-muted-foreground">al minuto</span>
              <input
                value={minuto}
                onChange={(e) => setMinuto(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="w-16 rounded-lg border bg-background px-2 py-2 text-center tabular-nums outline-none focus:border-primary"
              />
            </div>
            <input
              value={testoProg}
              onChange={(e) => setTestoProg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void programma()}
              placeholder="Cosa deve comparire in chat"
              className="t-corpo min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary"
            />
            <Button onClick={() => void programma()} variant="outline">
              <Plus className="h-4 w-4" /> Aggiungi
            </Button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={fissaProg} onChange={(e) => setFissaProg(e.target.checked)} />
            <span className="t-nota">Lascialo anche fisso in cima, non solo nella chat</span>
          </label>

          {sala.programmati.length > 0 && (
            <ul className="mt-3 divide-y rounded-lg border">
              {sala.programmati.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="t-nota w-16 shrink-0 tabular-nums text-muted-foreground">min {p.minuto}</span>
                  <span className="t-corpo min-w-0 flex-1 truncate">{p.testo}</span>
                  {p.inviatoIl && <span className="t-etichetta shrink-0 text-emerald-600">inviato</span>}
                  <button
                    onClick={() => void chiedi({ azione: "sprograma", codice, id: p.id }).then((j) => setSala((s) => (s ? { ...s, programmati: j.programmati } : s)))}
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                    aria-label="Elimina"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ══ DESTRA: LA CHAT ═══════════════════════════════════════════ */}
      <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border bg-slate-900 text-white lg:h-[42rem]">
        <p className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Chat — passa il mouse su un messaggio per i comandi
        </p>
        <ChatSala messaggi={sala.messaggi} palco={sala.palco} comandi={comandi} className="min-h-0 flex-1" />
        <div className="space-y-2 border-t border-white/10 p-2">
          <label className="flex cursor-pointer items-center gap-2 px-1">
            <input type="checkbox" checked={fissa} onChange={(e) => setFissa(e.target.checked)} />
            <span className="text-[11px] text-white/60">Fissalo in cima alla sala</span>
          </label>
          <div className="flex gap-2">
            <input
              value={bozza}
              onChange={(e) => setBozza(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void invia()}
              placeholder="Scrivi alla sala…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-sky-400"
            />
            <button
              onClick={() => void invia()}
              disabled={!bozza.trim()}
              className="rounded-lg bg-sky-500 px-3 text-white transition hover:brightness-110 disabled:opacity-40"
              aria-label="Invia"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/** ── IL NUMERO PER DOPO LA DIRETTA ─────────────────────────────────────────
 *  Si salva sulla scheda di chi conduce, non sulla sala: scritto una volta,
 *  vale per tutte le sue dirette — che è esattamente quello che serve a chi ne
 *  fa una alla settimana.
 *  ⚠️ SI SALVA A MANO, con un tasto, e non mentre si scrive: un salvataggio
 *   automatico su un campo del telefono manda al server mezzo numero a ogni
 *   cifra, e il mezzo numero è quello che poi finisce davanti alla sala se si
 *   chiude la scheda a metà. */
function NumeroWhatsapp() {
  const [numero, setNumero] = useState("");
  const [caricato, setCaricato] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    void fetch("/api/crm/webinar?azione=whatsapp")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setNumero(String(j?.numero || "")))
      .catch(() => { /* resta vuoto: si può scrivere lo stesso */ })
      .finally(() => setCaricato(true));
  }, []);

  const salva = async () => {
    setSalvo(true);
    try {
      const r = await fetch("/api/crm/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: "whatsapp", codice: "-", numero }),
      });
      const j = (await r.json()) as { numero?: string };
      if (!r.ok) throw new Error("non salvato");
      //  Si rimette quello che il server ha DAVVERO scritto: se ha tolto dei
      //  caratteri, chi guarda deve vedere il numero vero e non il suo.
      setNumero(String(j?.numero || ""));
      toast.success("Numero salvato: vale per tutte le tue dirette");
    } catch {
      toast.error("Non è stato salvato: riprova");
    } finally {
      setSalvo(false);
    }
  };

  return (
    <div className="rounded-xl border p-4">
      <p className="t-riga font-medium">Dopo la diretta ti scrivono qui</p>
      <p className="t-corpo mt-1 text-muted-foreground">
        Quando la diretta finisce, alla sala compare un invito a scriverti su
        WhatsApp. Senza numero resta solo un ringraziamento.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          disabled={!caricato}
          placeholder="+39 333 1234567"
          inputMode="tel"
          aria-label="Numero WhatsApp per dopo la diretta"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-foreground"
        />
        <button
          onClick={() => void salva()}
          disabled={salvo || !caricato}
          className="rounded-lg border px-3 py-2 text-[12px] font-medium hover:bg-muted disabled:opacity-50"
        >
          {salvo ? "Salvo…" : "Salva"}
        </button>
      </div>
      {!numero && caricato && (
        <p className="t-nota mt-1.5 text-amber-600">
          Non c'è nessun numero: alla fine della diretta la sala non potrà scriverti.
        </p>
      )}
    </div>
  );
}
