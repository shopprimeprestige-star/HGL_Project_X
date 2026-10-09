/** ── LA PROVA CAPELLI, DA DENTRO ───────────────────────────────────────────
 *
 *  Una pagina sola con quattro schede: i codici che diamo su WhatsApp, gli
 *  ordini di chi ha comprato altre prove, la classifica dei tagli e le chiavi.
 *
 *  ── ⚠️ PERCHÉ UNA PAGINA E NON QUATTRO ───────────────────────────────────
 *  Sono quattro facce dello stesso mestiere: do un codice, la persona prova,
 *  se ne vuole altre paga, e io guardo cosa sceglie. Sparpagliarle nel menu
 *  vorrebbe dire che chi manda un codice non vede mai se quella persona ha poi
 *  comprato — cioè la sola cosa che dice se questo strumento funziona.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck, BarChart3, Ban, Check, Copy, Gift, KeyRound, Loader2, Plus, Receipt, Search,
  CreditCard, Eye, EyeOff, Image as ImageIcon, Scissors, Sparkles, Trash2, UserRound, X,
} from "lucide-react";
import { Pagina, Scheda, Titolo } from "@/crm/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intestazioniCRM } from "@/crm/AuthContext";
import { ClassificaTagli } from "@/crm/ClassificaTagli";
import { ImpostazioniSumUp } from "@/crm/ImpostazioniSumUp";
import { inEuro } from "@/prova/pacchetti";
import { CODICE_SCHEDA, VERSIONE_SCHEDA, depositaAnteprimaCapelli } from "@/prova/anteprima-link";

export const Route = createFileRoute("/CRM/prova-capelli")({ component: PaginaProva });

interface Codice {
  codice: string; creatoIl: string; totali: number; usate: number; bloccato?: boolean;
  leadId?: string; nome?: string; cognome?: string; telefono?: string; email?: string;
  nota?: string; ultimoUso?: string; admin?: boolean;
  spesoCentesimi?: number; generazioni?: number;
}
interface Ordine {
  id: string; quando: string; codice: string; pacchetto: string; prove: number;
  centesimi: number; stato: string; nome?: string; cognome?: string; email?: string;
  telefono?: string; leadId?: string;
}
interface Lead { id: string; nome: string; cognome: string; telefono: string; email: string; stato: string }

const quando = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

async function chiedi(url: string) {
  const r = await fetch(url, { headers: await intestazioniCRM() });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || j?.errore || "non riesco a leggere");
  return j;
}
async function manda(corpo: unknown) {
  const r = await fetch("/api/crm/prova-codici", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
    body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || "non riesco a salvare");
  return j;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CERCARE IL LEAD A CUI DARE IL CODICE
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ Si cerca mentre si scrive, ma non a ogni lettera: mezzo secondo di
 *  silenzio prima di chiedere. Senza, digitare «Mario Rossi» sono undici
 *  richieste al database per una risposta sola che conta. */
function CercaLead({ scelto, onScegli }: { scelto: Lead | null; onScegli: (l: Lead | null) => void }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Lead[]>([]);
  const [cerco, setCerco] = useState(false);

  useEffect(() => {
    if (scelto || q.trim().length < 2) { setLista([]); return; }
    let vivo = true;
    setCerco(true);
    const t = setTimeout(() => {
      void chiedi(`/api/crm/prova-codici?azione=cerca&q=${encodeURIComponent(q.trim())}`)
        .then((j) => { if (vivo) setLista(j.lead || []); })
        .catch(() => { if (vivo) setLista([]); })
        .finally(() => { if (vivo) setCerco(false); });
    }, 500);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, scelto]);

  if (scelto) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{`${scelto.nome} ${scelto.cognome}`.trim() || "senza nome"}</span>
          {!!scelto.telefono && <span className="text-muted-foreground"> · {scelto.telefono}</span>}
        </span>
        <button onClick={() => onScegli(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Togli il collegamento">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca per numero, email, nome o cognome"
        className="pl-9"
      />
      {cerco && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {lista.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
          {lista.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => { onScegli(l); setQ(""); setLista([]); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{`${l.nome} ${l.cognome}`.trim() || "senza nome"}</span>
                  <span className="text-muted-foreground"> · {l.telefono || l.email || "—"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/*  ⚠️ Si dice che si può anche NON collegarlo: chi non trova la persona
          resterebbe fermo a cercare, e il codice non lo fa più. */}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Puoi anche crearlo senza collegarlo a nessuno: si collega da solo se poi paga.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I CODICI
   ═════════════════════════════════════════════════════════════════════════ */

function SchedaCodici() {
  const [codici, setCodici] = useState<Codice[]>([]);
  const [carico, setCarico] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [nota, setNota] = useState("");
  const [creo, setCreo] = useState(false);
  /** ⚠️ Un codice admin può aggiungere tagli alla vetrina che vedono tutti:
   *  si dà a chi vende, non a chi prova. Parte SPENTA apposta — la spunta si
   *  accende apposta, non per distrazione. */
  const [admin, setAdmin] = useState(false);
  const [copiato, setCopiato] = useState("");
  const [filtro, setFiltro] = useState("");

  const carica = useCallback(async () => {
    setCarico(true);
    try { setCodici((await chiedi("/api/crm/prova-codici?azione=elenco")).codici || []); }
    catch (e) { toast.error(String((e as Error).message || e)); }
    finally { setCarico(false); }
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const crea = async () => {
    setCreo(true);
    try {
      const j = await manda({
        azione: "crea",
        ...(lead ? { leadId: lead.id, nome: lead.nome, cognome: lead.cognome, telefono: lead.telefono, email: lead.email } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
        ...(admin ? { admin: true } : {}),
      });
      //  ⚠️ Si copia DA SOLO negli appunti: il gesto dopo è sempre incollarlo
      //   in una chat, e farlo cercare col mouse su una riga appena comparsa è
      //   il modo di far sbagliare codice.
      try { await navigator.clipboard.writeText(j.codice.codice); setCopiato(j.codice.codice); } catch { /* pazienza */ }
      toast.success(`Codice ${j.codice.codice} creato e copiato`);
      setLead(null); setNota(""); setAdmin(false);
      await carica();
    } catch (e) { toast.error(String((e as Error).message || e)); }
    finally { setCreo(false); }
  };

  const copia = async (c: string) => {
    try { await navigator.clipboard.writeText(c); setCopiato(c); toast.success("Copiato"); }
    catch { toast.error("Il browser non mi lascia copiare"); }
  };

  const visibili = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return codici;
    return codici.filter((c) =>
      [c.codice, c.nome, c.cognome, c.telefono, c.email, c.nota]
        .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [codici, filtro]);

  return (
    <div className="space-y-4">
      <Scheda
        titolo="Un codice nuovo"
        nota="Tre prove comprese. Si crea, si copia e si incolla nella chat."
        icona={KeyRound}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <CercaLead scelto={lead} onScegli={setLead} />
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (facoltativa): perché glielo stai dando" />
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5">
              <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium">Codice admin</span>
                <span className="block text-[12px] text-muted-foreground">
                  Può aggiungere tagli nuovi al catalogo caricando una foto. Da dare solo a chi
                  lavora qui: ogni taglio nuovo costa due generazioni e lo vedono tutti i clienti.
                </span>
              </span>
            </label>
          </div>
          <Button onClick={() => void crea()} disabled={creo} className="hg-shine h-10 self-start">
            {creo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crea e copia
          </Button>
        </div>
      </Scheda>

      <Scheda
        titolo="Codici"
        nota={`${codici.length} in tutto`}
        icona={BadgeCheck}
      >
        <div className="mb-3">
          <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtra: codice, nome, numero…" />
        </div>
        {carico && !codici.length ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Un attimo…
          </p>
        ) : !visibili.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {codici.length ? "Nessun codice con questo filtro." : "Nessun codice: creane uno qui sopra e mandalo su WhatsApp."}
          </p>
        ) : (
          <ul className="divide-y">
            {visibili.map((c) => {
              const restano = Math.max(0, c.totali - c.usate);
              return (
                <li key={c.codice} className="flex flex-wrap items-center gap-2 rounded-lg px-1 py-2.5 transition hover:bg-muted/40">
                  <button
                    onClick={() => void copia(c.codice)}
                    title="Copia il codice"
                    className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 font-mono text-[13px] font-semibold tracking-[0.08em] transition hover:border-foreground/30 hover:bg-muted"
                  >
                    {copiato === c.codice ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    {c.codice}
                  </button>
                  {c.admin && (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                      admin
                    </span>
                  )}
                  {c.bloccato && (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      bloccato
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {`${c.nome ?? ""} ${c.cognome ?? ""}`.trim() || <span className="text-muted-foreground">non collegato</span>}
                    {!!c.telefono && <span className="text-muted-foreground"> · {c.telefono}</span>}
                    {!!c.nota && <span className="text-muted-foreground"> · {c.nota}</span>}
                  </span>
                  {/*  ⚠️ Su un codice admin non si mostra «quante restano» —
                      sono illimitate — ma QUANTO HA SPESO: senza un tetto, il
                      freno è vedere il numero crescere. Sugli altri resta il
                      contatore, che è quello che dice se stanno per finire. */}
                  {c.admin ? (
                    <span className="text-[12px] tabular-nums text-muted-foreground">
                      {c.generazioni ?? 0} prove · {inEuro(c.spesoCentesimi ?? 0)}
                    </span>
                  ) : (
                    <span className={`text-[12px] tabular-nums ${restano ? "text-muted-foreground" : "font-semibold text-amber-600"}`}>
                      {restano} su {c.totali}
                    </span>
                  )}
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">{quando(c.creatoIl)}</span>
                  <Button size="sm" variant="ghost" title="Regala 3 prove"
                    onClick={() => void manda({ azione: "regala", codice: c.codice, prove: 3 }).then(carica).then(() => toast.success("Tre prove aggiunte"))}>
                    <Gift className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" title={c.bloccato ? "Riattiva" : "Blocca"}
                    onClick={() => void manda({ azione: "aggiorna", codice: c.codice, bloccato: !c.bloccato }).then(carica)}>
                    <Ban className={`h-3.5 w-3.5 ${c.bloccato ? "text-destructive" : ""}`} />
                  </Button>
                  <Button size="sm" variant="ghost" title="Elimina"
                    onClick={() => void manda({ azione: "elimina", codice: c.codice }).then(carica)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Scheda>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CATALOGO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ SI AGGIUNGE UN TAGLIO DA QUI, NON SOLO DALLA PAGINA ───────────────
 *  Chi cura la vetrina è già dentro il gestionale: mandarlo sulla pagina
 *  pubblica con un codice admin per caricare una foto è un giro inutile, e un
 *  giro inutile è una cosa che si smette di fare.
 *  ⚠️ E ci vuole un minuto: due generazioni vere, una per leggere la foto e
 *   una per riprodurre il taglio sul nostro modello. Detto prima, perché un
 *   minuto inatteso è un minuto in cui si ricarica la pagina e si paga due
 *   volte. */
function SchedaCatalogo() {
  const [tagli, setTagli] = useState<Array<{
    chiave: string; nome: string; famiglia: string; descrizione: string;
    immagine?: string; creatoIl?: string; stato?: string; nascosto?: boolean;
  }>>([]);
  const [carico, setCarico] = useState(true);
  const [aggiungo, setAggiungo] = useState(false);
  const scelta = useRef<HTMLInputElement | null>(null);

  const carica = useCallback(async () => {
    try {
      const r = await fetch("/api/crm/prova-catalogo", { headers: await intestazioniCRM() });
      const j = await r.json();
      setTagli(j?.tagli || []);
    } catch { /* elenco vuoto */ }
    finally { setCarico(false); }
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const aggiungi = async (f?: File | null) => {
    if (!f) return;
    setAggiungo(true);
    try {
      const r = await fetch("/api/crm/prova-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({ azione: "aggiungi", foto: await leggiFoto(f) }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.errore || j?.error || "non riuscito");
      toast.success(`Aggiunto: ${j.taglio.nome}`);
      await carica();
    } catch (e) { toast.error(String((e as Error).message || e)); }
    finally { setAggiungo(false); }
  };

  /** Conferma, nascondi, togli: tre gesti sulla stessa riga. */
  const comanda = async (azione: string, chiave: string, spento?: boolean) => {
    try {
      const r = await fetch("/api/crm/prova-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({ azione, chiave, ...(spento === undefined ? {} : { spento }) }),
      });
      if (!(await r.json())?.ok) throw new Error("non riuscito");
      await carica();
    } catch (e) { toast.error(String((e as Error).message || e)); }
  };

  const aggiunti = tagli.filter((t) => !!t.creatoIl);
  const daConfermare = tagli.filter((t) => t.stato === "nuovo");

  return (
    <div className="space-y-4">
      <input ref={scelta} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => void aggiungi(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => scelta.current?.click()} disabled={aggiungo} className="hg-shine">
          {aggiungo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {aggiungo ? "Sto creando il taglio…" : "Aggiungi un taglio da una foto"}
        </Button>
        <p className="text-[12px] text-muted-foreground">
          {aggiungo
            ? "Leggo la foto, gli do un nome e lo riproduco sul nostro modello. Ci vuole un minuto."
            : `${tagli.filter((x) => x.stato !== "nuovo" && !x.nascosto).length} in vetrina · ${aggiunti.length} aggiunti da voi`}
        </p>
        {/*  ⚠️ I nuovi da confermare si contano a parte e in evidenza: un
            taglio generato e dimenticato in bozza è lavoro (e denaro) buttato,
            e senza un numero che lo ricorda ci si dimentica davvero. */}
        {daConfermare.length > 0 && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[12px] font-semibold text-amber-600">
            {daConfermare.length} da confermare
          </span>
        )}
      </div>

      {carico ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Un attimo…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tagli.map((t) => (
            <div key={t.chiave} className="hg-lucido overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`relative aspect-square bg-muted ${t.nascosto ? "opacity-40" : ""}`}>
                {!!t.immagine && <img src={t.immagine} alt={t.nome} loading="lazy" className="h-full w-full object-cover" />}
                {t.stato === "nuovo" && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    nuovo
                  </span>
                )}
                {t.nascosto && (
                  <span className="absolute left-1.5 bottom-8 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                    nascosto
                  </span>
                )}
                <div className="absolute right-1.5 top-1.5 flex flex-col gap-1">
                  {/*  ⚠️ La spunta compare SOLO sui nuovi: è il gesto che li
                      manda in vetrina, e su un taglio già pubblicato non
                      vorrebbe dire niente. */}
                  {t.stato === "nuovo" && (
                    <button onClick={() => void comanda("conferma", t.chiave)} title="Conferma: lo vedono i clienti"
                      className="rounded-md bg-emerald-500 p-1.5 text-white transition hover:bg-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/*  Nascondere vale anche per i tagli scritti nel codice: uno
                      che non si vende più deve poter sparire dalla vetrina
                      senza aspettare un rilascio, e senza cancellare niente. */}
                  <button onClick={() => void comanda("nascondi", t.chiave, !t.nascosto)}
                    title={t.nascosto ? "Rimetti in vetrina" : "Nascondi ai clienti"}
                    className="rounded-md bg-black/60 p-1.5 text-white/80 transition hover:bg-black/80">
                    {t.nascosto ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  {/*  ⚠️ Si cancella SOLO quello che è stato aggiunto: i tagli
                      scritti nel codice non si rimetterebbero da qui, e
                      sparirebbero per sempre. */}
                  {!!t.creatoIl && (
                    <button onClick={() => void comanda("togli", t.chiave)} title="Elimina"
                      className="rounded-md bg-black/60 p-1.5 text-white/80 transition hover:bg-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="truncate px-2 py-1.5 text-[12px] font-medium">{t.nome}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** La foto ridotta prima di partire: un originale da dodici mega impiega dieci
 *  secondi e viene comunque rimpicciolito dal modello. */
async function leggiFoto(f: File): Promise<string> {
  const bitmap = await createImageBitmap(f);
  const scala = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const tela = document.createElement("canvas");
  tela.width = Math.round(bitmap.width * scala);
  tela.height = Math.round(bitmap.height * scala);
  tela.getContext("2d")?.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close?.();
  return tela.toDataURL("image/jpeg", 0.88);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLI ORDINI
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   IL NUMERO A CUI SCRIVERE
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ Il tasto WhatsApp sul risultato è il gesto che vale: tutto il resto
 *  della pagina serve a portare lì. Senza numero il tasto non compare
 *  affatto — un tasto che apre una chat vuota è peggio di nessun tasto. */
function SchedaContatto() {
  const [numero, setNumero] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [rifo, setRifo] = useState(false);
  const [codiceColore, setCodiceColore] = useState("60RH");
  const [generoColore, setGeneroColore] = useState(false);
  const [campioneFatto, setCampioneFatto] = useState("");

  /** ⚠️ Una generazione costa: si dice sempre com'è andata, e in italiano. Un
   *  tasto che non risponde fa premere due volte, e due volte vuol dire due
   *  immagini pagate. */
  const generaCampione = async () => {
    setGeneroColore(true);
    setCampioneFatto("");
    try {
      const r = await fetch("/api/crm/prova-colore", {
        method: "POST",
        headers: { ...(await intestazioniCRM()), "Content-Type": "application/json" },
        body: JSON.stringify({ codice: codiceColore.trim() }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(String(j?.errore || "non generato"));
      setCampioneFatto(String(j.url || ""));
      toast.success(`Campione ${codiceColore.trim()} generato`);
    } catch (e) {
      toast.error(String((e as Error).message || e));
    } finally {
      setGeneroColore(false);
    }
  };

  const rifaiScheda = async () => {
    setRifo(true);
    const fatto = await depositaAnteprimaCapelli();
    setRifo(false);
    if (fatto) toast.success("Anteprima rifatta: nelle chat nuove si vede questa");
    //  ⚠️ Si dice anche perché può non essere cambiato niente: i programmi di
    //   messaggistica tengono in cache l'anteprima di un link per giorni.
    else toast.error("Non sono riuscito a rifarla");
  };

  useEffect(() => {
    void (async () => {
      try {
        const j = await chiedi("/api/crm/prova-codici?azione=contatto");
        setNumero(String(j?.numero || ""));
        setMessaggio(String(j?.messaggio || ""));
      } catch { /* campi vuoti */ }
    })();
  }, []);

  const salva = async () => {
    setSalvo(true);
    try {
      await manda({ azione: "contatto", numero, messaggio });
      toast.success("Salvato");
    } catch (e) { toast.error(String((e as Error).message || e)); }
    finally { setSalvo(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Numero WhatsApp</span>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="+39 333 1234567" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Messaggio già scritto</span>
          <Input
            value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)}
            placeholder="Ciao! Ho provato l'anteprima capelli e mi piacerebbe un taglio come quello della simulazione."
          />
        </label>
      </div>
      {/*  ⚠️ Si dice cosa viene aggiunto in coda: chi scrive il messaggio deve
          sapere che il taglio e il colore ci finiscono da soli, altrimenti li
          riscrive e il cliente manda una frase che si ripete. */}
      <p className="text-[12px] text-muted-foreground">
        In fondo al messaggio finiscono da soli il taglio e il colore che il cliente stava
        guardando. Lasciando vuoto si usa un testo predefinito.
      </p>
      <Button onClick={() => void salva()} disabled={salvo} className="hg-shine">
        {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
      </Button>

      {/* ── ⚠️ LA SCHEDA CHE SI VEDE NELLA CHAT ──────────────────────────
            Si rifà da sola la prima volta, e questo tasto serve per DOPO: se
            si cambia il logo dello studio o il numero di prove comprese,
            l'immagine depositata resta quella vecchia e non c'è nessun altro
            momento in cui qualcuno se ne accorgerebbe. */}
      {/* ── ⚠️ I CAMPIONI FOTOGRAFICI DEI COLORI ────────────────────────
            La tinta piena dice QUAL È il colore; una fotografia di capelli
            veri dice come SARÀ — nella tinta piatta non c'è la luce che corre
            sulla ciocca, e senza quella un cenere e un freddo sembrano lo
            stesso colore.
           ⚠️ Uno per volta, di proposito: sessantatré generazioni in un colpo
            sono sessantatré immagini pagate prima di aver visto se la prima è
            quella giusta. */}
      <div className="mt-5 border-t pt-4">
        <p className="mb-1 text-sm font-medium">Campione fotografico di un colore</p>
        <p className="mb-2.5 text-[12px] text-muted-foreground">
          Scrivi il codice dell&apos;anello (es. 60RH) e lo genero come fotografia di capelli veri:
          nella vetrina prende il posto della tinta piatta. Dove non c&apos;è, resta il colore pieno.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={codiceColore}
            onChange={(e) => setCodiceColore(e.target.value.toUpperCase())}
            placeholder="60RH"
            className="w-32 font-mono uppercase"
          />
          <Button size="sm" onClick={() => void generaCampione()} disabled={!!generoColore}>
            {generoColore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Genera il campione
          </Button>
          {!!campioneFatto && (
            <a href={campioneFatto} target="_blank" rel="noopener noreferrer" className="text-[12px] underline">
              guarda l&apos;immagine
            </a>
          )}
        </div>
        {!!campioneFatto && (
          <img src={campioneFatto} alt="" className="mt-3 h-40 w-40 rounded-xl border object-cover" />
        )}
      </div>

      <div className="mt-5 border-t pt-4">
        <p className="mb-1 text-sm font-medium">L'immagine che si vede nella chat</p>
        <p className="mb-2.5 text-[12px] text-muted-foreground">
          È il riquadro che compare quando mandi il link su WhatsApp. Rifallo dopo aver
          cambiato il logo dello studio.
        </p>
        <Button variant="outline" size="sm" onClick={() => void rifaiScheda()} disabled={rifo}>
          {rifo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          Rifai l'anteprima del link
        </Button>
      </div>
    </div>
  );
}

function SchedaOrdini() {
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [carico, setCarico] = useState(true);

  useEffect(() => {
    void (async () => {
      try { setOrdini((await chiedi("/api/crm/prova-codici?azione=ordini")).ordini || []); }
      catch { /* si mostra l'elenco vuoto */ }
      finally { setCarico(false); }
    })();
  }, []);

  const pagati = ordini.filter((o) => o.stato === "pagato");
  const incassato = pagati.reduce((n, o) => n + o.centesimi, 0);

  if (carico) {
    return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Un attimo…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{inEuro(incassato)}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">incassato</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{pagati.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">ordini pagati</p>
        </div>
        {/*  ⚠️ Gli ordini rimasti in attesa si contano a parte: uno o due sono
            normali (la gente cambia idea alla cassa), tanti insieme vogliono
            dire che il pagamento si rompe da qualche parte. */}
        <div>
          <p className="text-2xl font-semibold tabular-nums">{ordini.length - pagati.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">non arrivati in fondo</p>
        </div>
      </div>

      {!ordini.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Receipt className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium">Ancora nessun ordine</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Compaiono qui appena qualcuno compra altre prove.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {ordini.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                o.stato === "pagato" ? "bg-emerald-500/15 text-emerald-600"
                : o.stato === "fallito" ? "bg-destructive/15 text-destructive"
                : "bg-amber-500/15 text-amber-600"}`}>
                {o.stato === "pagato" ? "pagato" : o.stato === "fallito" ? "fallito" : "in attesa"}
              </span>
              <span className="font-mono text-[12px] text-muted-foreground">{o.id}</span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{`${o.nome ?? ""} ${o.cognome ?? ""}`.trim() || "senza nome"}</span>
                <span className="text-muted-foreground"> · {o.telefono || o.email || "—"}</span>
              </span>
              <span className="text-[12px] text-muted-foreground">{o.prove} prove</span>
              <span className="font-semibold tabular-nums">{inEuro(o.centesimi)}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{o.codice}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">{quando(o.quando)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   IL RIEPILOGO IN CIMA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ QUATTRO NUMERI PRIMA DELLE SCHEDE ─────────────────────────────────
 *  Chi apre questa pagina si fa sempre la stessa domanda — «sta funzionando?»
 *  — e con cinque schede da aprire una per volta la risposta non arriva mai.
 *  Quattro numeri in cima la danno in un secondo: quanti codici sono in giro,
 *  quante prove hanno consumato, quanto è entrato, quanti tagli sono in
 *  vetrina. Se uno dei quattro è a zero, si sa già dove andare a guardare.
 *  ⚠️ NIENTE PERCENTUALI E NIENTE FRECCE: non c'è un periodo precedente con
 *   cui confrontarsi, e una freccia verde inventata è peggio di nessuna
 *   freccia — la si guarda, ci si crede, e non vuol dire niente.
 */
function Numero({
  valore, sotto, icona: Icona, tono,
}: {
  valore: string | number;
  sotto: string;
  icona: typeof KeyRound;
  tono?: "denaro" | "attenzione";
}) {
  return (
    <div className="hg-lucido group relative min-w-0 flex-1 overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-muted/40 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        {/*  ⚠️ L'icona in una pastiglia colorata e non nuda: nuda si legge
            come una decorazione della parola, in pastiglia diventa il segno
            che identifica il numero — e su quattro riquadri affiancati è
            l'unica cosa che li distingue a colpo d'occhio. */}
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${
          tono === "denaro" ? "bg-emerald-500/10 text-emerald-600"
            : tono === "attenzione" ? "bg-amber-500/10 text-amber-600"
            : "bg-primary/10 text-primary"
        }`}>
          <Icona className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {sotto}
        </span>
      </div>
      <p className={`mt-2 text-[26px] font-semibold leading-none tabular-nums ${
        tono === "denaro" ? "text-emerald-600" : tono === "attenzione" ? "text-amber-600" : ""
      }`}>
        {valore}
      </p>
    </div>
  );
}

function Riepilogo() {
  const [dati, setDati] = useState<{ codici: Codice[]; ordini: Ordine[]; tagli: number } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        //  ⚠️ Le tre richieste partono INSIEME: in fila sarebbero tre attese
        //   una dopo l'altra su una striscia che deve comparire subito.
        const [c, o, t] = await Promise.all([
          chiedi("/api/crm/prova-codici?azione=elenco").catch(() => ({ codici: [] })),
          chiedi("/api/crm/prova-codici?azione=ordini").catch(() => ({ ordini: [] })),
          fetch("/api/public/prova-capelli?azione=catalogo").then((r) => r.json()).catch(() => ({ tagli: [] })),
        ]);
        setDati({ codici: c.codici || [], ordini: o.ordini || [], tagli: (t.tagli || []).length });
      } catch { /* la striscia resta vuota, le schede funzionano lo stesso */ }
    })();
  }, []);

  if (!dati) return null;
  const vivi = dati.codici.filter((c) => !c.bloccato).length;
  const prove = dati.codici.reduce((n, c) => n + Number(c.usate || 0), 0);
  const incassato = dati.ordini.filter((o) => o.stato === "pagato").reduce((n, o) => n + o.centesimi, 0);
  //  I codici finiti si contano a parte: sono le persone che stanno davanti al
  //  pagamento adesso, cioè l'unica lista da cui esce del fatturato oggi.
  const finiti = dati.codici.filter((c) => !c.admin && !c.bloccato && c.usate >= c.totali).length;

  return (
    <div className="mt-4 flex flex-wrap gap-2.5">
      <Numero valore={vivi} sotto="codici attivi" icona={KeyRound} />
      <Numero valore={prove} sotto="prove fatte" icona={Sparkles} />
      <Numero valore={inEuro(incassato)} sotto="incassato" icona={Receipt} tono="denaro" />
      <Numero valore={dati.tagli} sotto="tagli in vetrina" icona={Scissors} />
      {finiti > 0 && <Numero valore={finiti} sotto="hanno finito le prove" icona={Gift} tono="attenzione" />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

function PaginaProva() {
  /** ── ⚠️ L'ANTEPRIMA DEL LINK SI RIFÀ QUANDO SI APRE QUESTA PAGINA ───────
   *  La scheda che si vede nella chat non cambia da persona a persona: è una
   *  sola per tutti i link della prova capelli, quindi non c'è un momento
   *  ovvio in cui disegnarla — nessuno «crea» quel link, esiste e basta.
   *  Qui è il posto giusto: chi apre questa pagina è chi manda quei codici, e
   *  disegnare costa un decimo di secondo. Se cambia il logo dello studio o il
   *  numero di prove comprese, la prima apertura del CRM rimette in pari
   *  l'immagine senza che nessuno debba ricordarsene.
   *  ⚠️ Solo se manca: ridepositarla a ogni apertura vorrebbe dire caricare un
   *   file da cento kilobyte ogni volta che si guarda un elenco di codici.
   *   Per rifarla a mano basta il tasto qui sotto. */
  useEffect(() => {
    void (async () => {
      //  ⚠️ Il disegno è cambiato? Allora si rifà comunque, anche se il file
      //   c'è: senza questo, migliorare la grafica non servirebbe a niente —
      //   nelle chat resterebbe per sempre la versione depositata la prima
      //   volta. Vedi VERSIONE_SCHEDA.
      let vista = "";
      try { vista = localStorage.getItem("hg_scheda_capelli_v") || ""; } catch { /* pazienza */ }
      const aggiornata = vista === String(VERSIONE_SCHEDA);
      if (aggiornata) {
        try {
          const r = await fetch(`/api/anteprima?tipo=capelli&codice=${CODICE_SCHEDA}`);
          const j = await r.json().catch(() => null);
          if (j?.ok && j?.url) return;
        } catch { /* nel dubbio si disegna */ }
      }
      if (await depositaAnteprimaCapelli()) {
        try { localStorage.setItem("hg_scheda_capelli_v", String(VERSIONE_SCHEDA)); } catch { /* pazienza */ }
      }
    })();
  }, []);

  return (
    <Pagina>
      <Titolo
        icona={Sparkles}
        //  ⚠️ «Anteprima capelli» e non «Prova capelli»: è il nome che il
        //   cliente sente dire in consulenza ed è quello scritto nella barra di
        //   Meetly. Due nomi per la stessa cosa, dentro lo stesso programma,
        //   sono due cose diverse per chi ci lavora.
        testo="Anteprima capelli"
        nota="I codici che mandi su WhatsApp, chi compra altre prove, la vetrina dei tagli e cosa sceglie la gente."
      />
      <Riepilogo />

      <Tabs defaultValue="codici" className="mt-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="codici" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
            <KeyRound className="h-3.5 w-3.5" /> Codici
          </TabsTrigger>
          <TabsTrigger value="ordini" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
            <Receipt className="h-3.5 w-3.5" /> Ordini
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
            <Scissors className="h-3.5 w-3.5" /> Vetrina
          </TabsTrigger>
          <TabsTrigger value="classifica" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Più scelti
          </TabsTrigger>
          <TabsTrigger value="pagamenti" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
            <CreditCard className="h-3.5 w-3.5" /> Pagamenti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="codici" className="mt-4"><SchedaCodici /></TabsContent>
        <TabsContent value="ordini" className="mt-4">
          <Scheda titolo="Ordini" nota="Chi ha comprato altre prove" icona={Receipt}><SchedaOrdini /></Scheda>
        </TabsContent>
        <TabsContent value="catalogo" className="mt-4">
          <Scheda titolo="La vetrina" nota="I tagli che i clienti possono provare" icona={Scissors}>
            <SchedaCatalogo />
          </Scheda>
        </TabsContent>
        <TabsContent value="classifica" className="mt-4">
          <Scheda titolo="I tagli più scelti" nota="Cosa prova davvero la gente" icona={BarChart3}>
            <ClassificaTagli />
          </Scheda>
        </TabsContent>
        <TabsContent value="pagamenti" className="mt-4 space-y-4">
          <Scheda titolo="Contatto WhatsApp" nota="Il tasto che compare sotto al risultato" icona={Receipt}>
            <SchedaContatto />
          </Scheda>
          <Scheda titolo="SumUp" nota="Serve per far comprare altre prove" icona={CreditCard}>
            <ImpostazioniSumUp />
          </Scheda>
        </TabsContent>
      </Tabs>
    </Pagina>
  );
}
