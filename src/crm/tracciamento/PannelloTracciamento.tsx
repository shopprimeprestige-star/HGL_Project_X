/** ── «TRACCIAMENTO» NELLE IMPOSTAZIONI: IL PANNELLO (PannelloTracciamento.tsx) ───────
 *  Shop R1 · T30. Tre lavori, in quest'ordine: capire di chi è il tracciamento del sito, mettere gli ID di Google,
 *  controllare che gli invii dal server arrivino. Schermata di lavoro: densa, chiara, parole semplici.
 *
 *  ⚠️ MAI un token a schermo: questo pannello non li legge nemmeno. Per gli ID di Google scrive solo le sue colonne, sulla
 *   riga dell'utente (come fa la pagina per Meta e TikTok). La salute viene da `/api/crm/tracciamento` (solo codici). */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchCRM, useAuth } from "@/crm/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { colonnaOTabellaMancante, COMANDO_PROPRIETARIO, fraseEsito, validaIdGoogle, type CampoGoogle } from "./regole";

interface Piattaforma {
  piattaforma: "meta" | "tiktok";
  ultimo: { evento: string; esito: string; quando: string } | null;
  invii24h: number;
  errori24h: number;
  /** Le righe lette sono arrivate al tetto: i numeri delle 24 ore sono «almeno» (si scrive «200+»). */
  oltreTetto?: boolean;
}
interface Salute {
  attivo: boolean;
  proprietario?: "nessuno" | "tu" | "altro";
  pixel?: { meta: boolean; tiktok: boolean; ga4: boolean; ads: boolean } | null;
  prova?: { meta: boolean; tiktok: boolean } | null;
  /** `false` se il server non è riuscito a leggere gli ID del proprietario: si dice «non leggibile», non «non impostato». */
  configLeggibile?: boolean;
  piattaforme?: Piattaforma[] | null;
  errori?: { piattaforma: string; evento: string; esito: string; quando: string }[] | null;
  adesso: string;
}
type Lettura = { stato: "carico" } | { stato: "errore"; frase: string } | { stato: "ok"; salute: Salute };

const NOME: Record<string, string> = { meta: "Meta (Facebook e Instagram)", tiktok: "TikTok" };
const VUOTI: Record<CampoGoogle, string> = { ga4: "", ads: "", etichetta: "", merchant: "" };

/** «2 minuti fa», rispetto all'ora del server (non quella del telefono). */
function quantoFa(iso: string, adesso: string): string {
  const s = Math.max(0, Math.round((Date.parse(adesso) - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return "";
  if (s < 60) return "meno di un minuto fa";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "1 minuto fa" : `${m} minuti fa`;
  const o = Math.round(m / 60);
  if (o < 48) return o === 1 ? "1 ora fa" : `${o} ore fa`;
  return `${Math.round(o / 24)} giorni fa`;
}

function Voce({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />}
      <span className={ok ? "" : "text-muted-foreground"}>{children}</span>
      <span className="sr-only">{ok ? "impostato" : "non impostato"}</span>
    </span>
  );
}

export function PannelloTracciamento() {
  const { user } = useAuth();
  const [lettura, setLettura] = useState<Lettura>({ stato: "carico" });
  const [valori, setValori] = useState<Record<CampoGoogle, string>>(VUOTI);
  const [errori, setErrori] = useState<Partial<Record<CampoGoogle, string>>>({});
  const [colonneMancanti, setColonneMancanti] = useState(false);
  // la lettura degli ID di Google è fallita per un altro motivo (rete, permessi): i campi restano spenti, o un «Salva» cancellerebbe quelli veri
  const [letturaGoogleRotta, setLetturaGoogleRotta] = useState(false);
  // i quattro ID sono stati letti davvero: finché non è così i campi sono vuoti per caso e un «Salva» cancellerebbe quelli veri
  const [googleLetti, setGoogleLetti] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const leggiSalute = useCallback(async () => {
    setLettura((l) => (l.stato === "ok" ? l : { stato: "carico" }));
    try {
      const r = await fetchCRM("/api/crm/tracciamento");
      if (r.status === 403) return setLettura({ stato: "errore", frase: "Non hai il permesso di vedere le impostazioni del tracciamento." });
      if (!r.ok) return setLettura({ stato: "errore", frase: "Non riesco a leggere lo stato del tracciamento. Riprova fra poco." });
      const j = (await r.json()) as Salute & { ok?: boolean };
      if (!j.ok) return setLettura({ stato: "errore", frase: "Non riesco a leggere lo stato del tracciamento. Riprova fra poco." });
      setLettura({ stato: "ok", salute: j });
    } catch {
      // una lettura che fallisce non cancella quella buona: resta l'ultima, con la frase accanto
      setLettura((l) => (l.stato === "ok" ? l : { stato: "errore", frase: "Non riesco a collegarmi. Controlla la connessione e riprova." }));
    }
  }, []);

  const userId = user?.id;
  const leggiIdGoogle = useCallback(async () => {
    if (!userId) return;
    setGoogleLetti(false);
    try {
      const { data, error } = await supabase
        .from("tracking_config")
        .select("google_ga4_id,google_ads_id,google_ads_label_acquisto,google_merchant_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        // colonne mancanti = la migrazione S3 non è applicata; ogni altro errore = non riesco a leggere ora
        setColonneMancanti(colonnaOTabellaMancante(error));
        setLetturaGoogleRotta(!colonnaOTabellaMancante(error));
        return;
      }
      const r = (data ?? {}) as Record<string, string | null>;
      setColonneMancanti(false);
      setLetturaGoogleRotta(false);
      setValori({ ga4: r.google_ga4_id ?? "", ads: r.google_ads_id ?? "", etichetta: r.google_ads_label_acquisto ?? "", merchant: r.google_merchant_id ?? "" });
      setGoogleLetti(true);
    } catch {
      // una lettura che lancia (rete) vale «non riesco a leggere»: i campi restano spenti
      setLetturaGoogleRotta(true);
    }
  }, [userId]);

  useEffect(() => {
    void leggiSalute();
  }, [leggiSalute]);
  useEffect(() => {
    void leggiIdGoogle();
  }, [leggiIdGoogle]);

  const salva = async () => {
    if (!user || salvando || !googleLetti || colonneMancanti || letturaGoogleRotta) return;
    const v = validaIdGoogle(valori);
    setErrori(v.errori);
    if (!v.ok) {
      toast.error("Controlla gli ID di Google: ce n'è uno nel formato sbagliato.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("tracking_config").upsert(
      {
        user_id: user.id,
        google_ga4_id: v.valori.ga4,
        google_ads_id: v.valori.ads,
        google_ads_label_acquisto: v.valori.etichetta,
        google_merchant_id: v.valori.merchant,
      } as never,
      { onConflict: "user_id" },
    );
    setSalvando(false);
    if (error) {
      toast.error(colonneMancanti ? "Il database non è ancora aggiornato: gli ID di Google non si possono salvare." : "Non sono riuscito a salvare gli ID di Google. Riprova.");
      return;
    }
    setValori({ ga4: v.valori.ga4 ?? "", ads: v.valori.ads ?? "", etichetta: v.valori.etichetta ?? "", merchant: v.valori.merchant ?? "" });
    toast.success("ID di Google salvati");
    void leggiSalute();
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(COMANDO_PROPRIETARIO);
      toast.success("Comando copiato");
    } catch {
      toast.error("Non riesco a copiare: selezionalo a mano.");
    }
  };

  const s = lettura.stato === "ok" ? lettura.salute : null;
  const campi: { chiave: CampoGoogle; etichetta: string; esempio: string; aiuto: string }[] = [
    { chiave: "ga4", etichetta: "Google Analytics 4", esempio: "G-ABC123XYZ", aiuto: "Conta le visite del sito." },
    { chiave: "ads", etichetta: "Google Ads", esempio: "AW-123456789", aiuto: "Misura le conversioni delle campagne." },
    { chiave: "etichetta", etichetta: "Etichetta di conversione (acquisto)", esempio: "abcDEF123", aiuto: "Serve insieme all'ID di Google Ads." },
    { chiave: "merchant", etichetta: "Merchant Center", esempio: "1234567890", aiuto: "Per il catalogo prodotti su Google." },
  ];

  return (
    <div className="space-y-4">
      {/* ── 1. DI CHI È IL TRACCIAMENTO ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi comanda il tracciamento del sito</CardTitle>
          <p className="text-sm text-muted-foreground">
            Il sito usa gli ID e le chiavi di <strong>un solo account</strong>: il proprietario. Chiunque abbia un accesso potrebbe salvare i propri ID, ma il sito li ignora.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {lettura.stato === "carico" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Leggo lo stato…
            </p>
          )}
          {lettura.stato === "errore" && (
            <div className="flex flex-wrap items-center gap-3" role="alert">
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden /> {lettura.frase}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void leggiSalute()}>
                Riprova
              </Button>
            </div>
          )}
          {s && !s.attivo && (
            <div className="space-y-1">
              <Badge variant="outline">Non ancora attivo</Badge>
              <p className="text-sm">
                Manca un aggiornamento del database (il file «tracciamento» delle migrazioni). Finché non lo applichi dal SQL Editor di Supabase il sito non carica nessun pixel e non manda nessun evento. Il resto del CRM funziona come sempre.
              </p>
            </div>
          )}
          {s?.attivo && s.proprietario === "tu" && (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              <span>
                <strong>Il proprietario è questo account.</strong> Il sito usa gli ID salvati qui e nelle schede Meta Ads e TikTok Ads.
              </span>
            </p>
          )}
          {s?.attivo && s.proprietario === "altro" && (
            <p className="flex items-start gap-2 text-sm" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <span>
                <strong>Il proprietario è un altro account.</strong> Il sito usa gli ID di quell'account: quelli che salvi qui non vengono usati. Per cambiare proprietario serve il SQL Editor di Supabase.
              </span>
            </p>
          )}
          {s?.attivo && s.proprietario === "nessuno" && (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <strong>Il proprietario non è ancora impostato.</strong> Finché non lo è il sito non carica nessun pixel, non manda nessun evento e il CRM non manda nessuna vendita a Meta o TikTok.
                </span>
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Imposta il proprietario dal SQL Editor</p>
                <p className="text-sm text-muted-foreground">
                  In Supabase apri «SQL Editor», incolla il comando qui sotto, scrivi la tua email al posto di <code className="rounded bg-muted px-1 py-0.5 text-xs">EMAIL-DEL-TITOLARE</code> e premi Run. Si fa una volta sola.
                </p>
                <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed" tabIndex={0} aria-label="Comando da incollare nel SQL Editor">
                  <code>{COMANDO_PROPRIETARIO}</code>
                </pre>
                <Button type="button" variant="outline" size="sm" onClick={() => void copia()} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" aria-hidden /> Copia il comando
                </Button>
                <p className="text-sm text-muted-foreground">Poi torna qui e premi «Aggiorna» nella sezione degli invii: deve comparire «Il proprietario è questo account».</p>
              </div>
            </div>
          )}
          {s?.attivo && s.configLeggibile === false && (
            <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground" role="status">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden /> Gli ID impostati non sono leggibili in questo momento: non vuol dire che manchino. Premi «Aggiorna» nella sezione degli invii.
            </p>
          )}
          {s?.attivo && s.configLeggibile !== false && s.pixel && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1" role="group" aria-label="ID impostati per il proprietario">
              <Voce ok={s.pixel.meta}>Pixel Meta</Voce>
              <Voce ok={s.pixel.tiktok}>Pixel TikTok</Voce>
              <Voce ok={s.pixel.ga4}>Google Analytics</Voce>
              <Voce ok={s.pixel.ads}>Google Ads</Voce>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. GLI ID DI GOOGLE ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ID di Google</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gli ID di Meta e TikTok e le loro chiavi si inseriscono nelle schede «Meta Ads» e «TikTok Ads». Qui ci sono quelli di Google: si salvano solo se nel formato giusto, e si cancellano svuotando il campo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {letturaGoogleRotta && (
            <div className="flex flex-wrap items-center gap-3" role="alert">
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Non riesco a leggere gli ID di Google ora. Riprova.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void leggiIdGoogle()}>
                Riprova
              </Button>
            </div>
          )}
          {colonneMancanti && (
            <p className="text-sm text-muted-foreground" role="status">
              Non ancora attivo: il database non ha ancora le colonne di Google (aggiornamento «tracciamento»). I campi si accendono appena lo applichi.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {campi.map((c) => (
              <div key={c.chiave} className="space-y-1.5">
                <Label htmlFor={`tr-${c.chiave}`}>{c.etichetta}</Label>
                <Input
                  id={`tr-${c.chiave}`}
                  value={valori[c.chiave]}
                  disabled={!googleLetti || colonneMancanti || letturaGoogleRotta}
                  placeholder={c.esempio}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!errori[c.chiave]}
                  aria-describedby={`tr-${c.chiave}-nota`}
                  onChange={(e) => {
                    setValori({ ...valori, [c.chiave]: e.target.value });
                    if (errori[c.chiave]) setErrori({ ...errori, [c.chiave]: undefined });
                  }}
                />
                <p id={`tr-${c.chiave}-nota`} className={errori[c.chiave] ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={errori[c.chiave] ? "alert" : undefined}>
                  {errori[c.chiave] ?? c.aiuto}
                </p>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => void salva()} disabled={salvando || !googleLetti || colonneMancanti || letturaGoogleRotta || !user}>
            {salvando ? "Salvo…" : "Salva gli ID di Google"}
          </Button>
        </CardContent>
      </Card>

      {/* ── 3. LA SALUTE DEGLI INVII ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Invii dal server a Meta e TikTok</CardTitle>
            <p className="text-sm text-muted-foreground">
              Qui si vedono solo gli eventi mandati dal nostro server (con il consenso marketing del visitatore). I pixel nel browser si controllano in Events Manager.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void leggiSalute()} className="shrink-0 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Aggiorna
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!s && <p className="text-sm text-muted-foreground">Appena la lettura riesce compare qui.</p>}
          {s && !s.attivo && <p className="text-sm text-muted-foreground">Non ancora attivo: manca l'aggiornamento del database.</p>}
          {s?.attivo && !s.piattaforme && <p className="text-sm text-muted-foreground">Il registro degli invii non è leggibile in questo momento.</p>}
          {s?.attivo &&
            s.piattaforme?.map((p) => {
              const inProva = !!s.prova?.[p.piattaforma];
              return (
                <div key={p.piattaforma} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{NOME[p.piattaforma]}</p>
                      {inProva && (
                        <Badge variant="outline" className="text-xs">
                          Modalità prova attiva
                        </Badge>
                      )}
                    </div>
                    {p.ultimo ? (
                      <p className="text-sm text-muted-foreground">
                        Ultimo invio: <span className="text-foreground">{p.ultimo.evento}</span>, {fraseEsito(p.ultimo.esito)}, {quantoFa(p.ultimo.quando, s.adesso)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nessun invio ancora. Parte dal primo evento dello shop con il consenso marketing.</p>
                    )}
                    {inProva && <p className="text-xs text-muted-foreground">Con il codice di prova gli eventi vanno nel pannello di test, non nelle statistiche vere. Toglilo dalla scheda quando hai finito.</p>}
                  </div>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {p.invii24h}
                    {p.oltreTetto ? "+" : ""} {p.invii24h === 1 && !p.oltreTetto ? "invio" : "invii"} in 24 ore
                    {p.errori24h > 0 && (
                      <span className="font-medium text-destructive">
                        {" "}
                        · {p.errori24h}
                        {p.oltreTetto ? "+" : ""} {p.errori24h === 1 && !p.oltreTetto ? "errore" : "errori"}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          {s?.attivo && s.errori && s.errori.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Ultimi errori</p>
              <ul className="space-y-1 text-sm">
                {s.errori.map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3 text-muted-foreground">
                    <span className="tabular-nums">{quantoFa(e.quando, s.adesso)}</span>
                    <span>{NOME[e.piattaforma] ?? e.piattaforma}</span>
                    <span>{e.evento}</span>
                    <span className="text-destructive">{fraseEsito(e.esito)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s?.attivo && s.piattaforme && s.errori && s.errori.length === 0 && <p className="text-sm text-muted-foreground">Nessun errore negli ultimi invii.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
