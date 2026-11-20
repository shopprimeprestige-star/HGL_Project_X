/** ── LE VARIANTI DI UN PRODOTTO (EditorVarianti.tsx) ─────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T15 (Design §4.10.4). Le opzioni (Colore, Misura, Lunghezza, Base) con i valori scritti
 *  dal titolare, la tabella delle combinazioni che nasce da sola (`varianti_genera`), il prezzo di ogni riga (vuoto = quello del
 *  prodotto), la giacenza con il motivo, e «Imposta lo stock di tutte le righe». Lo usa `SchedaProdotto`.
 *
 *  ── LE PROPS (le fissa T14, restano così) ───────────────────────────────────
 *   · `prodotto`  `{ id, sku, nome, prezzoCent, pubblicato, versione }`. `prezzoCent` è il prezzo che oggi vale per il prodotto.
 *   · `varianti`  quelle lette con la scheda.   · `esegui` `negozio.esegui` (l'esito lo leggo io).   · `aggiorna` rilegge la scheda.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Al massimo 3 opzioni e 50 combinazioni: i limiti sono scritti, e il tasto resta spento con la frase del perché.
 *  · Una variante NON si cancella: si disattiva (D5). Generare di nuovo non tocca quelle che ci sono già.
 *  · Il prezzo vuoto vale quello del prodotto; il prezzo scritto passa da `centDaEuro` (nessun prezzo barrato, nessuno sconto).
 *  · Su un prodotto pubblicato prezzo, varianti e giacenza si applicano SUBITO (D27): lo dice la riga in cima, e il server rifiuta
 *    un cambio che renderebbe il prodotto non pubblicabile.
 *  · Invisible Derm non ha un prezzo pubblico (D39): la colonna del prezzo non c'è.
 *  · Il campione di colore (la pallina di ogni colore) non si carica da qui: la firma di questo editor non porta i media. */
import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/crm/ui";
import { cn } from "@/lib/utils";
import type { ErroreNegozio } from "@/crm/negozio/client";
import type { OpzioneInput, Variante } from "@/shop/cms/modello";
import {
  LIMITI_VARIANTI,
  anteprimaCombinazioni,
  eInvisibleDerm,
  opzioniDaVarianti,
  prezzoInTesto,
  prezzoVarianteDaTesto,
  quantitaDaTesto,
} from "./scheda-pura";
import type { Negozio } from "./tipi";

export interface PropsEditorVarianti {
  prodotto: {
    id: string;
    sku: string;
    nome: string;
    prezzoCent: number;
    pubblicato: boolean;
    versione: string;
  };
  varianti: Variante[];
  esegui: Negozio["esegui"];
  aggiorna: () => Promise<void>;
}

const NOMI_OPZIONE = ["Colore", "Misura", "Lunghezza", "Base"] as const;
const MOTIVI = [
  { valore: "carico", nome: "Carico (è arrivata merce)" },
  { valore: "rettifica", nome: "Rettifica (ho contato)" },
  { valore: "reso", nome: "Reso (è tornata indietro)" },
] as const;
type Motivo = (typeof MOTIVI)[number]["valore"];
/** Dopo questi errori riprovare con la riga dopo è inutile: l'operazione si ferma. */
const FERMANO = ["sessione", "permesso", "migrazione", "rete"];

const campo =
  "h-11 w-full rounded-md border border-border bg-card px-2.5 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:text-[12.5px]";

type Esito = { tono: "ok" | "errore"; testo: string } | null;
const Messaggio = ({ esito }: { esito: Esito }) =>
  esito ? (
    <p
      role={esito.tono === "errore" ? "alert" : "status"}
      className={cn("text-[12.5px] leading-snug", esito.tono === "errore" ? "text-rose-800" : "text-emerald-800")}
    >
      {esito.testo}
    </p>
  ) : null;

const Etichetta = ({ testo, children }: { testo: string; children: ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-foreground">
    {testo}
    {children}
  </label>
);

/** I valori scritti come «Nero, Biondo» (virgola o a capo) → elenco. */
const valoriDa = (t: string): string[] =>
  t
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function EditorVarianti({ prodotto, varianti, esegui, aggiorna }: PropsEditorVarianti) {
  const senzaPrezzo = eInvisibleDerm(prodotto.nome);
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<Esito>(null);

  /** Una azione alla volta: i tasti restano spenti finché non è finita. */
  const lavora = async (f: () => Promise<Esito>) => {
    if (occupato) return;
    setOccupato(true);
    setEsito(null);
    try {
      const e = await f();
      setEsito(e);
    } finally {
      setOccupato(false);
    }
  };
  const errore = (e: ErroreNegozio): Esito => ({ tono: "errore", testo: e.messaggio });

  /* ── le opzioni ── */
  const [opzioni, setOpzioni] = useState<{ nome: string; valori: string }[]>(() => {
    const o = opzioniDaVarianti(varianti).map((x) => ({ nome: x.nome, valori: x.valori.join(", ") }));
    return o.length ? o : [{ nome: "Colore", valori: "" }];
  });
  const scritte: OpzioneInput[] = opzioni.map((o) => ({ nome: o.nome, valori: valoriDa(o.valori) }));
  const anteprima = anteprimaCombinazioni(prodotto.sku, scritte, varianti);
  const cambiaOpzione = (k: number, p: Partial<{ nome: string; valori: string }>) =>
    setOpzioni((o) => o.map((x, i) => (i === k ? { ...x, ...p } : x)));

  const genera = () =>
    lavora(async () => {
      const r = await esegui("varianti_genera", { prodottoId: prodotto.id, opzioni: scritte });
      if (!r.ok) return errore(r.errore);
      await aggiorna();
      const n = Array.isArray(r.dati.create) ? r.dati.create.length : 0;
      return { tono: "ok", testo: n === 1 ? "Ho creato 1 variante nuova." : `Ho creato ${n} varianti nuove.` };
    });

  const aggiungiUnica = () =>
    lavora(async () => {
      const r = await esegui("variante_salva", { prodottoId: prodotto.id, variante: { sku: prodotto.sku, nome: "Unica", opzioni: {} } });
      if (!r.ok) return errore(r.errore);
      await aggiorna();
      return { tono: "ok", testo: "Ho aggiunto la variante unica: ora scrivi prezzo e giacenza." };
    });

  /* ── lo stock di tutte le righe ── */
  const [stockTutte, setStockTutte] = useState("");
  const [motivoTutte, setMotivoTutte] = useState<Motivo>("rettifica");
  const q = quantitaDaTesto(stockTutte);
  const impostaTutte = () =>
    lavora(async () => {
      if (!q.ok) return { tono: "errore", testo: "Scrivi i pezzi come numero intero, da 0 in su." };
      const fuori: string[] = [];
      let fatte = 0;
      let fermo: string | null = null;
      for (const v of varianti) {
        if (fermo) {
          fuori.push(`${v.nome}: non l'ho provata, l'operazione si è fermata prima`);
          continue;
        }
        const r = await esegui("giacenza_imposta", { varianteId: v.id, valore: q.n, motivo: motivoTutte });
        if (r.ok) fatte++;
        else {
          fuori.push(`${v.nome}: ${r.errore.messaggio}`);
          if (FERMANO.includes(r.errore.tipo)) fermo = r.errore.messaggio;
        }
      }
      await aggiorna();
      return fuori.length
        ? { tono: "errore", testo: `Fatto per ${fatte} righe su ${varianti.length}. Rimaste fuori: ${fuori.join(" · ")}.` }
        : { tono: "ok", testo: `Giacenza impostata a ${q.n} su tutte le ${fatte} righe.` };
    });

  const prezzoProdotto = prezzoInTesto(prodotto.prezzoCent);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        Al massimo {LIMITI_VARIANTI.opzioni} opzioni e {LIMITI_VARIANTI.combinazioni} combinazioni. Le varianti non si cancellano: si
        disattivano.
        {prodotto.pubblicato && <strong className="font-semibold text-foreground"> Il prodotto è sul sito: ogni cambio qui si applica subito.</strong>}
      </p>

      {/* ── Le opzioni ── */}
      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <legend className="px-1 text-[12.5px] font-semibold">Opzioni</legend>
        <datalist id="nomi-opzione">
          {NOMI_OPZIONE.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {opzioni.map((o, k) => (
          <div key={k} className="grid grid-cols-[1fr_auto] items-end gap-2 md:grid-cols-[12rem_1fr_auto]">
            <Etichetta testo={`Opzione ${k + 1}`}>
              <input
                list="nomi-opzione"
                value={o.nome}
                maxLength={40}
                onChange={(e) => cambiaOpzione(k, { nome: e.target.value })}
                placeholder="Colore, Misura…"
                className={campo}
              />
            </Etichetta>
            <button
              type="button"
              aria-label={`Togli l'opzione ${o.nome || k + 1}`}
              disabled={opzioni.length === 1}
              onClick={() => setOpzioni((x) => x.filter((_, i) => i !== k))}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 md:order-3 md:h-9 md:w-9"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="col-span-2 md:order-2 md:col-span-1">
              <Etichetta testo="Valori, separati da una virgola">
                <input
                  value={o.valori}
                  onChange={(e) => cambiaOpzione(k, { valori: e.target.value })}
                  placeholder="Nero, Biondo, Castano"
                  className={campo}
                />
              </Etichetta>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 text-[13px] md:h-8 md:text-[12px]"
            disabled={opzioni.length >= LIMITI_VARIANTI.opzioni}
            onClick={() => setOpzioni((o) => [...o, { nome: "", valori: "" }])}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Aggiungi un'opzione
          </Button>
          <p className="text-[12px] text-muted-foreground" aria-live="polite">
            {anteprima.ok
              ? `${anteprima.totale} combinazioni: ${anteprima.esistenti} ci sono già, ${anteprima.nuove} ${anteprima.nuove === 1 ? "nuova" : "nuove"}.`
              : anteprima.frase}
          </p>
        </div>
        <div>
          <Button
            type="button"
            className="h-11 text-[13px] md:h-8 md:text-[12px]"
            disabled={occupato || !anteprima.ok || anteprima.nuove === 0}
            onClick={() => void genera()}
          >
            {anteprima.ok && anteprima.nuove > 0 ? `Crea ${anteprima.nuove} ${anteprima.nuove === 1 ? "variante" : "varianti"}` : "Crea le varianti"}
          </Button>
        </div>
      </fieldset>

      <Messaggio esito={esito} />

      {/* ── Le righe ── */}
      {varianti.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-[12.5px]">Non c'è ancora nessuna variante. Per pubblicare ne serve almeno una attiva.</p>
          <Button type="button" variant="outline" className="h-11 text-[13px] md:h-8 md:text-[12px]" disabled={occupato} onClick={() => void aggiungiUnica()}>
            Il prodotto non ha opzioni: aggiungi la variante unica
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 md:flex-row md:items-end">
            <Etichetta testo="Imposta lo stock di tutte le righe">
              <input
                inputMode="numeric"
                value={stockTutte}
                onChange={(e) => setStockTutte(e.target.value)}
                placeholder="Pezzi"
                className={cn(campo, "md:w-28")}
              />
            </Etichetta>
            <Etichetta testo="Motivo">
              <select value={motivoTutte} onChange={(e) => setMotivoTutte(e.target.value as Motivo)} className={cn(campo, "md:w-56")}>
                {MOTIVI.map((m) => (
                  <option key={m.valore} value={m.valore}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Etichetta>
            <Button type="button" variant="outline" className="h-11 text-[13px] md:h-9 md:text-[12px]" disabled={occupato || stockTutte.trim() === ""} onClick={() => void impostaTutte()}>
              Imposta su tutte
            </Button>
          </div>
          <ul className="flex flex-col gap-3">
            {varianti.map((v) => (
              <RigaVariante
                key={v.id}
                v={v}
                prodotto={prodotto}
                senzaPrezzo={senzaPrezzo}
                prezzoProdotto={prezzoProdotto}
                esegui={esegui}
                aggiorna={aggiorna}
                bloccata={occupato}
              />
            ))}
          </ul>
        </>
      )}
      <p className="text-[12px] text-muted-foreground">
        Il campione di colore (la pallina di ogni colore) non si carica da qui.
      </p>
    </div>
  );
}

/* ══ UNA RIGA ═══════════════════════════════════════════════════════════════ */

function RigaVariante({
  v,
  prodotto,
  senzaPrezzo,
  prezzoProdotto,
  esegui,
  aggiorna,
  bloccata,
}: {
  v: Variante;
  prodotto: PropsEditorVarianti["prodotto"];
  senzaPrezzo: boolean;
  prezzoProdotto: string;
  esegui: Negozio["esegui"];
  aggiorna: () => Promise<void>;
  bloccata: boolean;
}) {
  const [nome, setNome] = useState(v.nome);
  const [sku, setSku] = useState(v.sku);
  const [prezzo, setPrezzo] = useState(prezzoInTesto(v.prezzoCent ?? 0));
  const [peso, setPeso] = useState(v.pesoG === null ? "" : String(v.pesoG));
  const [stock, setStock] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("rettifica");
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<Esito>(null);

  const p = prezzoVarianteDaTesto(prezzo);
  const pesoOk = peso.trim() === "" || /^\d{1,7}$/.test(peso.trim());
  const prezzoSalvato = prezzoInTesto(v.prezzoCent ?? 0);
  const sporca =
    nome.trim() !== v.nome ||
    sku.trim() !== v.sku ||
    (!senzaPrezzo && prezzo.trim() !== prezzoSalvato) ||
    peso.trim() !== (v.pesoG === null ? "" : String(v.pesoG));
  const q = quantitaDaTesto(stock);

  const esegueRiga = async (f: () => Promise<Esito>) => {
    if (lavoro || bloccata) return;
    setLavoro(true);
    setEsito(null);
    try {
      setEsito(await f());
    } finally {
      setLavoro(false);
    }
  };
  const salva = () =>
    esegueRiga(async () => {
      if (!nome.trim()) return { tono: "errore", testo: "Scrivi il nome della variante." };
      if (!p.ok) return { tono: "errore", testo: "Scrivi il prezzo in euro, per esempio 19,90, oppure lascialo vuoto." };
      if (!pesoOk) return { tono: "errore", testo: "Il peso è un numero intero di grammi." };
      const campi: Record<string, unknown> = { id: v.id };
      if (nome.trim() !== v.nome) campi.nome = nome.trim();
      if (sku.trim() !== v.sku) campi.sku = sku.trim();
      if (!senzaPrezzo && prezzo.trim() !== prezzoSalvato) campi.prezzoCent = p.cent;
      if (peso.trim() !== (v.pesoG === null ? "" : String(v.pesoG))) campi.pesoG = peso.trim() === "" ? null : Number(peso.trim());
      const r = await esegui("variante_salva", { prodottoId: prodotto.id, variante: campi });
      if (!r.ok) return { tono: "errore", testo: r.errore.messaggio };
      await aggiorna();
      return { tono: "ok", testo: prodotto.pubblicato ? "Salvata: si vede già sul sito." : "Salvata." };
    });
  const attiva = (valore: boolean) =>
    esegueRiga(async () => {
      const r = await esegui("variante_attiva", { prodottoId: prodotto.id, varianteId: v.id, attiva: valore });
      if (!r.ok) return { tono: "errore", testo: r.errore.messaggio };
      await aggiorna();
      return { tono: "ok", testo: valore ? "Variante attiva." : "Variante disattivata: non si vende." };
    });
  const impostaStock = () =>
    esegueRiga(async () => {
      if (!q.ok) return { tono: "errore", testo: "Scrivi i pezzi come numero intero, da 0 in su." };
      const r = await esegui("giacenza_imposta", { varianteId: v.id, valore: q.n, motivo });
      if (!r.ok) return { tono: "errore", testo: r.errore.messaggio };
      await aggiorna();
      setStock("");
      return { tono: "ok", testo: `Giacenza: ${q.n}.` };
    });

  const spento = lavoro || bloccata;
  return (
    <li className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-3", !v.attiva && "opacity-80")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-semibold">{v.nome}</p>
          <Chip tono={!v.attiva ? "neutro" : v.giacenza > 0 ? "vinta" : "in_sospeso"}>
            {!v.attiva ? "Disattivata" : v.giacenza > 0 ? `${v.giacenza} pezzi` : "Esaurita"}
          </Chip>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[12.5px] md:min-h-9">
          <Switch checked={v.attiva} disabled={spento} onCheckedChange={(x) => void attiva(x)} aria-label={`Variante ${v.nome} attiva`} />
          Attiva
        </label>
      </div>
      <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", senzaPrezzo ? "md:grid-cols-3" : "md:grid-cols-4")}>
        <Etichetta testo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className={campo} />
        </Etichetta>
        <Etichetta testo="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} maxLength={40} className={campo} autoCapitalize="characters" />
        </Etichetta>
        {!senzaPrezzo && (
          <Etichetta testo="Prezzo in euro">
            <input
              inputMode="decimal"
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value)}
              placeholder={prezzoProdotto ? `${prezzoProdotto} (come il prodotto)` : "come il prodotto"}
              aria-invalid={!p.ok}
              className={cn(campo, !p.ok && "border-rose-400")}
            />
          </Etichetta>
        )}
        <Etichetta testo="Peso in grammi">
          <input inputMode="numeric" value={peso} onChange={(e) => setPeso(e.target.value)} aria-invalid={!pesoOk} className={cn(campo, !pesoOk && "border-rose-400")} />
        </Etichetta>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" className="h-11 text-[13px] md:h-9 md:text-[12px]" disabled={spento || !sporca} onClick={() => void salva()}>
          {prodotto.pubblicato ? "Applica subito" : "Salva la riga"}
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-3 md:flex-row md:items-end">
        <Etichetta testo={`Giacenza (ora ${v.giacenza})`}>
          <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Nuovo numero di pezzi" className={cn(campo, "md:w-44")} />
        </Etichetta>
        <Etichetta testo="Motivo">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)} className={cn(campo, "md:w-56")}>
            {MOTIVI.map((m) => (
              <option key={m.valore} value={m.valore}>
                {m.nome}
              </option>
            ))}
          </select>
        </Etichetta>
        <Button type="button" variant="outline" className="h-11 text-[13px] md:h-9 md:text-[12px]" disabled={spento || stock.trim() === ""} onClick={() => void impostaStock()}>
          Imposta
        </Button>
      </div>
      <Messaggio esito={esito} />
    </li>
  );
}
