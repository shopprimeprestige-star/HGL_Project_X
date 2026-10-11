/** ── IMPOSTAZIONI · MEETLY ──────────────────────────────────────────────────
 *
 *  ── PERCHÉ QUI NON C'È TUTTO, ED È LA COSA GIUSTA ─────────────────────────
 *  Meetly ha già il suo pannello, dentro la consulenza: listino, sconti, logo,
 *  slide, casi studio, registrazioni. Quelle cifre e quelle immagini le si
 *  cambia MENTRE si parla col cliente — «facciamo 2.400 invece di 2.600» — e
 *  stanno dove serve averle, cioè a un tocco dalla schermata che il cliente sta
 *  guardando.
 *  Copiarle anche qui vorrebbe dire due comandi per lo stesso valore in due
 *  schermate diverse: il giorno che divergono, nessuno sa quale comanda, e si
 *  scopre dal preventivo sbagliato mandato a un cliente.
 *
 *  Qui sta quello che nel pannello di Meetly NON può stare: l'infrastruttura.
 *  Il server TURN è una credenziale d'impianto — la si mette una volta e non
 *  la si tocca più — e chi la mette è chi amministra, non chi presenta. E la
 *  prova di funzionamento, che prima non esisteva da nessuna parte: l'unico
 *  modo di sapere se una videochiamata reggerà era fare una videochiamata.
 *
 *  Del resto c'è l'indice, con i collegamenti: niente è nascosto, niente è
 *  duplicato.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  FileText,
  Images,
  Loader2,
  Percent,
  Server,
  Sparkles,
  TriangleAlert,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { intestazioniCRM, fetchCRM } from "./AuthContext";

type Esito =
  | { stato: "fermo" }
  | { stato: "provo" }
  | { stato: "fatto"; relay: boolean; srflx: boolean; host: boolean; ms: number; server: string }
  | { stato: "rotto"; motivo: string };

/** ── LA PROVA DEL TURN ─────────────────────────────────────────────────────
 *  Apre una connessione vera con gli stessi server che userebbe una
 *  consulenza e guarda che tipo di indirizzi tornano indietro:
 *   · `host`  — il proprio indirizzo di rete. C'è sempre, non dimostra niente.
 *   · `srflx` — l'indirizzo pubblico visto da fuori (lo dice lo STUN). Basta
 *               quando i due sono su reti «normali».
 *   · `relay` — un indirizzo SUL server TURN. È l'unico che dimostra che il
 *               TURN risponde e accetta le credenziali, ed è quello che salva
 *               la chiamata quando il cliente è in 4G o dietro la rete di un
 *               ufficio.
 *  Senza `relay` la videochiamata funziona lo stesso in metà dei casi — ed è
 *  esattamente il tipo di guasto che si scopre col cliente collegato.
 */
async function provaIlTurn(): Promise<Esito> {
  const partito = Date.now();
  try {
    const cfg = await (await fetch("/api/public/turn")).json();
    const iceServers: RTCIceServer[] = Array.isArray(cfg?.iceServers) ? cfg.iceServers : [];
    const server =
      iceServers
        .flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]))
        .find((u) => String(u).startsWith("turn")) ?? "";

    const pc = new RTCPeerConnection({ iceServers });
    //  Serve un canale qualsiasi, o non parte la raccolta degli indirizzi.
    pc.createDataChannel("prova");

    const visti = new Set<string>();
    const finito = new Promise<void>((risolvi) => {
      const orologio = setTimeout(risolvi, 8000);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(orologio);
          risolvi();
          return;
        }
        const t = /typ (\w+)/.exec(e.candidate.candidate)?.[1];
        if (t) visti.add(t);
        //  Appena arriva un relay si può smettere: è la risposta cercata, e
        //  aspettare gli altri otto secondi non aggiunge niente.
        if (t === "relay") {
          clearTimeout(orologio);
          risolvi();
        }
      };
    });

    await pc.setLocalDescription(await pc.createOffer());
    await finito;
    try {
      pc.close();
    } catch {
      /* già chiusa */
    }

    return {
      stato: "fatto",
      relay: visti.has("relay"),
      srflx: visti.has("srflx"),
      host: visti.has("host"),
      ms: Date.now() - partito,
      server: String(server),
    };
  } catch (e) {
    return { stato: "rotto", motivo: String((e as Error).message || e) };
  }
}

export function ImpostazioniMeetly() {
  const [turn, setTurn] = useState({
    cfKeyId: "",
    cfApiToken: "",
    url: "",
    username: "",
    credential: "",
  });
  const [haToken, setHaToken] = useState(false);
  const [haCredential, setHaCredential] = useState(false);
  const [carico, setCarico] = useState(true);
  const [salvo, setSalvo] = useState(false);
  const [esito, setEsito] = useState<Esito>({ stato: "fermo" });

  const leggi = useCallback(async () => {
    try {
      const t = await fetchCRM("/api/public/turn?stato=1").then((r) => r.json());
      if (t && !t.error) {
        setTurn((v) => ({
          ...v,
          cfKeyId: t.cfKeyId || "",
          url: t.url || "",
          username: t.username || "",
        }));
        setHaToken(!!t.haCfApiToken);
        setHaCredential(!!t.haCredential);
      }
    } catch {
      toast.error("Non riesco a leggere la configurazione di Meetly");
    } finally {
      setCarico(false);
    }
  }, []);

  useEffect(() => {
    void leggi();
  }, [leggi]);

  const salva = async () => {
    setSalvo(true);
    try {
      const r = await fetch("/api/public/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify(turn),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(String(j?.error || `errore ${r.status}`));
      setTurn((v) => ({ ...v, cfApiToken: "", credential: "" }));
      setEsito({ stato: "fermo" }); // la prova di prima non vale più
      void leggi();
      toast.success("Server TURN salvato");
    } catch (e) {
      toast.error(String((e as Error).message || e));
    } finally {
      setSalvo(false);
    }
  };

  const prova = async () => {
    setEsito({ stato: "provo" });
    setEsito(await provaIlTurn());
  };

  const configurato = !!(turn.cfKeyId || turn.url);

  if (carico) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ══ LA PROVA ═══════════════════════════════════════════════════ */}
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4" /> La videochiamata funziona?
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void prova()}
            disabled={esito.stato === "provo"}
          >
            {esito.stato === "provo" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {esito.stato === "provo" ? "Sto provando…" : "Prova adesso"}
          </Button>
        </div>
        <p className="t-nota mt-1 text-muted-foreground">
          Apre una connessione vera con gli stessi server che userebbe una consulenza. Prima
          l&apos;unico modo di saperlo era fare una videochiamata e vedere se partiva.
        </p>

        {esito.stato === "fatto" && (
          <div className="mt-3 space-y-2">
            {/*  Il verdetto è UNO SOLO e sta in cima: «passa dal TURN» o no.
                Il dettaglio dei tre tipi di indirizzo sta sotto, per chi deve
                capire perché. */}
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 ${esito.relay ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}
            >
              {esito.relay ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0">
                <p className="t-riga font-medium">
                  {esito.relay ? "Il server TURN risponde" : "Il server TURN non risponde"}
                </p>
                <p className="t-nota text-muted-foreground">
                  {esito.relay
                    ? "Le chiamate reggono anche col cliente in 4G o dietro la rete di un ufficio."
                    : "Le chiamate funzionano solo fra reti «facili». Con un cliente in 4G o dietro un firewall aziendale resta lo schermo nero — ed è il guasto che si scopre col cliente collegato."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pastiglia acceso={esito.host} testo="indirizzo locale" />
              <Pastiglia acceso={esito.srflx} testo="indirizzo pubblico (STUN)" />
              <Pastiglia acceso={esito.relay} testo="passaggio dal TURN" />
              <span className="t-etichetta self-center text-muted-foreground">{esito.ms} ms</span>
            </div>
            {!!esito.server && (
              <p className="t-etichetta text-muted-foreground">Server: {esito.server}</p>
            )}
          </div>
        )}

        {esito.stato === "rotto" && (
          <p className="t-corpo mt-3 flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" /> {esito.motivo}
          </p>
        )}
      </div>

      {/* ══ IL SERVER TURN ═════════════════════════════════════════════ */}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Server className={`h-4 w-4 ${configurato ? "text-emerald-600" : "text-amber-500"}`} />
          Server TURN {configurato ? "" : "— da configurare"}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          È l&apos;unica credenziale che Meetly abbia. Fa incontrare due dispositivi su reti diverse
          — il tuo portatile in ufficio e il telefono del cliente in 4G — che da soli non si
          troverebbero. Senza, la chiamata parte e resta nera.
        </p>

        {/*  ⚠️ L'AVVISO PIÙ IMPORTANTE DELLA SCHERMATA. Non ne esistono tre:
            questa configurazione la usano le consulenze, il webinar su Meetly e
            anche quello su Cloudflare. Chi la cambia pensando di toccare una
            cosa sola le ferma tutte, e se ne accorge al primo cliente. */}
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs leading-relaxed">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            <b>È condivisa.</b> La usano le videoconsulenze e tutti e due i trasporti del webinar.
            Se la sbagli qui, si ferma anche il resto.
          </span>
        </p>

        <p className="text-xs font-semibold text-muted-foreground">
          Cloudflare TURN — Dashboard → Realtime → Server TURN (1.000 GB al mese gratis)
        </p>
        <input
          value={turn.cfKeyId}
          onChange={(e) => setTurn({ ...turn, cfKeyId: e.target.value })}
          placeholder="Turn Token ID"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          value={turn.cfApiToken}
          onChange={(e) => setTurn({ ...turn, cfApiToken: e.target.value })}
          type="password"
          autoComplete="new-password"
          placeholder={haToken ? "API Token — lascia vuoto per non cambiarlo" : "API Token"}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <p className="pt-1 text-xs font-semibold text-muted-foreground">
          Oppure un TURN tuo (coturn, Metered, Twilio…)
        </p>
        <input
          value={turn.url}
          onChange={(e) => setTurn({ ...turn, url: e.target.value })}
          placeholder="turn:esempio.it:3478  (più indirizzi separati da virgola)"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={turn.username}
            onChange={(e) => setTurn({ ...turn, username: e.target.value })}
            placeholder="Utente"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={turn.credential}
            onChange={(e) => setTurn({ ...turn, credential: e.target.value })}
            type="password"
            autoComplete="new-password"
            placeholder={haCredential ? "Password — vuoto = invariata" : "Password"}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Si possono tenere tutti e due: si provano entrambi e vince quello che risponde. I campi
          password non tornano mai indietro dal server: lasciandoli vuoti restano quelli di prima.
        </p>

        <Button onClick={() => void salva()} disabled={salvo}>
          {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
        </Button>
      </div>

      {/* ══ DOVE STA IL RESTO ══════════════════════════════════════════ */}
      <div className="rounded-xl border p-4">
        <p className="t-riga mb-1 font-medium">Il resto si configura dentro Meetly</p>
        <p className="t-nota mb-3 text-muted-foreground">
          Non è nascosto ed è tutto raggiungibile qui sotto. Sta lì e non qui perché sono cose che
          si cambiano <b>mentre parli col cliente</b> — «facciamo 2.400 invece di 2.600» — e devono
          essere a un tocco dalla schermata che lui sta guardando. Averle anche qui vorrebbe dire
          due comandi per lo stesso valore, e un giorno divergono.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Voce
            icona={FileText}
            titolo="Listino"
            desc="I prezzi del preventivo"
            href="/preventivo"
          />
          <Voce
            icona={Percent}
            titolo="Sconti e coupon"
            desc="Codici e sconti a quantità"
            href="/preventivo"
          />
          <Voce
            icona={Sparkles}
            titolo="Logo e slide"
            desc="Marchio e schermate della presentazione"
            href="/preventivo"
          />
          <Voce
            icona={Images}
            titolo="Media e casi studio"
            desc="Foto e video da mostrare"
            href="/presenta"
          />
          <Voce
            icona={Video}
            titolo="Registrazioni"
            desc="L'archivio delle consulenze"
            href="/preventivo"
          />
          <Voce
            icona={Users}
            titolo="Presentatori"
            desc="Chi può entrare, e col suo PIN"
            href="/preventivo"
          />
        </div>
        <p className="t-etichetta mt-3 text-muted-foreground">
          Dentro Meetly le trovi nel pannello Impostazioni, in alto a destra.
        </p>
      </div>
    </div>
  );
}

function Pastiglia({ acceso, testo }: { acceso: boolean; testo: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${acceso ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground"}`}
    >
      {acceso ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {testo}
    </span>
  );
}

function Voce({
  icona: Icona,
  titolo,
  desc,
  href,
}: {
  icona: typeof Server;
  titolo: string;
  desc: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 rounded-lg border p-3 transition hover:bg-muted/50"
    >
      <Icona className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="t-riga block font-medium">{titolo}</span>
        <span className="t-nota block text-muted-foreground">{desc}</span>
      </span>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}
