/** ─────────────────────────────────────────────────────────────────────────
 *  I MESSAGGI PREIMPOSTATI — l'editor
 *
 *  DA DOVE ARRIVA
 *  Richiesta del committente: «fai che tutti i messaggi posso modificarli da
 *  una scheda nelle impostazioni, con i segnaposto».
 *  L'editor c'era già ed era buono, ma viveva dentro la pagina delle chat
 *  (/CRM/whatsapp), cioè in un posto in cui si entra per LEGGERE le
 *  conversazioni, non per configurare. Chi cercava «dove si cambiano i testi»
 *  andava in Impostazioni e non trovava niente.
 *  Adesso è un componente suo e sta in due posti: dentro la pagina WhatsApp,
 *  dov'era, e nella scheda «Messaggi» di Impostazioni, dove lo si cerca.
 *
 *  ⚠️ UN EDITOR SOLO, NON DUE. Due schermate gemelle per la stessa
 *   configurazione si scostano al primo ritocco, e allora lo stesso testo
 *   risulta diverso a seconda della porta da cui lo si guarda.
 *  ⚠️ I TESTI DI PARTENZA E LE REGOLE DEI SEGNAPOSTO NON STANNO QUI: stanno in
 *   crm/whatsapp, insieme alla funzione che li compone. Qui si disegna soltanto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCRM } from "@/crm/CRMContext";
import { ALL_LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/crm/types";
import { Vuoto, classiStato } from "@/crm/ui";
import {
  CHIAVE_CONFIG_MODELLI,
  CAPO_DECIDENDO,
  SEGUE_IL_TESTO_DI,
  ETICHETTA_MODELLO_EXTRA,
  MODELLI_ORIGINALI,
  SEGNAPOSTI,
  componiMessaggio,
  controllaModello,
  impostaModelliPersonalizzati,
  leadDiEsempio,
  modelliCorrenti,
  modelloModificato,
  segnapostiResidui,
  valoriDaLead,
  type ChiaveModello,
  type Problema,
} from "@/crm/whatsapp";

/** ── PERCHÉ `app_config` SI DESCRIVE A MANO ─────────────────────────────────
 *  La tabella è stata aggiunta con una migrazione a parte e non compare nei
 *  tipi generati di Supabase: senza questa descrizione ogni chiamata sarebbe un
 *  errore di tipo. Si dichiara una volta sola, come si fa già per le tabelle
 *  WhatsApp più sotto e in api.crm.accesso.ts. */
const dbConfig = supabase as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{ data: { value?: string } | null }>;
      };
    };
    upsert: (
      v: Record<string, unknown>,
      o: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

/** Legge i modelli salvati e li mette in circolo per TUTTO il CRM.
 *  Sta fuori dai componenti perché la usano sia la pagina (all'apertura) sia
 *  l'editor (quando si apre): una funzione sola, un comportamento solo. */
export async function caricaModelliSalvati(): Promise<void> {
  const { data } = await dbConfig
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_CONFIG_MODELLI)
    .maybeSingle();
  try {
    impostaModelliPersonalizzati(
      data?.value ? (JSON.parse(data.value) as Partial<Record<ChiaveModello, string>>) : {},
    );
  } catch {
    //  Configurazione illeggibile: si continua con i testi originali, che sono
    //  sempre validi. Un messaggio scritto bene vale più di un errore a schermo.
    impostaModelliPersonalizzati({});
  }
}

const GRUPPI_MODELLI: { titolo: string; nota: string; chiavi: ChiaveModello[] }[] = [
  {
    titolo: "Valgono per tutti",
    nota: "La firma entra in ogni messaggio",
    //  ⚠️ Tre promemoria e non uno: online, in studio, telefonata. Il perché
    //   sta in `promemoriaDi` (crm/whatsapp) — un solo testo parlava sempre di
    //   videochiamata, anche a chi doveva venire in studio.
    chiavi: ["firma", "promemoria", "promemoria_sede", "promemoria_richiamo"],
  },
  {
    /*  ── ⚠️ I TRE DEL CONTATTO DI RITORNO ────────────────────────────────
        Non sono «uno per stato»: partono dal tasto WhatsApp dei duplicati
        (crm/importa/ricarico), e quale dei quattro parta lo decide la
        situazione: consulenza saltata, ancora da fare, mai presa, già fatta. Messi in un gruppo loro
        perché chi viene a cambiarli li cerca insieme. */
    titolo: "Chi ci aveva già contattato",
    nota: "Partono dal tasto WhatsApp sui lead di ritorno",
    chiavi: ["ritorno_sospeso", "ritorno_futuro", "ritorno_mai", "ritorno_fatta"],
  },
  {
    titolo: "Uno per stato",
    nota: "Parte quando la trattativa passa a quello stato",
    chiavi: ALL_LEAD_STATUSES as ChiaveModello[],
  },
];

/** Da dove parte ogni testo che non è «uno per stato»: senza questa riga si va
 *  a cercare uno stato della trattativa che non esiste. */
const NOTA_MODELLO: Partial<Record<ChiaveModello, string>> = {
  firma: "Chiude ogni messaggio: correggerla qui li sistema tutti.",
  promemoria: "Parte il giorno prima dell'appuntamento, dall'agenda.",
  promemoria_sede: "Parte il giorno prima della visita in studio.",
  promemoria_richiamo: "Parte il giorno prima del richiamo telefonico.",
  link_consulenza: "Si manda quando il cliente chiede di nuovo il link.",
  ritorno_sospeso:
    "Dal tasto WhatsApp sui lead di ritorno, quando la consulenza che avevano era saltata.",
  ritorno_futuro:
    "Dal tasto WhatsApp sui lead di ritorno che una consulenza ce l'hanno ancora davanti.",
  ritorno_mai: "Dal tasto WhatsApp sui lead di ritorno che un appuntamento non l'hanno mai preso.",
  ritorno_fatta:
    "Dal tasto WhatsApp sui lead di ritorno che la consulenza l'hanno già fatta: non gli si offre di farla, gli si offre di risentirsi.",
};

function etichettaModello(k: ChiaveModello): string {
  //  ⚠️ Si guarda PRIMA l'elenco dei testi che non sono stati: da quando ci
  //   sono anche i tre del contatto di ritorno, un elenco scritto a mano qui
  //   dentro sarebbe la seconda lista da tenere allineata alla prima.
  if (k in ETICHETTA_MODELLO_EXTRA)
    return ETICHETTA_MODELLO_EXTRA[k as keyof typeof ETICHETTA_MODELLO_EXTRA];
  return LEAD_STATUS_LABEL[k as LeadStatus] ?? k;
}

export function EditorMessaggi() {
  const { consultants } = useCRM();
  const [bozze, setBozze] = useState<Record<ChiaveModello, string>>(() => modelliCorrenti());
  //  Il confronto per capire cosa è ancora da salvare: senza, il pulsante
  //  "Salva" resta acceso per sempre e non si sa più se le modifiche sono
  //  andate a buon fine.
  const [salvati, setSalvati] = useState<Record<ChiaveModello, string>>(() => modelliCorrenti());
  const [chiave, setChiave] = useState<ChiaveModello>("appuntamento_fissato");
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void (async () => {
      await caricaModelliSalvati();
      const correnti = modelliCorrenti();
      setBozze(correnti);
      setSalvati(correnti);
      setCaricando(false);
    })();
  }, []);

  const bozza = bozze[chiave] ?? "";

  /** Il nome vero di un consulente rende l'anteprima credibile; se non ce ne
   *  sono ancora, un nome d'esempio è comunque meglio di una riga vuota. */
  const consulenteEsempio = consultants[0]?.data.nome || "Luca";

  /** ── L'ANTEPRIMA USA LA FIRMA CHE SI STA SCRIVENDO ──────────────────────
   *  `componiMessaggio` espanderebbe `{firma}` con la versione SALVATA: mentre
   *  si corregge la firma si vedrebbe ancora quella vecchia dentro gli altri
   *  messaggi, cioè l'esatto contrario di un'anteprima. */
  const anteprima = useMemo(() => {
    const esempio = leadDiEsempio(chiave);
    const valori = valoriDaLead(esempio, chiave, consulenteEsempio);
    const conFirma = bozza.replace(/\{firma\}/g, () => bozze.firma ?? "");
    return componiMessaggio(conFirma, valori, false);
  }, [bozza, bozze.firma, chiave, consulenteEsempio]);

  /** Cosa non va, in ordine: prima ciò che blocca, poi ciò che peggiora. */
  const problemi = useMemo<Problema[]>(() => {
    const p = controllaModello(chiave, bozza);
    const residui = segnapostiResidui(anteprima);
    if (residui.length > 0) {
      p.unshift({
        livello: "errore",
        testo: `${residui.join("  ")} resterebbe scritto così nel messaggio ricevuto dal cliente.`,
      });
    }
    return p;
  }, [chiave, bozza, anteprima]);

  /** Gli avvisi di TUTTI i modelli: servono a mettere il pallino nell'elenco,
   *  altrimenti un errore in un messaggio che non si sta guardando si scopre
   *  solo dal cliente. */
  const problemiPerChiave = useMemo(() => {
    const out = {} as Record<ChiaveModello, "errore" | "avviso" | null>;
    (Object.keys(bozze) as ChiaveModello[]).forEach((k) => {
      const p = controllaModello(k, bozze[k] ?? "");
      out[k] = p.some((x) => x.livello === "errore")
        ? "errore"
        : p.some((x) => x.livello === "avviso")
          ? "avviso"
          : null;
    });
    return out;
  }, [bozze]);

  const daSalvare = useMemo(
    () =>
      (Object.keys(bozze) as ChiaveModello[]).filter(
        (k) => (bozze[k] ?? "").trim() !== (salvati[k] ?? "").trim(),
      ),
    [bozze, salvati],
  );

  const scriviBozza = (testo: string) => setBozze((b) => ({ ...b, [chiave]: testo }));

  /** Inserisce il segnaposto dove sta il cursore: cercare la posizione a mano
   *  in un testo di cinque righe è il motivo per cui i segnaposto non si usano. */
  const inserisciSegnaposto = (nome: string) => {
    const el = areaRef.current;
    const token = `{${nome}}`;
    if (!el) {
      scriviBozza(bozza + token);
      return;
    }
    const da = el.selectionStart ?? bozza.length;
    const a = el.selectionEnd ?? bozza.length;
    const testo = bozza.slice(0, da) + token + bozza.slice(a);
    scriviBozza(testo);
    requestAnimationFrame(() => {
      el.focus();
      const pos = da + token.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* il cursore non è essenziale: il testo è già inserito */
      }
    });
  };

  const salva = async () => {
    setSalvando(true);
    //  Si salvano SOLO i testi diversi dall'originale: così un domani in cui si
    //  migliora un messaggio di partenza, chi non l'aveva toccato riceve la
    //  versione nuova invece di restare fermo a una copia identica.
    const mappa: Partial<Record<ChiaveModello, string>> = {};
    (Object.keys(bozze) as ChiaveModello[]).forEach((k) => {
      const t = (bozze[k] ?? "").trim();
      if (t && modelloModificato(k, t)) mappa[k] = t;
    });
    const { error } = await dbConfig.from("app_config").upsert(
      {
        key: CHIAVE_CONFIG_MODELLI,
        value: JSON.stringify(mappa),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    impostaModelliPersonalizzati(mappa);
    const correnti = modelliCorrenti();
    setBozze(correnti);
    setSalvati(correnti);
    toast.success(
      daSalvare.length === 1
        ? "Messaggio salvato: parte da adesso da tutto il CRM"
        : `${daSalvare.length} messaggi salvati: partono da adesso da tutto il CRM`,
    );
  };

  const ripristina = () => {
    const originale = MODELLI_ORIGINALI[chiave] ?? "";
    scriviBozza(originale);
  };

  if (caricando) {
    return (
      <div className="flex-1 min-h-0 grid place-items-center text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico i messaggi…
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* ── Elenco dei testi ─────────────────────────────────────────────── */}
      <aside className="md:w-[268px] border-b md:border-b-0 md:border-r border-border bg-card md:overflow-y-auto shrink-0 max-h-[38vh] md:max-h-none overflow-y-auto">
        {GRUPPI_MODELLI.map((g) => (
          <div key={g.titolo}>
            <div className="px-3 pt-3 pb-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.titolo}
              </div>
              <div className="text-[11px] text-muted-foreground/80">{g.nota}</div>
            </div>
            {g.chiavi.map((k) => {
              const attivo = k === chiave;
              const modificato = modelloModificato(k, bozze[k] ?? "");
              const avviso = problemiPerChiave[k];
              return (
                <button
                  key={k}
                  onClick={() => setChiave(k)}
                  className={cn(
                    "w-full text-left px-3 py-2 border-b border-border flex items-center gap-2 transition-colors",
                    attivo ? "bg-emerald-50/70" : "hover:bg-muted/50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-tight">
                      {etichettaModello(k)}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {(bozze[k] ?? "").replace(/\n+/g, " ").slice(0, 46) || "—"}
                    </span>
                  </span>
                  {avviso === "errore" && (
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  )}
                  {avviso === "avviso" && (
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                  {modificato && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                      title="Modificato rispetto al testo originale"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* ── Il testo e la sua anteprima ──────────────────────────────────── */}
      <section className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-muted/30">
        <div className="mx-auto max-w-3xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight">
                {etichettaModello(chiave)}
              </h2>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {/*  ⚠️ La riga dice DA DOVE PARTE quel testo. Da quando i
                    modelli non sono più solo «uno per stato», dire «quando la
                    trattativa passa a questo stato» su un messaggio che parte
                    da un pulsante manderebbe a cercare uno stato che non
                    esiste. */}
                {NOTA_MODELLO[chiave] ?? "Proposto quando la trattativa passa a questo stato."}
              </p>
              {/*  ── ⚠️ QUATTRO STATI, UN TESTO SOLO ─────────────────────
                   «Ricontatto fissato», «In valutazione», «Da gestire in
                   chat» e «Fissa meet dopo» partono con lo stesso messaggio,
                   perché per il cliente sono lo stesso momento. Correggerne
                   uno li corregge tutti, e chi lo sta facendo deve saperlo
                   PRIMA di premere Salva — non scoprirlo da un cliente. */}
              {SEGUE_IL_TESTO_DI(chiave) && (
                <p className="text-[11.5px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Stesso testo di «{etichettaModello(SEGUE_IL_TESTO_DI(chiave)!)}»: correggilo lì e
                  vale per tutti gli stati di chi sta decidendo.
                </p>
              )}
              {chiave === CAPO_DECIDENDO && (
                <p className="text-[11.5px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Questo testo vale anche per «In valutazione», «Da gestire in chat» e «Fissa meet
                  dopo».
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {chiave !== "firma" && chiave !== "promemoria" && (
                <Badge variant="outline" className={cn("h-5 text-[10px]", classiStato(chiave))}>
                  {LEAD_STATUS_LABEL[chiave as LeadStatus]}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={ripristina}
                disabled={!modelloModificato(chiave, bozza)}
                title="Rimette il testo di partenza"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Testo originale
              </Button>
            </div>
          </div>

          {/* Il testo */}
          <div className="rounded-xl border border-border bg-card p-3">
            <textarea
              ref={areaRef}
              value={bozza}
              onChange={(e) => scriviBozza(e.target.value)}
              rows={Math.min(14, Math.max(5, bozza.split("\n").length + 1))}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground mr-0.5">Inserisci:</span>
              {SEGNAPOSTI.map((s) => (
                <button
                  key={s.chiave}
                  type="button"
                  onClick={() => inserisciSegnaposto(s.chiave)}
                  title={`${s.descrizione}${s.facoltativo ? " · se manca sparisce la riga" : ""}`}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  {`{${s.chiave}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Cosa non va */}
          {problemi.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {problemi.map((p, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11.5px]",
                    p.livello === "errore"
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
                  <span>{p.testo}</span>
                </div>
              ))}
            </div>
          )}

          {/* L'anteprima */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] font-semibold">Come lo legge il cliente</span>
              <span className="text-[11px] text-muted-foreground truncate">
                Marco Bianchi · appuntamento domani alle 15:30 · {consulenteEsempio}
              </span>
            </div>
            <div className="p-4 bg-muted/40">
              {anteprima.trim() ? (
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-emerald-500 bg-emerald-500 px-3 py-2 text-[13px] leading-relaxed text-white shadow-sm">
                  <p className="whitespace-pre-wrap">{anteprima}</p>
                </div>
              ) : (
                <Vuoto
                  titolo="Nessun testo"
                  testo="Un messaggio vuoto non parte: verrebbe usato il testo originale."
                  icona={FileText}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── La barra del salvataggio ─────────────────────────────────────── */}
      <div className="shrink-0 md:w-[220px] border-t md:border-t-0 md:border-l border-border bg-card px-3 py-2 md:py-3 flex md:flex-col items-center md:items-stretch gap-2">
        <div className="min-w-0 flex-1 md:flex-none text-[11.5px] text-muted-foreground">
          {daSalvare.length === 0
            ? "Nessuna modifica da salvare."
            : `${daSalvare.length} ${daSalvare.length === 1 ? "messaggio modificato" : "messaggi modificati"}: ${daSalvare
                .map(etichettaModello)
                .slice(0, 3)
                .join(", ")}${daSalvare.length > 3 ? "…" : ""}`}
        </div>
        <Button
          onClick={() => void salva()}
          disabled={salvando || daSalvare.length === 0}
          size="sm"
          className="h-8 shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          {salvando ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Salva
        </Button>
        <p className="hidden md:block text-[11px] text-muted-foreground leading-relaxed">
          I testi salvati vengono usati subito da agenda, trattative, scheda cliente e area
          consulenti.
        </p>
      </div>
    </div>
  );
}
