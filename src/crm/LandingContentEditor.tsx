/** ─────────────────────────────────────────────────────────────────────────
 *  L'EDITOR DEI CONTENUTI PUBBLICI
 *
 *  Qui si riscrive la landing che vedono i clienti. Due cose devono essere
 *  sempre chiare, perché è un editor che si usa raramente e ogni volta si
 *  riparte da zero:
 *
 *   · COSA STO MODIFICANDO — non basta un campo con dentro del testo: serve
 *     sapere in che sezione della pagina finisce e cosa c'era scritto prima.
 *     Ogni campo toccato si accende, la sezione che lo contiene mostra quanti
 *     campi sono cambiati, e da ogni campo si torna indietro con un clic;
 *   · SE HO SALVATO O NO — il pulsante «Salva» sempre acceso non dice niente.
 *     Qui è spento finché non c'è qualcosa da salvare, dice quante modifiche
 *     ci sono, e se si prova a lasciare la pagina con del lavoro non salvato
 *     il browser chiede conferma. Salvare pubblica: la landing cambia per
 *     tutti nel momento in cui si preme, e va detto prima, non dopo.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Plus, Save, FileText, Image as ImageIcon, MessageSquareQuote, Highlighter, CornerDownLeft, Eraser, Undo2, ExternalLink } from "lucide-react";
import { RichText } from "@/components/landing/RichText";
import {
  DEFAULT_LANDING,
  mergeLandingContent,
  LANDING_SCHEMA,
  type LandingContent,
  type Review,
  type FieldDef,
} from "@/landing/landing-content";

async function uploadFile(file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("landing-media")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("landing-media").getPublicUrl(path);
  return data.publicUrl;
}

function MediaInput({
  value,
  onChange,
  accept,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  accept: string;
  prefix: string;
}) {
  const [uploading, setUploading] = useState(false);
  const isVideo = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(value) || (accept === "video/*");
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... oppure carica un file"
          className="text-xs"
        />
        <label className="inline-flex">
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const url = await uploadFile(f, prefix);
                onChange(url);
                toast.success("Caricato");
              } catch (err: any) {
                toast.error(err?.message || "Errore upload");
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
          <span
            className={
              "inline-flex items-center gap-1.5 px-3 rounded-md border text-xs cursor-pointer bg-background hover:bg-accent whitespace-nowrap " +
              (uploading ? "opacity-60 pointer-events-none" : "")
            }
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Carica
          </span>
        </label>
        {value && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => onChange("")}
            className="text-destructive"
            title="Rimuovi"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {value && isVideo && (
        <video src={value} controls className="mt-2 w-full max-w-xs rounded border" />
      )}
      {value && !isVideo && (
        <img src={value} alt="" className="mt-2 max-h-32 rounded border" />
      )}
    </div>
  );
}

function RichTextField({
  value,
  onChange,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const applyAtSelection = (transform: (sel: string) => string, fallback?: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const replacement = selected ? transform(selected) : (fallback ?? transform(""));
    const next = value.slice(0, start) + replacement + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + replacement.length;
      try {
        (el as HTMLTextAreaElement).setSelectionRange(pos, pos);
      } catch {}
    });
  };

  const highlight = () =>
    applyAtSelection((s) => `[a]${s}[/a]`, "[a]testo[/a]");
  const newline = () => applyAtSelection((s) => `${s}\n`, "\n");
  const clearHighlight = () => onChange(value.replace(/\[\/?a\]/g, ""));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={highlight}
          className="h-7 gap-1 text-[11px]"
          title="Evidenzia selezione con colore brand"
        >
          <Highlighter className="h-3 w-3" /> Evidenzia
        </Button>
        {multiline && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={newline}
            className="h-7 gap-1 text-[11px]"
            title="Inserisci a-capo"
          >
            <CornerDownLeft className="h-3 w-3" /> A capo
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clearHighlight}
          className="h-7 gap-1 text-[11px] text-muted-foreground"
          title="Rimuovi tutti gli evidenziati"
        >
          <Eraser className="h-3 w-3" /> Pulisci
        </Button>
      </div>
      {multiline ? (
        <Textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="text-sm"
        />
      ) : (
        <Input
          ref={ref as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}
      <div className="text-[11px] text-muted-foreground px-2 py-1.5 rounded bg-muted/40 border border-dashed">
        <span className="text-[10px] uppercase tracking-wider opacity-60 mr-1.5">Anteprima:</span>
        <RichText value={value} highlightClass="text-brand font-semibold" />
      </div>
    </div>
  );
}

/** L'intestazione di un campo: il nome, e — solo se è stato toccato — il segno
 *  che lo dice e il modo per tornare indietro. Il segno sta accanto al nome e
 *  non in fondo alla riga: è lì che si guarda mentre si scrive. */
function IntestazioneCampo({
  testo,
  modificato,
  onRipristina,
}: {
  testo: string;
  modificato: boolean;
  onRipristina: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs">{testo}</Label>
      {modificato && (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            modificato
          </span>
          <button
            type="button"
            onClick={onRipristina}
            className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground"
            title="Rimette il testo salvato"
          >
            <Undo2 className="h-3 w-3" /> annulla
          </button>
        </>
      )}
    </div>
  );
}

function FieldRow({
  def,
  textValue,
  mediaValue,
  modificato,
  onText,
  onMedia,
  onRipristina,
}: {
  def: FieldDef;
  textValue: string;
  mediaValue: string;
  /** true = diverso da quello che è online adesso */
  modificato: boolean;
  onText: (k: string, v: string) => void;
  onMedia: (k: string, v: string) => void;
  onRipristina: (k: string) => void;
}) {
  if (def.type === "image" || def.type === "video") {
    return (
      <div className="space-y-1.5">
        <IntestazioneCampo
          testo={def.label}
          modificato={modificato}
          onRipristina={() => onRipristina(def.key)}
        />
        <MediaInput
          value={mediaValue}
          onChange={(v) => onMedia(def.key, v)}
          accept="image/*,video/*"
          prefix={`landing/${def.key}`}
        />
        <p className="text-[10px] text-muted-foreground">
          Puoi caricare un'immagine oppure un video — il tipo viene rilevato automaticamente.
        </p>
      </div>
    );
  }
  // Clean label (remove the "(usa [a]...[/a])" hint)
  const cleanLabel = def.label.replace(/\s*\(usa.*?\)\s*/i, "");
  return (
    <div className="space-y-1.5">
      <IntestazioneCampo
        testo={cleanLabel}
        modificato={modificato}
        onRipristina={() => onRipristina(def.key)}
      />
      <RichTextField
        value={textValue}
        onChange={(v) => onText(def.key, v)}
        multiline={def.type === "textarea"}
      />
    </div>
  );
}

export function LandingContentEditor() {
  const [content, setContent] = useState<LandingContent>(DEFAULT_LANDING);
  /** Cosa è ONLINE adesso. Serve a una cosa sola ma essenziale: dire quali
   *  campi sono cambiati. Senza, «modificato» sarebbe un'impressione. */
  const [online, setOnline] = useState<LandingContent>(DEFAULT_LANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ultimoSalvataggio, setUltimoSalvataggio] = useState<Date | null>(null);

  useEffect(() => {
    supabase
      .from("landing_content")
      .select("data")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        const caricato = mergeLandingContent(data?.data);
        setContent(caricato);
        setOnline(caricato);
        setLoading(false);
      });
  }, []);

  /** ── QUALI CAMPI SONO CAMBIATI ─────────────────────────────────────────
   *  Un insieme di chiavi, calcolato una volta sola: lo usano il segno accanto
   *  al campo, il conteggio sulla sezione e la barra del salvataggio, che
   *  quindi non possono contraddirsi fra loro. */
  const modificati = useMemo(() => {
    const s = new Set<string>();
    LANDING_SCHEMA.forEach((sec) =>
      sec.fields.forEach((f) => {
        const attuale = f.type === "image" || f.type === "video" ? content.media[f.key] : content.texts[f.key];
        const salvato = f.type === "image" || f.type === "video" ? online.media[f.key] : online.texts[f.key];
        if ((attuale ?? "") !== (salvato ?? "")) s.add(f.key);
      }),
    );
    return s;
  }, [content, online]);

  /** Le recensioni non stanno nello schema: si confrontano per intero. */
  const recensioniCambiate = useMemo(
    () =>
      JSON.stringify(content.reviews) !== JSON.stringify(online.reviews) ||
      content.reviewsBadge !== online.reviewsBadge ||
      content.reviewsCount !== online.reviewsCount ||
      content.reviewsHeadline !== online.reviewsHeadline ||
      content.reviewsSubhead !== online.reviewsSubhead,
    [content, online],
  );

  const nModifiche = modificati.size + (recensioniCambiate ? 1 : 0);
  const sporco = nModifiche > 0;

  /** Quanti campi cambiati per sezione: il numero sta sull'intestazione, così
   *  si trova la modifica anche con tutte le sezioni chiuse. */
  const modificatiPerSezione = useMemo(() => {
    const m: Record<string, number> = {};
    LANDING_SCHEMA.forEach((sec) => {
      m[sec.id] = sec.fields.filter((f) => modificati.has(f.key)).length;
    });
    return m;
  }, [modificati]);

  /** ── LA PORTA CHE AVVISA ───────────────────────────────────────────────
   *  Chiudere la scheda con dieci campi riscritti e non salvati è la perdita
   *  più stupida possibile: mezz'ora di lavoro e nessun modo di recuperarla. */
  useEffect(() => {
    if (!sporco) return;
    const avvisa = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [sporco]);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("landing_content")
      .upsert({
        id: "default",
        data: content as any,
        updated_at: new Date().toISOString(),
        updated_by: u.user?.id ?? null,
      });
    setSaving(false);
    if (error) {
      toast.error(`Non salvato: ${error.message}`);
      return;
    }
    //  Da qui in poi ciò che è online è ciò che si vede: i segni «modificato»
    //  si spengono da soli, ed è la conferma che conta.
    setOnline(content);
    setUltimoSalvataggio(new Date());
    toast.success(
      nModifiche === 1
        ? "Modifica pubblicata: la landing è aggiornata"
        : `${nModifiche} modifiche pubblicate: la landing è aggiornata`,
    );
  };

  /** Torna al testo online per un campo solo. */
  const ripristinaCampo = (k: string) =>
    setContent((c) => ({
      ...c,
      texts: { ...c.texts, [k]: online.texts[k] ?? "" },
      media: { ...c.media, [k]: online.media[k] ?? "" },
    }));

  const annullaTutto = () => {
    if (!confirm(`Annullare ${nModifiche === 1 ? "la modifica" : `le ${nModifiche} modifiche`} non salvate?`))
      return;
    setContent(online);
  };

  const setText = (k: string, v: string) =>
    setContent((c) => ({ ...c, texts: { ...c.texts, [k]: v } }));
  const setMedia = (k: string, v: string) =>
    setContent((c) => ({ ...c, media: { ...c.media, [k]: v } }));

  const updateReview = (idx: number, patch: Partial<Review>) =>
    setContent((c) => ({
      ...c,
      reviews: c.reviews.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const addReview = () =>
    setContent((c) => ({
      ...c,
      reviews: [
        ...c.reviews,
        {
          id: `r${Date.now()}`,
          name: "Nuovo cliente",
          location: "",
          rating: 5,
          title: "Titolo recensione",
          text: "Testo della recensione...",
          videoUrl: "",
          posterUrl: "",
        },
      ],
    }));

  const removeReview = (idx: number) =>
    setContent((c) => ({ ...c, reviews: c.reviews.filter((_, i) => i !== idx) }));

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  /** ── LA BARRA DEL SALVATAGGIO ─────────────────────────────────────────
   *  Dice tre cose, in quest'ordine: se c'è qualcosa da salvare, cosa
   *  esattamente, e che salvare significa pubblicare. Il pulsante spento
   *  quando non c'è nulla da salvare è di per sé una risposta: hai salvato. */
  const SaveBar = (
    <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-1 py-2 backdrop-blur">
      <div className="min-w-0 text-xs">
        {sporco ? (
          <span className="inline-flex items-center gap-1.5 text-sky-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
            <span className="font-medium">
              {nModifiche === 1 ? "1 modifica non salvata" : `${nModifiche} modifiche non salvate`}
            </span>
            <span className="text-muted-foreground">· salvare pubblica sulla landing</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {ultimoSalvataggio
              ? `Tutto salvato alle ${ultimoSalvataggio.toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })} · quello che vedi è online`
              : "Quello che vedi è quello che è online adesso."}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Apre la landing pubblica in una scheda nuova"
        >
          <ExternalLink className="h-3 w-3" /> Vedi la landing
        </a>
        {sporco && (
          <Button onClick={annullaTutto} size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
            <Undo2 className="h-3.5 w-3.5" /> Annulla
          </Button>
        )}
        <Button onClick={save} disabled={saving || !sporco} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {sporco ? "Salva e pubblica" : "Salvato"}
        </Button>
      </div>
    </div>
  );

  /** L'intestazione di una sezione, col numero di campi cambiati dentro. */
  const TitoloSezione = ({ titolo, id }: { titolo: string; id: string }) => (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">{titolo}</span>
      {(modificatiPerSezione[id] ?? 0) > 0 && (
        <span className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
          {modificatiPerSezione[id]} modificat{modificatiPerSezione[id] === 1 ? "o" : "i"}
        </span>
      )}
    </span>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contenuti della landing pubblica</CardTitle>
        <p className="text-xs text-muted-foreground">
          Testi, immagini e video della pagina che vedono i clienti. Ogni campo toccato si segna, e
          salvare pubblica subito: non esiste una bozza.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sezioni">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="sezioni" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Testi & Sezioni
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 text-xs">
              <ImageIcon className="h-3.5 w-3.5" /> Immagini & Video
            </TabsTrigger>
            <TabsTrigger value="recensioni" className="gap-1.5 text-xs">
              <MessageSquareQuote className="h-3.5 w-3.5" /> Recensioni
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sezioni" className="mt-4">
            {SaveBar}
            <Accordion type="multiple" className="space-y-2">
              {LANDING_SCHEMA.map((sec) => {
                const textFields = sec.fields.filter((f) => f.type === "text" || f.type === "textarea");
                if (textFields.length === 0) return null;
                return (
                  <AccordionItem key={sec.id} value={sec.id} className="border rounded-md">
                    <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                      <TitoloSezione titolo={sec.title} id={sec.id} />
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 space-y-3">
                      {textFields.map((f) => (
                        <FieldRow
                          key={f.key}
                          def={f}
                          textValue={content.texts[f.key] ?? ""}
                          mediaValue={content.media[f.key] ?? ""}
                          modificato={modificati.has(f.key)}
                          onText={setText}
                          onMedia={setMedia}
                          onRipristina={ripristinaCampo}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>

          <TabsContent value="media" className="mt-4">
            {SaveBar}
            <Accordion type="multiple" className="space-y-2">
              {LANDING_SCHEMA.map((sec) => {
                const mediaFields = sec.fields.filter((f) => f.type === "image" || f.type === "video");
                if (mediaFields.length === 0) return null;
                return (
                  <AccordionItem key={sec.id} value={sec.id} className="border rounded-md">
                    <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                      <TitoloSezione titolo={sec.title} id={sec.id} />
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 space-y-3">
                      {mediaFields.map((f) => (
                        <FieldRow
                          key={f.key}
                          def={f}
                          textValue={content.texts[f.key] ?? ""}
                          mediaValue={content.media[f.key] ?? ""}
                          modificato={modificati.has(f.key)}
                          onText={setText}
                          onMedia={setMedia}
                          onRipristina={ripristinaCampo}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>

          <TabsContent value="recensioni" className="mt-4 space-y-3">
            {SaveBar}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Badge</Label>
                <Input
                  value={content.reviewsBadge}
                  onChange={(e) => setContent({ ...content, reviewsBadge: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Conteggio clienti</Label>
                <Input
                  value={content.reviewsCount}
                  onChange={(e) => setContent({ ...content, reviewsCount: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Titolo principale</Label>
                <Input
                  value={content.reviewsHeadline}
                  onChange={(e) => setContent({ ...content, reviewsHeadline: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Sottotitolo</Label>
                <Textarea
                  value={content.reviewsSubhead}
                  onChange={(e) => setContent({ ...content, reviewsSubhead: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                Recensioni ({content.reviews.length})
                {recensioniCambiate && (
                  <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                    modificate
                  </span>
                )}
              </h4>
              <Button onClick={addReview} size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Aggiungi
              </Button>
            </div>

            <Accordion type="multiple" className="space-y-2">
              {content.reviews.map((r, i) => (
                <AccordionItem key={r.id} value={r.id} className="border rounded-md bg-muted/30">
                  <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                    #{i + 1} — {r.name}
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-3">
                    <div className="flex justify-end">
                      <Button
                        onClick={() => removeReview(i)}
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                      </Button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome cliente</Label>
                        <Input value={r.name} onChange={(e) => updateReview(i, { name: e.target.value })} className="text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Località</Label>
                        <Input value={r.location} onChange={(e) => updateReview(i, { location: e.target.value })} className="text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Rating (1-5)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={r.rating}
                          onChange={(e) =>
                            updateReview(i, {
                              rating: Math.max(1, Math.min(5, Number(e.target.value) || 5)),
                            })
                          }
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Titolo</Label>
                        <Input value={r.title} onChange={(e) => updateReview(i, { title: e.target.value })} className="text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Testo recensione</Label>
                        <Textarea value={r.text} onChange={(e) => updateReview(i, { text: e.target.value })} rows={4} className="text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Video (mp4)</Label>
                        <MediaInput
                          value={r.videoUrl}
                          onChange={(v) => updateReview(i, { videoUrl: v })}
                          accept="video/*"
                          prefix="reviews/videos"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Poster / immagine</Label>
                        <MediaInput
                          value={r.posterUrl}
                          onChange={(v) => updateReview(i, { posterUrl: v })}
                          accept="image/*"
                          prefix="reviews/posters"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
