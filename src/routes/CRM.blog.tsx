/** ── IL BLOG NEL CRM ────────────────────────────────────────────────────────
 *
 *  Qui arrivano le bozze che scrive AIOS. Si leggono in anteprima così come
 *  usciranno sul sito, si correggono, e solo allora si preme «Pubblica».
 *  Un articolo online si può ritirare in qualunque momento.
 *
 *  ⚠️ «PUBBLICA» NON PASSA SE IL CONTROLLO TROVA PROBLEMI (prezzi, segnaposto,
 *   titolo o descrizione fuori misura…): l'elenco dei problemi è qui sotto
 *   l'editor, e il server lo rifà comunque prima di mettere online. */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import { fetchCRM } from "@/crm/AuthContext";
import { Pagina, Scheda, Titolo } from "@/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SITO, markdownInHtml, minutiDiLettura, contaParole, type Faq, type Problema, type RigaArticolo } from "@/seo/regole";

export const Route = createFileRoute("/CRM/blog")({
  component: PaginaBlog,
});

type Voce = RigaArticolo & { problemi: Problema[] };

const ETICHETTA: Record<RigaArticolo["stato"], string> = {
  bozza: "Bozza",
  pubblicato: "Online",
  ritirato: "Ritirato",
};
const CLASSE: Record<RigaArticolo["stato"], string> = {
  bozza: "bg-amber-100 text-amber-900 border-amber-200",
  pubblicato: "bg-emerald-100 text-emerald-900 border-emerald-200",
  ritirato: "bg-muted text-muted-foreground border-border",
};

function PaginaBlog() {
  const [articoli, setArticoli] = useState<Voce[]>([]);
  const [carico, setCarico] = useState(false);
  const [errore, setErrore] = useState("");
  const [scelto, setScelto] = useState<string | null>(null);

  const ricarica = useCallback(async () => {
    setCarico(true);
    setErrore("");
    try {
      const r = await fetchCRM("/api/crm/blog");
      const j = await r.json();
      if (!j.ok) throw new Error(j.reason || "Errore");
      setArticoli(j.articoli);
      setScelto((s) => s ?? j.articoli[0]?.id ?? null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setCarico(false);
    }
  }, []);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  const corrente = articoli.find((a) => a.id === scelto) || null;
  const bozze = articoli.filter((a) => a.stato === "bozza").length;

  return (
    <Pagina larga>
      <Titolo
        testo="Blog"
        icona={FileText}
        nota={
          bozze
            ? `${bozze} ${bozze === 1 ? "bozza da leggere" : "bozze da leggere"}. Gli articoli li prepara AIOS: qui li correggi e li metti online.`
            : "Gli articoli li prepara AIOS: arrivano qui come bozze, li leggi e li metti online tu."
        }
        azioni={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/blog" target="_blank" rel="noopener">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Vedi il blog
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void ricarica()} disabled={carico}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${carico ? "animate-spin" : ""}`} /> Aggiorna
            </Button>
          </div>
        }
      />

      {errore ? (
        <Scheda>
          <p className="text-sm text-destructive">{errore}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se dice che la tabella non esiste, va applicata la migrazione del blog (Actions → «Database Supabase»).
          </p>
        </Scheda>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Scheda titolo="Articoli" senzaPadding>
          {articoli.length === 0 && !carico ? (
            <p className="p-4 text-sm text-muted-foreground">
              Ancora nessun articolo. Le bozze compaiono qui quando AIOS le manda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {articoli.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setScelto(a.id)}
                    className={`w-full p-3 text-left hover:bg-muted/60 ${a.id === scelto ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CLASSE[a.stato]}`}>{ETICHETTA[a.stato]}</span>
                      {a.problemi.length && a.stato !== "pubblicato" ? (
                        <span className="text-[11px] text-amber-700">{a.problemi.length} da sistemare</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium">{a.titolo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">/blog/{a.slug}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Scheda>

        {corrente ? <Editor key={corrente.id + corrente.aggiornato_il} voce={corrente} dopo={ricarica} /> : null}
      </div>
    </Pagina>
  );
}

function Editor({ voce, dopo }: { voce: Voce; dopo: () => Promise<void> }) {
  const [titolo, setTitolo] = useState(voce.titolo);
  const [slug, setSlug] = useState(voce.slug);
  const [descrizione, setDescrizione] = useState(voce.descrizione);
  const [parolaChiave, setParolaChiave] = useState(voce.parola_chiave);
  const [autore, setAutore] = useState(voce.autore);
  const [corpo, setCorpo] = useState(voce.corpo);
  const [faq, setFaq] = useState<Faq[]>(Array.isArray(voce.faq) ? voce.faq : []);
  const [vista, setVista] = useState<"anteprima" | "testo">("anteprima");
  const [occupato, setOccupato] = useState(false);
  const [problemi, setProblemi] = useState<Problema[]>(voce.problemi);

  const modificato =
    titolo !== voce.titolo ||
    slug !== voce.slug ||
    descrizione !== voce.descrizione ||
    parolaChiave !== voce.parola_chiave ||
    autore !== voce.autore ||
    corpo !== voce.corpo ||
    JSON.stringify(faq) !== JSON.stringify(voce.faq ?? []);

  const html = useMemo(() => markdownInHtml(corpo), [corpo]);

  async function chiama(azione: string, campi?: Record<string, unknown>) {
    setOccupato(true);
    try {
      const r = await fetchCRM("/api/crm/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione, id: voce.id, campi }),
      });
      const j = await r.json();
      if (Array.isArray(j.problemi)) setProblemi(j.problemi);
      if (!j.ok) {
        toast.error(j.reason || "Non riuscito");
        return false;
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setOccupato(false);
    }
  }

  const campi = () => ({ titolo, slug, descrizione, parola_chiave: parolaChiave, autore, corpo, faq });

  async function salva() {
    if (await chiama("salva", campi())) {
      toast.success("Salvato");
      await dopo();
    }
  }
  async function pubblica() {
    if (modificato && !(await chiama("salva", campi()))) return;
    if (!window.confirm(`Mettere online «${titolo}»?\n\nSarà visibile a tutti su ${SITO}/blog/${slug}`)) return;
    if (await chiama("pubblica")) {
      toast.success("Online");
      await dopo();
    }
  }
  async function ritira() {
    if (!window.confirm("Togliere l'articolo dal sito? Resta qui e si può ripubblicare.")) return;
    if (await chiama("ritira")) {
      toast.success("Ritirato dal sito");
      await dopo();
    }
  }
  async function elimina() {
    if (!window.confirm("Cancellare definitivamente questo articolo? Non si può annullare.")) return;
    if (await chiama("elimina")) {
      toast.success("Cancellato");
      await dopo();
    }
  }

  const misura = (n: number, min: number, max: number) => (n < min || n > max ? "text-destructive" : "text-muted-foreground");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Scheda
        titolo={ETICHETTA[voce.stato]}
        nota={`${contaParole(corpo)} parole · ${minutiDiLettura(corpo)} min di lettura${voce.fonte ? ` · da ${voce.fonte}` : ""}`}
        azioni={
          <div className="flex flex-wrap gap-2">
            {voce.stato === "pubblicato" ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`/blog/${voce.slug}`} target="_blank" rel="noopener">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Apri online
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void salva()} disabled={occupato || !modificato}>
              Salva
            </Button>
            {voce.stato === "pubblicato" ? (
              <Button variant="outline" size="sm" onClick={() => void ritira()} disabled={occupato}>
                Ritira dal sito
              </Button>
            ) : (
              <Button size="sm" onClick={() => void pubblica()} disabled={occupato}>
                Pubblica
              </Button>
            )}
            {voce.stato !== "pubblicato" ? (
              <Button variant="ghost" size="sm" onClick={() => void elimina()} disabled={occupato} title="Cancella">
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        }
      >
        {problemi.length ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Da sistemare prima di pubblicare:</p>
            <ul className="mt-1 list-disc pl-5">
              {problemi.map((p, i) => (
                <li key={i}>{p.messaggio}</li>
              ))}
            </ul>
          </div>
        ) : voce.stato !== "pubblicato" ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Il controllo è passato: si può pubblicare dopo averlo letto.
          </p>
        ) : null}

        {voce.note ? (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p className="font-medium">Note di AIOS (non vanno online)</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{voce.note}</p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="flex justify-between">
              Titolo (H1 e titolo su Google) <span className={misura(titolo.trim().length, 20, 60)}>{titolo.trim().length}/60</span>
            </span>
            <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="flex justify-between">
              Descrizione (sotto il titolo su Google) <span className={misura(descrizione.trim().length, 70, 160)}>{descrizione.trim().length}/160</span>
            </span>
            <Textarea rows={2} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
          </label>
          <label className="text-sm">
            Parola chiave principale
            <Input value={parolaChiave} onChange={(e) => setParolaChiave(e.target.value)} />
          </label>
          <label className="text-sm">
            Indirizzo
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={voce.stato === "pubblicato"} />
          </label>
          <label className="text-sm md:col-span-2">
            Autore
            <Input value={autore} onChange={(e) => setAutore(e.target.value)} />
          </label>
        </div>
      </Scheda>

      <Scheda
        titolo="Testo"
        azioni={
          <div className="flex gap-1 rounded-lg border border-border p-0.5 text-sm">
            {(["anteprima", "testo"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`rounded-md px-3 py-1 ${vista === v ? "bg-muted font-medium" : "text-muted-foreground"}`}
              >
                {v === "anteprima" ? "Anteprima" : "Modifica"}
              </button>
            ))}
          </div>
        }
      >
        {vista === "anteprima" ? (
          <div className="rounded-xl bg-white p-4 md:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] md:text-3xl">{titolo}</h1>
            <p className="mt-2 text-[color:var(--ink-muted)]">{descrizione}</p>
            <div className="articolo-blog mt-6" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              «## » sottotitolo · «### » sottotitolo piccolo · «- » elenco · **grassetto** · *corsivo* · [testo](https://indirizzo)
            </p>
            <Textarea rows={28} className="font-mono text-sm" value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          </>
        )}
      </Scheda>

      <Scheda
        titolo="Domande frequenti"
        nota="Compaiono in fondo all'articolo e possono uscire su Google come risposte."
        azioni={
          <Button variant="outline" size="sm" onClick={() => setFaq([...faq, { domanda: "", risposta: "" }])}>
            <Plus className="mr-1.5 h-4 w-4" /> Aggiungi
          </Button>
        }
      >
        {faq.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna domanda.</p> : null}
        <div className="flex flex-col gap-3">
          {faq.map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Domanda"
                  value={f.domanda}
                  onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, domanda: e.target.value } : x)))}
                />
                <Button variant="ghost" size="sm" onClick={() => setFaq(faq.filter((_, j) => j !== i))} title="Togli">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                className="mt-2"
                rows={3}
                placeholder="Risposta"
                value={f.risposta}
                onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, risposta: e.target.value } : x)))}
              />
            </div>
          ))}
        </div>
      </Scheda>
    </div>
  );
}
