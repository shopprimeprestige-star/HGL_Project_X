/** ─────────────────────────────────────────────────────────────────────────
 *  MetaVsTikTokSection — «conviene di più Meta o TikTok?»
 *
 *  COSA È CAMBIATO, E PERCHÉ
 *   · IL DIAGRAMMA NON DICEVA NIENTE. C'era un secondo Sankey con cinque nodi
 *     («Meta Spend → Lead Meta → Vendite»): quattro nastri per informazioni che
 *     stanno in sei numeri, e con 100px di margine per le etichette su un
 *     telefono restava una striscia colorata senza nomi. Al suo posto ci sono
 *     gli stessi tre gradini — speso, persone, clienti — scritti in parole con
 *     una barretta di lunghezza proporzionale: si leggono a 320px e si
 *     confrontano fra i due canali perché la scala è la stessa.
 *   · PARLAVA UN'ALTRA LINGUA. «Spend», «ROAS leader», «CPL», «CPA»,
 *     «attribution via fbclid». Chi usa questo CRM vende impianti di capelli:
 *     adesso legge «speso», «costo per contatto», «costo per cliente» e «per
 *     ogni euro speso ne tornano», che è la stessa cosa detta come la si pensa.
 *   · STESSI MATTONI DEL RESTO DEL CRM. Era rimasto l'unico blocco della pagina
 *     con Card/CardHeader di shadcn, il fondo bianco fisso e un badge tutto suo:
 *     ora Scheda · Chip · Kpi come nelle altre venti schermate.
 *   · IL COLORE È UN SEGNALE. Il blu di Meta e il degradé rosa/ciano di TikTok
 *     erano decorazione: due tinte forti che non dicevano se le cose andassero
 *     bene o male. Restano due iniziali neutre; l'emerald lo prende SOLO il
 *     canale che rende di più, che è l'unica cosa da vedere in un secondo.
 *   · SE LA LETTURA FALLISCE, LO DICE. La promise non aveva un `catch`: alla
 *     prima query andata male il blocco restava a girare per sempre, senza che
 *     nessuno potesse sapere perché.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { Chip, Scheda, VuotoRiga, eur } from "@/crm/ui";

interface StatoCanale {
  speso: number;
  persone: number;
  clienti: number;
  fatturato: number;
  /** quanto costa far arrivare una persona */
  costoPersona: number;
  /** quanto costa portare a casa un cliente */
  costoCliente: number;
  /** per ogni euro speso, quanti ne tornano */
  ritorno: number;
}

function canaleVuoto(): StatoCanale {
  return {
    speso: 0,
    persone: 0,
    clienti: 0,
    fatturato: 0,
    costoPersona: 0,
    costoCliente: 0,
    ritorno: 0,
  };
}

/** Il ritorno si scrive con i centesimi: fra 1,80 e 2,40 per euro speso c'è la
 *  differenza fra una campagna che sta in piedi e una che ci guadagna. */
const perEuro = (v: number) =>
  Number.isFinite(v) && v > 0
    ? `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const conta = (v: number) => v.toLocaleString("it-IT");

export function MetaVsTikTokSection({
  sinceISO,
  untilISO,
}: {
  sinceISO: string;
  untilISO: string;
}) {
  const { user } = useAuth();
  const [meta, setMeta] = useState<StatoCanale>(canaleVuoto());
  const [tiktok, setTiktok] = useState<StatoCanale>(canaleVuoto());
  //  Le persone senza codice dell'annuncio non stanno da nessuna delle due
  //  parti: dirlo evita di leggere «40 persone» come se fossero tutte quelle
  //  arrivate nel periodo.
  const [senzaCodice, setSenzaCodice] = useState(0);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    setCaricamento(true);
    setErrore(null);
    Promise.all([
      supabase
        .from("meta_ad_spend")
        .select("spend")
        .eq("user_id", user.id)
        .gte("spend_date", sinceISO)
        .lte("spend_date", untilISO),
      supabase
        .from("tiktok_ad_spend")
        .select("spend")
        .eq("user_id", user.id)
        .gte("spend_date", sinceISO)
        .lte("spend_date", untilISO),
      supabase
        .from("public_leads")
        .select("id, fbclid, ttclid, status")
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`),
      supabase
        .from("crm_leads")
        .select("data")
        .eq("user_id", user.id)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`),
    ])
      .then(([spesaMeta, spesaTikTok, leadPubblici, leadCrm]) => {
        if (!vivo) return;
        const primoErrore =
          spesaMeta.error || spesaTikTok.error || leadPubblici.error || leadCrm.error;
        if (primoErrore) {
          setErrore(primoErrore.message);
          setCaricamento(false);
          return;
        }

        const m = canaleVuoto();
        const t = canaleVuoto();
        let fuori = 0;

        m.speso = (spesaMeta.data || []).reduce(
          (s, r) => s + Number((r as { spend: number }).spend || 0),
          0,
        );
        t.speso = (spesaTikTok.data || []).reduce(
          (s, r) => s + Number((r as { spend: number }).spend || 0),
          0,
        );

        const pubblici =
          (leadPubblici.data as Array<{
            id: string;
            fbclid: string | null;
            ttclid: string | null;
            status: string;
          }> | null) || [];
        const pubbliciPerId = new Map(pubblici.map((p) => [p.id, p]));

        //  ── LA STESSA PERSONA STA IN DUE TABELLE ──────────────────────────
        //  Chi lascia i dati sulla landing nasce in `public_leads` e, quando
        //  viene presa in carico, diventa anche una scheda del CRM che si
        //  ricorda da dove viene (`publicLeadId`). Contando i due elenchi uno
        //  dopo l'altro — come si faceva qui — quella persona valeva due, e
        //  con lei la sua vendita: il costo per contatto risultava la metà di
        //  quello vero. Si parte dalle schede del CRM, che sono quelle con il
        //  prezzo, e si segna quale riga della landing è già stata contata.
        const consumati = new Set<string>();
        const schede = (leadCrm.data as Array<{ data: Record<string, unknown> }> | null) || [];
        for (const c of schede) {
          const d = c.data || {};
          const tracking = (d as { tracking?: Record<string, unknown> }).tracking || {};
          const idPubblico = (d as { publicLeadId?: string }).publicLeadId;
          const gemella = idPubblico ? pubbliciPerId.get(idPubblico) : undefined;
          if (gemella) consumati.add(gemella.id);
          //  Il codice può essersi perso nel passaggio alla scheda: in quel
          //  caso lo si riprende dalla riga della landing, che è la stessa
          //  persona.
          const ttclid =
            (d as { ttclid?: string }).ttclid ||
            (tracking as { ttclid?: string }).ttclid ||
            gemella?.ttclid;
          const fbclid =
            (d as { fbclid?: string }).fbclid ||
            (tracking as { fbclid?: string }).fbclid ||
            gemella?.fbclid;
          const pagamento =
            (d as { payment?: { prezzoFinaleVendita?: number; prezzoTotale?: number } }).payment ||
            {};
          const incasso = Number(pagamento.prezzoFinaleVendita || pagamento.prezzoTotale || 0);
          const stato = String((d as { status?: string }).status || "").toLowerCase();
          const vinto = incasso > 0 || ["vinto", "venduto", "installato"].includes(stato);
          if (ttclid) {
            t.persone += 1;
            if (vinto) {
              t.clienti += 1;
              t.fatturato += incasso;
            }
          } else if (fbclid) {
            m.persone += 1;
            if (vinto) {
              m.clienti += 1;
              m.fatturato += incasso;
            }
          } else {
            fuori += 1;
          }
        }

        //  Restano le persone della landing che una scheda non ce l'hanno
        //  ancora: sono arrivate, e vanno contate.
        for (const p of pubblici) {
          if (consumati.has(p.id)) continue;
          const vinto = p.status === "vinto" || p.status === "venduto";
          if (p.ttclid) {
            t.persone += 1;
            if (vinto) t.clienti += 1;
          } else if (p.fbclid) {
            m.persone += 1;
            if (vinto) m.clienti += 1;
          } else {
            fuori += 1;
          }
        }

        for (const c of [m, t]) {
          c.costoPersona = c.persone > 0 ? c.speso / c.persone : 0;
          c.costoCliente = c.clienti > 0 ? c.speso / c.clienti : 0;
          c.ritorno = c.speso > 0 ? c.fatturato / c.speso : 0;
        }

        setMeta(m);
        setTiktok(t);
        setSenzaCodice(fuori);
        setCaricamento(false);
      })
      .catch((e) => {
        if (!vivo) return;
        setErrore(e instanceof Error ? e.message : String(e));
        setCaricamento(false);
      });
    return () => {
      vivo = false;
    };
  }, [user, sinceISO, untilISO]);

  //  Vince chi riporta più soldi per euro speso, non chi ha più lead: un canale
  //  che porta il doppio delle persone a metà prezzo e non vende niente costa
  //  e basta.
  const vincitore = useMemo<"meta" | "tiktok" | null>(() => {
    //  Se su un canale non è stato speso niente non c'è nessun confronto da
    //  fare: dire «Meta rende di più» quando TikTok è spento è una bugia che
    //  sembra un dato.
    if (meta.speso <= 0 || tiktok.speso <= 0) return null;
    if (meta.ritorno === tiktok.ritorno) return null;
    return meta.ritorno > tiktok.ritorno ? "meta" : "tiktok";
  }, [meta.speso, tiktok.speso, meta.ritorno, tiktok.ritorno]);

  //  Scale comuni ai due canali: se ognuno normalizzasse sul proprio massimo,
  //  due barre lunghe uguali direbbero numeri diversi ed è esattamente il modo
  //  in cui un grafico mente.
  const scale = {
    speso: Math.max(meta.speso, tiktok.speso, 1),
    persone: Math.max(meta.persone, tiktok.persone, 1),
  };

  const titolo = "Meta o TikTok: chi rende di più";
  const nota = "Solo le persone arrivate cliccando un annuncio";

  if (caricamento) {
    return (
      <Scheda titolo={titolo} nota={nota} icona={Scale}>
        <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sto confrontando i due canali…
        </div>
      </Scheda>
    );
  }

  if (errore) {
    return (
      <Scheda titolo={titolo} nota={nota} icona={Scale} senzaPadding>
        <VuotoRiga testo={`Non sono riuscito a leggere spesa e contatti: ${errore}`} />
      </Scheda>
    );
  }

  if (meta.speso + tiktok.speso === 0 && meta.persone + tiktok.persone === 0) {
    return (
      <Scheda titolo={titolo} nota={nota} icona={Scale} senzaPadding>
        <VuotoRiga testo="Nessuna spesa e nessun contatto con codice dell'annuncio nel periodo scelto." />
      </Scheda>
    );
  }

  return (
    <Scheda titolo={titolo} nota={nota} icona={Scale}>
      <div className="grid gap-3 md:grid-cols-2">
        <BloccoCanale
          nome="Meta"
          spiega="Facebook e Instagram"
          dati={meta}
          scale={scale}
          vince={vincitore === "meta"}
        />
        <BloccoCanale
          nome="TikTok"
          spiega="Annunci su TikTok"
          dati={tiktok}
          scale={scale}
          vince={vincitore === "tiktok"}
        />
      </div>

      {/*  Come è fatto il conto, in una riga: senza, un numero più basso del
           previsto sembra un errore del CRM invece che una persona arrivata da
           un passaparola. */}
      <p className="mt-3 text-[11.5px] leading-snug text-muted-foreground">
        Una persona finisce in una delle due colonne solo se l'annuncio ha lasciato il suo codice
        nel link (Meta e TikTok ne mettono uno diverso).
        {senzaCodice > 0 && (
          <>
            {" "}
            Le altre <span className="font-medium text-foreground">{conta(senzaCodice)}</span>{" "}
            arrivate nel periodo — passaparola, ricerca su Google, telefono — non stanno né di qua
            né di là.
          </>
        )}{" "}
        Il fatturato conta solo le trattative del CRM con un prezzo scritto in scheda.
      </p>
    </Scheda>
  );
}

/** ── UN CANALE ────────────────────────────────────────────────────────────
 *  Tre gradini in colonna (speso → persone → clienti) e sotto i due costi: è
 *  la stessa forma per Meta e per TikTok, così il confronto si fa scorrendo
 *  l'occhio in orizzontale invece di ricordarsi il numero dell'altro blocco. */
function BloccoCanale({
  nome,
  spiega,
  dati,
  scale,
  vince,
}: {
  nome: string;
  spiega: string;
  dati: StatoCanale;
  scale: { speso: number; persone: number };
  vince: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        vince ? "border-emerald-300 bg-emerald-50/30" : "border-border bg-background"
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-card text-[13px] font-semibold">
            {nome[0]}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold leading-tight">{nome}</div>
            <div className="truncate text-[11px] text-muted-foreground">{spiega}</div>
          </div>
        </div>
        {vince && <Chip tono="vinta">Rende di più</Chip>}
      </div>

      <Gradino etichetta="Speso" valore={eur(dati.speso)} parte={dati.speso} totale={scale.speso} />
      <Gradino
        etichetta="Persone arrivate"
        valore={conta(dati.persone)}
        parte={dati.persone}
        totale={scale.persone}
      />
      <Gradino
        etichetta="Diventate clienti"
        valore={conta(dati.clienti)}
        parte={dati.clienti}
        totale={scale.persone}
        forte
      />

      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-2.5">
        <Voce
          etichetta="Costo per contatto"
          valore={dati.persone > 0 ? eur(dati.costoPersona) : "—"}
        />
        <Voce
          etichetta="Costo per cliente"
          valore={dati.clienti > 0 ? eur(dati.costoCliente) : "—"}
        />
        <Voce etichetta="Fatturato" valore={dati.fatturato > 0 ? eur(dati.fatturato) : "—"} />
        <Voce
          etichetta="Per ogni € speso"
          valore={perEuro(dati.ritorno)}
          classe={classeRitorno(dati.ritorno, dati.speso)}
        />
      </dl>
    </div>
  );
}

/** Un gradino del percorso: etichetta a sinistra, numero a destra, barretta
 *  sotto. La barretta fa il lavoro che nel diagramma faceva lo spessore del
 *  nastro, e lo fa a qualunque larghezza di schermo. */
function Gradino({
  etichetta,
  valore,
  parte,
  totale,
  forte,
}: {
  etichetta: string;
  valore: string;
  parte: number;
  totale: number;
  /** l'ultimo gradino è quello che conta: si vede di più */
  forte?: boolean;
}) {
  const perc = totale > 0 ? Math.min(100, Math.round((parte / totale) * 100)) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11.5px] text-muted-foreground">{etichetta}</span>
        <span
          className={`shrink-0 tabular-nums ${
            forte ? "text-[14px] font-semibold" : "text-[12.5px] font-medium"
          }`}
        >
          {valore}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${forte ? "bg-emerald-500/70" : "bg-sky-500/60"}`}
          style={{ width: `${Math.max(parte > 0 ? 2 : 0, perc)}%` }}
        />
      </div>
    </div>
  );
}

function Voce({
  etichetta,
  valore,
  classe,
}: {
  etichetta: string;
  valore: string;
  classe?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-muted-foreground">{etichetta}</dt>
      <dd className={`truncate text-[13px] font-semibold tabular-nums ${classe ?? ""}`}>
        {valore}
      </dd>
    </div>
  );
}

//  Emerald = la pubblicità si ripaga e avanza · ambra = ci va vicino ·
//  rose = si spende più di quanto rientra. Le stesse tre tinte delle fasi
//  della trattativa: nessun vocabolario di colore nuovo.
function classeRitorno(ritorno: number, speso: number): string {
  if (speso <= 0 || ritorno <= 0) return "";
  if (ritorno >= 2) return "text-emerald-700";
  if (ritorno >= 1) return "text-amber-700";
  return "text-rose-700";
}
